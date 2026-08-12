import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FolderOpen,
  FileText,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  Trash2,
  FileSpreadsheet,
  Zap,
  Info,
  Check,
  Clock,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "firebase/auth";
import { enqueueContractProcessing, AuxiliaryDriveFile, mergeExtractedContractData, callAnalyzeContractWithRetryAndBackoff, processBatchInSubBatches } from "../lib/queueService";
import { db, sanitizeFirestoreData } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

interface LocalBatchFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  folderPath: string;
  category: "contrato" | "ddc";
  contractNumber: string;
  base64Data?: string;
  status: "pending" | "processing" | "done" | "error";
  resultSummary?: string;
}

interface LocalBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onComplete: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function LocalBatchModal({
  isOpen,
  onClose,
  user,
  onComplete,
  showToast
}: LocalBatchModalProps) {
  const [filesList, setFilesList] = useState<LocalBatchFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<"select" | "preview" | "queueing" | "completed">("select");
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [enqueuedCount, setEnqueuedCount] = useState(0);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("pt-BR");
    setImportLogs(prev => [...prev, `[${time}] ${msg}`]);
    setTimeout(() => {
      if (logTerminalRef.current) {
        logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
      }
    }, 50);
  };

  // Helper to extract contract number from file or folder name
  const extractContractNumber = (filename: string): string => {
    const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/^CPR_|^CCB_|^CONTRATO_/, "");
    const match = cleanName.match(/(C?\d{5,12}[-\d]*)/i);
    if (match) return match[1].toUpperCase();
    return cleanName.substring(0, 20).toUpperCase();
  };

  // Helper to classify file as Main Contract or Auxiliary DDC
  const classifyFile = (file: File): "contrato" | "ddc" => {
    const relativePath = (file as any).webkitRelativePath || file.name;
    const pathUpper = relativePath.toUpperCase();

    const ddcKeywords = ["DDC", "DEMONSTRATIVO", "FICHA", "EXTRATO", "MEMORIA", "EVOLUCAO", "ANEXO"];
    const isDdc = ddcKeywords.some(kw => pathUpper.includes(kw));

    return isDdc ? "ddc" : "contrato";
  };

  const handleFilesAdded = (files: FileList | File[]) => {
    const newItems: LocalBatchFileItem[] = [];

    Array.from(files).forEach((file, index) => {
      // Ignore hidden or non-document files if needed
      if (file.name.startsWith(".")) return;

      const folderPath = (file as any).webkitRelativePath
        ? (file as any).webkitRelativePath.substring(0, (file as any).webkitRelativePath.lastIndexOf("/"))
        : "";

      const category = classifyFile(file);
      const contractNumber = extractContractNumber(file.name);

      newItems.push({
        id: `file_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/pdf",
        folderPath,
        category,
        contractNumber,
        status: "pending"
      });
    });

    if (newItems.length > 0) {
      setFilesList(prev => [...prev, ...newItems]);
      setCurrentStep("preview");
      showToast(`${newItems.length} arquivo(s) carregado(s) e classificados.`, "success");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const toggleCategory = (id: string) => {
    setFilesList(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, category: item.category === "contrato" ? "ddc" : "contrato" }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setFilesList(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setFilesList([]);
    setCurrentStep("select");
    setImportLogs([]);
    setEnqueuedCount(0);
  };

  // Helper to read file to Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper function to process a single contract file directly with Gemini Flash 3.6
  const processSingleBatchContract = async (contractItem: LocalBatchFileItem) => {
    // 1. Update UI status to 'processing'
    setFilesList(prev =>
      prev.map(f =>
        f.id === contractItem.id
          ? { ...f, status: "processing", resultSummary: "Analisando com IA (Gemini)..." }
          : f
      )
    );
    addLog(`🔍 Analisando contrato "${contractItem.contractNumber}" (${contractItem.name})...`);

    try {
      // 2. Find linked DDCs
      const auxDdcs = filesList.filter(f => f.category === "ddc");
      const linkedDdcs = auxDdcs.filter(aux => {
        const numClean = contractItem.contractNumber.replace(/[^0-9]/g, "");
        const auxNameUpper = aux.name.toUpperCase();
        if (numClean && numClean.length >= 5) {
          return auxNameUpper.includes(contractItem.contractNumber) || auxNameUpper.includes(numClean);
        }
        return true;
      });

      // 3. Read base64 from file in memory
      addLog(`📄 Lendo arquivo local "${contractItem.name}"...`);
      const mainBase64 = await readFileAsBase64(contractItem.file);

      // 4. Send directly to /api/analyze-contract with automatic retry on 429 Rate Limit and exponential backoff
      addLog(`🤖 Executando extração OCR/IA via Gemini Flash 3.6...`);
      
      let extractedContract: any = null;
      try {
        extractedContract = await callAnalyzeContractWithRetryAndBackoff({
          fileData: mainBase64,
          mimeType: contractItem.type || "application/pdf",
          fileName: contractItem.name,
          maxRetries: 4,
          initialBackoffMs: 3500,
          timeoutMs: 180000,
          onLog: addLog
        });
      } catch (err: any) {
        throw new Error(err?.message || "Falha na resposta da API de Análise.");
      }

      addLog(`✨ Dados extraídos com sucesso para o contrato "${contractItem.contractNumber}"!`);

      // 5. If linked DDCs exist, analyze and merge them
      let finalExtractedContract = extractedContract;
      const associatedDocsList: any[] = [];
      for (const aux of linkedDdcs) {
        addLog(`📎 Lendo e analisando DDC vinculado "${aux.name}"...`);
        try {
          const auxBase64 = await readFileAsBase64(aux.file);
          const auxExtracted = await callAnalyzeContractWithRetryAndBackoff({
            fileData: auxBase64,
            mimeType: aux.type || "application/pdf",
            fileName: aux.name,
            maxRetries: 3,
            initialBackoffMs: 3000,
            onLog: addLog
          });
          finalExtractedContract = mergeExtractedContractData(finalExtractedContract, auxExtracted);
          addLog(`✨ DDC "${aux.name}" analisado e integrado ao contrato.`);

          associatedDocsList.push({
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: aux.name,
            fileName: aux.name,
            type: aux.type || "application/pdf",
            mimeType: aux.type || "application/pdf",
            category: "ddc",
            notes: "DDC carregado em lote e integrado",
            createdAt: new Date().toISOString()
          });
        } catch (auxErr: any) {
          addLog(`⚠️ Aviso na análise do DDC "${aux.name}": ${auxErr.message}`);
        }
      }

      // 6. Save complete simulation in Firestore
      const finalEmitente = finalExtractedContract.emitente || "Emitente Padrão";
      const finalNumero = finalExtractedContract.numero || contractItem.contractNumber;
      const simId = `${user?.uid || "user"}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const simulationDoc = {
        id: simId,
        name: `Contrato CPR ${finalNumero} - ${finalEmitente}`,
        processingStatus: "concluido",
        contractData: finalExtractedContract,
        contrato: finalExtractedContract,
        associatedDocuments: associatedDocsList,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user?.uid || "anonymous",
        createdByName: user?.displayName || "Analista",
        createdByEmail: user?.email || "analista@agro.com",
        auditLogs: [
          {
            timestamp: new Date().toISOString(),
            action: "ia_analise_concluida",
            userName: user?.displayName || "Analista",
            details: `Contrato CPR N.º ${finalNumero} analisado com sucesso via Gemini Flash 3.6.`
          }
        ]
      };

      if (db) {
        await setDoc(doc(db, "simulations", simId), sanitizeFirestoreData(simulationDoc), { merge: true });
        
        // Registrar item concluído na fila_processamento para histórico auditável
        await setDoc(doc(db, "fila_processamento", `task_${simId}`), {
          id: `task_${simId}`,
          simulationId: simId,
          contractNumber: finalNumero,
          status: "concluido",
          currentStep: "Concluído",
          fileName: contractItem.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attempts: 1
        }, { merge: true });
      }

      // 7. Update UI status to 'done'
      setFilesList(prev =>
        prev.map(f =>
          f.id === contractItem.id
            ? { ...f, status: "done", resultSummary: "Salvo e analisado com sucesso!" }
            : f
        )
      );
      addLog(`🎉 [CONCLUÍDO] Contrato "${finalNumero}" salvo no banco com sucesso!`);

      // Update main dashboard view
      onComplete();
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      addLog(`❌ [Erro] Falha ao processar contrato "${contractItem.contractNumber}": ${errorMsg}`);

      // Update UI status to 'error'
      setFilesList(prev =>
        prev.map(f =>
          f.id === contractItem.id
            ? { ...f, status: "error", resultSummary: errorMsg }
            : f
        )
      );

      // Save error status stub in Firestore so user can inspect or retry
      if (db) {
        const errSimId = `${user?.uid || "user"}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await setDoc(doc(db, "simulations", errSimId), {
          id: errSimId,
          name: `Contrato CPR ${contractItem.contractNumber} - (Erro: ${errorMsg.substring(0, 30)})`,
          processingStatus: "erro",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: user?.uid || "anonymous"
        }, { merge: true });

        await setDoc(doc(db, "fila_processamento", `task_${errSimId}`), {
          id: `task_${errSimId}`,
          simulationId: errSimId,
          contractNumber: contractItem.contractNumber,
          status: "erro",
          currentStep: "Erro",
          errorMessage: errorMsg,
          fileName: contractItem.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attempts: 1
        }, { merge: true });
      }

      return false;
    }
  };

  // Main Action: Process all contracts in sub-batches of 1 with exponential backoff and throttling
  const startBatchEnqueueing = async () => {
    const mainContracts = filesList.filter(f => f.category === "contrato");

    if (mainContracts.length === 0) {
      showToast("Nenhum contrato principal identificado. Selecione ao menos um arquivo de contrato.", "error");
      return;
    }

    setIsProcessing(true);
    setCurrentStep("queueing");
    setImportLogs([]);
    addLog(`🚀 Iniciando processamento em sub-lotes de ${mainContracts.length} contrato(s)...`);

    const { successCount, errorCount } = await processBatchInSubBatches(
      mainContracts,
      async (contractItem, index) => {
        addLog(`--------------------------------------------------`);
        addLog(`📌 [${index + 1}/${mainContracts.length}] Processando contrato: ${contractItem.contractNumber}`);
        return await processSingleBatchContract(contractItem);
      },
      {
        subBatchSize: 1, // Processa 1 por vez para máxima segurança da cota Gemini QPS
        delayBetweenItemsMs: 2500, // Pausa estratégica de 2,5s entre arquivos do lote
        delayBetweenSubBatchesMs: 3000,
        onProgress: (processed) => {
          setEnqueuedCount(processed);
        }
      }
    );

    addLog(`--------------------------------------------------`);
    addLog(`🏆 Lote finalizado: ${successCount} concluído(s), ${errorCount} com erro.`);

    setIsProcessing(false);
    setCurrentStep("completed");

    if (errorCount === 0) {
      showToast(`Todos os ${successCount} contrato(s) foram processados e salvos com sucesso!`, "success");
    } else {
      showToast(`${successCount} contrato(s) salvos e ${errorCount} com erro. Você pode tentar novamente os falhos.`, "info");
    }

    onComplete();
  };

  // Retry processing a single contract that previously failed
  const retrySingleContract = async (contractItem: LocalBatchFileItem) => {
    setIsProcessing(true);
    addLog(`🔄 Reprocessando contrato "${contractItem.contractNumber}"...`);
    await processSingleBatchContract(contractItem);
    setIsProcessing(false);
  };

  const mainContractsCount = filesList.filter(f => f.category === "contrato").length;
  const auxDdcsCount = filesList.filter(f => f.category === "ddc").length;
  const totalSizeMb = (filesList.reduce((acc, curr) => acc + curr.size, 0) / (1024 * 1024)).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Importação em Lote do Computador Local</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold rounded border border-emerald-500/40">
                  100% Rápido & Sem Limites
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Selecione pastas completas ou múltiplos arquivos. Os contratos são cadastrados instantaneamente na fila.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50">
          {/* STEP 1: SELECT FILES OR FOLDER */}
          {currentStep === "select" && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 rounded-2xl p-8 text-center transition-all cursor-pointer group shadow-xs space-y-4"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">
                    Arraste sua Pasta ou Selecione Múltiplos Arquivos
                  </h4>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto">
                    Suporta arquivos PDF ou Imagens de CPRs, CCBs e DDCs. O sistema classifica automaticamente o que é contrato principal e o que é demonstrativo.
                  </p>
                </div>

                {/* Dual Buttons: Folder vs File selection */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  {/* Folder Selection Input (webkitdirectory) */}
                  <input
                    type="file"
                    ref={folderInputRef}
                    onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                    {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4 text-emerald-200" />
                    <span>Selecionar Pasta Completa / Subpastas</span>
                  </button>

                  {/* Multiple Files Selection Input */}
                  <input
                    type="file"
                    ref={filesInputRef}
                    onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.txt"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => filesInputRef.current?.click()}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-slate-300" />
                    <span>Selecionar Vários Arquivos (Ctrl+A)</span>
                  </button>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-center gap-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Leitura Local Instantânea
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sem limites do Google Drive
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Fila em Segundo Plano
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & CLASSIFICATION */}
          {(currentStep === "preview" || currentStep === "queueing" || currentStep === "completed") && (
            <div className="space-y-6">
              {/* Summary Stats Header Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
                      {filesList.length}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Total de Arquivos</div>
                      <div className="text-[11px] text-slate-500">{totalSizeMb} MB acumulados</div>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <div>
                        <span className="font-bold text-emerald-900">{mainContractsCount}</span>
                        <span className="text-emerald-700 ml-1 font-medium">Contratos Principais</span>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-700" />
                      <div>
                        <span className="font-bold text-amber-900">{auxDdcsCount}</span>
                        <span className="text-amber-700 ml-1 font-medium">Demonstrativos (DDC)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentStep === "preview" && (
                    <>
                      <button
                        onClick={clearAll}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Limpar</span>
                      </button>

                      <button
                        onClick={startBatchEnqueueing}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Iniciar Agendamento na Fila ({mainContractsCount} Contratos)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Log Terminal during Queueing or Completion */}
              {(currentStep === "queueing" || currentStep === "completed") && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200 shadow-xl space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-sans font-bold text-slate-400">
                    <span className="flex items-center gap-2 text-emerald-400">
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Log de Agendamento da Fila no Firestore
                    </span>
                    <span>{enqueuedCount} de {mainContractsCount} Agendados</span>
                  </div>

                  <div
                    ref={logTerminalRef}
                    className="h-40 overflow-y-auto space-y-1 text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-700"
                  >
                    {importLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Table / List */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>Arquivos Selecionados e Classificação</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Clique no badge para alterar entre "Contrato Principal" e "DDC"
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {filesList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                            item.category === "contrato"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {item.category === "contrato" ? <FileText className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({(item.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {item.folderPath && <span>Pasta: {item.folderPath}</span>}
                            <span>• N° Contrato Detectado: <strong className="text-slate-700">{item.contractNumber}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                        {/* Toggle Category Badge Button */}
                        <button
                          type="button"
                          onClick={() => toggleCategory(item.id)}
                          disabled={isProcessing}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border shadow-2xs flex items-center gap-1.5 ${
                            item.category === "contrato"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                              : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                          }`}
                        >
                          <span>{item.category === "contrato" ? "📜 Contrato Principal" : "📎 Documento DDC"}</span>
                          <span className="text-[10px] opacity-60">(Alterar)</span>
                        </button>

                        {/* Status badge & Retry actions */}
                        {item.status === "processing" && (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-[11px] rounded-lg border border-blue-200 flex items-center gap-1.5 animate-pulse">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                            <span>Analisando com IA...</span>
                          </span>
                        )}

                        {item.status === "done" && (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Concluído</span>
                          </span>
                        )}

                        {item.status === "error" && (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-[11px] rounded-lg border border-rose-200 flex items-center gap-1" title={item.resultSummary}>
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Erro</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => retrySingleContract(item)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Tentar Novamente</span>
                            </button>
                          </div>
                        )}

                        {/* Remove item button */}
                        {currentStep === "preview" && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Remover arquivo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600" />
            <span>Fila processada com isolamento e resiliência via Firestore + Gemini Flash 3.6 AI</span>
          </div>

          <div className="flex items-center gap-3">
            {currentStep === "completed" ? (
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Concluir e Acompanhar Fila no Painel</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
