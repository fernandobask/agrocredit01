import React from "react";
import { DollarSign, TrendingDown, FileText, AlertTriangle, Scale, ShieldAlert, Sparkles } from "lucide-react";
import { SimulationDocument } from "../types";

interface KPIHeaderDashboardProps {
  simulations: SimulationDocument[];
  formatCurrency: (val: number) => string;
  onOpenSimulador?: () => void;
}

export const KPIHeaderDashboard: React.FC<KPIHeaderDashboardProps> = ({
  simulations,
  formatCurrency,
  onOpenSimulador
}) => {
  // Calculate aggregate metrics
  const totalContratos = simulations.length;

  let volumeTotalFinanciado = 0;
  let contratosComAbusividadeCount = 0;
  let economiaTotalEstimada = 0;

  simulations.forEach((sim) => {
    const cData = sim.contractData || sim.contrato;
    if (!cData) return;

    const valorPrincipal = cData.valorPrincipal || 0;
    const taxaJuros = cData.taxaJurosAnual || 0;
    volumeTotalFinanciado += valorPrincipal;

    // Check MCR Abusiveness rules
    // 1. CDI / Floating indexers in rural credit (Null under Súmula 176 STJ)
    // 2. Taxa > 12.0% p.a. (Exceeds Decreto 22.626/33 - Usura)
    // 3. Presence of audit divergence in laudo
    const indexador = (cData.indexadorOriginal || (cData as any).indexador || "").toString().toUpperCase();
    const isCdiOrFlutuante = indexador.includes("CDI") || indexador.includes("SELIC") || indexador.includes("FLUTUANTE") || indexador.includes("VARIAVEL");
    const isTaxaAbusiva = taxaJuros > 12.0 || isCdiOrFlutuante;
    const hasLaudoDivergencia = sim.laudo && sim.laudo.irregularidadesEncontradas;
    const hasDivergenciasItems = sim.laudo?.divergencias && sim.laudo.divergencias.some(d => d.status === 'divergente' || d.status === 'atencao');

    if (isTaxaAbusiva || hasLaudoDivergencia || hasDivergenciasItems) {
      contratosComAbusividadeCount++;
    }

    // Estimate potential savings from MCR expurge / rate reduction
    // If rate > 12% or has divergence, estimate 15-28% reduction in total interest burden
    if (isTaxaAbusiva) {
      const excessRate = taxaJuros - 8.5; // Benchmark standard rural credit ~8.5%
      const estimatedYearlyExcess = valorPrincipal * (excessRate / 100);
      economiaTotalEstimada += estimatedYearlyExcess * 3; // 3 year horizon estimate
    } else if (hasLaudoDivergencia) {
      economiaTotalEstimada += valorPrincipal * 0.12; // 12% avg expurge
    } else {
      // Standard baseline MCR repactuation estimate
      economiaTotalEstimada += valorPrincipal * 0.08;
    }
  });

  return (
    <div className="mb-6 space-y-3">
      {/* KPI BAR HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold shadow-xs">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-none">
              Indicadores da Carteira de Contratos & Perícia MCR
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Consolidação executiva de volume financiado, indícios de juros abusivos e expurgo potencial
            </p>
          </div>
        </div>

        {onOpenSimulador && (
          <button
            onClick={onOpenSimulador}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Simulador de Repactuação</span>
          </button>
        )}
      </div>

      {/* KPI CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* CARD 1: VOLUME FINANCIADO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-slate-100/60 rounded-full group-hover:scale-110 transition-transform -z-0" />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Volume Total Financiado</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {formatCurrency(volumeTotalFinanciado)}
            </p>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
              <span className="font-bold text-slate-700">{totalContratos}</span> contrato(s) registrado(s) na base
            </div>
          </div>
        </div>

        {/* CARD 2: ECONOMIA / EXPURGO POTENCIAL */}
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-4 rounded-2xl border border-emerald-800/50 shadow-xs hover:shadow-md transition relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
              <span>Expurgo / Economia MCR</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-emerald-400 font-mono tracking-tight">
              {formatCurrency(economiaTotalEstimada)}
            </p>
            <div className="text-[10px] text-emerald-200/80 flex items-center gap-1 font-medium">
              <span>Potencial de redução contratual</span>
            </div>
          </div>
        </div>

        {/* CARD 3: CONTRATOS AUDITADOS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition relative overflow-hidden group">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Contratos na Base</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
              {totalContratos}
            </p>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              Sincronizado com Firestore
            </div>
          </div>
        </div>

        {/* CARD 4: ALERTAS DE ABUSIVIDADE DE JUROS */}
        <div className={`p-4 rounded-2xl border transition relative overflow-hidden group ${
          contratosComAbusividadeCount > 0 
            ? 'bg-amber-50/70 border-amber-200/90 text-amber-950' 
            : 'bg-white border-slate-200/80 text-slate-900'
        }`}>
          <div className="relative z-10 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className={contratosComAbusividadeCount > 0 ? 'text-amber-800' : 'text-slate-500'}>
                Alertas de Abusividade
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                contratosComAbusividadeCount > 0 ? 'bg-amber-200/80 text-amber-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {contratosComAbusividadeCount > 0 ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
            </div>
            <p className="text-xl font-black font-mono tracking-tight flex items-center gap-2">
              <span>{contratosComAbusividadeCount}</span>
              {contratosComAbusividadeCount > 0 && (
                <span className="text-[10px] font-sans font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                  Atenção MCR
                </span>
              )}
            </p>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
              {contratosComAbusividadeCount > 0 ? (
                <span className="text-amber-800 font-semibold">Juros &gt;12% ou divergências no DDC</span>
              ) : (
                <span>Sem anormalidades críticas</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
