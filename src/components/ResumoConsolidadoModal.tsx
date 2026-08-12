import React, { useState, useMemo } from "react";
import { 
  X, 
  FileSpreadsheet, 
  Printer, 
  Filter, 
  CheckCircle2, 
  PowerOff, 
  Download, 
  Sparkles, 
  AlertCircle,
  Building2,
  UserCheck,
  TrendingDown,
  Scale,
  Calendar,
  Layers,
  Star
} from "lucide-react";
import { formatCurrency, formatDate, parseDateSafely, formatCSVNumber } from "../utils/math";
import { IndexadorRates } from "../types";

interface ResumoConsolidadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulations: any[];
  initialEmitente?: string;
  indexadores: IndexadorRates;
  onToggleAtivo?: (simId: string, currentAtivo: boolean) => void;
}

export const ResumoConsolidadoModal: React.FC<ResumoConsolidadoModalProps> = ({
  isOpen,
  onClose,
  simulations,
  initialEmitente = "",
  indexadores,
  onToggleAtivo
}) => {
  // List of all unique emitentes
  const uniqueEmitentes = useMemo(() => {
    return Array.from(
      new Set(
        simulations
          .map(s => (s.contractData?.emitente || s.contrato?.emitente || "").trim())
          .filter(Boolean)
      )
    ).sort();
  }, [simulations]);

  // Selected emitente state
  const [selectedEmitente, setSelectedEmitente] = useState<string>(() => {
    if (initialEmitente && uniqueEmitentes.includes(initialEmitente)) {
      return initialEmitente;
    }
    return uniqueEmitentes[0] || "";
  });

  // Selected credor filter
  const [selectedCredor, setSelectedCredor] = useState<string>("");

  // Selected indexer for recalculated balance calculation
  const [selectedIndexador, setSelectedIndexador] = useState<string>("INPC");

  // Only active filter checkbox (default true)
  const [somenteAtivos, setSomenteAtivos] = useState<boolean>(true);

  // Set of highlighted contract IDs (pink/magenta highlight like in the Excel sheet)
  const [highlightedSimIds, setHighlightedSimIds] = useState<Set<string>>(new Set());

  const toggleHighlight = (simId: string) => {
    setHighlightedSimIds(prev => {
      const next = new Set(prev);
      if (next.has(simId)) next.delete(simId);
      else next.add(simId);
      return next;
    });
  };

  // Available credores for selected emitente
  const uniqueCredores = useMemo(() => {
    const creds = simulations
      .filter(s => {
        const emit = (s.contractData?.emitente || s.contrato?.emitente || "").trim();
        return !selectedEmitente || emit === selectedEmitente;
      })
      .map(s => (s.contractData?.credor || s.contrato?.credor || "").trim())
      .filter(Boolean);
    return Array.from(new Set(creds)).sort();
  }, [simulations, selectedEmitente]);

  // Filtered list of simulations
  const filteredSimulations = useMemo(() => {
    return simulations.filter(sim => {
      const emit = (sim.contractData?.emitente || sim.contrato?.emitente || "").trim();
      const cred = (sim.contractData?.credor || sim.contrato?.credor || "").trim();
      const isAtivo = sim.ativo !== false;

      if (selectedEmitente && emit !== selectedEmitente) return false;
      if (selectedCredor && cred !== selectedCredor) return false;
      if (somenteAtivos && !isAtivo) return false;

      return true;
    });
  }, [simulations, selectedEmitente, selectedCredor, somenteAtivos]);

  // Computes calculated totals for each contract row
  const rowDataList = useMemo(() => {
    return filteredSimulations.map(sim => {
      const cData = sim.contractData || sim.contrato || {};
      const isAtivo = sim.ativo !== false;

      const operacao = cData.numero || sim.name || "S/N";
      const tipo = cData.modalidade || "CPR";
      const valorOriginal = cData.valorPrincipal || 0;
      const dataLiberacao = cData.dataEmissao || "";

      // Calculate paid / liquidated amount from parcelas
      const cronograma = cData.cronogramaParcelas || [];
      let valorLiquidado = 0;
      let parcelasVencidas = 0;
      let parcelasAVencer = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      cronograma.forEach((p: any) => {
        const pDate = parseDateSafely(p.data);
        pDate.setHours(0, 0, 0, 0);
        
        // Percentual or manual principal
        const valParc = p.valorPrincipalManual !== undefined && p.valorPrincipalManual > 0 
          ? p.valorPrincipalManual 
          : valorOriginal * ((p.percentualAmortizacao || 0) / 100);

        if (p.paga) {
          valorLiquidado += p.valorAmortizadoPago || valParc;
        } else {
          if (pDate.getTime() < today.getTime()) {
            parcelasVencidas += valParc;
          } else {
            parcelasAVencer += valParc;
          }
        }
      });

      // Calculate bank charged debt balance (Valor Cobrado - Credora)
      // Defaults to original principal - liquidated + approximate interest, or calculated
      let valorCobradoCredora = 0;
      if (cData.valorEmissao && cData.valorEmissao > 0) {
        valorCobradoCredora = cData.valorEmissao;
      } else {
        // Simple projection with original contract rate
        const years = 1;
        const taxa = (cData.taxaJurosAnual || 0) / 100;
        valorCobradoCredora = (valorOriginal - valorLiquidado) * Math.pow(1 + taxa, years);
        if (valorCobradoCredora < 0) valorCobradoCredora = 0;
      }

      // Calculate recalculated debt balance (Valor Recalculado) based on selectedIndexador
      let valorRecalculado = 0;
      const cenarios = sim.scenariosData || sim.cenarios || [];

      if (selectedIndexador === "CENARIO_IA") {
        if (cenarios && cenarios.length > 0) {
          const bestCen = cenarios[0];
          const proj = bestCen.parcelas || [];
          if (proj.length > 0) {
            valorRecalculado = proj.reduce((acc: number, p: any) => acc + (p.totalPago || 0), 0);
          } else {
            valorRecalculado = (bestCen.totalPago || bestCen.totalAmortizado || valorOriginal) * 0.85;
          }
        } else {
          valorRecalculado = Math.max(0, (valorOriginal - valorLiquidado) * 1.05);
        }
      } else {
        // Find scenario matching selected indexer
        const matchingCen = cenarios.find((c: any) => 
          (c.indexador || c.nome || "").toUpperCase().includes(selectedIndexador.toUpperCase())
        );

        if (matchingCen && matchingCen.parcelas && matchingCen.parcelas.length > 0) {
          valorRecalculado = matchingCen.parcelas.reduce((acc: number, p: any) => acc + (p.totalPago || 0), 0);
        } else {
          // Dynamic recalculation using indexer rate + legal agricultural interest
          const saldoLiquido = Math.max(0, valorOriginal - valorLiquidado);
          let rateValue = 4.5; // default INPC
          if (selectedIndexador === "INPC") rateValue = indexadores?.INPC ?? 4.5;
          else if (selectedIndexador === "IPCA") rateValue = indexadores?.IPCA ?? 3.8;
          else if (selectedIndexador === "IGPM") rateValue = indexadores?.IGPM ?? 5.2;
          else if (selectedIndexador === "CDI") rateValue = indexadores?.CDI ?? 10.5;
          else if (selectedIndexador === "SELIC") rateValue = indexadores?.SELIC ?? 10.5;
          else if (selectedIndexador === "TAXA_LEGAL") rateValue = 0; // 0% indexer + 8% legal interest
          else if (indexadores && (indexadores as any)[selectedIndexador] !== undefined) {
            rateValue = (indexadores as any)[selectedIndexador];
          }

          // Combined annual rate: Indexer Rate + Legal Rural Interest (8% a.a.)
          const totalRateAnnual = (rateValue / 100) + 0.08;
          let years = 1;
          if (dataLiberacao) {
            const pDate = parseDateSafely(dataLiberacao);
            if (pDate) {
              const diffMs = new Date().getTime() - pDate.getTime();
              if (diffMs > 0) years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
            }
          }

          valorRecalculado = saldoLiquido * Math.pow(1 + totalRateAnnual, Math.min(years, 5));
        }
      }

      const diferenca = Math.max(0, valorCobradoCredora - valorRecalculado);

      return {
        simId: sim.id,
        isAtivo,
        operacao,
        tipo,
        valorOriginal,
        dataLiberacao,
        valorLiquidado,
        valorCobradoCredora,
        valorRecalculado,
        diferenca,
        parcelasVencidas,
        parcelasAVencer,
        credor: cData.credor || "Credora",
        emitente: cData.emitente || "Emitente"
      };
    });
  }, [filteredSimulations, selectedIndexador, indexadores]);

  // Overall Total Calculations
  const totals = useMemo(() => {
    return rowDataList.reduce(
      (acc, r) => {
        acc.valorOriginal += r.valorOriginal;
        acc.valorLiquidado += r.valorLiquidado;
        acc.valorCobradoCredora += r.valorCobradoCredora;
        acc.valorRecalculado += r.valorRecalculado;
        acc.diferenca += r.diferenca;
        acc.parcelasVencidas += r.parcelasVencidas;
        acc.parcelasAVencer += r.parcelasAVencer;
        acc.countActive += r.isAtivo ? 1 : 0;
        acc.countTotal += 1;
        return acc;
      },
      {
        valorOriginal: 0,
        valorLiquidado: 0,
        valorCobradoCredora: 0,
        valorRecalculado: 0,
        diferenca: 0,
        parcelasVencidas: 0,
        parcelasAVencer: 0,
        countActive: 0,
        countTotal: 0
      }
    );
  }, [rowDataList]);

  if (!isOpen) return null;

  // Export to Excel CSV (UTF-8 with BOM, semicolon delimited, comma decimal)
  const handleExportCSV = () => {
    let csv = "\uFEFF"; // UTF-8 BOM

    const credorTitle = selectedCredor ? selectedCredor.toUpperCase() : "TODOS OS CREDORES";
    const emitenteTitle = selectedEmitente ? selectedEmitente.toUpperCase() : "TODOS OS EMITENTES";

    csv += `RESUMO CONSOLIDADO ÚNICO — ${emitenteTitle} x ${credorTitle}\n`;
    csv += `Data-base: ${new Date().toLocaleDateString("pt-BR")} (exceto onde indicado)\n`;
    csv += `Índice de Recálculo Aplicado: ${selectedIndexador}\n`;
    csv += `Filtro Aplicado: ${somenteAtivos ? "Apenas Contratos Ativos" : "Todos os Contratos (Ativos e Inativos)"}\n\n`;

    csv += `Operação;Tipo;Valor Original (R$);Data Liberação;Valor Liquidado (R$);Valor Cobrado - Credora (R$);Valor Recalculado [${selectedIndexador}] (R$);Diferença (R$);Parcelas Vencidas (R$);Parcelas a Vencer (R$);Status\n`;

    rowDataList.forEach(r => {
      csv += `${r.operacao};${r.tipo};${formatCSVNumber(r.valorOriginal)};${formatDate(r.dataLiberacao)};${formatCSVNumber(r.valorLiquidado)};${formatCSVNumber(r.valorCobradoCredora)};${formatCSVNumber(r.valorRecalculado)};${formatCSVNumber(r.diferenca)};${formatCSVNumber(r.parcelasVencidas)};${formatCSVNumber(r.parcelasAVencer)};${r.isAtivo ? "Ativo" : "Inativo"}\n`;
    });

    csv += `\n`;
    csv += `TOTAL (linhas com valor recalculado);;${formatCSVNumber(totals.valorOriginal)};;${formatCSVNumber(totals.valorLiquidado)};${formatCSVNumber(totals.valorCobradoCredora)};${formatCSVNumber(totals.valorRecalculado)};${formatCSVNumber(totals.diferenca)};${formatCSVNumber(totals.parcelasVencidas)};${formatCSVNumber(totals.parcelasAVencer)};${totals.countActive} ATIVOS\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Resumo_Consolidado_${selectedEmitente || "Geral"}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report PDF
  const handlePrint = () => {
    window.print();
  };

  const credorDisplay = selectedCredor ? selectedCredor.toUpperCase() : "SICREDI / CREDORES CONSOLIDADOS";
  const emitenteDisplay = selectedEmitente ? selectedEmitente.toUpperCase() : "CLIENTE / EMITENTE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* MODAL HEADER - STYLED WITH EXCEL GREEN THEME MATCHING SCREENSHOT */}
        <div className="bg-emerald-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 print:bg-emerald-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[11px] rounded tracking-wide uppercase shadow-2xs">
                PRÉVIA PARA ANÁLISE
              </span>
              <span className="px-2 py-0.5 bg-emerald-800 text-emerald-200 text-xs font-semibold rounded border border-emerald-700">
                Data-base: {new Date().toLocaleDateString("pt-BR")}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight text-emerald-50 leading-tight">
              RESUMO CONSOLIDADO ÚNICO — {emitenteDisplay} x {credorDisplay}
            </h2>
            <p className="text-xs text-emerald-200 font-medium">
              Consolidação técnica auditada de operações ativas do cliente para repactuação e renegociação.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden shrink-0 self-end sm:self-auto">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm border border-emerald-600 cursor-pointer"
              title="Exportar tabela para Excel CSV"
            >
              <Download className="w-4 h-4 text-emerald-300" />
              <span className="hidden md:inline">Exportar Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white text-emerald-950 font-bold text-xs rounded-xl hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Imprimir ou Salvar como PDF"
            >
              <Printer className="w-4 h-4 text-emerald-700" />
              <span>Imprimir PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FILTERS & SCOPE BAR */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-center">
            
            {/* Emitente Filter */}
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                1. Cliente / Emitente:
              </label>
              <select
                value={selectedEmitente}
                onChange={e => setSelectedEmitente(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="">-- Todos os Clientes ({uniqueEmitentes.length}) --</option>
                {uniqueEmitentes.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            {/* Credor Filter */}
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                2. Instituição / Credor:
              </label>
              <select
                value={selectedCredor}
                onChange={e => setSelectedCredor(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="">-- Todos os Credores / Bancos --</option>
                {uniqueCredores.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Indexador p/ Recálculo Selector */}
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-emerald-800 uppercase mb-1 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                3. Índice p/ Valor Recalculado:
              </label>
              <select
                value={selectedIndexador}
                onChange={e => setSelectedIndexador(e.target.value)}
                className="w-full bg-emerald-100/80 border-2 border-emerald-600 text-emerald-950 font-black rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
              >
                <option value="INPC">INPC (Tabela Justiça - 4.5% a.a.)</option>
                <option value="IPCA">IPCA (Inflação Oficial - 3.8% a.a.)</option>
                <option value="IGPM">IGP-M (Mercado - 5.2% a.a.)</option>
                <option value="CDI">CDI (10.5% a.a.)</option>
                <option value="SELIC">SELIC (10.5% a.a.)</option>
                <option value="TAXA_LEGAL">Teto Legal Rural (8% a.a. sem indexador)</option>
                <option value="CENARIO_IA">Cenário Otimizado (IA Simulador)</option>
              </select>
            </div>

            {/* Status Checkbox */}
            <div className="md:col-span-3 flex items-center pt-2 sm:pt-4">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3.5 py-2 border border-slate-300 rounded-xl w-full shadow-2xs hover:bg-emerald-50/50 transition">
                <input
                  type="checkbox"
                  checked={somenteAtivos}
                  onChange={e => setSomenteAtivos(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Somente Contratos Ativos <span className="text-[10px] text-emerald-700 font-semibold">({totals.countActive}/{totals.countTotal})</span>
                </span>
              </label>
            </div>

          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* KPI CARDS HEADER */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Valor Original Principal</span>
              <p className="text-sm sm:text-base font-black text-slate-900 font-mono mt-1">{formatCurrency(totals.valorOriginal)}</p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">{totals.countActive} operação(ões) ativa(s)</span>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Saldo Cobrado (Credora)</span>
              <p className="text-sm sm:text-base font-black text-emerald-950 font-mono mt-1">{formatCurrency(totals.valorCobradoCredora)}</p>
              <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">Exigido pelo Banco</span>
            </div>

            <div className="bg-teal-50/90 border-2 border-teal-400 rounded-2xl p-3.5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-teal-900 uppercase tracking-wider block">Saldo Recalculado</span>
                <span className="px-1.5 py-0.5 bg-teal-800 text-white font-black text-[9px] rounded uppercase shadow-2xs">
                  {selectedIndexador}
                </span>
              </div>
              <p className="text-sm sm:text-base font-black text-teal-950 font-mono mt-1">{formatCurrency(totals.valorRecalculado)}</p>
              <span className="text-[10px] text-teal-800 font-bold mt-0.5 block">Índice: {selectedIndexador} + Juros Legais</span>
            </div>

            <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Diferença / Indébito (Economia)</span>
              <p className="text-sm sm:text-base font-black text-amber-950 font-mono mt-1">{formatCurrency(totals.diferenca)}</p>
              <span className="text-[10px] text-amber-800 font-bold mt-0.5 block">Excesso Cobrado</span>
            </div>

            <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-3.5 shadow-2xs col-span-2 md:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Parcelas Vencidas</span>
              <p className="text-sm sm:text-base font-black text-amber-400 font-mono mt-1">{formatCurrency(totals.parcelasVencidas)}</p>
              <span className="text-[10px] text-slate-300 mt-0.5 block">A Vencer: {formatCurrency(totals.parcelasAVencer)}</span>
            </div>
          </div>

          {/* TABLE CONTAINER MATCHING SPREADSHEET LAYOUT */}
          <div className="border border-emerald-900/30 rounded-2xl shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-emerald-900 text-white font-bold text-[11px] uppercase tracking-wider border-b border-emerald-950">
                    <th className="p-3 border-r border-emerald-800/60">Operação</th>
                    <th className="p-3 border-r border-emerald-800/60">Tipo</th>
                    <th className="p-3 text-right border-r border-emerald-800/60">Valor Original (R$)</th>
                    <th className="p-3 text-center border-r border-emerald-800/60">Data Liberação</th>
                    <th className="p-3 text-right border-r border-emerald-800/60">Valor Liquidado (R$)</th>
                    <th className="p-3 text-right border-r border-emerald-800/60 bg-red-900/90">Valor Cobrado - Credora (R$)</th>
                    <th className="p-3 text-right border-r border-emerald-800/60 bg-emerald-950 text-amber-300 font-black">
                      <div className="flex flex-col items-end">
                        <span>Valor Recalculado (R$)</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded tracking-wide uppercase mt-0.5">
                          Índice: {selectedIndexador}
                        </span>
                      </div>
                    </th>
                    <th className="p-3 text-right border-r border-emerald-800/60 bg-emerald-950">Diferença (R$)</th>
                    <th className="p-3 text-right border-r border-emerald-800/60">Parcelas Vencidas (R$)</th>
                    <th className="p-3 text-right border-r border-emerald-800/60">Parcelas a Vencer (R$)</th>
                    <th className="p-3 text-center print:hidden">Status / Destaque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rowDataList.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500 italic bg-slate-50">
                        Nenhum contrato ativo encontrado para o cliente ou filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    rowDataList.map((row, idx) => {
                      const isHighlighted = highlightedSimIds.has(row.simId);

                      return (
                        <tr
                          key={row.simId || `resumo-row-${idx}`}
                          className={`transition-colors ${
                            isHighlighted 
                              ? "bg-fuchsia-500 text-white font-semibold hover:bg-fuchsia-600 print:bg-fuchsia-200 print:text-black" 
                              : !row.isAtivo 
                                ? "bg-slate-100 text-slate-400 italic hover:bg-slate-200/80" 
                                : "hover:bg-emerald-50/40 text-slate-800"
                          }`}
                        >
                          {/* Operação */}
                          <td className="p-3 font-bold font-mono border-r border-slate-200/80 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isHighlighted && <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0 print:hidden" />}
                              <span>{row.operacao}</span>
                            </div>
                          </td>

                          {/* Tipo */}
                          <td className="p-3 font-semibold border-r border-slate-200/80 whitespace-nowrap">
                            {row.tipo}
                          </td>

                          {/* Valor Original */}
                          <td className="p-3 text-right font-mono font-bold border-r border-slate-200/80 whitespace-nowrap">
                            {formatCurrency(row.valorOriginal)}
                          </td>

                          {/* Data Liberação */}
                          <td className="p-3 text-center border-r border-slate-200/80 font-mono whitespace-nowrap">
                            {formatDate(row.dataLiberacao) || "—"}
                          </td>

                          {/* Valor Liquidado */}
                          <td className="p-3 text-right font-mono border-r border-slate-200/80 whitespace-nowrap">
                            {formatCurrency(row.valorLiquidado)}
                          </td>

                          {/* Valor Cobrado Credora */}
                          <td className={`p-3 text-right font-mono font-bold border-r border-slate-200/80 whitespace-nowrap ${isHighlighted ? 'text-white' : 'text-red-700 bg-red-50/40'}`}>
                            {formatCurrency(row.valorCobradoCredora)}
                          </td>

                          {/* Valor Recalculado */}
                          <td className={`p-3 text-right font-mono font-bold border-r border-slate-200/80 whitespace-nowrap ${isHighlighted ? 'text-white' : 'text-emerald-800 bg-emerald-50/50'}`}>
                            {formatCurrency(row.valorRecalculado)}
                          </td>

                          {/* Diferença */}
                          <td className={`p-3 text-right font-mono font-black border-r border-slate-200/80 whitespace-nowrap ${isHighlighted ? 'text-amber-200' : 'text-amber-700 bg-amber-50/60'}`}>
                            {formatCurrency(row.diferenca)}
                          </td>

                          {/* Parcelas Vencidas */}
                          <td className="p-3 text-right font-mono border-r border-slate-200/80 whitespace-nowrap">
                            {formatCurrency(row.parcelasVencidas)}
                          </td>

                          {/* Parcelas a Vencer */}
                          <td className="p-3 text-right font-mono border-r border-slate-200/80 whitespace-nowrap">
                            {formatCurrency(row.parcelasAVencer)}
                          </td>

                          {/* Status & Highlight Controls */}
                          <td className="p-3 text-center print:hidden whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {onToggleAtivo && (
                                <button
                                  onClick={() => onToggleAtivo(row.simId, row.isAtivo)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                    row.isAtivo
                                      ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300"
                                      : "bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300"
                                  }`}
                                  title={row.isAtivo ? "Clique para desativar este contrato" : "Clique para ativar este contrato"}
                                >
                                  {row.isAtivo ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Ativo</span>
                                    </>
                                  ) : (
                                    <>
                                      <PowerOff className="w-3 h-3 text-slate-500" />
                                      <span>Inativo</span>
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                onClick={() => toggleHighlight(row.simId)}
                                className={`p-1 rounded-lg transition cursor-pointer ${
                                  isHighlighted
                                    ? "bg-amber-400 text-slate-950 font-bold"
                                    : "bg-slate-100 hover:bg-fuchsia-100 text-slate-500 hover:text-fuchsia-700 border border-slate-200"
                                }`}
                                title="Destacar linha em rosa (como na planilha)"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* SUMMARY FOOTER ROW - EXACTLY MATCHING EXCEL GREEN BAR */}
                <tfoot>
                  <tr className="bg-emerald-900 text-white font-black text-xs uppercase tracking-wider border-t-2 border-emerald-950">
                    <td colSpan={2} className="p-3.5 border-r border-emerald-800/80">
                      TOTAL ({somenteAtivos ? "contratos ativos" : "todos os contratos"})
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80">
                      {formatCurrency(totals.valorOriginal)}
                    </td>
                    <td className="p-3.5 border-r border-emerald-800/80"></td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80">
                      {formatCurrency(totals.valorLiquidado)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80 bg-red-950/80 text-amber-200">
                      {formatCurrency(totals.valorCobradoCredora)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80 bg-emerald-950 text-emerald-300">
                      {formatCurrency(totals.valorRecalculado)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80 bg-amber-400 text-slate-950 font-black">
                      {formatCurrency(totals.diferenca)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80 text-amber-300">
                      {formatCurrency(totals.parcelasVencidas)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-emerald-800/80 text-emerald-200">
                      {formatCurrency(totals.parcelasAVencer)}
                    </td>
                    <td className="p-3.5 text-center print:hidden">
                      {totals.countActive} ATIVOS
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* INFORMATIONAL NOTE */}
          <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Regra de Consolidação por Cliente (Atividades Recorrentes):</span>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              Para clientes que possuem repactuações ou contratos recorrentes, desative os contratos antigos ou quitados clicando no botão <strong>"Ativo/Inativo"</strong>. O resumo consolidado recalculará automaticamente os totais considerando <strong>apenas as cédulas e contratos vigentes (ativos)</strong>.
            </p>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong>{rowDataList.length}</strong> operação(ões) para <strong>{selectedEmitente || "Todos os clientes"}</strong>.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
          >
            Fechar Resumo
          </button>
        </div>

      </div>
    </div>
  );
};
