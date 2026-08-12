import React, { useState, useEffect } from "react";
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
  AlertCircle
} from "lucide-react";
import { AssociatedDocument } from "../types";

interface DocumentViewerModalProps {
  document: AssociatedDocument | null;
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const isPdf = Boolean(
    docItem?.mimeType?.includes("pdf") || 
    docItem?.fileName?.toLowerCase().endsWith(".pdf") || 
    (docItem?.fileData && docItem?.fileData.includes("JVBERi"))
  );

  const isImage = Boolean(
    docItem?.mimeType?.includes("image") || 
    /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(docItem?.fileName || "")
  );

  // Convert Base64 into a secure Blob URL to bypass Chrome's data: URL blocking policies
  useEffect(() => {
    if (!docItem || !docItem.fileData) {
      setBlobUrl(null);
      return;
    }

    try {
      let cleanBase64 = docItem.fileData;
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
      const mime = docItem.mimeType || (isPdf ? "application/pdf" : isImage ? "image/jpeg" : "application/pdf");
      const blob = new Blob([byteArray], { type: mime });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.error("Erro ao gerar Blob URL para o documento:", err);
      setBlobUrl(null);
    }
  }, [docItem, isPdf, isImage]);

  if (!docItem) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    if (!blobUrl && !docItem.fileData) return;
    const downloadUrl = blobUrl || `data:${docItem.mimeType || "application/pdf"};base64,${docItem.fileData}`;
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
    } else if (docItem.fileData) {
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
                ? `<embed src="data:application/pdf;base64,${docItem.fileData.replace(/^data:[^;]+;base64,/, '')}" type="application/pdf" width="100%" height="100vh" />`
                : `<img src="data:${docItem.mimeType || 'image/jpeg'};base64,${docItem.fileData.replace(/^data:[^;]+;base64,/, '')}" alt="${docItem.name}" />`
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
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 md:p-6 animate-fadeIn">
      <div className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
        isFullscreen ? "w-full h-full rounded-none border-none" : "w-full max-w-6xl h-[92vh]"
      }`}>
        {/* Top Navigation Bar */}
        <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm md:text-base text-slate-100 truncate max-w-xs md:max-w-md">
                  {docItem.name}
                </h3>
                <span className="px-2 py-0.5 bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-md font-bold text-[10px] uppercase tracking-wider">
                  {docItem.type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                {contratoNumero && (
                  <span className="font-mono text-slate-300">Contrato: {contratoNumero}</span>
                )}
                <span>Arquivo: {docItem.fileName || "documento.pdf"}</span>
                {docItem.uploadDate && (
                  <span>Data: {new Date(docItem.uploadDate).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Controls toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
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
        <div className="flex-1 bg-slate-950 p-3 md:p-6 overflow-auto flex items-center justify-center relative">
          {blobUrl ? (
            isPdf ? (
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
                      <button onClick={handleDownload} className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">
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
                  Este formato de arquivo ({docItem.mimeType || docItem.fileName}) foi carregado com sucesso.
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
            )
          ) : (
            <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md text-slate-300 space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-slate-100">{docItem.name}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Documento anexado no sistema e registrado no contrato.
              </p>
              
              <div className="text-left bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
                <div className="flex justify-between border-b border-slate-800/80 pb-1">
                  <span className="text-slate-500">Tipo de Documento:</span>
                  <span className="font-bold text-emerald-400">{docItem.type}</span>
                </div>
                {docItem.fileName && (
                  <div className="flex justify-between border-b border-slate-800/80 pb-1">
                    <span className="text-slate-500">Nome do Arquivo:</span>
                    <span className="font-mono text-slate-300">{docItem.fileName}</span>
                  </div>
                )}
                {docItem.uploadDate && (
                  <div className="flex justify-between border-b border-slate-800/80 pb-1">
                    <span className="text-slate-500">Data de Envio:</span>
                    <span>{new Date(docItem.uploadDate).toLocaleDateString("pt-BR")}</span>
                  </div>
                )}
                {docItem.notes && (
                  <div className="pt-1 text-slate-400 italic">
                    "{docItem.notes}"
                  </div>
                )}
              </div>

              {onAnalyzeWithAI && (
                <button
                  onClick={() => onAnalyzeWithAI(docItem)}
                  disabled={isAnalyzing}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                  <span>{isAnalyzing ? "Analisando com IA..." : "Extrair e Mapear Dados com IA"}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Metadata & Notes Bar */}
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
