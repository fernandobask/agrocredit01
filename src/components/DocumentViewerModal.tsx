import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Download, 
  ExternalLink, 
  Printer, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  FileText, 
  Info,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Building2,
  User,
  Calendar,
  DollarSign,
  Percent,
  ShieldCheck,
  RefreshCw,
  UploadCloud,
  Eye,
  Check
} from "lucide-react";
import { AssociatedDocument } from "../types";
import { getDocumentFile, saveDocumentFile } from "../utils/documentStorage";

interface DocumentViewerModalProps {
  document: (AssociatedDocument & { contratoData?: any }) | null;
  contratoNumero?: string;
  onClose: () => void;
  onAnalyzeWithAI?: (doc: AssociatedDocument) => void;
  isAnalyzing?: boolean;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document: docItem,
  contratoNumero,
  onClose,
  onAnalyzeWithAI,
  isAnalyzing = false
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showValidationPanel, setShowValidationPanel] = useState<boolean>(true);
  const [activeFileData, setActiveFileData] = useState<string | null>(docItem?.fileData || null);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleDirectFileUpload = (file: File) => {
    if (!docItem) return;
    setLoadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      
      // Save locally in IndexedDB for persistent viewing
      saveDocumentFile(docItem.id, base64);
      setActiveFileData(base64);
      docItem.fileData = base64;
      setLoadingFile(false);
    };
    reader.onerror = () => {
      setLoadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  // Attempt to load fileData from IndexedDB if docItem.fileData is missing
  useEffect(() => {
    let isMounted = true;
    if (!docItem) {
      setActiveFileData(null);
      setBlobUrl(null);
      return;
    }

    if (docItem.fileData) {
      setActiveFileData(docItem.fileData);
    } else {
      setLoadingFile(true);
      getDocumentFile(docItem.id)
        .then((savedBase64) => {
          if (isMounted) {
            if (savedBase64) {
              setActiveFileData(savedBase64);
            } else {
              setActiveFileData(null);
            }
          }
        })
        .catch(() => {
          if (isMounted) setActiveFileData(null);
        })
        .finally(() => {
          if (isMounted) setLoadingFile(false);
        });
    }

    return () => { isMounted = false; };
  }, [docItem]);

  const isPdf = Boolean(
    docItem?.mimeType?.includes("pdf") || 
    docItem?.fileName?.toLowerCase().endsWith(".pdf") || 
    (activeFileData && activeFileData.includes("JVBERi")) ||
    docItem?.type?.toLowerCase().includes("cédula") ||
    docItem?.type?.toLowerCase().includes("contrato")
  );

  const isImage = Boolean(
    docItem?.mimeType?.includes("image") || 
    /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(docItem?.fileName || "")
  );

  // Convert Base64 into a Blob URL
  useEffect(() => {
    if (!activeFileData) {
      setBlobUrl(null);
      return;
    }

    try {
      let cleanBase64 = activeFileData;
      if (cleanBase64.includes(";base64,")) {
        cleanBase64 = cleanBase64.split(";base64,")[1];
      }
      cleanBase64 = cleanBase64.replace(/\s/g, "");

      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const mime = docItem?.mimeType || (isPdf ? "application/pdf" : isImage ? "image/jpeg" : "application/pdf");
      const blob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("Erro ao converter documento em Blob URL:", err);
      setBlobUrl(null);
    }
  }, [activeFileData, isPdf, isImage, docItem?.mimeType]);

  if (!docItem) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    if (!blobUrl && !activeFileData) return;
    const downloadUrl = blobUrl || `data:${docItem.mimeType || "application/pdf"};base64,${activeFileData}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = docItem.fileName || `${docItem.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    } else if (activeFileData) {
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${docItem.name}</title>
              <style>
                body { margin: 0; background-color: #0f172a; color: white; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                img, embed, object { max-width: 100%; max-height: 100vh; }
              </style>
            </head>
            <body>
              ${isPdf 
                ? `<embed src="data:application/pdf;base64,${activeFileData.replace(/^data:[^;]+;base64,/, '')}" type="application/pdf" width="100%" height="100vh" />`
                : `<img src="data:${docItem.mimeType || 'image/jpeg'};base64,${activeFileData.replace(/^data:[^;]+;base64,/, '')}" alt="${docItem.name}" />`
              }
            </body>
          </html>
        `);
      }
    }
  };

  const handlePrint = () => {
    if (blobUrl) {
      const printWindow = window.open(blobUrl, "_blank");
      if (printWindow) {
        setTimeout(() => printWindow.print(), 500);
      }
    } else {
      window.print();
    }
  };

  const contratoData = docItem.contratoData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 md:p-4 animate-fadeIn">
      <div className={`bg-slate-50 border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800 transition-all duration-200 ${
        isFullscreen ? "w-full h-full rounded-none border-none" : "w-full max-w-7xl h-[94vh] rounded-2xl"
      }`}>
        {/* Top Navigation Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate max-w-xs md:max-w-md">
                  {docItem.name}
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-bold text-xs uppercase tracking-wider">
                  {docItem.type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 mt-0.5 flex-wrap">
                {(contratoNumero || contratoData?.numero) && (
                  <span className="font-mono text-slate-900 font-bold">Contrato: {contratoNumero || contratoData?.numero}</span>
                )}
                <span>Arquivo: {docItem.fileName || "documento_original.pdf"}</span>
                {docItem.uploadDate && (
                  <span>Data: {new Date(docItem.uploadDate).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Controls toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Upload/Replace Original PDF Button */}
            <input
              type="file"
              ref={uploadInputRef}
              onChange={(e) => e.target.files?.[0] && handleDirectFileUpload(e.target.files[0])}
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
            />
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Anexar ou Substituir o arquivo PDF / Foto original deste contrato"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">{blobUrl ? "Substituir PDF" : "Anexar PDF Original"}</span>
            </button>

            {blobUrl && (
              <button
                onClick={() => setShowValidationPanel(!showValidationPanel)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  showValidationPanel
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
                    : "bg-slate-800 text-slate-300 border-slate-700"
                }`}
                title="Alternar Painel Lateral de Conferência e Validação de Dados"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Conferir Dados Lado a Lado</span>
              </button>
            )}

            {onAnalyzeWithAI && (
              <button
                onClick={() => onAnalyzeWithAI(docItem)}
                disabled={isAnalyzing}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                title="Analisar e extrair dados deste documento usando Gemini IA"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                <span>{isAnalyzing ? "Analisando..." : "Analisar com IA"}</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-800 my-auto mx-1" />

            {blobUrl && (
              <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/80 text-slate-300">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition cursor-pointer"
                  title="Reduzir Zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-2 font-bold">{zoom}%</span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition cursor-pointer"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition cursor-pointer border-l border-slate-700 ml-1 pl-1.5"
                  title="Rotacionar 90º"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            {blobUrl && (
              <>
                <button
                  onClick={handleDownload}
                  className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                  title="Baixar Arquivo Original"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={handleOpenNewTab}
                  className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
                  title="Abrir em Nova Aba sem Bloqueio"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={handlePrint}
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
              title="Imprimir Documento"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-lg transition cursor-pointer ml-2"
              title="Fechar Visualizador"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Document Content Canvas */}
        <div className="flex-1 bg-slate-950 p-2 md:p-4 overflow-hidden relative flex flex-col">
          {loadingFile ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-slate-300">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-bold">Carregando arquivo do documento...</p>
            </div>
          ) : blobUrl ? (
            <div className="flex-1 w-full h-full flex flex-col lg:flex-row gap-4 overflow-hidden">
              {/* Document Render Canvas */}
              <div className="flex-1 h-full min-h-0 flex items-center justify-center overflow-hidden bg-slate-900/60 rounded-xl border border-slate-800 p-2 relative">
                {isPdf ? (
                  <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                    <object
                      data={`${blobUrl}#toolbar=1&navpanes=0&view=FitH`}
                      type="application/pdf"
                      className="w-full h-full rounded-xl border border-slate-800 bg-white shadow-2xl transition-transform duration-200"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transformOrigin: "center center"
                      }}
                    >
                      <iframe
                        src={`${blobUrl}#toolbar=1&navpanes=0&view=FitH`}
                        className="w-full h-full rounded-xl border-none"
                        title={docItem.name}
                      >
                        <div className="p-6 text-center text-slate-300">
                          <p>O navegador não suporta a pré-visualização inline de PDF.</p>
                          <button onClick={handleDownload} className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer">
                            Baixar PDF
                          </button>
                        </div>
                      </iframe>
                    </object>
                  </div>
                ) : isImage ? (
                  <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                    <img
                      src={blobUrl}
                      alt={docItem.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-200"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transformOrigin: "center center"
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md text-slate-300 space-y-4">
                    <FileText className="w-12 h-12 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-base text-white">{docItem.name}</h4>
                    <p className="text-xs text-slate-400">
                      Formato de arquivo registrado e pronto para exportação.
                    </p>
                    <div className="flex justify-center gap-3 pt-2">
                      <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" /> Baixar Arquivo
                      </button>
                      <button
                        onClick={handleOpenNewTab}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs transition flex items-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" /> Abrir em Nova Aba
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Side-by-Side Validation Panel */}
              {showValidationPanel && (
                <div className="w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-4 overflow-y-auto shrink-0 text-slate-200 text-xs">
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-emerald-400 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Conferência de Dados (PDF vs IA)</span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/30">
                        Visualização Lado a Lado
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Compare o documento original ao lado e valide se os dados extraídos pelo sistema conferem integralmente:
                    </p>

                    <div className="space-y-2.5">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-emerald-400" /> Número da Cédula / Contrato
                        </span>
                        <div className="font-mono font-bold text-slate-100 text-sm flex items-center justify-between">
                          <span>{contratoNumero || contratoData?.numero || "N/A"}</span>
                          <Check className="w-4 h-4 text-emerald-400" />
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-400" /> Devedor / Emitente
                        </span>
                        <div className="font-bold text-slate-100 flex items-center justify-between">
                          <span className="truncate">{contratoData?.emitente || docItem.name || "Produtor Rural"}</span>
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-emerald-400" /> Instituição Financeira / Credor
                        </span>
                        <div className="font-bold text-slate-100 flex items-center justify-between">
                          <span className="truncate">{contratoData?.credor || "Banco / Cooperativa"}</span>
                          <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Valor Principal</span>
                          <div className="font-mono font-bold text-emerald-400 text-xs">
                            {contratoData?.valorPrincipal ? `R$ ${contratoData.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "N/I"}
                          </div>
                        </div>

                        <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Taxa Pactuada</span>
                          <div className="font-bold text-slate-200 text-xs">
                            {contratoData?.taxaJurosAnual ? `${contratoData.taxaJurosAnual}% a.a.` : "N/I"}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-400" /> Vencimento Final do Título
                        </span>
                        <div className="font-mono font-bold text-slate-200 text-xs">
                          {contratoData?.dataVencimento ? new Date(contratoData.dataVencimento).toLocaleDateString("pt-BR") : "N/I"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <button
                      onClick={() => setShowValidationPanel(false)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmado & Validado</span>
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Os dados conferem com a cópia física oficial do documento.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Digital Structured Document View + Interactive Upload Zone */
            <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-full border border-slate-200">
              
              {/* Drag & Drop / Upload Box for Original PDF */}
              <div
                onClick={() => uploadInputRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleDirectFileUpload(e.dataTransfer.files[0]);
                }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 rounded-2xl p-6 text-center transition cursor-pointer group space-y-2"
              >
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200 group-hover:scale-110 transition-transform shadow-xs">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Clique aqui ou Arraste o Arquivo PDF / Foto Original deste Contrato
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Anexe a imagem ou PDF escaneado da Cédula de Crédito para abrir a pré-visualização inline e conferir os dados lado a lado.
                  </p>
                </div>
                <span className="inline-block px-3 py-1 bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-2xs">
                  Selecionar Arquivo PDF Original
                </span>
              </div>
              
              {/* Header Badge & Title */}
              <div className="border-b-2 border-emerald-600 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200">
                      Cédula / Documento Digital Auditável
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase border border-slate-200">
                      {docItem.type || "Contrato de Crédito"}
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2">
                    {docItem.name}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Registro de Contrato Nº <strong className="text-slate-800 font-mono font-bold">{contratoNumero || contratoData?.numero || "S/N"}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onAnalyzeWithAI && (
                    <button
                      onClick={() => onAnalyzeWithAI(docItem)}
                      disabled={isAnalyzing}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <Sparkles className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                      <span>{isAnalyzing ? "Analisando..." : "Extrair via IA"}</span>
                    </button>
                  )}
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              {/* Main Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-600" /> Devedor / Emitente
                  </span>
                  <p className="font-bold text-slate-900 text-sm truncate">{contratoData?.emitente || "Produtor Rural S/N"}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Instituição Credora
                  </span>
                  <p className="font-bold text-slate-900 text-sm truncate">{contratoData?.credor || "Instituição Financeira S/N"}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Valor Principal Emitido
                  </span>
                  <p className="font-mono font-bold text-emerald-700 text-base">
                    {contratoData?.valorPrincipal ? `R$ ${contratoData.valorPrincipal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "Não Informado"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" /> Taxa de Juros & Indexador
                  </span>
                  <p className="font-bold text-slate-800">
                    {contratoData?.taxaJurosAnual ? `${contratoData.taxaJurosAnual}% a.a.` : "Não Informada"} + {contratoData?.indexadorOriginal || "INPC"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Data de Emissão
                  </span>
                  <p className="font-bold text-slate-800">
                    {contratoData?.dataEmissao ? new Date(contratoData.dataEmissao).toLocaleDateString("pt-BR") : "Não Informada"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Vencimento Final
                  </span>
                  <p className="font-bold text-slate-800">
                    {contratoData?.dataVencimento ? new Date(contratoData.dataVencimento).toLocaleDateString("pt-BR") : "Não Informada"}
                  </p>
                </div>
              </div>

              {/* Installment Schedule Table if contract data is present */}
              {contratoData?.cronogramaParcelas && contratoData.cronogramaParcelas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Cronograma de Amortização & Vencimentos Registrados
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="p-2.5"># Parcela</th>
                          <th className="p-2.5">Vencimento</th>
                          <th className="p-2.5 text-right">% Amortização</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-medium">
                        {contratoData.cronogramaParcelas.map((p: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">Parcela {idx + 1}</td>
                            <td className="p-2.5 font-mono">{p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "N/A"}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">{p.percentualAmortizacao}%</td>
                            <td className="p-2.5 text-center">
                              {p.paga ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                  Liquidada
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                  Pendente
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Notes or AI Observations */}
              {docItem.notes && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-600" /> Observações do Documento:
                  </div>
                  <p className="text-slate-700 italic">{docItem.notes}</p>
                </div>
              )}

              {/* Footer Audit Declaration */}
              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2">
                <span className="flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Documento auditado e catalogado no sistema AgroCredit Simulador Pro
                </span>
                <span>Data do Registro: {new Date(docItem.uploadDate || Date.now()).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Notes Bar */}
        {docItem.notes && (
          <div className="bg-slate-950/90 border-t border-slate-800 px-4 py-2 text-xs text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-slate-300 shrink-0">Observações:</span>
            <span className="truncate italic text-slate-400">{docItem.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
};
