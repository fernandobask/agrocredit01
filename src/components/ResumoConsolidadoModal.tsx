import React, { useState, useMemo, useEffect } from "react";
import { 
  X, 
  Printer, 
  Download, 
  Sparkles, 
  Building2,
  UserCheck,
  Scale,
  CheckCircle2, 
  PowerOff, 
  Star,
  Info,
  TrendingDown,
  ArrowRight,
  Sliders,
  Check,
  FileSpreadsheet,
  Edit3,
  RotateCcw
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

// Inline Editable Currency Cell Component
const EditableCurrencyCell: React.FC<{
  value: number;
  isModified: boolean;
  onChange: (val: number) => void;
  onReset?: () => void;
  accentClass?: string;
  bgClass?: string;
  isHighlighted?: boolean;
}> = ({ value, isModified, onChange, onReset, accentClass = "text-slate-900", bgClass = "bg-transparent", isHighlighted = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(value.toString());

  useEffect(() => {
    if (!isEditing) {
      setTempText(value > 0 ? value.toFixed(2) : "0");
    }
  }, [value, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const sanitized = tempText.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    } else {
      setTempText(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setTempText(value.toString());
    }
  };

  return (
    <div className={`flex items-center justify-end gap-1 ${bgClass} p-1 rounded transition`}>
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-28 text-right bg-white border-2 border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-slate-950 focus:outline-hidden shadow-inner"
        />
      ) : (
        <div className="flex items-center gap-1 justify-end w-full">
          {isModified && onReset && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="text-amber-500 hover:text-red-500 p-0.5 rounded transition cursor-pointer"
              title="Restaurar valor padrão calculado"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => {
              setTempText(value > 0 ? value.toFixed(2) : "0");
              setIsEditing(true);
            }}
            className={`group flex items-center justify-end gap-1 text-right font-mono font-bold text-xs ${
              isHighlighted ? 'text-white' : accentClass
            } cursor-pointer hover:underline focus:outline-hidden`}
            title="Clique para editar este valor manualmente"
          >
            {isModified && (
              <span className="text-[9px] px-1 py-0.2 bg-amber-400 text-slate-950 font-black rounded uppercase tracking-tighter shrink-0">
                Manual
              </span>
            )}
            <span>{formatCurrency(value)}</span>
            <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
};

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

  // Proposal Column Titles (Editable/Customizable)
  const [nomeEspecialista, setNomeEspecialista] = useState<string>("Recalculado INPC (PROPOSTA)");
  const [nomeBanco, setNomeBanco] = useState<string>("SICREDI DDC");
  const [nomeTerceiro, setNomeTerceiro] = useState<string>("SANDRO RAUEN");
  const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false);

  // Set of highlighted contract IDs (pink/magenta highlight like in the Excel sheet)
  const [highlightedSimIds, setHighlightedSimIds] = useState<Set<string>>(new Set());

  // Manual numeric overrides per contract row: { [simId]: { valorBanco?: number, valorRecalculado?: number, valorTerceiro?: number } }
  const [manualOverrides, setManualOverrides] = useState<Record<string, { valorRecalculado?: number; valorBanco?: number; valorTerceiro?: number }>>({});

  const handleUpdateManualValue = (simId: string, field: 'valorRecalculado' | 'valorBanco' | 'valorTerceiro', val: number) => {
    setManualOverrides(prev => ({
      ...prev,
      [simId]: {
        ...prev[simId],
        [field]: isNaN(val) ? 0 : val
      }
    }));
  };

  const handleResetManualValue = (simId: string, field?: 'valorRecalculado' | 'valorBanco' | 'valorTerceiro') => {
    setManualOverrides(prev => {
      if (!prev[simId]) return prev;
      const nextSim = { ...prev[simId] };
      if (field) {
        delete nextSim[field];
      } else {
        const nextAll = { ...prev };
        delete nextAll[simId];
        return nextAll;
      }
      
      if (Object.keys(nextSim).length === 0) {
        const nextAll = { ...prev };
        delete nextAll[simId];
        return nextAll;
      }
      return { ...prev, [simId]: nextSim };
    });
  };

  const handleResetAllManualOverrides = () => {
    setManualOverrides({});
  };

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

      // 1. PROPOSTA DO CREDOR / BANCO (SICREDI DDC)
      let defaultValorBanco = 0;
      if (cData.valorEmissao && cData.valorEmissao > 0) {
        defaultValorBanco = cData.valorEmissao;
      } else {
        const years = 1;
        const taxa = (cData.taxaJurosAnual || 0) / 100;
        defaultValorBanco = (valorOriginal - valorLiquidado) * Math.pow(1 + taxa, years);
        if (defaultValorBanco < 0) defaultValorBanco = 0;
      }

      const hasManualBanco = manualOverrides[sim.id]?.valorBanco !== undefined;
      const valorBanco = hasManualBanco ? manualOverrides[sim.id].valorBanco! : defaultValorBanco;

      // 2. PROPOSTA DO ESPECIALISTA (RECALCULADO INPC / ÍNDICE SELECIONADO)
      let defaultValorRecalculado = 0;
      const cenarios = sim.scenariosData || sim.cenarios || [];

      if (selectedIndexador === "CENARIO_IA") {
        if (cenarios && cenarios.length > 0) {
          const bestCen = cenarios[0];
          const proj = bestCen.parcelas || [];
          if (proj.length > 0) {
            defaultValorRecalculado = proj.reduce((acc: number, p: any) => acc + (p.totalPago || 0), 0);
          } else {
            defaultValorRecalculado = (bestCen.totalPago || bestCen.totalAmortizado || valorOriginal) * 0.85;
          }
        } else {
          defaultValorRecalculado = Math.max(0, (valorOriginal - valorLiquidado) * 1.05);
        }
      } else {
        // Find scenario matching selected indexer
        const matchingCen = cenarios.find((c: any) => 
          (c.indexador || c.nome || "").toUpperCase().includes(selectedIndexador.toUpperCase())
        );

        if (matchingCen && matchingCen.parcelas && matchingCen.parcelas.length > 0) {
          defaultValorRecalculado = matchingCen.parcelas.reduce((acc: number, p: any) => acc + (p.totalPago || 0), 0);
        } else {
          // Dynamic recalculation using indexer rate + legal agricultural interest
          const saldoLiquido = Math.max(0, valorOriginal - valorLiquidado);
          let rateValue = 4.5; // default INPC
          if (selectedIndexador === "INPC") rateValue = indexadores?.INPC ?? 4.5;
          else if (selectedIndexador === "IPCA") rateValue = indexadores?.IPCA ?? 3.8;
          else if (selectedIndexador === "IGPM") rateValue = indexadores?.IGPM ?? 5.2;
          else if (selectedIndexador === "CDI") rateValue = indexadores?.CDI ?? 10.5;
          else if (selectedIndexador === "SELIC") rateValue = indexadores?.SELIC ?? 10.5;
          else if (selectedIndexador === "TAXA_LEGAL") rateValue = 0;
          else if (indexadores && (indexadores as any)[selectedIndexador] !== undefined) {
            rateValue = (indexadores as any)[selectedIndexador];
          }

          const totalRateAnnual = (rateValue / 100) + 0.08;
          let years = 1;
          if (dataLiberacao) {
            const pDate = parseDateSafely(dataLiberacao);
            if (pDate) {
              const diffMs = new Date().getTime() - pDate.getTime();
              if (diffMs > 0) years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
            }
          }

          defaultValorRecalculado = saldoLiquido * Math.pow(1 + totalRateAnnual, Math.min(years, 5));
        }
      }

      const hasManualRecalculado = manualOverrides[sim.id]?.valorRecalculado !== undefined;
      const valorRecalculado = hasManualRecalculado ? manualOverrides[sim.id].valorRecalculado! : defaultValorRecalculado;

      // 3. PROPOSTA DE TERCEIROS / PERITO (SANDRO RAUEN)
      let defaultValorTerceiro = 0;
      if (cData.valorTerceiro && cData.valorTerceiro > 0) {
        defaultValorTerceiro = cData.valorTerceiro;
      } else if (cenarios.length > 1 && cenarios[1].totalPago) {
        defaultValorTerceiro = cenarios[1].totalPago;
      } else {
        defaultValorTerceiro = Math.max(defaultValorBanco * 1.07, defaultValorRecalculado * 1.12);
      }

      const hasManualTerceiro = manualOverrides[sim.id]?.valorTerceiro !== undefined;
      const valorTerceiro = hasManualTerceiro ? manualOverrides[sim.id].valorTerceiro! : defaultValorTerceiro;

      // DIFERENÇAS DE COBRANÇA
      const diferencaBancoEspecialista = valorBanco - valorRecalculado;
      const diferencaTerceiroEspecialista = valorTerceiro - valorRecalculado;

      return {
        simId: sim.id,
        isAtivo,
        operacao,
        tipo,
        valorOriginal,
        dataLiberacao,
        valorLiquidado,
        valorBanco,
        valorRecalculado,
        valorTerceiro,
        hasManualBanco,
        hasManualRecalculado,
        hasManualTerceiro,
        diferencaBancoEspecialista,
        diferencaTerceiroEspecialista,
        parcelasVencidas,
        parcelasAVencer,
        credor: cData.credor || "Credora",
        emitente: cData.emitente || "Emitente"
      };
    });
  }, [filteredSimulations, selectedIndexador, indexadores, manualOverrides]);

  // Overall Total Calculations
  const totals = useMemo(() => {
    return rowDataList.reduce(
      (acc, r) => {
        acc.valorOriginal += r.valorOriginal;
        acc.valorLiquidado += r.valorLiquidado;
        acc.valorBanco += r.valorBanco;
        acc.valorRecalculado += r.valorRecalculado;
        acc.valorTerceiro += r.valorTerceiro;
        acc.diferencaBancoEspecialista += r.diferencaBancoEspecialista;
        acc.diferencaTerceiroEspecialista += r.diferencaTerceiroEspecialista;
        acc.parcelasVencidas += r.parcelasVencidas;
        acc.parcelasAVencer += r.parcelasAVencer;
        acc.countActive += r.isAtivo ? 1 : 0;
        acc.countTotal += 1;
        return acc;
      },
      {
        valorOriginal: 0,
        valorLiquidado: 0,
        valorBanco: 0,
        valorRecalculado: 0,
        valorTerceiro: 0,
        diferencaBancoEspecialista: 0,
        diferencaTerceiroEspecialista: 0,
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
    csv += `Índice Selecionado pelo Especialista: ${selectedIndexador}\n`;
    csv += `Filtro Aplicado: ${somenteAtivos ? "Apenas Contratos Ativos" : "Todos os Contratos (Ativos e Inativos)"}\n\n`;

    csv += `Operação;Modalidade;Data Liberação;Valor Liberado (R$);Valor Pago DDC (R$);Parcelas Vencidas (R$);Parcelas a Vencer (R$);${nomeEspecialista} (R$);${nomeBanco} (R$);${nomeTerceiro} (R$);Diferença Economia (R$);Status\n`;

    rowDataList.forEach(r => {
      csv += `${r.operacao};${r.tipo};${formatDate(r.dataLiberacao)};${formatCSVNumber(r.valorOriginal)};${formatCSVNumber(r.valorLiquidado)};${formatCSVNumber(r.parcelasVencidas)};${formatCSVNumber(r.parcelasAVencer)};${formatCSVNumber(r.valorRecalculado)};${formatCSVNumber(r.valorBanco)};${formatCSVNumber(r.valorTerceiro)};${formatCSVNumber(r.diferencaBancoEspecialista)};${r.isAtivo ? "Ativo" : "Inativo"}\n`;
    });

    csv += `\n`;
    csv += `TOTAL;;;${formatCSVNumber(totals.valorOriginal)};${formatCSVNumber(totals.valorLiquidado)};${formatCSVNumber(totals.parcelasVencidas)};${formatCSVNumber(totals.parcelasAVencer)};${formatCSVNumber(totals.valorRecalculado)};${formatCSVNumber(totals.valorBanco)};${formatCSVNumber(totals.valorTerceiro)};${formatCSVNumber(totals.diferencaBancoEspecialista)};${totals.countActive} ATIVOS\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Resumo_Consolidado_${selectedEmitente || "Geral"}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const credorDisplay = selectedCredor ? selectedCredor.toUpperCase() : "SICREDI / CREDORES CONSOLIDADOS";
  const emitenteDisplay = selectedEmitente ? selectedEmitente.toUpperCase() : "CLIENTE / EMITENTE";

  // Compute percentage savings
  const percentEconomia = totals.valorBanco > 0 
    ? ((totals.diferencaBancoEspecialista / totals.valorBanco) * 100).toFixed(1)
    : "0.0";

  const totalManualOverridesCount = Object.keys(manualOverrides).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-xl w-full max-w-7xl max-h-[94vh] flex flex-col overflow-hidden animate-fadeIn print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* MODAL HEADER - SOFT ELEGANT SLATE & EMERALD ACCENT */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800 print:bg-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded tracking-wide uppercase shadow-2xs">
                PRÉVIA PARA ANÁLISE
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded border border-emerald-500/20">
                Data-base: {new Date().toLocaleDateString("pt-BR")}
              </span>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-medium rounded border border-slate-700">
                {totals.countActive} de {totals.countTotal} operações ativas
              </span>
              {totalManualOverridesCount > 0 && (
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-xs font-bold rounded border border-amber-400/30 flex items-center gap-1">
                  <Edit3 className="w-3 h-3 text-amber-400" />
                  {totalManualOverridesCount} edições manuais
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg md:text-xl font-bold uppercase tracking-tight text-white leading-tight">
              RESUMO CONSOLIDADO ÚNICO — {emitenteDisplay} x {credorDisplay}
            </h2>
            <p className="text-xs text-slate-400">
              Consolidação técnica auditada e comparativo de propostas entre o Especialista, o Banco e Terceiros.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden shrink-0 self-end sm:self-auto flex-wrap">
            {totalManualOverridesCount > 0 && (
              <button
                onClick={handleResetAllManualOverrides}
                className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-lg border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
                title="Restaurar todos os valores calculados automaticamente"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Resetar Manuais</span>
              </button>
            )}

            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Personalizar nomes das propostas na tabela"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Propostas</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Exportar tabela para Excel CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-200" />
              <span className="hidden md:inline">Exportar Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimir ou Salvar como PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PROPOSAL NAMES CUSTOMIZATION BAR (EXPANDABLE) */}
        {showColumnSettings && (
          <div className="bg-slate-800 border-b border-slate-700 p-3 text-xs text-slate-200 print:hidden animate-fadeIn">
            <div className="flex items-center gap-2 mb-2 font-bold text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Personalizar Títulos das Propostas Comparativas:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Proposta 1 (Especialista):
                </label>
                <input
                  type="text"
                  value={nomeEspecialista}
                  onChange={e => setNomeEspecialista(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-semibold focus:outline-hidden focus:border-emerald-500"
                  placeholder="Ex: Recalculado INPC (PROPOSTA)"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Proposta 2 (Banco / Credor):
                </label>
                <input
                  type="text"
                  value={nomeBanco}
                  onChange={e => setNomeBanco(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 font-semibold focus:outline-hidden focus:border-rose-500"
                  placeholder="Ex: SICREDI DDC"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">
                  Proposta 3 (Terceiro / Perito):
                </label>
                <input
                  type="text"
                  value={nomeTerceiro}
                  onChange={e => setNomeTerceiro(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-semibold focus:outline-hidden focus:border-indigo-500"
                  placeholder="Ex: SANDRO RAUEN"
                />
              </div>
            </div>
          </div>
        )}

        {/* FILTERS & SCOPE BAR - SOFT CLEAN BACKGROUND */}
        <div className="bg-white border-b border-slate-200 p-3.5 sm:p-4 shrink-0 print:hidden">
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
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
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
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
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
                3. Índice p/ Especialista:
              </label>
              <select
                value={selectedIndexador}
                onChange={e => setSelectedIndexador(e.target.value)}
                className="w-full bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold rounded-xl px-3 py-1.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
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
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3.5 py-1.5 border border-slate-300 rounded-xl w-full shadow-2xs hover:bg-emerald-50/50 transition">
                <input
                  type="checkbox"
                  checked={somenteAtivos}
                  onChange={e => setSomenteAtivos(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  Somente Ativos <span className="text-[10px] text-emerald-700 font-semibold">({totals.countActive}/{totals.countTotal})</span>
                </span>
              </label>
            </div>

          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">

          {/* 1. PLANILHA DE VISUALIZAÇÃO DOS CONTRATOS (TABELA PRINCIPAL PRIMEIRO) */}
          <div className="border border-slate-200 rounded-2xl shadow-xs overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                
                {/* TABLE HEADER - CLEAN SOFT GREY WITH COLORED PROPOSAL BADGES */}
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b-2 border-slate-300">
                    <th className="p-3 border-r border-slate-200">Operação</th>
                    <th className="p-3 border-r border-slate-200">Modalidade</th>
                    <th className="p-3 text-center border-r border-slate-200">Data Liberação</th>
                    <th className="p-3 text-right border-r border-slate-200">Valor Liberado (R$)</th>
                    <th className="p-3 text-right border-r border-slate-200">Valor Pago DDC (R$)</th>
                    <th className="p-3 text-right border-r border-slate-200">Parcelas Vencidas (R$)</th>
                    <th className="p-3 text-right border-r border-slate-200">Parcelas a Vencer (R$)</th>

                    {/* PROPOSAL 1: ESPECIALISTA (INPC) */}
                    <th className="p-2 text-right border-r border-slate-200 bg-emerald-100/80 text-emerald-950 font-black min-w-[170px]">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 bg-white/80 border border-emerald-300 rounded px-1.5 py-0.5 shadow-2xs">
                          <Edit3 className="w-3 h-3 text-emerald-700 opacity-80 shrink-0" />
                          <input
                            type="text"
                            value={nomeEspecialista}
                            onChange={(e) => setNomeEspecialista(e.target.value)}
                            className="text-right bg-transparent font-black text-xs text-emerald-950 focus:outline-hidden w-36"
                            title="Clique para editar o nome da coluna do Especialista"
                            placeholder="Recalculado INPC"
                          />
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-600 text-white font-bold rounded tracking-wide uppercase">
                          Especialista ({selectedIndexador})
                        </span>
                      </div>
                    </th>

                    {/* PROPOSAL 2: BANCO (SICREDI DDC) */}
                    <th className="p-2 text-right border-r border-slate-200 bg-rose-100/80 text-rose-950 font-black min-w-[170px]">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 bg-white/80 border border-rose-300 rounded px-1.5 py-0.5 shadow-2xs">
                          <Edit3 className="w-3 h-3 text-rose-700 opacity-80 shrink-0" />
                          <input
                            type="text"
                            value={nomeBanco}
                            onChange={(e) => setNomeBanco(e.target.value)}
                            className="text-right bg-transparent font-black text-xs text-rose-950 focus:outline-hidden w-36"
                            title="Clique para editar o nome da coluna do Banco (ex: SICREDI DDC)"
                            placeholder="SICREDI DDC"
                          />
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 bg-rose-600 text-white font-bold rounded tracking-wide uppercase">
                          Cobrança Banco
                        </span>
                      </div>
                    </th>

                    {/* PROPOSAL 3: TERCEIRO (SANDRO RAUEN) */}
                    <th className="p-2 text-right border-r border-slate-200 bg-indigo-100/80 text-indigo-950 font-black min-w-[170px]">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 bg-white/80 border border-indigo-300 rounded px-1.5 py-0.5 shadow-2xs">
                          <Edit3 className="w-3 h-3 text-indigo-700 opacity-80 shrink-0" />
                          <input
                            type="text"
                            value={nomeTerceiro}
                            onChange={(e) => setNomeTerceiro(e.target.value)}
                            className="text-right bg-transparent font-black text-xs text-indigo-950 focus:outline-hidden w-36"
                            title="Clique para editar o nome da coluna de Terceiro (ex: SANDRO RAUEN)"
                            placeholder="SANDRO RAUEN"
                          />
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 bg-indigo-600 text-white font-bold rounded tracking-wide uppercase">
                          Perícia Terceiros
                        </span>
                      </div>
                    </th>

                    {/* DIFFERENCE / ECONOMIA */}
                    <th className="p-3 text-right border-r border-slate-200 bg-amber-100/90 text-amber-950 font-black">
                      Diferença (Economia)
                    </th>

                    <th className="p-3 text-center print:hidden">Status / Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {rowDataList.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-500 italic bg-slate-50">
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
                                : "hover:bg-slate-100/80 text-slate-800"
                          }`}
                        >
                          {/* Operação */}
                          <td className="p-3 font-bold font-mono border-r border-slate-200 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {isHighlighted && <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0 print:hidden" />}
                              <span>{row.operacao}</span>
                            </div>
                          </td>

                          {/* Modalidade */}
                          <td className="p-3 font-medium border-r border-slate-200 whitespace-nowrap">
                            {row.tipo}
                          </td>

                          {/* Data Liberação */}
                          <td className="p-3 text-center border-r border-slate-200 font-mono whitespace-nowrap">
                            {formatDate(row.dataLiberacao) || "—"}
                          </td>

                          {/* Valor Liberado */}
                          <td className="p-3 text-right font-mono font-bold border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(row.valorOriginal)}
                          </td>

                          {/* Valor Pago DDC */}
                          <td className="p-3 text-right font-mono border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(row.valorLiquidado)}
                          </td>

                          {/* Parcelas Vencidas */}
                          <td className="p-3 text-right font-mono border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(row.parcelasVencidas)}
                          </td>

                          {/* Parcelas a Vencer */}
                          <td className="p-3 text-right font-mono border-r border-slate-200 whitespace-nowrap">
                            {formatCurrency(row.parcelasAVencer)}
                          </td>

                          {/* 1. Recalculado INPC (PROPOSTA / Especialista) EDITÁVEL */}
                          <td className={`p-2 text-right border-r border-slate-200 whitespace-nowrap ${
                            isHighlighted ? 'bg-fuchsia-600' : 'bg-emerald-50/70'
                          }`}>
                            <EditableCurrencyCell
                              value={row.valorRecalculado}
                              isModified={row.hasManualRecalculado}
                              onChange={(val) => handleUpdateManualValue(row.simId, 'valorRecalculado', val)}
                              onReset={row.hasManualRecalculado ? () => handleResetManualValue(row.simId, 'valorRecalculado') : undefined}
                              accentClass="text-emerald-950"
                              isHighlighted={isHighlighted}
                            />
                          </td>

                          {/* 2. SICREDI DDC (Banco) EDITÁVEL */}
                          <td className={`p-2 text-right border-r border-slate-200 whitespace-nowrap ${
                            isHighlighted ? 'bg-fuchsia-600' : 'bg-rose-50/50'
                          }`}>
                            <EditableCurrencyCell
                              value={row.valorBanco}
                              isModified={row.hasManualBanco}
                              onChange={(val) => handleUpdateManualValue(row.simId, 'valorBanco', val)}
                              onReset={row.hasManualBanco ? () => handleResetManualValue(row.simId, 'valorBanco') : undefined}
                              accentClass="text-rose-950"
                              isHighlighted={isHighlighted}
                            />
                          </td>

                          {/* 3. SANDRO RAUEN (Terceiro / Perito) EDITÁVEL */}
                          <td className={`p-2 text-right border-r border-slate-200 whitespace-nowrap ${
                            isHighlighted ? 'bg-fuchsia-600' : 'bg-indigo-50/50'
                          }`}>
                            <EditableCurrencyCell
                              value={row.valorTerceiro}
                              isModified={row.hasManualTerceiro}
                              onChange={(val) => handleUpdateManualValue(row.simId, 'valorTerceiro', val)}
                              onReset={row.hasManualTerceiro ? () => handleResetManualValue(row.simId, 'valorTerceiro') : undefined}
                              accentClass="text-indigo-950"
                              isHighlighted={isHighlighted}
                            />
                          </td>

                          {/* Diferença (Economia Especialista vs Banco) */}
                          <td className={`p-3 text-right font-mono font-black border-r border-slate-200 whitespace-nowrap ${
                            isHighlighted ? 'text-amber-200' : 'text-amber-950 bg-amber-50/90'
                          }`}>
                            {formatCurrency(row.diferencaBancoEspecialista)}
                          </td>

                          {/* Status & Actions */}
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

                {/* SUMMARY FOOTER ROW - SOFT DARK SLATE FOOTER */}
                <tfoot>
                  <tr className="bg-slate-800 text-white font-black text-xs uppercase tracking-wider border-t-2 border-slate-900">
                    <td colSpan={3} className="p-3.5 border-r border-slate-700">
                      TOTAL ({somenteAtivos ? "contratos ativos" : "todos os contratos"})
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-slate-700">
                      {formatCurrency(totals.valorOriginal)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-slate-700">
                      {formatCurrency(totals.valorLiquidado)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-slate-700 text-amber-300">
                      {formatCurrency(totals.parcelasVencidas)}
                    </td>
                    <td className="p-3.5 text-right font-mono border-r border-slate-700 text-slate-300">
                      {formatCurrency(totals.parcelasAVencer)}
                    </td>

                    {/* Total Recalculado Especialista */}
                    <td className="p-3.5 text-right font-mono border-r border-slate-700 bg-emerald-950/80 text-emerald-300">
                      {formatCurrency(totals.valorRecalculado)}
                    </td>

                    {/* Total Banco */}
                    <td className="p-3.5 text-right font-mono border-r border-slate-700 bg-rose-950/80 text-rose-200">
                      {formatCurrency(totals.valorBanco)}
                    </td>

                    {/* Total Terceiro */}
                    <td className="p-3.5 text-right font-mono border-r border-slate-700 bg-indigo-950/80 text-indigo-200">
                      {formatCurrency(totals.valorTerceiro)}
                    </td>

                    {/* Total Economia */}
                    <td className="p-3.5 text-right font-mono border-r border-slate-700 bg-amber-400 text-slate-950 font-black">
                      {formatCurrency(totals.diferencaBancoEspecialista)}
                    </td>

                    <td className="p-3.5 text-center print:hidden text-slate-300">
                      {totals.countActive} ATIVOS
                    </td>
                  </tr>
                </tfoot>

              </table>
            </div>
          </div>

          {/* 2. SESSÃO: RESUMO COMPARATIVO DE PROPOSTAS & ANÁLISE DE ECONOMIA (AGORA ABAIXO DA PLANILHA) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Resumo Comparativo de Propostas & Análise de Economia
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comparação direta entre as propostas do Especialista, do Banco e de Terceiros. Clique no nome ou nos valores para editá-los livremente.
                  </p>
                </div>
              </div>

              {totals.diferencaBancoEspecialista > 0 && (
                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 shrink-0">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Economia Estimada: <strong className="text-emerald-950 font-black">{formatCurrency(totals.diferencaBancoEspecialista)}</strong> ({percentEconomia}% menor)</span>
                </div>
              )}
            </div>

            {/* 3 PROPOSAL CARDS COMPARISON */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* Card Proposta 1: Especialista */}
              <div className="bg-emerald-50/70 border-2 border-emerald-300 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-2xs relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-600 text-white font-bold text-[9px] uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                  Proposta Especialista
                </div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={nomeEspecialista}
                    onChange={(e) => setNomeEspecialista(e.target.value)}
                    className="text-xs font-bold text-emerald-950 bg-transparent border-b border-dashed border-emerald-400 focus:outline-hidden w-full"
                    title="Clique para editar este título"
                  />
                  <p className="text-xs text-emerald-700 leading-tight">
                    Índice: <strong>{selectedIndexador}</strong> + Juros Legais Agrícolas (8% a.a.)
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-200/80">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">Saldo Total Recalculado</span>
                  <p className="text-lg sm:text-xl font-black text-emerald-950 font-mono mt-0.5">
                    {formatCurrency(totals.valorRecalculado)}
                  </p>
                </div>

                <div className="text-[11px] text-emerald-800 bg-white/80 border border-emerald-200 rounded-lg p-2 font-medium flex items-center justify-between">
                  <span>Diferença vs Banco:</span>
                  <strong className="text-emerald-900 font-bold font-mono">
                    - {formatCurrency(totals.diferencaBancoEspecialista)}
                  </strong>
                </div>
              </div>

              {/* Card Proposta 2: Banco (SICREDI DDC) */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-2xs relative">
                <div className="absolute top-0 right-0 bg-rose-200 text-rose-900 font-bold text-[9px] uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                  Cobrança do Banco
                </div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={nomeBanco}
                    onChange={(e) => setNomeBanco(e.target.value)}
                    className="text-xs font-bold text-rose-950 bg-transparent border-b border-dashed border-rose-400 focus:outline-hidden w-full"
                    title="Clique para editar este título"
                  />
                  <p className="text-xs text-rose-800 leading-tight">
                    Cobrança exigida pelo Banco com encargos do contrato original.
                  </p>
                </div>

                <div className="pt-2 border-t border-rose-200/80">
                  <span className="text-[10px] text-rose-800 uppercase font-bold block">Saldo Exigido pelo Banco</span>
                  <p className="text-lg sm:text-xl font-black text-rose-950 font-mono mt-0.5">
                    {formatCurrency(totals.valorBanco)}
                  </p>
                </div>

                <div className="text-[11px] text-rose-900 bg-white/80 border border-rose-200 rounded-lg p-2 font-medium flex items-center justify-between">
                  <span>Excesso sobre Recálculo:</span>
                  <strong className="text-rose-950 font-bold font-mono">
                    + {formatCurrency(totals.diferencaBancoEspecialista)}
                  </strong>
                </div>
              </div>

              {/* Card Proposta 3: Terceiro (SANDRO RAUEN) */}
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-2xs relative">
                <div className="absolute top-0 right-0 bg-indigo-200 text-indigo-950 font-bold text-[9px] uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                  Parecer de Terceiros
                </div>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={nomeTerceiro}
                    onChange={(e) => setNomeTerceiro(e.target.value)}
                    className="text-xs font-bold text-indigo-950 bg-transparent border-b border-dashed border-indigo-400 focus:outline-hidden w-full"
                    title="Clique para editar este título"
                  />
                  <p className="text-xs text-indigo-800 leading-tight">
                    Avaliação/parecer técnico alternativo de terceiros.
                  </p>
                </div>

                <div className="pt-2 border-t border-indigo-200/80">
                  <span className="text-[10px] text-indigo-800 uppercase font-bold block">Saldo Proposta Terceiro</span>
                  <p className="text-lg sm:text-xl font-black text-indigo-950 font-mono mt-0.5">
                    {formatCurrency(totals.valorTerceiro)}
                  </p>
                </div>

                <div className="text-[11px] text-indigo-900 bg-white/80 border border-indigo-200 rounded-lg p-2 font-medium flex items-center justify-between">
                  <span>Diferença vs Especialista:</span>
                  <strong className="text-indigo-950 font-bold font-mono">
                    + {formatCurrency(totals.diferencaTerceiroEspecialista)}
                  </strong>
                </div>
              </div>

            </div>

            {/* BRIEF EXPLANATORY BANNER */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              <p className="leading-relaxed">
                <strong>Dica de Edição:</strong> Os nomes dos cabeçalhos das colunas (ex: <em>{nomeBanco}</em> e <em>{nomeTerceiro}</em>) e os valores de cada contrato podem ser **editados diretamente** na tabela acima ou nos campos dos cards. As economias e totais são recalculados em tempo real.
              </p>
            </div>

          </div>

          {/* INFORMATIONAL FOOTER NOTE */}
          <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block text-amber-950">Consolidação de Contratos por Cliente:</strong>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Para renegociações com reincidência de cédulas, desative operações quitadas ou substituídas no botão <strong>"Ativo/Inativo"</strong> para recalcular instantaneamente os totais do cliente.
              </p>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-slate-200 p-3.5 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-xs text-slate-500 font-medium">
            Exibindo <strong>{rowDataList.length}</strong> operação(ões) para <strong>{selectedEmitente || "Todos os clientes"}</strong>.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
          >
            Fechar Resumo Consolidado
          </button>
        </div>

      </div>
    </div>
  );
};
