import React, { useState, useMemo } from "react";
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
  Sliders,
  Pencil,
  RotateCcw,
  Maximize2,
  Minimize2
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

// Inline Editable Cell for Financial Numbers
interface EditableNumberCellProps {
  value: number;
  onChange: (val: number) => void;
  isOverridden?: boolean;
  bgClass?: string;
  textClass?: string;
  title?: string;
}

const EditableNumberCell: React.FC<EditableNumberCellProps> = ({
  value,
  onChange,
  isOverridden,
  bgClass = "",
  textClass = "",
  title = "Clique para editar este valor"
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>("");

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempValue(value.toString());
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const cleaned = tempValue.replace(/[R$\s.]/g, "").replace(",", ".");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        autoFocus
        value={tempValue}
        onChange={e => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-28 text-right font-mono font-bold text-xs bg-white text-slate-900 border-2 border-emerald-500 rounded px-1.5 py-0.5 focus:outline-hidden shadow-xs"
      />
    );
  }

  return (
    <div
      onClick={handleStartEditing}
      className={`group cursor-pointer py-1 px-1.5 rounded transition-all flex items-center justify-end gap-1 hover:bg-white hover:ring-2 hover:ring-emerald-400 ${bgClass} ${
        isOverridden ? "ring-2 ring-amber-400 bg-amber-50/90" : ""
      }`}
      title={title}
    >
      <span className={`font-mono font-bold ${textClass}`}>
        {formatCurrency(value)}
      </span>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-emerald-600 transition-opacity shrink-0 print:hidden" />
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
    if (!Array.isArray(simulations)) return [];
    return Array.from(
      new Set(
        simulations
          .map(s => (s?.contractData?.emitente || s?.contrato?.emitente || "").trim())
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

  // Keep selectedEmitente synced when modal opens or filter changes
  React.useEffect(() => {
    if (isOpen) {
      if (initialEmitente && uniqueEmitentes.includes(initialEmitente)) {
        setSelectedEmitente(initialEmitente);
      } else if (!selectedEmitente || !uniqueEmitentes.includes(selectedEmitente)) {
        if (uniqueEmitentes.length > 0) {
          setSelectedEmitente(uniqueEmitentes[0]);
        }
      }
    }
  }, [isOpen, initialEmitente, uniqueEmitentes]);

  // Selected credor filter
  const [selectedCredor, setSelectedCredor] = useState<string>("");

  // Selected indexer for recalculated balance calculation
  const [selectedIndexador, setSelectedIndexador] = useState<string>("INPC");

  // Only active filter checkbox (default true)
  const [somenteAtivos, setSomenteAtivos] = useState<boolean>(true);

  // Full Screen / Expanded View Mode (default true for full screen expansion)
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);

  // Proposal Column Titles and Subtitles (Editable/Customizable)
  const [nomeEspecialista, setNomeEspecialista] = useState<string>("Recalculado INPC (PROPOSTA)");
  const [subEspecialista, setSubEspecialista] = useState<string>("Especialista (INPC)");

  const [nomeBanco, setNomeBanco] = useState<string>("SICREDI DDC");
  const [subBanco, setSubBanco] = useState<string>("Cobrança Banco");

  const [nomeTerceiro, setNomeTerceiro] = useState<string>("SANDRO RAUEN");
  const [subTerceiro, setSubTerceiro] = useState<string>("Perícia Terceiros");

  const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false);

  // Row Value Overrides State (Manual Edits)
  const [rowOverrides, setRowOverrides] = useState<Record<string, {
    valorRecalculado?: number;
    valorBanco?: number;
    valorTerceiro?: number;
    valorOriginal?: number;
    valorLiquidado?: number;
    parcelasVencidas?: number;
    parcelasAVencer?: number;
  }>>({});

  const updateRowOverride = (simId: string, field: string, value: number) => {
    setRowOverrides(prev => ({
      ...prev,
      [simId]: {
        ...prev[simId],
        [field]: value
      }
    }));
  };

  const clearAllOverrides = () => {
    setRowOverrides({});
  };

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
      const simId = sim.id;

      const override = rowOverrides[simId] || {};

      const operacao = cData.numero || sim.name || "S/N";
      const tipo = cData.modalidade || "CPR";
      const valorOriginalCalc = cData.valorPrincipal || 0;
      const dataLiberacao = cData.dataEmissao || "";

      // Calculate paid / liquidated amount from parcelas
      const cronograma = cData.cronogramaParcelas || [];
      let valorLiquidadoCalc = 0;
      let parcelasVencidasCalc = 0;
      let parcelasAVencerCalc = 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      cronograma.forEach((p: any) => {
        const pDate = parseDateSafely(p.data);
        pDate.setHours(0, 0, 0, 0);
        
        // Percentual or manual principal
        const valParc = p.valorPrincipalManual !== undefined && p.valorPrincipalManual > 0 
          ? p.valorPrincipalManual 
          : valorOriginalCalc * ((p.percentualAmortizacao || 0) / 100);

        if (p.paga) {
          valorLiquidadoCalc += p.valorAmortizadoPago || valParc;
        } else {
          if (pDate.getTime() < today.getTime()) {
            parcelasVencidasCalc += valParc;
          } else {
            parcelasAVencerCalc += valParc;
          }
        }
      });

      // 1. PROPOSTA DO CREDOR / BANCO (SICREDI DDC)
      let calculatedBanco = 0;
      if (cData.valorEmissao && cData.valorEmissao > 0) {
        calculatedBanco = cData.valorEmissao;
      } else {
        const years = 1;
        const taxa = (cData.taxaJurosAnual || 0) / 100;
        calculatedBanco = (valorOriginalCalc - valorLiquidadoCalc) * Math.pow(1 + taxa, years);
        if (calculatedBanco < 0) calculatedBanco = 0;
      }

      // 2. PROPOSTA DO ESPECIALISTA (RECALCULADO INPC / ÍNDICE SELECIONADO)
      let calculatedRecalculado = 0;
      const cenarios = sim.scenariosData || sim.cenarios || [];

      if (selectedIndexador === "CENARIO_IA") {
        if (cenarios && cenarios.length > 0) {
          const bestCen = cenarios[0];
          const proj = bestCen.parcelas || [];
          if (proj.length > 0) {
            calculatedRecalculado = proj.reduce((acc: number, p: any) => acc + (p.totalPago || 0), 0);
          } else {
            calculatedRecalculado = (bestCen.totalPago || bestCen.totalAmortizado || valorOriginalCalc) * 0.85;
          }
        } else {
          calculatedRecalculado = Math.max(0, (valorOriginalCalc - valorLiquidadoCalc) * 1.05);
        }
      } else {
        // Find scenario matching selected indexer
        const matchingCen = cenarios.find((c: any) => 
          (c.indexador || c.nome || "").toUpperCase().includes(selectedIndexador.toUpperCase())
        );

        if (matchingCen && matchingCen.parcelas && matchingCen.parcelas.length > 0) {
          calculatedRecalculado = matchingCen.parcelas.reduce((acc: number, p: any) => acc + (p.totalPago || 0), 0);
        } else {
          // Dynamic recalculation using indexer rate + legal agricultural interest
          const saldoLiquido = Math.max(0, valorOriginalCalc - valorLiquidadoCalc);
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

          calculatedRecalculado = saldoLiquido * Math.pow(1 + totalRateAnnual, Math.min(years, 5));
        }
      }

      // 3. PROPOSTA DE TERCEIROS / PERITO (SANDRO RAUEN)
      let calculatedTerceiro = 0;
      if (cData.valorTerceiro && cData.valorTerceiro > 0) {
        calculatedTerceiro = cData.valorTerceiro;
      } else if (cenarios.length > 1 && cenarios[1].totalPago) {
        calculatedTerceiro = cenarios[1].totalPago;
      } else {
        calculatedTerceiro = Math.max(calculatedBanco * 1.07, calculatedRecalculado * 1.12);
      }

      // APPLY USER MANUAL OVERRIDES IF PRESENT
      const valorOriginal = override.valorOriginal !== undefined ? override.valorOriginal : valorOriginalCalc;
      const valorLiquidado = override.valorLiquidado !== undefined ? override.valorLiquidado : valorLiquidadoCalc;
      const parcelasVencidas = override.parcelasVencidas !== undefined ? override.parcelasVencidas : parcelasVencidasCalc;
      const parcelasAVencer = override.parcelasAVencer !== undefined ? override.parcelasAVencer : parcelasAVencerCalc;

      const valorBanco = override.valorBanco !== undefined ? override.valorBanco : calculatedBanco;
      const valorRecalculado = override.valorRecalculado !== undefined ? override.valorRecalculado : calculatedRecalculado;
      const valorTerceiro = override.valorTerceiro !== undefined ? override.valorTerceiro : calculatedTerceiro;

      // DIFERENÇAS DE COBRANÇA
      const diferencaBancoEspecialista = valorBanco - valorRecalculado;
      const diferencaTerceiroEspecialista = valorTerceiro - valorRecalculado;

      const isOverridden = Object.keys(override).length > 0;

      return {
        simId,
        isAtivo,
        isOverridden,
        operacao,
        tipo,
        valorOriginal,
        dataLiberacao,
        valorLiquidado,
        valorBanco,
        valorRecalculado,
        valorTerceiro,
        diferencaBancoEspecialista,
        diferencaTerceiroEspecialista,
        parcelasVencidas,
        parcelasAVencer,
        credor: cData.credor || "Credora",
        emitente: cData.emitente || "Emitente"
      };
    });
  }, [filteredSimulations, selectedIndexador, indexadores, rowOverrides]);

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

    csv += `Operação;Modalidade;Data Liberação;Valor Liberado (R$);Valor Pago DDC (R$);Parcelas Vencidas (R$);Parcelas a Vencer (R$);${nomeEspecialista} (${subEspecialista}) (R$);${nomeBanco} (${subBanco}) (R$);${nomeTerceiro} (${subTerceiro}) (R$);Diferença Economia (R$);Status\n`;

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
    const credorTitle = selectedCredor ? selectedCredor.toUpperCase() : "SICREDI / CREDORES CONSOLIDADOS";
    const emitenteTitle = selectedEmitente ? selectedEmitente.toUpperCase() : "TODOS OS EMITENTES";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const rowsHtml = rowDataList.map((r, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 10px;">
        <td style="padding: 6px 8px; font-weight: bold; font-family: monospace; border: 1px solid #cbd5e1;">${r.operacao}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${r.tipo}</td>
        <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1;">${formatDate(r.dataLiberacao)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(r.valorOriginal)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(r.valorLiquidado)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; color: #dc2626;">${formatCurrency(r.parcelasVencidas)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(r.parcelasAVencer)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; background-color: #d1fae5; color: #065f46;">${formatCurrency(r.valorRecalculado)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; background-color: #ffe4e6; color: #881337;">${formatCurrency(r.valorBanco)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; background-color: #e0e7ff; color: #3730a3;">${formatCurrency(r.valorTerceiro)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; background-color: #fef3c7; color: #78350f;">${formatCurrency(r.diferencaBancoEspecialista)}</td>
        <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: ${r.isAtivo ? '#166534' : '#94a3b8'};">${r.isAtivo ? 'ATIVO' : 'INATIVO'}</td>
      </tr>
    `).join("");

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>RESUMO CONSOLIDADO ÚNICO — ${emitenteTitle}</title>
        <style>
          @page {
            size: landscape;
            margin: 8mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 16px;
            background: #ffffff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .header {
            border-bottom: 3px solid #047857;
            padding-bottom: 10px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .title {
            font-size: 17px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: -0.3px;
          }
          .subtitle {
            font-size: 11px;
            color: #475569;
            margin-top: 3px;
          }
          .badge-row {
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
            font-size: 10px;
          }
          .badge {
            padding: 5px 10px;
            border-radius: 6px;
            font-weight: bold;
          }
          .badge-emerald { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
          .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .badge-slate { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            background-color: #0f172a;
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 8px 6px;
            border: 1px solid #334155;
            text-align: center;
          }
          th.th-especialista { background-color: #065f46; border-color: #047857; }
          th.th-banco { background-color: #881337; border-color: #9f1239; }
          th.th-terceiro { background-color: #3730a3; border-color: #4338ca; }
          th.th-economia { background-color: #78350f; border-color: #92400e; }
          
          tfoot td {
            background-color: #0f172a;
            color: #ffffff;
            font-weight: bold;
            font-size: 10px;
            padding: 8px 6px;
            border: 1px solid #334155;
          }
          tfoot td.tf-economia {
            background-color: #fbbf24;
            color: #0f172a;
            font-weight: 900;
            font-size: 11px;
          }
          .footer-note {
            margin-top: 14px;
            font-size: 10px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">RESUMO CONSOLIDADO ÚNICO — DEMONSTRATIVO DE OPERAÇÕES E PROPOSTAS</div>
            <div class="subtitle">Consolidação Técnica Auditada x Comparativo de Propostas de Reequilíbrio Financeiro</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 13px; font-weight: 900; color: #0f172a;">${emitenteTitle}</div>
            <div style="font-size: 10px; color: #475569;">Credor: ${credorTitle}</div>
          </div>
        </div>

        <div class="badge-row">
          <div class="badge badge-emerald">Data-base: ${new Date().toLocaleDateString("pt-BR")}</div>
          <div class="badge badge-amber">Índice Selecionado: ${selectedIndexador}</div>
          <div class="badge badge-slate">Operações: ${rowDataList.length} (${totals.countActive} Ativas)</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Operação</th>
              <th>Mod.</th>
              <th>Liberação</th>
              <th>Valor Liberado</th>
              <th>Valor Pago DDC</th>
              <th>Parc. Vencidas</th>
              <th>Parc. a Vencer</th>
              <th class="th-especialista">${nomeEspecialista}<br/><span style="font-weight:normal; font-size:8px;">(${subEspecialista})</span></th>
              <th class="th-banco">${nomeBanco}<br/><span style="font-weight:normal; font-size:8px;">(${subBanco})</span></th>
              <th class="th-terceiro">${nomeTerceiro}<br/><span style="font-weight:normal; font-size:8px;">(${subTerceiro})</span></th>
              <th class="th-economia">Diferença (Economia)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: center;">TOTALIZADOR GERAL</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(totals.valorOriginal)}</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(totals.valorLiquidado)}</td>
              <td style="text-align: right; font-family: monospace; color: #fca5a5;">${formatCurrency(totals.parcelasVencidas)}</td>
              <td style="text-align: right; font-family: monospace;">${formatCurrency(totals.parcelasAVencer)}</td>
              <td style="text-align: right; font-family: monospace; background-color: #065f46; color: #ffffff;">${formatCurrency(totals.valorRecalculado)}</td>
              <td style="text-align: right; font-family: monospace; background-color: #881337; color: #ffffff;">${formatCurrency(totals.valorBanco)}</td>
              <td style="text-align: right; font-family: monospace; background-color: #3730a3; color: #ffffff;">${formatCurrency(totals.valorTerceiro)}</td>
              <td class="tf-economia" style="text-align: right; font-family: monospace;">${formatCurrency(totals.diferencaBancoEspecialista)}</td>
              <td style="text-align: center;">${totals.countActive} ATIVOS</td>
            </tr>
          </tfoot>
        </table>

        <div class="footer-note">
          <div>Relatório emitido em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} — Sistema de Perícia & Auditoria Rural</div>
          <div>Formato de Impressão: <strong>PAISAGEM (LANDSCAPE)</strong></div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  const credorDisplay = selectedCredor ? selectedCredor.toUpperCase() : "SICREDI / CREDORES CONSOLIDADOS";
  const emitenteDisplay = selectedEmitente ? selectedEmitente.toUpperCase() : "CLIENTE / EMITENTE";

  // Compute percentage savings
  const percentEconomia = totals.valorBanco > 0 
    ? ((totals.diferencaBancoEspecialista / totals.valorBanco) * 100).toFixed(1)
    : "0.0";

  const totalOverridesCount = Object.keys(rowOverrides).length;

  return (
    <div className={
      isFullScreen 
        ? "fixed inset-0 z-[100] flex flex-col bg-slate-900 overflow-hidden p-0 print:p-0 print:bg-white" 
        : "fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-2 bg-slate-900/80 backdrop-blur-md overflow-hidden print:p-0 print:bg-white"
    }>
      <div className={
        isFullScreen 
          ? "bg-slate-50 border-none shadow-none w-screen h-screen max-w-none max-h-none flex flex-col overflow-hidden animate-fadeIn print:max-h-none print:shadow-none print:border-none print:rounded-none" 
          : "bg-slate-50 border border-slate-300 rounded-xl shadow-2xl w-full h-full max-w-none max-h-none flex flex-col overflow-hidden animate-fadeIn print:max-h-none print:shadow-none print:border-none print:rounded-none"
      }>
        
        {/* MODAL HEADER - SOFT ELEGANT LIGHT EXECUTIVE THEME */}
        <div className="bg-white text-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-slate-200 print:bg-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-black text-[10px] rounded tracking-wide uppercase shadow-2xs border border-amber-300">
                PRÉVIA PARA ANÁLISE
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded border border-emerald-300">
                Data-base: {new Date().toLocaleDateString("pt-BR")}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium rounded border border-slate-300">
                {totals.countActive} de {totals.countTotal} operações ativas
              </span>
            </div>
            <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900 leading-tight">
              RESUMO CONSOLIDADO ÚNICO — {emitenteDisplay} x {credorDisplay}
            </h2>
            <p className="text-xs text-slate-500">
              Consolidação técnica auditada e comparativo de propostas entre o Especialista, o Banco e Terceiros.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setShowColumnSettings(!showColumnSettings)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-300 cursor-pointer shadow-2xs"
              title="Personalizar nomes e descrições das propostas"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>Personalizar Nomes</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Exportar tabela para Excel CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-100" />
              <span className="hidden md:inline">Exportar Excel</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-slate-800 font-bold text-xs rounded-xl hover:bg-slate-100 transition flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer"
              title="Imprimir ou Salvar como PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition border border-slate-200 cursor-pointer"
              title={isFullScreen ? "Restaurar tamanho reduzido" : "Expandir para Tela Cheia (100%)"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4 text-emerald-700" /> : <Maximize2 className="w-4 h-4 text-emerald-700" />}
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

        {/* PROPOSAL NAMES & SUBTITLES CUSTOMIZATION BAR (EXPANDABLE) */}
        {showColumnSettings && (
          <div className="bg-slate-800 border-b border-slate-700 p-3.5 text-xs text-slate-200 print:hidden animate-fadeIn">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-200">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Personalizar Títulos e Legendas das Propostas Comparativas:</span>
              </div>
              <span className="text-[11px] text-slate-400 italic">
                (Altera os cabeçalhos da planilha e os cartões de resumo)
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Proposta 1: Especialista */}
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-emerald-500/30 space-y-2">
                <label className="block text-[10px] text-emerald-400 uppercase font-bold">
                  1. Proposta Especialista:
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={nomeEspecialista}
                    onChange={e => setNomeEspecialista(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-bold focus:outline-hidden focus:border-emerald-500"
                    placeholder="Título Ex: Recalculado INPC (PROPOSTA)"
                  />
                  <input
                    type="text"
                    value={subEspecialista}
                    onChange={e => setSubEspecialista(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-emerald-400/90 focus:outline-hidden focus:border-emerald-500"
                    placeholder="Legenda Ex: Especialista (INPC)"
                  />
                </div>
              </div>

              {/* Proposta 2: Banco */}
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-rose-500/30 space-y-2">
                <label className="block text-[10px] text-rose-400 uppercase font-bold">
                  2. Proposta Banco / Credor:
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={nomeBanco}
                    onChange={e => setNomeBanco(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-rose-300 font-bold focus:outline-hidden focus:border-rose-500"
                    placeholder="Título Ex: SICREDI DDC"
                  />
                  <input
                    type="text"
                    value={subBanco}
                    onChange={e => setSubBanco(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-rose-400/90 focus:outline-hidden focus:border-rose-500"
                    placeholder="Legenda Ex: Cobrança Banco"
                  />
                </div>
              </div>

              {/* Proposta 3: Terceiro */}
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-500/30 space-y-2">
                <label className="block text-[10px] text-indigo-400 uppercase font-bold">
                  3. Proposta Terceiro / Perito:
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={nomeTerceiro}
                    onChange={e => setNomeTerceiro(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-bold focus:outline-hidden focus:border-indigo-500"
                    placeholder="Título Ex: SANDRO RAUEN"
                  />
                  <input
                    type="text"
                    value={subTerceiro}
                    onChange={e => setSubTerceiro(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-indigo-400/90 focus:outline-hidden focus:border-indigo-500"
                    placeholder="Legenda Ex: Perícia Terceiros"
                  />
                </div>
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

            {/* Status & Overrides Controls */}
            <div className="md:col-span-3 flex items-center justify-between gap-2 pt-2 sm:pt-4">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 border border-slate-300 rounded-xl flex-1 shadow-2xs hover:bg-emerald-50/50 transition">
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

              {totalOverridesCount > 0 && (
                <button
                  onClick={clearAllOverrides}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                  title="Restaurar todos os valores calculados automaticamente"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  <span>Restaurar ({totalOverridesCount})</span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">

          {/* 1. TABLE CONTAINER (PLANILHA) FIRST */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-900 text-white rounded-lg">
                  <Scale className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Planilha Demonstrativa de Operações & Propostas
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Clique em qualquer valor das colunas de proposta para editar manualmente os valores em tempo real.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 text-[10px] font-bold">
                  <Pencil className="w-3 h-3 text-emerald-600" /> Colunas & Valores Editáveis
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl shadow-xs overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  
                  {/* TABLE HEADER - CLEAN SOFT GREY WITH EDITABLE PROPOSAL HEADERS */}
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider border-b-2 border-slate-300">
                      <th className="p-3 border-r border-slate-200">Operação</th>
                      <th className="p-3 border-r border-slate-200">Modalidade</th>
                      <th className="p-3 text-center border-r border-slate-200">Data Liberação</th>
                      <th className="p-3 text-right border-r border-slate-200">Valor Liberado (R$)</th>
                      <th className="p-3 text-right border-r border-slate-200">Valor Pago DDC (R$)</th>
                      <th className="p-3 text-right border-r border-slate-200">Parcelas Vencidas (R$)</th>
                      <th className="p-3 text-right border-r border-slate-200">Parcelas a Vencer (R$)</th>

                      {/* PROPOSAL 1: ESPECIALISTA (EDITABLE HEADER) */}
                      <th className="p-3 text-right border-r border-slate-200 bg-emerald-100/90 text-emerald-950 font-black min-w-[260px]">
                        <div className="flex flex-col items-end gap-1.5 w-full">
                          <div className="w-full flex items-center justify-end gap-1">
                            <Pencil className="w-3 h-3 text-emerald-700 opacity-60 shrink-0 print:hidden" />
                            <input
                              type="text"
                              value={nomeEspecialista}
                              onChange={e => setNomeEspecialista(e.target.value)}
                              className="text-right bg-transparent border-b border-dashed border-emerald-700 hover:border-emerald-900 font-black text-xs text-emerald-950 focus:outline-hidden focus:bg-white focus:rounded focus:px-2 py-0.5 w-full transition-all cursor-pointer"
                              title="Clique para editar o nome desta coluna"
                              placeholder="Nome da proposta"
                            />
                          </div>
                          <input
                            type="text"
                            value={subEspecialista}
                            onChange={e => setSubEspecialista(e.target.value)}
                            className="text-[10px] text-right bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded px-2 py-0.5 border-none focus:outline-hidden focus:ring-1 focus:ring-emerald-900 w-full transition-all cursor-pointer"
                            title="Clique para editar a legenda desta coluna"
                            placeholder="Legenda da proposta"
                          />
                        </div>
                      </th>

                      {/* PROPOSAL 2: BANCO (SICREDI DDC - EDITABLE HEADER) */}
                      <th className="p-3 text-right border-r border-slate-200 bg-rose-100/90 text-rose-950 font-black min-w-[260px]">
                        <div className="flex flex-col items-end gap-1.5 w-full">
                          <div className="w-full flex items-center justify-end gap-1">
                            <Pencil className="w-3 h-3 text-rose-700 opacity-60 shrink-0 print:hidden" />
                            <input
                              type="text"
                              value={nomeBanco}
                              onChange={e => setNomeBanco(e.target.value)}
                              className="text-right bg-transparent border-b border-dashed border-rose-700 hover:border-rose-900 font-black text-xs text-rose-950 focus:outline-hidden focus:bg-white focus:rounded focus:px-2 py-0.5 w-full transition-all cursor-pointer"
                              title="Clique para editar o nome desta coluna"
                              placeholder="Nome da proposta do banco"
                            />
                          </div>
                          <input
                            type="text"
                            value={subBanco}
                            onChange={e => setSubBanco(e.target.value)}
                            className="text-[10px] text-right bg-rose-600 hover:bg-rose-700 text-white font-bold rounded px-2 py-0.5 border-none focus:outline-hidden focus:ring-1 focus:ring-rose-900 w-full transition-all cursor-pointer"
                            title="Clique para editar a legenda desta coluna"
                            placeholder="Legenda da proposta"
                          />
                        </div>
                      </th>

                      {/* PROPOSAL 3: TERCEIRO (SANDRO RAUEN - EDITABLE HEADER) */}
                      <th className="p-3 text-right border-r border-slate-200 bg-indigo-100/90 text-indigo-950 font-black min-w-[260px]">
                        <div className="flex flex-col items-end gap-1.5 w-full">
                          <div className="w-full flex items-center justify-end gap-1">
                            <Pencil className="w-3 h-3 text-indigo-700 opacity-60 shrink-0 print:hidden" />
                            <input
                              type="text"
                              value={nomeTerceiro}
                              onChange={e => setNomeTerceiro(e.target.value)}
                              className="text-right bg-transparent border-b border-dashed border-indigo-700 hover:border-indigo-900 font-black text-xs text-indigo-950 focus:outline-hidden focus:bg-white focus:rounded focus:px-2 py-0.5 w-full transition-all cursor-pointer"
                              title="Clique para editar o nome desta coluna"
                              placeholder="Nome da proposta de terceiros"
                            />
                          </div>
                          <input
                            type="text"
                            value={subTerceiro}
                            onChange={e => setSubTerceiro(e.target.value)}
                            className="text-[10px] text-right bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded px-2 py-0.5 border-none focus:outline-hidden focus:ring-1 focus:ring-indigo-900 w-full transition-all cursor-pointer"
                            title="Clique para editar a legenda desta coluna"
                            placeholder="Legenda da proposta"
                          />
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
                                {row.isOverridden && (
                                  <span className="px-1 py-0.2 bg-amber-400 text-slate-950 text-[9px] font-black rounded print:hidden" title="Contém valores editados manualmente">
                                    editado
                                  </span>
                                )}
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

                            {/* Valor Liberado (Editable) */}
                            <td className="p-2 text-right border-r border-slate-200 whitespace-nowrap">
                              <EditableNumberCell
                                value={row.valorOriginal}
                                onChange={val => updateRowOverride(row.simId, "valorOriginal", val)}
                                isOverridden={rowOverrides[row.simId]?.valorOriginal !== undefined}
                                textClass={isHighlighted ? "text-white" : "text-slate-900 font-bold"}
                                title="Clique para editar o Valor Liberado"
                              />
                            </td>

                            {/* Valor Pago DDC (Editable) */}
                            <td className="p-2 text-right border-r border-slate-200 whitespace-nowrap">
                              <EditableNumberCell
                                value={row.valorLiquidado}
                                onChange={val => updateRowOverride(row.simId, "valorLiquidado", val)}
                                isOverridden={rowOverrides[row.simId]?.valorLiquidado !== undefined}
                                textClass={isHighlighted ? "text-white" : "text-slate-700"}
                                title="Clique para editar o Valor Pago"
                              />
                            </td>

                            {/* Parcelas Vencidas (Editable) */}
                            <td className="p-2 text-right border-r border-slate-200 whitespace-nowrap">
                              <EditableNumberCell
                                value={row.parcelasVencidas}
                                onChange={val => updateRowOverride(row.simId, "parcelasVencidas", val)}
                                isOverridden={rowOverrides[row.simId]?.parcelasVencidas !== undefined}
                                textClass={isHighlighted ? "text-amber-200" : "text-slate-700"}
                                title="Clique para editar as Parcelas Vencidas"
                              />
                            </td>

                            {/* Parcelas a Vencer (Editable) */}
                            <td className="p-2 text-right border-r border-slate-200 whitespace-nowrap">
                              <EditableNumberCell
                                value={row.parcelasAVencer}
                                onChange={val => updateRowOverride(row.simId, "parcelasAVencer", val)}
                                isOverridden={rowOverrides[row.simId]?.parcelasAVencer !== undefined}
                                textClass={isHighlighted ? "text-slate-200" : "text-slate-700"}
                                title="Clique para editar as Parcelas a Vencer"
                              />
                            </td>

                            {/* 1. Recalculado ESPECIALISTA (EDITABLE VALUE) */}
                            <td className={`p-2 text-right border-r border-slate-200 whitespace-nowrap ${
                              isHighlighted ? 'text-white' : 'bg-emerald-50/70'
                            }`}>
                              <EditableNumberCell
                                value={row.valorRecalculado}
                                onChange={val => updateRowOverride(row.simId, "valorRecalculado", val)}
                                isOverridden={rowOverrides[row.simId]?.valorRecalculado !== undefined}
                                bgClass={isHighlighted ? "" : "hover:bg-emerald-100/60"}
                                textClass={isHighlighted ? "text-white" : "text-emerald-950 font-black"}
                                title={`Clique para editar o valor da proposta (${nomeEspecialista})`}
                              />
                            </td>

                            {/* 2. SICREDI DDC / BANCO (EDITABLE VALUE) */}
                            <td className={`p-2 text-right border-r border-slate-200 whitespace-nowrap ${
                              isHighlighted ? 'text-white' : 'bg-rose-50/50'
                            }`}>
                              <EditableNumberCell
                                value={row.valorBanco}
                                onChange={val => updateRowOverride(row.simId, "valorBanco", val)}
                                isOverridden={rowOverrides[row.simId]?.valorBanco !== undefined}
                                bgClass={isHighlighted ? "" : "hover:bg-rose-100/60"}
                                textClass={isHighlighted ? "text-white" : "text-rose-950 font-black"}
                                title={`Clique para editar o valor da cobrança do banco (${nomeBanco})`}
                              />
                            </td>

                            {/* 3. SANDRO RAUEN / TERCEIRO (EDITABLE VALUE) */}
                            <td className={`p-2 text-right border-r border-slate-200 whitespace-nowrap ${
                              isHighlighted ? 'text-white' : 'bg-indigo-50/50'
                            }`}>
                              <EditableNumberCell
                                value={row.valorTerceiro}
                                onChange={val => updateRowOverride(row.simId, "valorTerceiro", val)}
                                isOverridden={rowOverrides[row.simId]?.valorTerceiro !== undefined}
                                bgClass={isHighlighted ? "" : "hover:bg-indigo-100/60"}
                                textClass={isHighlighted ? "text-white" : "text-indigo-950 font-black"}
                                title={`Clique para editar o valor da proposta de terceiros (${nomeTerceiro})`}
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
          </div>

          {/* 2. RESUMO COMPARATIVO DE PROPOSTAS & ANÁLISE DE ECONOMIA (MOVED BELOW PLANILHA) */}
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
                    Comparação direta entre as propostas do Especialista, do Banco e de Terceiros.
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
                  {subEspecialista}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-900 block">{nomeEspecialista}</span>
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
                  {subBanco}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-rose-950 block">{nomeBanco}</span>
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
                  {subTerceiro}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-indigo-950 block">{nomeTerceiro}</span>
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
                <strong>Explicação das Colunas:</strong> A proposta do <strong>Especialista ({nomeEspecialista})</strong> aplica o recálculo do saldo devedor ajustado por índice legal e teto rural. A proposta do <strong>Banco ({nomeBanco})</strong> reflete a dívida cobrada pela instituição. A proposta de <strong>Terceiro ({nomeTerceiro})</strong> traz o parecer pericial externo para benchmarking de repactuação.
              </p>
            </div>

          </div>

          {/* INFORMATIONAL FOOTER NOTE */}
          <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="block text-amber-950">Consolidação de Contratos por Cliente:</strong>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Para renegociações com reincidência de cédulas, desative operações quitadas ou substituídas no botão <strong>"Ativo/Inativo"</strong> para recalcular instantaneamente os totais do cliente. Edite qualquer valor diretamente nas células da planilha.
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
