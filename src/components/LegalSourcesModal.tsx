import React, { useState } from "react";
import { 
  X, 
  BookOpen, 
  ExternalLink, 
  Scale, 
  Search, 
  ShieldCheck, 
  Building2, 
  FileText, 
  CheckCircle2, 
  Copy,
  Info,
  Maximize2,
  Minimize2
} from "lucide-react";
import { LEGAL_SOURCES_DATABASE, LegalSourceItem } from "../data/legalSources";

interface LegalSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSourceId?: string;
  showToast?: (msg: string, type: "success" | "error" | "info") => void;
}

export const LegalSourcesModal: React.FC<LegalSourcesModalProps> = ({
  isOpen,
  onClose,
  initialSourceId,
  showToast
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [selectedSource, setSelectedSource] = useState<LegalSourceItem | null>(
    initialSourceId ? LEGAL_SOURCES_DATABASE.find(s => s.id === initialSourceId) || null : null
  );

  if (!isOpen) return null;

  const categories = [
    { id: "todos", label: "Todas as Fontes" },
    { id: "sumula_stj", label: "Súmulas STJ" },
    { id: "mcr_bacen", label: "Normas MCR / BACEN" },
    { id: "decreto", label: "Decretos Federais" },
    { id: "lei", label: "Leis Federais" }
  ];

  const filteredSources = LEGAL_SOURCES_DATABASE.filter(item => {
    const matchesCategory = activeCategory === "todos" || item.category === activeCategory;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.officialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.organ.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const copyToClipboard = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    if (showToast) {
      showToast(`Citação jurídica de "${title}" copiada!`, "success");
    }
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto`}>
      <div className={`bg-slate-50 border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800 transition-all duration-200 ${
        isMaximized 
          ? "fixed inset-0 w-full h-full rounded-none max-w-none max-h-none" 
          : "w-full max-w-7xl max-h-[94vh] rounded-2xl"
      }`}>
        
        {/* Header */}
        <div className="p-4 md:p-5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-slate-900">
                  Base Legal & Doutrinária do Crédito Rural
                </h2>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md border border-emerald-300">
                  Fontes Oficiais Verificáveis
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulta direta a leis do Planalto, resoluções do BACEN/CMN e Súmulas do STJ com links para conferência oficial.
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
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Category Tabs Bar + Quick Official Portals Bar */}
        <div className="p-4 bg-white border-b border-slate-200 space-y-3.5 shrink-0">
          {/* Official Portals Quick Links */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-slate-100/90 border border-slate-200 rounded-xl text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
              <span className="font-bold text-slate-800">Portais Oficiais do Banco Central em Tempo Real:</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://manuais.bcb.gov.br/app/manual/mcr/publico"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
                <span>Portal Público MCR (manuais.bcb.gov.br)</span>
              </a>
              <a
                href="https://www.bcb.gov.br/estabilidadefinanceira/normativos"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
                <span>Mudanças & Resoluções (bcb.gov.br)</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Súmula, Decreto, MCR ou palavra-chave..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer border ${
                    activeCategory === cat.id
                      ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: Dual Column (List + Selected Source Detail) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white">
          
          {/* Column 1: Items List */}
          <div className="w-full md:w-5/12 overflow-y-auto p-3.5 sm:p-4 space-y-2.5 max-h-80 md:max-h-full bg-slate-50/50">
            {filteredSources.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhuma fonte legal encontrada para o termo pesquisado.
              </div>
            ) : (
              filteredSources.map(item => {
                const isSelected = selectedSource?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSource(item)}
                    className={`p-4 rounded-xl border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/20 shadow-sm"
                        : "bg-white hover:bg-slate-100/80 border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 text-xs font-semibold rounded-md uppercase border border-slate-300">
                        {item.officialNumber}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {item.organ.split("(")[0]}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {item.title}
                    </h4>

                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Column 2: Detailed View of Selected Legal Source */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white space-y-5">
            {selectedSource ? (
              <div className="space-y-5">
                {/* Header Tag */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs sm:text-sm font-semibold">
                      {selectedSource.officialNumber}
                    </span>
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 mt-2.5 leading-snug">
                      {selectedSource.title}
                    </h3>
                  </div>

                  {/* Direct Link Button to Official Government Source */}
                  <a
                    href={selectedSource.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-2xs cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-200" />
                    <span>Conferir na Fonte Oficial ({selectedSource.organ.split("(")[0]})</span>
                  </a>
                </div>

                {/* Organ Badge */}
                <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-100/80 p-3 rounded-xl border border-slate-200">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Órgão Emissor / Repositório Oficial: <strong className="text-slate-900 font-bold">{selectedSource.organ}</strong></span>
                </div>

                {/* Summary Section */}
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 sm:p-5 space-y-2">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-700" /> Resumo e Fundamentação
                  </h4>
                  <p className="text-sm text-slate-800 leading-relaxed font-normal">
                    {selectedSource.summary}
                  </p>
                </div>

                {/* Legal Quote (Trecho Oficial da Lei/Súmula) */}
                <div className="bg-slate-50 border border-slate-200 border-l-4 border-l-amber-500 rounded-r-xl p-4 sm:p-5 space-y-2.5 relative">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600" /> Trecho / Citação Oficial
                    </h4>
                    <button
                      onClick={() => copyToClipboard(`${selectedSource.officialNumber} - "${selectedSource.legalQuote}"`, selectedSource.title)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Copiar citação legal para laudo ou petição"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-600" /> Copiar Citação
                    </button>
                  </div>
                  <blockquote className="text-sm text-slate-900 font-serif leading-relaxed bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                    "{selectedSource.legalQuote}"
                  </blockquote>
                </div>

                {/* Application in Audit */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 sm:p-5 space-y-2">
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Aplicação no Recálculo do Sistema
                  </h4>
                  <p className="text-sm text-slate-800 leading-relaxed font-normal">
                    {selectedSource.applicationInApp}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                <BookOpen className="w-12 h-12 text-slate-300" />
                <h4 className="text-base font-bold text-slate-800">Selecione uma norma ao lado</h4>
                <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                  Escolha uma Súmula, Decreto ou Item do MCR para visualizar os detalhes, o texto oficial e acessar o link direto no portal do Governo.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 shrink-0">
          <span>
            Todas as fontes são atualizadas segundo as diretrizes vigentes do Banco Central do Brasil e do STJ.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer self-end sm:self-auto"
          >
            Fechar Consulta
          </button>
        </div>

      </div>
    </div>
  );
};

