import React, { useState } from "react";
import { X, Scale, FileSpreadsheet, Download, CheckCircle2, AlertTriangle, ArrowRight, TrendingDown, RefreshCw, Calculator, Maximize2, Minimize2 } from "lucide-react";
import { Contrato, IndexadorRates, Indexador } from "../types";

interface CenariosComparativoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contrato: Contrato | null;
  taxasMap: IndexadorRates;
  formatCurrency: (val: number) => string;
  formatPercentage: (val: number) => string;
  onTriggerPDFExport?: () => void;
  onTriggerCSVExport?: () => void;
}

export const CenariosComparativoModal: React.FC<CenariosComparativoModalProps> = ({
  isOpen,
  onClose,
  contrato,
  taxasMap,
  formatCurrency,
  formatPercentage,
  onTriggerPDFExport,
  onTriggerCSVExport
}) => {
  const [taxaLegalMcr, setTaxaLegalMcr] = useState<number>(8.5); // Benchmark 8.5% p.a. MCR
  const [extenderPrazoMeses, setExtenderPrazoMeses] = useState<number>(0); // Extension under MCR 2-6-4
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  if (!isOpen || !contrato) return null;

  const principal = contrato.valorPrincipal || 0;
  const taxaOriginal = contrato.taxaJurosAnual || 0;
  const cronogramaOriginal = contrato.cronogramaParcelas || [];

  // Calculate Original Bank Totals
  let totalOriginalAmortizacao = 0;
  let totalOriginalJuros = 0;

  cronogramaOriginal.forEach(p => {
    const amort = p.valorPrincipalManual ?? (principal * (p.percentualAmortizacao / 100));
    const juros = p.valorJurosManual ?? (amort * (taxaOriginal / 100));
    totalOriginalAmortizacao += amort;
    totalOriginalJuros += juros;
  });

  if (totalOriginalAmortizacao === 0) totalOriginalAmortizacao = principal;
  if (totalOriginalJuros === 0) totalOriginalJuros = principal * (taxaOriginal / 100) * (cronogramaOriginal.length || 1);
  const totalOriginalPago = totalOriginalAmortizacao + totalOriginalJuros;

  // Calculate Recalculated MCR Schedule
  let totalRecalculadoJuros = 0;
  const parcelasComparativas = cronogramaOriginal.map((p, idx) => {
    const amortOriginal = p.valorPrincipalManual ?? (principal * (p.percentualAmortizacao / 100));
    const jurosOriginal = p.valorJurosManual ?? (amortOriginal * (taxaOriginal / 100));
    const totalOriginal = amortOriginal + jurosOriginal;

    // Recalculated under MCR (e.g. 8.5% p.a. legal cap and expurge of unapproved compounding)
    const jurosMcr = amortOriginal * (taxaLegalMcr / 100);
    const totalMcr = amortOriginal + jurosMcr;
    totalRecalculadoJuros += jurosMcr;

    const economiaParcela = Math.max(0, totalOriginal - totalMcr);

    return {
      numero: idx + 1,
      data: p.data,
      amortizacao: amortOriginal,
      jurosOriginal,
      totalOriginal,
      jurosMcr,
      totalMcr,
      economiaParcela
    };
  });

  const totalRecalculadoPago = totalOriginalAmortizacao + totalRecalculadoJuros;
  const economiaTotal = Math.max(0, totalOriginalPago - totalRecalculadoPago);
  const percentualEconomia = totalOriginalPago > 0 ? (economiaTotal / totalOriginalPago) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className={`bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800 transition-all duration-200 ${
        isMaximized
          ? "fixed inset-0 w-full h-full rounded-none max-w-none max-h-none"
          : "w-full max-w-7xl max-h-[94vh]"
      }`}>
        
        {/* MODAL HEADER */}
        <div className="bg-white p-4 md:p-5 flex items-center justify-between shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold shadow-2xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Comparador de Cenários Lado a Lado (MCR vs Banco)</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded border border-emerald-300">
                  Perícia Auditável
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Contrato: <strong className="text-slate-900">{contrato.numero || "Sem Número"}</strong> • Emitente: <strong className="text-slate-900">{contrato.emitente || "—"}</strong>
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

        {/* CONTROLS BAR */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <label htmlFor="taxaLegalMcr" className="text-slate-600">Taxa Benchmark MCR (% a.a.):</label>
              <input
                id="taxaLegalMcr"
                type="number"
                step="0.1"
                min="0"
                value={taxaLegalMcr}
                onChange={(e) => setTaxaLegalMcr(Number(e.target.value) || 0)}
                className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="extenderPrazoMeses" className="text-slate-600">Prorrogação MCR 2-6-4 (Meses):</label>
              <select
                id="extenderPrazoMeses"
                value={extenderPrazoMeses}
                onChange={(e) => setExtenderPrazoMeses(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value={0}>Sem Prorrogação (Manter Vencimentos)</option>
                <option value={12}>+ 12 Meses (Seca / Evento Climático)</option>
                <option value={24}>+ 24 Meses (Frustração de Safra Prolongada)</option>
                <option value={36}>+ 36 Meses (Reestruturação MCR)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onTriggerCSVExport && (
              <button
                onClick={onTriggerCSVExport}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar XLS</span>
              </button>
            )}
            {onTriggerPDFExport && (
              <button
                onClick={onTriggerPDFExport}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gerar Laudo PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* COMPARISON SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* CARD 1: BANCO */}
            <div className="bg-red-50/50 border border-red-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-red-800">
                <span>Cenário Cobrado pelo Banco</span>
                <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-mono text-[10px]">
                  Taxa {formatPercentage(taxaOriginal)}
                </span>
              </div>
              <p className="text-xl font-black text-red-950 font-mono">
                {formatCurrency(totalOriginalPago)}
              </p>
              <div className="text-[11px] text-red-700 space-y-0.5 font-medium border-t border-red-200/60 pt-2">
                <div>Amortização: <strong className="font-mono">{formatCurrency(totalOriginalAmortizacao)}</strong></div>
                <div>Juros & Encargos: <strong className="font-mono">{formatCurrency(totalOriginalJuros)}</strong></div>
              </div>
            </div>

            {/* CARD 2: RECALCULADO MCR */}
            <div className="bg-emerald-50/60 border border-emerald-200/90 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>Cenário Recalculado MCR</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px]">
                  Taxa Legal {formatPercentage(taxaLegalMcr)}
                </span>
              </div>
              <p className="text-xl font-black text-emerald-950 font-mono">
                {formatCurrency(totalRecalculadoPago)}
              </p>
              <div className="text-[11px] text-emerald-800 space-y-0.5 font-medium border-t border-emerald-200/60 pt-2">
                <div>Amortização Mantida: <strong className="font-mono">{formatCurrency(totalOriginalAmortizacao)}</strong></div>
                <div>Juros Corrigidos MCR: <strong className="font-mono">{formatCurrency(totalRecalculadoJuros)}</strong></div>
              </div>
            </div>

            {/* CARD 3: ECONOMIA OBTIDA */}
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-4 space-y-2 shadow-sm border border-emerald-800/40">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                <span>Economia Direta / Expurgo</span>
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 font-mono">
                {formatCurrency(economiaTotal)}
              </p>
              <div className="text-[11px] text-emerald-200/90 font-medium border-t border-emerald-800/80 pt-2 flex items-center justify-between">
                <span>Redução na dívida:</span>
                <strong className="text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                  - {percentualEconomia.toFixed(1)}%
                </strong>
              </div>
            </div>
          </div>

          {/* PARCELA A PARCELA TABLE */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-600" />
              Comparativo Parcela a Parcela
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="p-3">Nº</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3 text-right">Amortização</th>
                      <th className="p-3 text-right text-red-700">Juros Banco</th>
                      <th className="p-3 text-right text-red-700">Total Banco</th>
                      <th className="p-3 text-right text-emerald-700">Juros MCR</th>
                      <th className="p-3 text-right text-emerald-700">Total MCR</th>
                      <th className="p-3 text-right text-emerald-800">Economia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {parcelasComparativas.map((row) => (
                      <tr key={row.numero} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-700">{row.numero}</td>
                        <td className="p-3 text-slate-600 font-mono text-[11px]">{row.data || "—"}</td>
                        <td className="p-3 text-right font-mono text-slate-800">{formatCurrency(row.amortizacao)}</td>
                        <td className="p-3 text-right font-mono text-red-600">{formatCurrency(row.jurosOriginal)}</td>
                        <td className="p-3 text-right font-mono font-bold text-red-900">{formatCurrency(row.totalOriginal)}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">{formatCurrency(row.jurosMcr)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-900">{formatCurrency(row.totalMcr)}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50">
                          +{formatCurrency(row.economiaParcela)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            * Cálculo fundamentado no Manual de Crédito Rural (MCR 2-6-4) e jurisprudência de expurgo de juros excessivos.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Fechar Comparador
          </button>
        </div>

      </div>
    </div>
  );
};
