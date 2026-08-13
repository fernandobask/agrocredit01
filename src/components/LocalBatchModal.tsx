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
  ArrowRight,
  Search,
  CheckSquare,
  Square,
  Filter,
  Database,
  Maximize2,
  Minimize2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User } from "firebase/auth";
import { enqueueContractProcessing, AuxiliaryDriveFile, mergeExtractedContractData, callAnalyzeContractWithRetryAndBackoff, processBatchInSubBatches } from "../lib/queueService";
import { db, sanitizeFirestoreData } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

export type UniversalDocCategory = "contrato" | "ddc" | "aditivo" | "garantia" | "laudo" | "outro";

interface LocalBatchFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  folderPath: string;
  category: UniversalDocCategory;
  contractNumber: string;
  assignedContractId?: string; // ID do contrato pai atribuído manualmente
  base64Data?: string;
  status: "pending" | "processing" | "done" | "error";
  resultSummary?: string;
  selected: boolean; // Marcação individual de seleção
  isDuplicateInBatch?: boolean; // Flag de duplicidade no próprio lote
  isDuplicateInDb?: boolean; // Flag de duplicidade com contratos do banco de dados
  duplicateReason?: string;
}

interface LocalBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onComplete: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
  existingSimulations?: any[];
}

export function LocalBatchModal({
  isOpen,
  onClose,
  user,
  onComplete,
  showToast,
  existingSimulations = []
}: LocalBatchModalProps) {
  const [filesList, setFilesList] = useState<LocalBatchFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<"select" | "preview" | "queueing" | "completed">("select");
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [enqueuedCount, setEnqueuedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

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

  // Helper to classify file into Universal Document Taxonomy
  const classifyFile = (file: File): UniversalDocCategory => {
    const relativePath = (file as any).webkitRelativePath || file.name;
    const pathUpper = relativePath.toUpperCase();

    // Special check for Consolidation / Summary spreadsheets like "RESUMO GERAL JULINERE.xlsx"
    if (["RESUMO", "CONSOLIDADO", "SINTESE", "RELATORIO_GERAL"].some(kw => pathUpper.includes(kw))) {
      return "outro";
    }

    if (["DDC", "DEMONSTRATIVO", "FICHA", "EXTRATO", "MEMORIA", "EVOLUCAO", "DEBITO", "CREDITO"].some(kw => pathUpper.includes(kw))) {
      return "ddc";
    }
    if (["ADITIVO", "REPACTUACAO", "PRORROGACAO", "ALTERACAO", "TERMO"].some(kw => pathUpper.includes(kw))) {
      return "aditivo";
    }
    if (["MATRICULA", "GARANTIA", "PENHOR", "HIPOTECA", "CERTIDAO"].some(kw => pathUpper.includes(kw))) {
      return "garantia";
    }
    if (["LAUDO", "FRUSTRACAO", "PROAGRO", "VISTORIA", "PERICIA"].some(kw => pathUpper.includes(kw))) {
      return "laudo";
    }
    if (["CPR", "CCB", "CONTRATO", "CEDULA", "NOTA"].some(kw => pathUpper.includes(kw))) {
      return "contrato";
    }
    return "contrato";
  };

  // Helper to get linked auxiliary documents for a main contract
  const findLinkedAuxiliaryDocs = (contractItem: LocalBatchFileItem, allFiles: LocalBatchFileItem[]): LocalBatchFileItem[] => {
    const mainContracts = allFiles.filter(f => f.category === "contrato");
    const auxFiles = allFiles.filter(f => f.category !== "contrato");

    return auxFiles.filter(aux => {
      // 1. Manual assignment priority
      if (aux.assignedContractId) {
        return aux.assignedContractId === contractItem.id;
      }

      // 2. Exact contract number or signature match
      const cNumUpper = contractItem.contractNumber.toUpperCase();
      const auxNameUpper = aux.name.toUpperCase();
      const auxPathUpper = (aux.folderPath + "/" + aux.name).toUpperCase();

      if (cNumUpper && cNumUpper.length >= 4 && auxPathUpper.includes(cNumUpper)) {
        return true;
      }

      // 3. Clean digits signature match (e.g. C30528645-1 -> 305286451)
      const cDigits = contractItem.contractNumber.replace(/[^0-9]/g, "");
      const auxDigits = auxNameUpper.replace(/[^0-9]/g, "");
      if (cDigits.length >= 4 && auxDigits.includes(cDigits)) {
        return true;
      }

      // 4. Index prefix match (e.g. "01 - Contrato..." <-> "01 - DDC..." or "1 - ...")
      const cIndexMatch = contractItem.name.match(/^(\d{1,3})[\s-_]/);
      const auxIndexMatch = aux.name.match(/^(\d{1,3})[\s-_]/);
      if (cIndexMatch && auxIndexMatch && cIndexMatch[1] === auxIndexMatch[1]) {
        return true;
      }

      // 5. Parent / Grandparent Folder Match (e.g., CADORE JULINERE/1 Contratos vs CADORE JULINERE/2 DDC)
      const getParentFolder = (path: string) => {
        const parts = path.split("/").filter(Boolean);
        return parts.length > 1 ? parts[parts.length - 2] : parts[0] || "";
      };
      const cParent = getParentFolder(contractItem.folderPath);
      const auxParent = getParentFolder(aux.folderPath);
      if (cParent && auxParent && cParent.toUpperCase() === auxParent.toUpperCase()) {
        const contractsInSameParent = mainContracts.filter(c => getParentFolder(c.folderPath).toUpperCase() === cParent.toUpperCase());
        if (contractsInSameParent.length === 1) {
          return true;
        }
      }

      // 6. Same direct folder match
      if (contractItem.folderPath && aux.folderPath && contractItem.folderPath === aux.folderPath) {
        return true;
      }

      // 7. Fallback: if there is only 1 main contract in the batch, all aux docs attach to it
      if (mainContracts.length === 1) {
        return true;
      }

      return false;
    });
  };

  // Helper to compute duplicate status for all items in filesList
  const computeDuplicationFlags = (items: LocalBatchFileItem[]): LocalBatchFileItem[] => {
    const dbContractNumbers = existingSimulations
      .map(s => {
        const c = s.contractData || s.contrato;
        return (c?.numero || s.name || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
      })
      .filter(n => n.length >= 4);

    return items.map((item, idx) => {
      const cleanNum = item.contractNumber.replace(/[^A-Z0-9]/g, "");
      const isContract = item.category === "contrato";

      let isDuplicateInBatch = false;
      let isDuplicateInDb = false;
      let duplicateReason = "";

      if (isContract && cleanNum.length >= 4) {
        // Check duplicate within the batch (another file with same contract number)
        const duplicateInBatchIndex = items.findIndex(
          (other, oIdx) => oIdx !== idx && other.category === "contrato" && other.contractNumber.replace(/[^A-Z0-9]/g, "") === cleanNum
        );

        if (duplicateInBatchIndex !== -1) {
          isDuplicateInBatch = true;
          duplicateReason = `Duplicado no lote (mesmo contrato do arquivo #${duplicateInBatchIndex + 1})`;
        }

        // Check duplicate with existing database contracts
        if (dbContractNumbers.some(dbNum => dbNum.includes(cleanNum) || cleanNum.includes(dbNum))) {
          isDuplicateInDb = true;
          duplicateReason = duplicateReason 
            ? `${duplicateReason} + Já cadastrado no banco de dados` 
            : `Contrato Nº ${item.contractNumber} já está cadastrado no sistema`;
        }
      }

      return {
        ...item,
        isDuplicateInBatch,
        isDuplicateInDb,
        duplicateReason,
        // Auto-unselect if it's a new duplicate to prevent accidental re-import
        selected: (isDuplicateInBatch || isDuplicateInDb) ? false : item.selected
      };
    });
  };

  const handleFilesAdded = (files: FileList | File[]) => {
    const newItems: LocalBatchFileItem[] = [];

    Array.from(files).forEach((file, index) => {
      if (file.name.startsWith(".")) return;

      const folderPath = (file as any).webkitRelativePath
        ? (file as any).webkitRelativePath.substring(0, (file as any).webkitRelativePath.lastIndexOf("/"))
        : "";

      const category = classifyFile(file);
      const contractNumber = extractContractNumber(file.name);
      const isSummarySpreadsheet = ["RESUMO", "CONSOLIDADO", "SINTESE"].some(kw => file.name.toUpperCase().includes(kw));

      newItems.push({
        id: `file_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || "application/pdf",
        folderPath,
        category,
        contractNumber,
        status: "pending",
        selected: !isSummarySpreadsheet && category === "contrato"
      });
    });

    if (newItems.length > 0) {
      setFilesList(prev => {
        const combined = [...prev, ...newItems];
        return computeDuplicationFlags(combined);
      });
      setCurrentStep("preview");
      showToast(`${newItems.length} arquivo(s) carregado(s) e validados contra duplicidade.`, "success");
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

  const toggleSelectItem = (id: string) => {
    setFilesList(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, selected: !item.selected }
          : item
      )
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setFilesList(prev =>
      prev.map(item => ({ ...item, selected: select }))
    );
  };

  const updateItemCategory = (id: string, category: UniversalDocCategory) => {
    setFilesList(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              category,
              selected: category === "contrato" ? true : item.selected // Auto-select if changed to contract
            }
          : item
      )
    );
  };

  const assignAuxToContract = (auxId: string, targetContractId: string) => {
    setFilesList(prev =>
      prev.map(item =>
        item.id === auxId
          ? { ...item, assignedContractId: targetContractId }
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

  // Helper function to process a single contract file directly with Gemini 2.5 Flash
  const processSingleBatchContract = async (contractItem: LocalBatchFileItem) => {
    setFilesList(prev =>
      prev.map(f =>
        f.id === contractItem.id
          ? { ...f, status: "processing", resultSummary: "Analisando com IA (Gemini)..." }
          : f
      )
    );
    addLog(`🔍 Analisando contrato "${contractItem.contractNumber}" (${contractItem.name})...`);

    try {
      // Find linked auxiliary documents using the Graph Linker
      const linkedAuxDocs = findLinkedAuxiliaryDocs(contractItem, filesList);
      addLog(`📎 [Grafo] ${linkedAuxDocs.length} documento(s) auxiliar(es) vinculado(s) ao contrato ${contractItem.contractNumber}.`);

      // Read base64 from file in memory
      addLog(`📄 Lendo arquivo local "${contractItem.name}"...`);
      const mainBase64 = await readFileAsBase64(contractItem.file);

      // Send directly to /api/analyze-contract
      addLog(`🤖 Executando extração OCR/IA via Gemini 2.5 Flash...`);
      
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

      // Analyze and merge all linked auxiliary documents (DDC, Aditivo, Garantia, Laudo, etc.)
      let finalExtractedContract = extractedContract;
      const associatedDocsList: any[] = [];
      for (const aux of linkedAuxDocs) {
        addLog(`📎 Lendo e analisando [${aux.category.toUpperCase()}] "${aux.name}"...`);
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
          addLog(`✨ Documento "${aux.name}" (${aux.category.toUpperCase()}) integrado ao contrato.`);

          associatedDocsList.push({
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: aux.name,
            fileName: aux.name,
            type: aux.type || "application/pdf",
            mimeType: aux.type || "application/pdf",
            fileData: auxBase64, // Preserva o PDF Base64 para download/visualização no painel
            category: aux.category,
            notes: `Documento [${aux.category.toUpperCase()}] atrelado via Grafo em Lote`,
            createdAt: new Date().toISOString()
          });
        } catch (auxErr: any) {
          addLog(`⚠️ Aviso na análise do documento "${aux.name}": ${auxErr.message}`);
          // Mesmo com erro de extração parcial, preservamos o anexo PDF
          try {
            const auxBase64 = await readFileAsBase64(aux.file);
            associatedDocsList.push({
              id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: aux.name,
              fileName: aux.name,
              type: aux.type || "application/pdf",
              mimeType: aux.type || "application/pdf",
              fileData: auxBase64,
              category: aux.category,
              notes: `Anexo [${aux.category.toUpperCase()}] preservado`,
              createdAt: new Date().toISOString()
            });
          } catch (e) {}
        }
      }

      // 6. Save complete simulation in Firestore
      const finalContractData = {
        numero: finalExtractedContract?.numero || contractItem.contractNumber,
        modalidade: finalExtractedContract?.modalidade || "Cédula de Produto Rural (CPR)",
        emitente: finalExtractedContract?.emitente || "Emitente Não Identificado",
        credor: finalExtractedContract?.credor || "",
        dataEmissao: finalExtractedContract?.dataEmissao || new Date().toISOString().split("T")[0],
        dataVencimento: finalExtractedContract?.dataVencimento || new Date().toISOString().split("T")[0],
        valorPrincipal: Number(finalExtractedContract?.valorPrincipal) || Number(finalExtractedContract?.valorEmissao) || 0,
        taxaJurosAnual: Number(finalExtractedContract?.taxaJurosAnual) || 0,
        indexadorOriginal: finalExtractedContract?.indexador || finalExtractedContract?.indexadorOriginal || "CDI",
        produto: finalExtractedContract?.produto || "",
        quantidade: finalExtractedContract?.quantidade || "",
        valorEmissao: Number(finalExtractedContract?.valorEmissao) || Number(finalExtractedContract?.valorPrincipal) || 0,
        cronogramaParcelas: Array.isArray(finalExtractedContract?.cronogramaParcelas) ? finalExtractedContract.cronogramaParcelas : []
      };

      const finalEmitente = finalContractData.emitente;
      const finalNumero = finalContractData.numero;
      const cleanNum = (finalNumero || "").replace(/[^A-Z0-9]/g, "").toUpperCase();

      // Check if this contract number is already in the database
      const existingSim = existingSimulations.find(s => {
        const c = s.contractData || s.contrato;
        const sNum = (c?.numero || s.name || "").toString().replace(/[^A-Z0-9]/g, "").toUpperCase();
        return sNum.length >= 4 && (sNum === cleanNum || cleanNum.includes(sNum) || sNum.includes(cleanNum));
      });

      const simId = existingSim ? existingSim.id : `${user?.uid || "user"}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const currentVersion = existingSim ? (existingSim.version || 1) + 1 : 1;

      // Merge existing associated documents with new batch docs so no attachments are lost
      const mergedDocsMap = new Map<string, any>();
      if (existingSim?.associatedDocuments && Array.isArray(existingSim.associatedDocuments)) {
        for (const docItem of existingSim.associatedDocuments) {
          mergedDocsMap.set(docItem.id || docItem.name, docItem);
        }
      }
      for (const docItem of associatedDocsList) {
        mergedDocsMap.set(docItem.id || docItem.name, docItem);
      }
      const finalAssociatedDocs = Array.from(mergedDocsMap.values());

      const existingHistory = existingSim?.history || [];
      const newHistoryEntry = existingSim ? {
        version: existingSim.version || 1,
        contractData: existingSim.contractData || existingSim.contrato,
        updatedAt: existingSim.updatedAt || existingSim.createdAt || new Date().toISOString(),
        changeSummary: "Atualização de contrato e reprocessamento de anexos em lote"
      } : null;

      const updatedHistory = newHistoryEntry ? [...existingHistory, newHistoryEntry] : existingHistory;

      const simulationDoc = {
        id: simId,
        name: `Contrato CPR ${finalNumero} - ${finalEmitente}`,
        processingStatus: "concluido",
        contractData: finalContractData,
        contrato: finalContractData,
        scenariosData: existingSim?.scenariosData || existingSim?.cenarios || [],
        cenarios: existingSim?.scenariosData || existingSim?.cenarios || [],
        associatedDocuments: finalAssociatedDocs,
        createdAt: existingSim?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user?.uid || "anonymous",
        createdByName: user?.displayName || user?.email || "Fernando Gomes Santos",
        createdByEmail: user?.email || "fernandobask@gmail.com",
        version: currentVersion,
        history: updatedHistory,
        auditLogs: [
          ...(existingSim?.auditLogs || []),
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: existingSim ? `Nova Versão Criada (v${currentVersion})` : "ia_analise_concluida",
            userName: user?.displayName || user?.email || "Fernando Gomes Santos",
            details: existingSim 
              ? `Contrato N.º ${finalNumero} atualizado para a versão v${currentVersion} via reprocessamento em lote.` 
              : `Contrato CPR N.º ${finalNumero} analisado com sucesso via Gemini 2.5 Flash.`
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

  // Main Action: Process selected contracts in sub-batches of 1 with exponential backoff and throttling
  const startBatchEnqueueing = async (retryOnlyErrors = false) => {
    let targetContracts = filesList.filter(f => f.category === "contrato" && f.selected);

    if (retryOnlyErrors) {
      targetContracts = filesList.filter(f => f.category === "contrato" && f.selected && f.status === "error");
    }

    if (targetContracts.length === 0) {
      showToast(
        retryOnlyErrors 
          ? "Nenhum contrato marcado com erro para reprocessar." 
          : "Nenhum contrato principal selecionado. Marque a caixa de seleção dos contratos que deseja importar.", 
        "error"
      );
      return;
    }

    setIsProcessing(true);
    setCurrentStep("queueing");
    setImportLogs([]);
    addLog(`🚀 Iniciando processamento em sub-lotes de ${targetContracts.length} contrato(s) selecionado(s)...`);
    addLog(`💾 Salvamento atômico ativado: Cada contrato concluído é gravado instantaneamente no banco de dados.`);

    const { successCount, errorCount } = await processBatchInSubBatches(
      targetContracts,
      async (contractItem, index) => {
        addLog(`--------------------------------------------------`);
        addLog(`📌 [${index + 1}/${targetContracts.length}] Processando contrato: ${contractItem.contractNumber}`);
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
      showToast(`Todos os ${successCount} contrato(s) selecionados foram processados e salvos com sucesso!`, "success");
    } else {
      showToast(`${successCount} contrato(s) salvos e ${errorCount} com erro. Você pode clicar em "Reprocessar Falhas" para tentar novamente.`, "info");
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

  const deselectAllDuplicates = () => {
    setFilesList(prev =>
      prev.map(item => (item.isDuplicateInBatch || item.isDuplicateInDb) ? { ...item, selected: false } : item)
    );
    showToast("Contratos duplicados foram desmarcados.", "info");
  };

  const duplicatesCount = filesList.filter(f => f.category === "contrato" && (f.isDuplicateInBatch || f.isDuplicateInDb)).length;
  const mainContractsCount = filesList.filter(f => f.category === "contrato").length;
  const selectedContractsCount = filesList.filter(f => f.category === "contrato" && f.selected).length;
  const auxDdcsCount = filesList.filter(f => f.category !== "contrato").length;
  const erroredContractsCount = filesList.filter(f => f.category === "contrato" && f.status === "error").length;
  const totalSizeMb = (filesList.reduce((acc, curr) => acc + curr.size, 0) / (1024 * 1024)).toFixed(2);

  const filteredContracts = filesList.filter(f => 
    f.category === "contrato" && 
    (searchQuery.trim() === "" || 
     f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     f.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
     f.folderPath.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={`bg-slate-50 border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800 transition-all duration-200 ${
          isMaximized
            ? "fixed inset-0 w-full h-full rounded-none max-w-none max-h-none h-full"
            : "w-[96vw] max-w-7xl h-[88vh] max-h-[920px] rounded-2xl"
        }`}
      >
        {/* Modal Header */}
        <div className="bg-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center border border-emerald-300 shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-slate-900">Importação em Lote Widescreen HD</h3>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-md border border-emerald-300">
                  ⚡ Conexão Direta Gemini 2.5
                </span>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold text-xs rounded-md border border-blue-300 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-blue-700" />
                  Salvamento Atômico Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione quais contratos deseja processar via caixa de seleção. Cada contrato finalizado é salvo **instantaneamente** no banco de dados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title={isMaximized ? "Restaurar tamanho da janela" : "Maximizar janela"}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50">
          {/* STEP 1: SELECT FILES OR FOLDER */}
          {currentStep === "select" && (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 rounded-2xl p-10 text-center transition-all cursor-pointer group shadow-xs space-y-4"
              >
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-slate-800">
                    Arraste sua Pasta Completa ou Selecione Múltiplos Arquivos
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xl mx-auto">
                    Suporta PDFs de CPRs/CCBs, Aditivos, DDCs, Fichas e Planilhas Excel (.xlsx). O sistema separa automaticamente contratos e resumos.
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
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
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
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => filesInputRef.current?.click()}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-slate-300" />
                    <span>Selecionar Vários Arquivos (Ctrl+A)</span>
                  </button>
                </div>

                <div className="pt-3 text-[11px] text-slate-400 flex items-center justify-center gap-6 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Leitura Local Instantânea
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" /> Salvamento Atômico no Banco
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Isola erros por arquivo
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & CLASSIFICATION */}
          {(currentStep === "preview" || currentStep === "queueing" || currentStep === "completed") && (
            <div className="space-y-4">
              {/* Summary Stats Header Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 font-bold border border-emerald-200 text-sm">
                      {filesList.length}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Total no Lote</div>
                      <div className="text-[11px] text-slate-500">{totalSizeMb} MB acumulados</div>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <div className="bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-700" />
                      <div>
                        <span className="font-bold text-emerald-900">{selectedContractsCount} de {mainContractsCount}</span>
                        <span className="text-emerald-700 ml-1 font-medium">Contratos Selecionados</span>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-700" />
                      <div>
                        <span className="font-bold text-amber-900">{auxDdcsCount}</span>
                        <span className="text-amber-700 ml-1 font-medium">Anexos/DDCs</span>
                      </div>
                    </div>

                    {erroredContractsCount > 0 && (
                      <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <div>
                          <span className="font-bold text-rose-900">{erroredContractsCount}</span>
                          <span className="text-rose-700 ml-1 font-medium">Com Erro</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                        onClick={() => startBatchEnqueueing(false)}
                        disabled={selectedContractsCount === 0}
                        className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Iniciar Processamento ({selectedContractsCount} Selecionados)</span>
                      </button>
                    </>
                  )}

                  {currentStep === "completed" && erroredContractsCount > 0 && (
                    <button
                      onClick={() => startBatchEnqueueing(true)}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reprocessar Apenas com Erro ({erroredContractsCount})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Log Terminal during Queueing or Completion */}
              {(currentStep === "queueing" || currentStep === "completed") && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-200 shadow-xl space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-sans font-bold text-slate-400">
                    <span className="flex items-center gap-2 text-emerald-400">
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Log de Gravação Atômica em Tempo Real (Firestore)
                    </span>
                    <span>{enqueuedCount} de {selectedContractsCount} Processados</span>
                  </div>

                  <div
                    ref={logTerminalRef}
                    className="h-36 overflow-y-auto space-y-1 text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-700"
                  >
                    {importLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplication Warning Banner if duplicates found */}
              {duplicatesCount > 0 && (
                <div className="bg-amber-50 border border-amber-300/90 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-extrabold text-sm">{duplicatesCount} contrato(s) duplicado(s) detectado(s)!</span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Identificamos arquivos repetidos no lote ou já salvos previamente no seu banco de dados. Eles foram desmarcados por segurança.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={deselectAllDuplicates}
                    className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 text-amber-200" />
                    <span>Desmarcar Duplicados</span>
                  </button>
                </div>
              )}

              {/* Filter, Search & Bulk Selection Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por número, nome ou pasta..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto justify-end">
                  <span className="text-slate-600 font-semibold mr-1">Seleção de Envio:</span>
                  <button
                    onClick={() => toggleSelectAll(true)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-xs border border-emerald-200 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Marcar Todos</span>
                  </button>
                  <button
                    onClick={() => toggleSelectAll(false)}
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs border border-slate-200 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                    <span>Desmarcar Todos</span>
                  </button>
                </div>
              </div>

              {/* Files Table / Relational Graph Tree */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-0 divide-y divide-slate-100">
                <div className="p-3.5 bg-slate-100 border-b border-slate-200 font-bold text-xs sm:text-sm text-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4.5 h-4.5 text-emerald-700" />
                    <span>Mapeamento do Dossiê ({filteredContracts.length} Contratos Principais Exibidos)</span>
                  </div>
                  <span className="text-xs text-slate-500 font-normal">
                    Marque ou desmarque a caixa de seleção para escolher o que será enviado para extração
                  </span>
                </div>

                <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-200 p-2 space-y-3">
                  {filteredContracts.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm space-y-2">
                      <div>⚠️ Nenhum contrato principal encontrado para a busca.</div>
                      <div className="text-xs text-slate-500">
                        Ajuste o termo da busca ou converta anexos abaixo para "Contrato Principal".
                      </div>
                    </div>
                  ) : (
                    filteredContracts.map((contractItem) => {
                      const linkedAuxDocs = findLinkedAuxiliaryDocs(contractItem, filesList);

                      return (
                        <div
                          key={contractItem.id}
                          className={`border rounded-xl overflow-hidden transition shadow-2xs ${
                            contractItem.selected
                              ? "bg-white border-emerald-300 ring-1 ring-emerald-200"
                              : "bg-slate-50/70 border-slate-200 opacity-75"
                          }`}
                        >
                          {/* Main Contract Header Row with Checkbox */}
                          <div className={`p-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            contractItem.selected ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-100/60 border-slate-200"
                          }`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Selection Checkbox */}
                              <input
                                type="checkbox"
                                checked={contractItem.selected}
                                onChange={() => toggleSelectItem(contractItem.id)}
                                disabled={isProcessing}
                                className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                                title="Marque para definir se este contrato será enviado"
                              />

                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs shadow-xs ${
                                contractItem.selected ? "bg-emerald-700 text-white" : "bg-slate-400 text-white"
                              }`}>
                                <FileText className="w-5 h-5" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-bold truncate ${contractItem.selected ? "text-slate-900" : "text-slate-500 line-through"}`}>
                                    {contractItem.name}
                                  </span>

                                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md border border-emerald-200">
                                    📜 Contrato N.º {contractItem.contractNumber}
                                  </span>

                                  {contractItem.isDuplicateInBatch && (
                                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-md flex items-center gap-1 shadow-2xs" title={contractItem.duplicateReason}>
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                                      ⚠️ Duplicado no Lote
                                    </span>
                                  )}

                                  {contractItem.isDuplicateInDb && (
                                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 text-xs font-bold rounded-md flex items-center gap-1 shadow-2xs" title={contractItem.duplicateReason}>
                                      <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                                      ⚠️ Já Cadastrado no Banco
                                    </span>
                                  )}

                                  {!contractItem.selected && (
                                    <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-md">
                                      Ignorado
                                    </span>
                                  )}

                                  <span className="text-xs font-mono text-slate-500">
                                    ({(contractItem.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>

                                {contractItem.folderPath && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    📁 Pasta: {contractItem.folderPath}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                              {/* Category Switcher Dropdown */}
                              <select
                                value={contractItem.category}
                                onChange={(e) => updateItemCategory(contractItem.id, e.target.value as UniversalDocCategory)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 bg-white text-slate-800 border border-slate-300 rounded-lg text-xs sm:text-sm font-bold shadow-2xs focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                              >
                                <option value="contrato">📜 Contrato Principal</option>
                                <option value="ddc">📎 DDC / Demonstrativo</option>
                                <option value="aditivo">📝 Aditivo de Prorrogação</option>
                                <option value="garantia">🛡️ Garantia / Matrícula</option>
                                <option value="laudo">🔬 Laudo Pericial</option>
                                <option value="outro">📊 Planilha Resumo / Outro</option>
                              </select>

                              {/* Status Badges */}
                              {contractItem.status === "processing" && (
                                <span className="px-3 py-1.5 bg-blue-50 text-blue-800 font-bold text-xs rounded-lg border border-blue-200 flex items-center gap-1.5 animate-pulse">
                                  <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                                  <span>Analisando...</span>
                                </span>
                              )}

                              {contractItem.status === "done" && (
                                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Salvo no Banco</span>
                                </span>
                              )}

                              {contractItem.status === "error" && (
                                <div className="flex items-center gap-2">
                                  <span className="px-3 py-1.5 bg-rose-100 text-rose-800 font-bold text-xs rounded-lg border border-rose-200 flex items-center gap-1" title={contractItem.resultSummary}>
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Erro</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => retrySingleContract(contractItem)}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Tentar</span>
                                  </button>
                                </div>
                              )}

                              {currentStep === "preview" && (
                                <button
                                  onClick={() => removeItem(contractItem.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Remover Contrato"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Tree Branch: Linked Auxiliary Documents */}
                          <div className="bg-slate-50/50 p-3 space-y-2 border-t border-slate-100">
                            <div className="text-[11px] font-bold text-slate-500 flex items-center gap-2 pl-2">
                              <ChevronRight className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Documentos Auxiliares Anexados ao Contrato ({linkedAuxDocs.length})</span>
                            </div>

                            {linkedAuxDocs.length === 0 ? (
                              <div className="pl-6 text-[11px] text-slate-400 italic">
                                Nenhum anexo (DDC, Aditivo, Garantia) vinculado a este contrato.
                              </div>
                            ) : (
                              <div className="space-y-1.5 pl-4">
                                {linkedAuxDocs.map((aux) => (
                                  <div
                                    key={aux.id}
                                    className="p-2 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-emerald-50/30 transition text-xs"
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-emerald-600 font-mono font-bold">└──</span>
                                      <span className="text-slate-800 font-medium truncate">{aux.name}</span>
                                      <span className="text-[10px] text-slate-400">({(aux.size / 1024).toFixed(1)} KB)</span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Category Dropdown Selector */}
                                      <select
                                        value={aux.category}
                                        onChange={(e) => updateItemCategory(aux.id, e.target.value as UniversalDocCategory)}
                                        disabled={isProcessing}
                                        className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-300 rounded text-[11px] font-semibold cursor-pointer"
                                      >
                                        <option value="ddc">📎 DDC / Demonstrativo</option>
                                        <option value="aditivo">📝 Aditivo de Prorrogação</option>
                                        <option value="garantia">🛡️ Garantia / Matrícula</option>
                                        <option value="laudo">🔬 Laudo Pericial</option>
                                        <option value="outro">📊 Planilha Resumo / Outro</option>
                                        <option value="contrato">📜 Converter em Contrato Principal</option>
                                      </select>

                                      {/* Reassign to Parent Contract Dropdown */}
                                      {filesList.filter(f => f.category === "contrato").length > 1 && (
                                        <select
                                          value={aux.assignedContractId || contractItem.id}
                                          onChange={(e) => assignAuxToContract(aux.id, e.target.value)}
                                          disabled={isProcessing}
                                          className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[11px] font-semibold cursor-pointer max-w-[140px] truncate"
                                        >
                                          {filesList.filter(f => f.category === "contrato").map(c => (
                                            <option key={c.id} value={c.id}>
                                              Vincular a: {c.contractNumber}
                                            </option>
                                          ))}
                                        </select>
                                      )}

                                      {currentStep === "preview" && (
                                        <button
                                          onClick={() => removeItem(aux.id)}
                                          className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                          title="Remover anexo"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Arquivos concluídos são salvos no Firestore de forma independente. Falhas de rede não perdem os itens anteriores.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {currentStep === "completed" ? (
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Concluir e Ver Contratos Atualizados no Painel</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer disabled:opacity-50"
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
