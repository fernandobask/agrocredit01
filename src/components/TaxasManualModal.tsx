import React, { useState, useEffect } from "react";
import { X, Coins, RefreshCw, Check, Edit3, Sparkles, Info, ShieldCheck } from "lucide-react";
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
        <div key="taxas-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <motion.div
            key="taxas-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
          {/* Header */}
          <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-400 border border-emerald-500/30">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  Ajuste Manual de Taxas e Indexadores
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase rounded border border-emerald-500/30">
                    BACEN / Editável
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Defina manualmente as taxas macroeconômicas usadas nas simulações do contrato.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Status Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Origem dos Dados: <strong>{lastUpdatedStr || "Valores de Referência"}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetToOfficial}
                disabled={loadingOfficial}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3 h-3 ${loadingOfficial ? "animate-spin text-emerald-600" : ""}`} />
                {loadingOfficial ? "Buscando..." : "Buscar Oficial BACEN"}
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* SELIC */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>SELIC Meta (% a.a.)</span>
                  <span className="text-[10px] text-emerald-600 font-mono">BACEN #432</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.SELIC}
                    onChange={e => handleChange(Indexador.SELIC, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>

              {/* CDI */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>CDI Over (% a.a.)</span>
                  <span className="text-[10px] text-blue-600 font-mono">BACEN #12</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.CDI}
                    onChange={e => handleChange(Indexador.CDI, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>

              {/* IPCA */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>IPCA (% a.a. / 12m)</span>
                  <span className="text-[10px] text-amber-600 font-mono">IBGE / BACEN</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.IPCA}
                    onChange={e => handleChange(Indexador.IPCA, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>

              {/* INPC */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>INPC (% a.a. / 12m)</span>
                  <span className="text-[10px] text-purple-600 font-mono">IBGE / BACEN</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.INPC}
                    onChange={e => handleChange(Indexador.INPC, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>

              {/* TR */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>TR Referencial (% a.a.)</span>
                  <span className="text-[10px] text-emerald-600 font-mono">BACEN #226</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.TR}
                    onChange={e => handleChange(Indexador.TR, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>

              {/* PRE */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Pré-Fixado Base (% a.a.)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Referencial</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={localRates.PRE || 0}
                    onChange={e => handleChange(Indexador.PRE, Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-xs font-bold">%</span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
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
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
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
