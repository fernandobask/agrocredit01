import React, { useState, useEffect } from "react";
import { X, Coins, RefreshCw, Check, Edit3, Sparkles, Info, ShieldCheck, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { IndexadorRates, Indexador } from "../types";

interface TaxasManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexadores: IndexadorRates;
  onSave: (newRates: IndexadorRates) => void;
  onFetchOfficial: () => Promise<void>;
  loadingOfficial: boolean;
  lastUpdatedStr: string;
}

export const TaxasManualModal: React.FC<TaxasManualModalProps> = ({
  isOpen,
  onClose,
  indexadores,
  onSave,
  onFetchOfficial,
  loadingOfficial,
  lastUpdatedStr
}) => {
  const [localRates, setLocalRates] = useState<IndexadorRates>(indexadores);
  const [isModified, setIsModified] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalRates(indexadores);
      setIsModified(false);
    }
  }, [isOpen, indexadores]);

  const handleChange = (key: keyof IndexadorRates, val: number) => {
    setLocalRates(prev => ({
      ...prev,
      [key]: val
    }));
    setIsModified(true);
  };

  const handleSave = () => {
    onSave(localRates);
    onClose();
  };

  const handleResetToOfficial = async () => {
    await onFetchOfficial();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="taxas-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            key="taxas-modal-content"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={`bg-slate-50 border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
              isMaximized
                ? "fixed inset-0 w-full h-full rounded-none max-w-none max-h-none h-full"
                : "w-full max-w-4xl max-h-[92vh] rounded-2xl"
            }`}
          >
          {/* Header */}
          <div className="bg-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-800 border border-emerald-300">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base md:text-lg text-slate-900 flex items-center gap-2">
                  Ajuste Manual de Taxas e Indexadores
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase rounded-md border border-emerald-300">
                    BACEN / Editável
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Defina manualmente as taxas macroeconômicas usadas nas simulações do contrato.
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

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Status Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                <span>
                  Origem dos Dados: <strong className="text-slate-900 font-bold">{lastUpdatedStr || "Valores de Referência"}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToOfficial}
                disabled={loadingOfficial}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingOfficial ? "animate-spin text-emerald-600" : ""}`} />
                {loadingOfficial ? "Buscando..." : "Buscar Oficial BACEN"}
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* SELIC */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-800">
                  <span>SELIC Meta (% a.a.)</span>
                  <span className="text-xs text-emerald-700 font-mono font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">BACEN #432</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.SELIC}
                    onChange={e => handleChange(Indexador.SELIC, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              {/* CDI */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-800">
                  <span>CDI Over (% a.a.)</span>
                  <span className="text-xs text-blue-700 font-mono font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200">BACEN #12</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.CDI}
                    onChange={e => handleChange(Indexador.CDI, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              {/* IPCA */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-800">
                  <span>IPCA (% a.a. / 12m)</span>
                  <span className="text-xs text-amber-800 font-mono font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">IBGE / BACEN</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.IPCA}
                    onChange={e => handleChange(Indexador.IPCA, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              {/* INPC */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-800">
                  <span>INPC (% a.a. / 12m)</span>
                  <span className="text-xs text-purple-800 font-mono font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">IBGE / BACEN</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.INPC}
                    onChange={e => handleChange(Indexador.INPC, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              {/* TR */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-800">
                  <span>TR Referencial (% a.a.)</span>
                  <span className="text-xs text-emerald-700 font-mono font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">BACEN #226</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.TR}
                    onChange={e => handleChange(Indexador.TR, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              {/* PRE */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs sm:text-sm font-semibold text-slate-800">
                  <span>Pré-Fixado Base (% a.a.)</span>
                  <span className="text-xs text-slate-600 font-mono font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Referencial</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.PRE || 0}
                    onChange={e => handleChange(Indexador.PRE, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3.5 top-3 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl p-3.5 text-xs sm:text-sm flex items-center gap-2.5 leading-relaxed">
              <Sparkles className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>
                Ao clicar em <strong>Aplicar Taxas Manualmente</strong>, todos os cenários comparativos, gráficos de amortização e auditorias da memória de cálculo serão recalculados em tempo real com estas taxas.
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Taxas Manualmente</span>
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};
