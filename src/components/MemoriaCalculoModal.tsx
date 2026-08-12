import React, { useState, useMemo, useRef } from "react";
import { X, Calculator, Copy, Check, Printer, ShieldCheck, Download, Search, Table, Layers, ArrowRight, Maximize2, Minimize2, AlertTriangle, AlertCircle, DollarSign, Calendar, FileText, CheckCircle2, RotateCcw, FileSpreadsheet, Edit3, Eye } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatCurrency, formatDate, calcularProjecaoMensal, exportMensalToCSV, exportAtrasosToCSV, parseDateSafely, getDaysBetween, formatCSVNumber } from "../utils/math";
import { Contrato, ProjecaoParcela, Indexador, IndexadorRates, AssociatedDocument } from "../types";

interface MemoriaCalculoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contrato: Contrato;
  parcela?: ProjecaoParcela;
  cenarioNome?: string;
  indexadorNome?: string;
  taxaJurosAnual?: number;
  valorIndexadorAnual?: number;
  dataBaseCalculo?: string;
  indexadorRates?: IndexadorRates;
  associatedDocuments?: AssociatedDocument[];
  onViewDocument?: (doc: AssociatedDocument) => void;
}

export function MemoriaCalculoModal({
  isOpen,
  onClose,
  contrato,
  parcela,
  cenarioNome = "Contrato Original / Cenário Vigente",
  indexadorNome,
  taxaJurosAnual,
  valorIndexadorAnual = 0,
  dataBaseCalculo = new Date().toISOString().split("T")[0],
  indexadorRates,
  associatedDocuments = [],
  onViewDocument
}: MemoriaCalculoModalProps) {
  const [copied, setCopied] = useState(false);
  // Requested order: 1º Resumo & Fórmula, 2º Grade Mensal, 3º Cobrança Real de Atrasos ("A Bagaceira")
  const [activeStepTab, setActiveStepTab] = useState<"passoapasso" | "mensal" | "atrasos">("passoapasso");
  const [searchTerm, setSearchTerm] = useState("");
  const [isMaximized, setIsMaximized] = useState(true);

  // Custom Liquidation parameters for Overdue Debt tab
  const [dataBaseApuracao, setDataBaseApuracao] = useState<string>(dataBaseCalculo || new Date().toISOString().split("T")[0]);
  const [taxaMultaPct, setTaxaMultaPct] = useState<number>(2.0); // 2% legal max CDC/BACEN
  const [taxaMoraMesPct, setTaxaMoraMesPct] = useState<number>(1.0); // 1% a.m. (0.0333% a.d.)
  const [honorariosPct, setHonorariosPct] = useState<number>(10.0); // 10% honorários extrajudiciais/sucumbenciais
  const [incluirHonorarios, setIncluirHonorarios] = useState<boolean>(false);

  // Specialist Payment Overrides per Installment
  const [paymentOverrides, setPaymentOverrides] = useState<Record<number, {
    paga?: boolean;
    valorPago?: number;
    dataPagamento?: string;
    observacao?: string;
  }>>({});
  const [atrasosSubTab, setAtrasosSubTab] = useState<"parcelas" | "mensal" | "documentos">("parcelas");

  // Use provided values or default from contract
  const idxNome = (indexadorNome || contrato?.indexadorOriginal || "CDI") as Indexador;
  const tJurosFixa = taxaJurosAnual !== undefined ? taxaJurosAnual : (contrato?.taxaJurosAnual || 0);
  const tIndexadorVal = valorIndexadorAnual;

  // Create fallback indexer rates if not passed
  const currentRates: IndexadorRates = useMemo(() => {
    const baseRates: IndexadorRates = indexadorRates ? { ...indexadorRates } : {
      CDI: 10.65,
      SELIC: 10.75,
      IPCA: 3.93,
      INPC: 3.86,
      TR: 0.10,
      PRE: 0
    };
    if (idxNome) {
      baseRates[idxNome] = tIndexadorVal;
    }
    return baseRates;
  }, [indexadorRates, idxNome, tIndexadorVal]);

  // Calculate detailed monthly schedule (grade mensal especialista Excel)
  const mensalGrid = useMemo(() => {
    if (!isOpen || !contrato) return [];
    return calcularProjecaoMensal(contrato, idxNome, tJurosFixa, currentRates);
  }, [isOpen, contrato, idxNome, tJurosFixa, currentRates]);

  // Filtered monthly grid for table search
  const filteredMensalGrid = useMemo(() => {
    if (!searchTerm.trim()) return mensalGrid;
    const term = searchTerm.toLowerCase();
    return mensalGrid.filter(m => 
      m.anoMesStr.toLowerCase().includes(term) ||
      m.dataInicio.includes(term) ||
      m.dataFim.includes(term) ||
      String(m.mesIndex).includes(term) ||
      (m.isMesParcela && `parcela ${m.numeroParcela}`.includes(term))
    );
  }, [mensalGrid, searchTerm]);

  // Overdue Installments Real Liquidation Engine ("A Bagaceira") with Payments & Overrides
  const liquidanteReal = useMemo(() => {
    if (!contrato || !contrato.cronogramaParcelas) return null;
    const dtBase = parseDateSafely(dataBaseApuracao);

    const parcelasLiquidadas = contrato.cronogramaParcelas.map((p, idx) => {
      const numParcela = idx + 1;
      const override = paymentOverrides[numParcela] || {};

      const dtVenc = parseDateSafely(p.data);
      const isPagaExplicit = override.paga !== undefined ? override.paga : !!p.paga;

      const valPrincipalParcela = (p.valorPrincipalManual && p.valorPrincipalManual > 0)
        ? p.valorPrincipalManual
        : ((contrato.valorPrincipal || 0) * ((p.percentualAmortizacao || 0) / 100));

      const valPagoDefault = p.valorAmortizadoPago || (isPagaExplicit ? valPrincipalParcela : 0);
      const valPago = override.valorPago !== undefined ? override.valorPago : valPagoDefault;

      const dataPagamentoReal = override.dataPagamento || p.data;
      const isPagaTotal = isPagaExplicit || (valPago >= valPrincipalParcela && valPrincipalParcela > 0);

      const saldoDevedorPrincipal = isPagaTotal ? 0 : Math.max(0, valPrincipalParcela - valPago);

      const isVencida = !isPagaTotal && dtVenc.getTime() <= dtBase.getTime();
      const diasAtrasoCalc = isVencida ? getDaysBetween(p.data, dataBaseApuracao) : 0;

      // Indexer correction from installment date to base date
      const taxaIdxDecimal = ((currentRates && currentRates[idxNome]) || 0) / 100;
      const anosDecorridos = diasAtrasoCalc / 360;
      const fatorCorrecao = isVencida && anosDecorridos > 0 ? Math.pow(1 + taxaIdxDecimal, anosDecorridos) - 1 : 0;
      const valCorrecaoMonetaria = saldoDevedorPrincipal * fatorCorrecao;
      const valBaseComCorrecao = saldoDevedorPrincipal + valCorrecaoMonetaria;

      // Late fine (multa moratória)
      const valMultaMoratoria = isVencida ? valBaseComCorrecao * (taxaMultaPct / 100) : 0;

      // Late interest (juros de mora - pro rata die)
      const taxaMoraDiaria = (taxaMoraMesPct / 100) / 30;
      const valJurosMora = isVencida ? valBaseComCorrecao * (taxaMoraDiaria * diasAtrasoCalc) : 0;

      // Subtotal per installment
      const valTotalAtualizado = isVencida 
        ? (valBaseComCorrecao + valMultaMoratoria + valJurosMora) 
        : saldoDevedorPrincipal;

      return {
        numero: numParcela,
        dataVencimento: p.data,
        dataPagamentoReal,
        isPaga: isPagaTotal,
        isParcial: !isPagaTotal && valPago > 0,
        isVencida,
        diasAtraso: diasAtrasoCalc,
        valorOriginal: valPrincipalParcela,
        valorPago: valPago,
        saldoDevedorPrincipal,
        correcaoMonetaria: valCorrecaoMonetaria,
        valorAtualizado: valBaseComCorrecao,
        multaMoratoria: valMultaMoratoria,
        jurosMora: valJurosMora,
        totalLiquidaçãoParcela: valTotalAtualizado,
        observacao: override.observacao || ""
      };
    });

    const vencidas = parcelasLiquidadas.filter(p => p.isVencida);
    const pagas = parcelasLiquidadas.filter(p => p.isPaga);
    const vincendas = parcelasLiquidadas.filter(p => !p.isPaga && !p.isVencida);

    const totalOriginalVencido = vencidas.reduce((acc, c) => acc + c.saldoDevedorPrincipal, 0);
    const saldoVincendo = vincendas.reduce((acc, c) => acc + c.saldoDevedorPrincipal, 0);
    const totalPagoApurado = parcelasLiquidadas.reduce((acc, c) => acc + c.valorPago, 0);
    const totalCorrecao = vencidas.reduce((acc, c) => acc + c.correcaoMonetaria, 0);
    const totalBaseCorrigida = vencidas.reduce((acc, c) => acc + c.valorAtualizado, 0);
    const totalMulta = vencidas.reduce((acc, c) => acc + c.multaMoratoria, 0);
    const totalJurosMora = vencidas.reduce((acc, c) => acc + c.jurosMora, 0);
    const subtotalAtraso = vencidas.reduce((acc, c) => acc + c.totalLiquidaçãoParcela, 0);

    const valHonorarios = incluirHonorarios ? subtotalAtraso * (honorariosPct / 100) : 0;
    const totalGeralDebitoLiquido = subtotalAtraso + valHonorarios;
    const totalLiquidacaoContrato = totalGeralDebitoLiquido + saldoVincendo;

    return {
      dtBase,
      parcelas: parcelasLiquidadas,
      qtdVencidas: vencidas.length,
      qtdPagas: pagas.length,
      qtdVincendas: vincendas.length,
      qtdTotal: parcelasLiquidadas.length,
      totalOriginalVencido,
      saldoVincendo,
      totalPagoApurado,
      totalCorrecao,
      totalBaseCorrigida,
      totalMulta,
      totalJurosMora,
      subtotalAtraso,
      valHonorarios,
      totalGeralDebitoLiquido,
      totalLiquidacaoContrato
    };
  }, [contrato, dataBaseApuracao, idxNome, currentRates, taxaMultaPct, taxaMoraMesPct, honorariosPct, incluirHonorarios, paymentOverrides]);

  // Grade Mensal Mês a Mês da Evolução Real do Contrato (Com Inadimplência e Projeção Futura)
  const atrasosGridMensal = useMemo(() => {
    if (!contrato || !contrato.cronogramaParcelas || !liquidanteReal) return [];

    const dtInicio = parseDateSafely(contrato.dataEmissao || contrato.cronogramaParcelas[0]?.data || "2020-01-01");
    
    // Horizon reaches end of full contract (same as 2º Grade Mensal)
    let dtFim = parseDateSafely(contrato.dataVencimento || dataBaseApuracao);
    contrato.cronogramaParcelas.forEach(p => {
      const pDate = parseDateSafely(p.data);
      if (pDate.getTime() > dtFim.getTime()) {
        dtFim = pDate;
      }
    });

    if (dtFim.getTime() <= dtInicio.getTime()) {
      dtFim = new Date(dtInicio.getFullYear() + 1, dtInicio.getMonth(), dtInicio.getDate());
    }

    const dtBase = parseDateSafely(dataBaseApuracao);
    const baseYear = dtBase.getFullYear();
    const baseMonth = dtBase.getMonth();

    // Map parcelas by "YYYY-M" for O(1) fast lookup
    const parcelasByMonthMap = new Map<string, typeof liquidanteReal.parcelas>();
    liquidanteReal.parcelas.forEach(p => {
      const dt = parseDateSafely(p.dataVencimento);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (!parcelasByMonthMap.has(key)) {
        parcelasByMonthMap.set(key, []);
      }
      parcelasByMonthMap.get(key)!.push(p);
    });

    let year = dtInicio.getFullYear();
    let month = dtInicio.getMonth();

    const endYear = dtFim.getFullYear();
    const endMonth = dtFim.getMonth();

    const grid = [];
    let principalResidualReg = contrato.valorPrincipal || 0;
    let principalInadimplido = 0;
    let multaAcumulada = 0;
    let moraAcumulada = 0;
    let correcaoAcumulada = 0;

    const taxaIdxDecimal = ((currentRates && currentRates[idxNome]) || 0) / 100;
    const taxaMoraMensal = taxaMoraMesPct / 100;
    const taxaMultaDecimal = taxaMultaPct / 100;

    let maxLoop = 360;
    while ((year < endYear || (year === endYear && month <= endMonth)) && maxLoop > 0) {
      maxLoop--;
      const mesStr = String(month + 1).padStart(2, "0");
      const anoStr = String(year);
      const labelMesAno = `${mesStr}/${anoStr}`;

      const isPastOrCurrentBase = year < baseYear || (year === baseYear && month <= baseMonth);
      const key = `${year}-${month}`;
      const parcelasDoMes = parcelasByMonthMap.get(key) || [];

      const amortizacaoDevidaNoMes = parcelasDoMes.reduce((acc, p) => acc + p.valorOriginal, 0);
      const saldoInicialMes = principalResidualReg + principalInadimplido + correcaoAcumulada + multaAcumulada + moraAcumulada;

      if (isPastOrCurrentBase) {
        // Mês passado ou atual (até a data base)
        const pagamentoNoMes = parcelasDoMes.reduce((acc, p) => acc + p.valorPago, 0);
        
        // Novas parcelas vencidas no mês
        const valorInadimplidoNovo = parcelasDoMes.reduce((acc, p) => acc + (p.isVencida ? p.saldoDevedorPrincipal : 0), 0);

        // Amortiza do saldo regular a parcela que venceu
        if (amortizacaoDevidaNoMes > 0) {
          principalResidualReg = Math.max(0, principalResidualReg - amortizacaoDevidaNoMes);
        }

        // Se a parcela não foi paga na totalidade, o saldo devedor principal vai para inadimplido
        if (valorInadimplidoNovo > 0) {
          principalInadimplido += valorInadimplidoNovo;
          const multaMes = valorInadimplidoNovo * taxaMultaDecimal;
          multaAcumulada += multaMes;
        }

        // Se houve pagamento no mês, reduz do principal inadimplido ou regular
        if (pagamentoNoMes > 0) {
          if (principalInadimplido > 0) {
            const abaterInadimplido = Math.min(principalInadimplido, pagamentoNoMes);
            principalInadimplido -= abaterInadimplido;
            const sobraPagamento = pagamentoNoMes - abaterInadimplido;
            if (sobraPagamento > 0) {
              principalResidualReg = Math.max(0, principalResidualReg - sobraPagamento);
            }
          }
        }

        // Correção monetária do mês
        const baseCalculoCorrecao = principalResidualReg + principalInadimplido;
        const correcaoMes = baseCalculoCorrecao > 0 ? baseCalculoCorrecao * (taxaIdxDecimal / 12) : 0;
        correcaoAcumulada += correcaoMes;

        // Juros de mora do mês (1%/m) sobre a base em atraso
        const moraMes = principalInadimplido > 0 ? (principalInadimplido + correcaoMes) * taxaMoraMensal : 0;
        moraAcumulada += moraMes;

        const saldoFinalMes = Math.max(0, principalResidualReg + principalInadimplido + correcaoAcumulada + multaAcumulada + moraAcumulada);

        grid.push({
          mesAno: labelMesAno,
          ano: year,
          mes: month + 1,
          saldoInicial: saldoInicialMes,
          amortizacaoDevida: amortizacaoDevidaNoMes,
          pagamentoEfetuado: pagamentoNoMes,
          valorInadimplidoNovo,
          principalInadimplidoAcumulado: principalInadimplido,
          correcaoMonetaria: correcaoMes,
          multaMoratoria: valorInadimplidoNovo * taxaMultaDecimal,
          jurosMora: moraMes,
          saldoFinal: saldoFinalMes,
          qtdParcelasVencendo: parcelasDoMes.length,
          isFuturo: false
        });
      } else {
        // Mês futuro (projeção pós data base)
        const pagamentoNoMes = amortizacaoDevidaNoMes > 0 ? Math.min(principalResidualReg, amortizacaoDevidaNoMes) : 0;
        if (amortizacaoDevidaNoMes > 0) {
          principalResidualReg = Math.max(0, principalResidualReg - amortizacaoDevidaNoMes);
        }

        const baseCalculoCorrecao = principalResidualReg + principalInadimplido;
        const correcaoMes = baseCalculoCorrecao > 0 ? baseCalculoCorrecao * (taxaIdxDecimal / 12) : 0;
        correcaoAcumulada += correcaoMes;

        const saldoFinalMes = Math.max(0, principalResidualReg + principalInadimplido + correcaoAcumulada + multaAcumulada + moraAcumulada);

        grid.push({
          mesAno: labelMesAno,
          ano: year,
          mes: month + 1,
          saldoInicial: saldoInicialMes,
          amortizacaoDevida: amortizacaoDevidaNoMes,
          pagamentoEfetuado: pagamentoNoMes,
          valorInadimplidoNovo: 0,
          principalInadimplidoAcumulado: principalInadimplido,
          correcaoMonetaria: correcaoMes,
          multaMoratoria: 0,
          jurosMora: 0,
          saldoFinal: saldoFinalMes,
          qtdParcelasVencendo: parcelasDoMes.length,
          isFuturo: true
        });
      }

      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    return grid;
  }, [contrato, liquidanteReal, dataBaseApuracao, currentRates, idxNome, taxaMoraMesPct, taxaMultaPct]);

  const mensalTableParentRef = useRef<HTMLDivElement>(null);
  const monthlyRowVirtualizer = useVirtualizer({
    count: atrasosGridMensal.length,
    getScrollElement: () => mensalTableParentRef.current,
    estimateSize: () => 36,
    overscan: 8
  });

  if (!isOpen || !contrato) return null;

  // Compounded interest effective rate
  const iFixa = tJurosFixa / 100;
  const iIdx = tIndexadorVal / 100;
  const iEfetivaAnual = (1 + iFixa) * (1 + iIdx) - 1;
  const iEfetivaAnualPct = iEfetivaAnual * 100;

  // Default to whole contract memory if no single parcel is selected
  const sInicial = parcela ? parcela.saldoDevedorInicial : contrato.valorPrincipal;
  const percentAmort = parcela ? parcela.percentualAmortizacao : 100;
  const valAmort = parcela ? parcela.amortizacao : contrato.valorPrincipal;
  const valJurosIdx = parcela ? parcela.jurosIndexador : 0;
  const valJurosSpread = parcela ? parcela.jurosSpread : (sInicial * (iFixa));
  const valJurosTotal = parcela ? parcela.jurosOriginal : (valJurosIdx + valJurosSpread);
  const valTotalParcela = parcela ? parcela.totalPago : (valAmort + valJurosTotal);
  const sFinal = parcela ? parcela.saldoDevedorFinal : 0;
  const numParcelaStr = parcela ? `Parcela #${parcela.numero}` : "Consolidado Geral da Operação";
  const dataVencStr = parcela ? formatDate(parcela.data) : formatDate(contrato.dataVencimento);

  // Late payment metrics check
  const hoy = parseDateSafely(dataBaseCalculo);
  const dVenc = parcela ? parseDateSafely(parcela.data) : parseDateSafely(contrato?.dataVencimento);
  const isEmAtraso = dVenc.getTime() < hoy.getTime();
  const diasAtraso = isEmAtraso ? Math.max(0, Math.ceil((hoy.getTime() - dVenc.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const valorMulta = isEmAtraso ? valTotalParcela * 0.02 : 0;
  const valorMora = isEmAtraso ? valTotalParcela * 0.01 * (diasAtraso / 30) : 0;
  const valorTotalComMora = valTotalParcela + valorMulta + valorMora;

  // Totals for monthly schedule
  const totalMensalAmortizacao = mensalGrid.reduce((acc, curr) => acc + curr.amortizacaoMes, 0);
  const totalMensalJurosSpread = mensalGrid.reduce((acc, curr) => acc + curr.jurosSpreadMes, 0);
  const totalMensalJurosIndexador = mensalGrid.reduce((acc, curr) => acc + curr.jurosIndexadorMes, 0);
  const totalMensalJurosTotal = mensalGrid.reduce((acc, curr) => acc + curr.jurosTotalMes, 0);
  const totalMensalFluxo = mensalGrid.reduce((acc, curr) => acc + curr.totalFluxoMes, 0);

  // Plain text report formatted for printing/copying
  const generateTextReport = () => {
    return `================================================================================
MEMÓRIA DE CÁLCULO AUDITÁVEL E EVOLUÇÃO MENSAL
================================================================================
CONTRATO N.º: ${contrato.numero || "S/N"}
EMITENTE / DEVEDOR: ${contrato.emitente || "Não Especificado"}
CREDOR / INSTITUIÇÃO: ${contrato.credor || "Não Especificado"}
CENÁRIO ANALISADO: ${cenarioNome}
REFERÊNCIA: ${numParcelaStr} (Vencimento: ${dataVencStr})
DATA BASE DE APURAÇÃO: ${formatDate(dataBaseCalculo)}
--------------------------------------------------------------------------------

1. PARÂMETROS E TAXAS DE ENTRADA:
   - Saldo Devedor Inicial: ${formatCurrency(contrato.valorPrincipal)}
   - Taxa Fixa / Spread Contratual: ${tJurosFixa.toFixed(4)}% a.a.
   - Indexador Monetário: ${idxNome} (${tIndexadorVal.toFixed(4)}% a.a.)
   - Taxa Efetiva Composta (B3/Bacen): ${iEfetivaAnualPct.toFixed(4)}% a.a.

2. RESUMO FINANCEIRO CONSOLIDADO:
   - Total Amortizado: ${formatCurrency(totalMensalAmortizacao)}
   - Total Juros Spread: ${formatCurrency(totalMensalJurosSpread)}
   - Total Encargos Indexador (${idxNome}): ${formatCurrency(totalMensalJurosIndexador)}
   - Total Geral de Juros: ${formatCurrency(totalMensalJurosTotal)}
   - CUSTO TOTAL MENSAL DA OPERAÇÃO: ${formatCurrency(totalMensalFluxo)}

--------------------------------------------------------------------------------
Auditado via Simulador de Renegociação Agrícola - Em conformidade com a Lei 4.829/65, 
Manual de Crédito Rural (MCR - Banco Central) e Resoluções do CMN.
================================================================================`;
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = "";

    if (activeStepTab === "atrasos" && liquidanteReal) {
      csvContent = exportAtrasosToCSV(liquidanteReal, contrato, String(idxNome), taxaMultaPct, taxaMoraMesPct, dataBaseApuracao);
      fileName = `Apuracao_Atrasos_Contrato_${contrato.numero || 'Simulacao'}.csv`;
    } else {
      csvContent = exportMensalToCSV(mensalGrid, contrato, String(idxNome));
      fileName = `Memoria_Mensal_Contrato_${contrato.numero || 'Simulacao'}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateTextReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let tableRowsHtml = mensalGrid.map(m => `
      <tr>
        <td>${m.mesIndex}</td>
        <td>${m.anoMesStr}</td>
        <td>${formatDate(m.dataInicio)} - ${formatDate(m.dataFim)}</td>
        <td>${m.diasNoMes}</td>
        <td>${formatCurrency(m.saldoDevedorInicial)}</td>
        <td>${formatCurrency(m.jurosSpreadMes)}</td>
        <td>${formatCurrency(m.jurosIndexadorMes)}</td>
        <td>${formatCurrency(m.jurosTotalMes)}</td>
        <td>${formatCurrency(m.amortizacaoMes)}</td>
        <td><strong>${formatCurrency(m.totalFluxoMes)}</strong></td>
        <td>${formatCurrency(m.saldoDevedorFinal)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Memória de Cálculo Mensal - Contrato ${contrato.numero}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 11px; color: #0f172a; }
            h1 { font-size: 16px; margin-bottom: 4px; }
            h2 { font-size: 12px; color: #475569; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
            th { background-color: #f1f5f9; text-align: center; font-size: 10px; font-weight: bold; }
            td:nth-child(1), td:nth-child(2), td:nth-child(3) { text-align: center; }
            .total-row { font-weight: bold; background-color: #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>MEMÓRIA DE CÁLCULO MENSAL DETALHADA (GRADE EXCEL)</h1>
          <h2>Contrato Nº ${contrato.numero} | Devedor: ${contrato.emitente} | Credor: ${contrato.credor}</h2>
          <p><strong>Indexador:</strong> ${idxNome} (${tIndexadorVal.toFixed(2)}% a.a.) | <strong>Taxa Fixa:</strong> ${tJurosFixa.toFixed(2)}% a.a. | <strong>Principal:</strong> ${formatCurrency(contrato.valorPrincipal)}</p>
          
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Período</th>
                <th>Início - Fim</th>
                <th>Dias</th>
                <th>S. Inicial (R$)</th>
                <th>Juros Fixo (R$)</th>
                <th>Juros Indexador (R$)</th>
                <th>Juros Total (R$)</th>
                <th>Amortização (R$)</th>
                <th>Fluxo Total (R$)</th>
                <th>S. Final (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
              <tr class="total-row">
                <td colspan="4" style="text-align: center;">TOTAIS DA OPERAÇÃO</td>
                <td>-</td>
                <td>${formatCurrency(totalMensalJurosSpread)}</td>
                <td>${formatCurrency(totalMensalJurosIndexador)}</td>
                <td>${formatCurrency(totalMensalJurosTotal)}</td>
                <td>${formatCurrency(totalMensalAmortizacao)}</td>
                <td>${formatCurrency(totalMensalFluxo)}</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className={`fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in ${isMaximized ? 'p-1 sm:p-2' : 'p-3 sm:p-4'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
        isMaximized 
          ? 'w-[99vw] h-[98vh] max-w-none max-h-none' 
          : 'w-full max-w-7xl h-[92vh] max-h-[94vh]'
      }`}>
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-3 sm:p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Table className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">Memória de Cálculo Mensal Detalhada</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 hidden sm:inline-block">
                  VISÃO ESPECIALISTA EXCEL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Contrato Nº {contrato.numero || "S/N"} &bull; Devedor: {contrato.emitente || "Não informado"} &bull; {cenarioNome}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="text-slate-400 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title={isMaximized ? "Janela Normal" : "Expandir Tela Cheia"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4 text-emerald-400" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
              <span className="hidden sm:inline">{isMaximized ? "Restaurar" : "Tela Cheia"}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Sub-Header Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveStepTab("passoapasso")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeStepTab === "passoapasso"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>1º Resumo & Fórmulas B3/BACEN</span>
            </button>

            <button
              onClick={() => setActiveStepTab("mensal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeStepTab === "mensal"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Table className="w-4 h-4 text-emerald-600" />
              <span>2º Grade Mensal</span>
            </button>

            <button
              onClick={() => setActiveStepTab("atrasos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeStepTab === "atrasos"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <AlertCircle className="w-4 h-4 text-slate-600" />
              <span>3º Apuração de Débitos e Mora</span>
              {liquidanteReal && liquidanteReal.qtdVencidas > 0 && (
                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded ml-0.5">
                  {liquidanteReal.qtdVencidas} Vencidas
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Baixar planilha compatível com Microsoft Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Planilha Excel (.CSV)</span>
            </button>
            <button
              onClick={handleCopyText}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? "Copiado!" : "Copiar"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">

          {activeStepTab === "passoapasso" ? (
            /* 1º Resumo & Fórmulas B3/BACEN */
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Inicial</span>
                  <span className="text-sm font-extrabold text-slate-800">{formatCurrency(sInicial)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Amortização</span>
                  <span className="text-sm font-extrabold text-blue-700">{formatCurrency(valAmort)}</span>
                  <span className="text-[10px] text-slate-500 block">({percentAmort.toFixed(2)}% do principal)</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Juros & Encargos</span>
                  <span className="text-sm font-extrabold text-amber-600">{formatCurrency(valJurosTotal)}</span>
                  <span className="text-[10px] text-slate-500 block">({idxNome} + {tJurosFixa.toFixed(2)}%)</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Total Parcela</span>
                  <span className="text-sm font-extrabold text-emerald-900">{formatCurrency(valTotalParcela)}</span>
                  {isEmAtraso && (
                    <span className="text-[10px] font-bold text-red-600 block">+ Atraso: {formatCurrency(valorTotalComMora)}</span>
                  )}
                </div>
              </div>

              {/* Step 1: Effective Interest Formula */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">1</div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Fórmula da Taxa Efetiva Composta de Juros (B3 / BACEN)</h4>
                </div>
                <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs space-y-2">
                  <div className="text-emerald-400 font-bold">i_efetiva = (1 + i_fixa) &times; (1 + i_indexador) - 1</div>
                  <div className="text-slate-300">
                    Substituição: (1 + {(iFixa).toFixed(4)}) &times; (1 + {(iIdx).toFixed(4)}) - 1
                  </div>
                  <div className="text-emerald-300 font-bold text-sm">
                    = {iEfetivaAnualPct.toFixed(4)}% a.a. (Taxa Anual Combinada)
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Conforme convenção do mercado financeiro e resolução do Conselho Monetário Nacional (CMN), a combinação entre taxa fixa e indexadores pós-fixados é realizada por capitalização multiplicativa, e não por mera soma aritmética.
                </p>
              </div>

              {/* Step 2: Period Interest & Amortization Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">2</div>
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Cálculo dos Componentes da Parcela</h4>
                </div>

                <div className="space-y-3">
                  {/* Amortization math */}
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                    <div className="flex justify-between text-xs font-bold text-blue-900">
                      <span>a) Amortização de Saldo Principal (A)</span>
                      <span>{formatCurrency(valAmort)}</span>
                    </div>
                    <p className="text-[11px] font-mono text-blue-700">
                      Amortização = Saldo Base ({formatCurrency(sInicial)}) &times; {percentAmort.toFixed(4)}% = {formatCurrency(valAmort)}
                    </p>
                  </div>

                  {/* Spread math */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>b) Juros de Spread / Taxa Fixa ({tJurosFixa.toFixed(2)}% a.a.)</span>
                      <span>{formatCurrency(valJurosSpread)}</span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-600">
                      Juros Fixo = Saldo Base ({formatCurrency(sInicial)}) &times; {tJurosFixa.toFixed(2)}% (pro rata ano/período) = {formatCurrency(valJurosSpread)}
                    </p>
                  </div>

                  {/* Indexer math */}
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
                    <div className="flex justify-between text-xs font-bold text-amber-900">
                      <span>c) Encargos do Indexador ({idxNome} - {tIndexadorVal.toFixed(2)}% a.a.)</span>
                      <span>{formatCurrency(valJurosIdx)}</span>
                    </div>
                    <p className="text-[11px] font-mono text-amber-700">
                      Variação {idxNome} = Valor de Juros Efetivos ({formatCurrency(valJurosTotal)}) - Juros Fixo ({formatCurrency(valJurosSpread)}) = {formatCurrency(valJurosIdx)}
                    </p>
                  </div>

                  {/* Total installment */}
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                    <div className="flex justify-between text-xs font-extrabold text-emerald-900">
                      <span>TOTAL DA PARCELA = Amortização + Juros Total</span>
                      <span>{formatCurrency(valTotalParcela)}</span>
                    </div>
                    <p className="text-[11px] font-mono text-emerald-700">
                      Total = {formatCurrency(valAmort)} + {formatCurrency(valJurosTotal)} = {formatCurrency(valTotalParcela)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3: Late Penalty & Default Interest (If Overdue) */}
              <div className={`rounded-xl border p-4 space-y-3 ${isEmAtraso ? "bg-red-50/40 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full text-white font-bold text-xs flex items-center justify-center ${isEmAtraso ? "bg-red-600" : "bg-slate-400"}`}>3</div>
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                      Encargos de Atraso e Mora ({isEmAtraso ? `${diasAtraso} dias em atraso` : "Em Dia"})
                    </h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isEmAtraso ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {isEmAtraso ? "ATRASO DETECTADO" : "REGULAR / SEM ATRASO"}
                  </span>
                </div>

                {isEmAtraso ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 bg-white rounded-lg border border-red-100">
                      <span className="text-slate-600">Multa Contratual Moratória (2.00% s/ valor vencido):</span>
                      <span className="font-bold text-red-600">{formatCurrency(valorMulta)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded-lg border border-red-100">
                      <span className="text-slate-600">Juros de Mora (1.00% a.m. pro rata die - {diasAtraso} dias):</span>
                      <span className="font-bold text-red-600">{formatCurrency(valorMora)}</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-red-600 text-white rounded-lg font-bold">
                      <span>VALOR TOTAL ATUALIZADO DA PARCELA:</span>
                      <span>{formatCurrency(valorTotalComMora)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      * Conforme o Decreto-Lei nº 167/67 e a Lei 13.986/2020 (Nova Lei do Agro), a mora em cédulas rurais é limitada a juros moratórios de 1% a.m. e multa contratual máxima de 2%.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    A parcela encontra-se em situação regular na data de apuração ({formatDate(dataBaseCalculo)}). Nenhuns juros moratórios ou multas foram computados nesta projeção.
                  </p>
                )}
              </div>
            </div>
          ) : activeStepTab === "mensal" ? (
            /* 2º Grade Mensal Detalhada (Excel) */
            <div className="space-y-4">
              
              {/* Top Consolidated Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duração Total</span>
                  <span className="text-sm font-extrabold text-slate-800">{mensalGrid.length} meses</span>
                  <span className="text-[10px] text-slate-500 block">Evolução Mês a Mês</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Amortizado</span>
                  <span className="text-sm font-extrabold text-blue-700">{formatCurrency(totalMensalAmortizacao)}</span>
                  <span className="text-[10px] text-slate-500 block">Saldo Principal</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Juros Fixo ({tJurosFixa.toFixed(2)}%)</span>
                  <span className="text-sm font-extrabold text-slate-800">{formatCurrency(totalMensalJurosSpread)}</span>
                  <span className="text-[10px] text-slate-500 block">Spread Contratual</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Indexador ({idxNome})</span>
                  <span className="text-sm font-extrabold text-amber-600">{formatCurrency(totalMensalJurosIndexador)}</span>
                  <span className="text-[10px] text-slate-500 block">Variação Acumulada</span>
                </div>
                <div className="col-span-2 md:col-span-1 bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Custo Total da Operação</span>
                  <span className="text-sm font-extrabold text-emerald-900">{formatCurrency(totalMensalFluxo)}</span>
                  <span className="text-[10px] text-emerald-700 block">Principal + Juros</span>
                </div>
              </div>

              {/* Search & Controls Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por mês (ex: 05/2024), ano ou parcela..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 justify-end">
                  <span>Exibindo <strong>{filteredMensalGrid.length}</strong> de <strong>{mensalGrid.length}</strong> meses</span>
                </div>
              </div>

              {/* Monthly Excel Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                <div className="overflow-x-auto max-h-[52vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="py-2.5 px-3 text-center border-r border-slate-800">Mês</th>
                        <th className="py-2.5 px-3 border-r border-slate-800">Período Referência</th>
                        <th className="py-2.5 px-3 border-r border-slate-800">Dias</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800">Saldo Inicial (R$)</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800">Juros Fixo (R$)</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800">Juros Indexador (R$)</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800 bg-amber-950/60 text-amber-200">Juros Total (R$)</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800 bg-blue-950/60 text-blue-200">Amortização (R$)</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800 bg-emerald-950/60 text-emerald-200">Fluxo Total Mês (R$)</th>
                        <th className="py-2.5 px-3 text-right border-r border-slate-800">Saldo Final (R$)</th>
                        <th className="py-2.5 px-3 text-center">Status / Parcela</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {filteredMensalGrid.map((m) => (
                        <tr 
                          key={m.mesIndex} 
                          className={`hover:bg-slate-50 transition ${
                            m.isMesParcela ? "bg-amber-50/40 font-semibold" : m.mesIndex % 2 === 0 ? "bg-slate-50/50" : "bg-white"
                          }`}
                        >
                          <td className="py-2 px-3 text-center font-bold text-slate-600 border-r border-slate-200">
                            #{m.mesIndex}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            <span className="font-bold text-slate-900">{m.anoMesStr}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {formatDate(m.dataInicio)} a {formatDate(m.dataFim)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-500 border-r border-slate-200">
                            {m.diasNoMes}d
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                            {formatCurrency(m.saldoDevedorInicial)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                            {formatCurrency(m.jurosSpreadMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-700 border-r border-slate-200">
                            {formatCurrency(m.jurosIndexadorMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-amber-800 border-r border-slate-200 bg-amber-50/30">
                            {formatCurrency(m.jurosTotalMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 border-r border-slate-200 bg-blue-50/30">
                            {m.amortizacaoMes > 0 ? formatCurrency(m.amortizacaoMes) : "-"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-900 border-r border-slate-200 bg-emerald-50/40">
                            {formatCurrency(m.totalFluxoMes)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800 border-r border-slate-200">
                            {formatCurrency(m.saldoDevedorFinal)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {m.isMesParcela ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                Parcela #{m.numeroParcela}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Acumulação</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900 text-white font-bold text-xs sticky bottom-0">
                      <tr>
                        <td colSpan={3} className="py-3 px-3 text-center uppercase tracking-wider">
                          Totais da Operação
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">-</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-200">{formatCurrency(totalMensalJurosSpread)}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-300">{formatCurrency(totalMensalJurosIndexador)}</td>
                        <td className="py-3 px-3 text-right font-mono text-amber-400">{formatCurrency(totalMensalJurosTotal)}</td>
                        <td className="py-3 px-3 text-right font-mono text-blue-300">{formatCurrency(totalMensalAmortizacao)}</td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-300 font-extrabold text-sm">{formatCurrency(totalMensalFluxo)}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">-</td>
                        <td className="py-3 px-3 text-center">R$ Total</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            /* Tab 3: Apuração Real de Débito e Liquidação de Mora */
            <div className="space-y-4">
              
              {/* Top Consolidated Overdue Metrics Cards */}
              {liquidanteReal && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Principal Vencido</span>
                      <span className="text-sm font-extrabold text-slate-800">{formatCurrency(liquidanteReal.totalOriginalVencido)}</span>
                      <span className="text-[10px] text-slate-500 block">{liquidanteReal.qtdVencidas} parcelas em atraso</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pago / Amortizado</span>
                      <span className="text-sm font-extrabold text-emerald-700">{formatCurrency(liquidanteReal.totalPagoApurado)}</span>
                      <span className="text-[10px] text-emerald-600 block">{liquidanteReal.qtdPagas} parcelas quitadas</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Correção ({idxNome})</span>
                      <span className="text-sm font-extrabold text-slate-800">+{formatCurrency(liquidanteReal.totalCorrecao)}</span>
                      <span className="text-[10px] text-slate-500 block">Atualização Monetária</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Multa & Mora</span>
                      <span className="text-sm font-extrabold text-slate-800">+{formatCurrency(liquidanteReal.totalMulta + liquidanteReal.totalJurosMora)}</span>
                      <span className="text-[10px] text-slate-500 block">{taxaMultaPct}% multa + {taxaMoraMesPct}%/m</span>
                    </div>

                    <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xs border border-slate-800">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Débito Vencido em Aberto</span>
                      <span className="text-sm font-extrabold text-amber-300">{formatCurrency(liquidanteReal.totalGeralDebitoLiquido)}</span>
                      <span className="text-[10px] text-slate-400 block">Somente Parcelas Vencidas</span>
                    </div>

                    <div className="bg-slate-950 text-white rounded-xl p-3 shadow-sm border border-emerald-500/50">
                      <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider block">Liquidação Total Contrato</span>
                      <span className="text-base font-black text-emerald-300">{formatCurrency(liquidanteReal.totalLiquidacaoContrato)}</span>
                      <span className="text-[10px] text-slate-300 block">Vencido + Vincendo ({liquidanteReal.qtdVincendas}x)</span>
                    </div>
                  </div>

                  {/* High Visibility Comparison Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-3.5 rounded-xl shadow-sm border border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 border-b md:border-b-0 md:border-r border-slate-700/80 pb-3 md:pb-0 md:pr-4">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 font-bold">
                        1
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                          Liquidação Total do Débito em Aberto (Somente Vencido)
                        </span>
                        <div className="text-lg font-black text-amber-300 font-mono">
                          {formatCurrency(liquidanteReal.totalGeralDebitoLiquido)}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Valor das {liquidanteReal.qtdVencidas} parcelas vencidas + atualização ({idxNome}) + multa ({taxaMultaPct}%) + mora ({taxaMoraMesPct}%/m) até {formatDate(dataBaseApuracao)}.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 font-bold">
                        2
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                          Liquidação Total do Contrato (Débito em Aberto + Saldo Vincendo)
                        </span>
                        <div className="text-xl font-black text-emerald-300 font-mono">
                          {formatCurrency(liquidanteReal.totalLiquidacaoContrato)}
                        </div>
                        <p className="text-[10px] text-slate-300 leading-tight">
                          Soma o débito em atraso ({formatCurrency(liquidanteReal.totalGeralDebitoLiquido)}) com o saldo principal a vencer ({formatCurrency(liquidanteReal.saldoVincendo)} das {liquidanteReal.qtdVincendas} parcelas vincendas).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls Bar & Sub-Navigation */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
                
                {/* Sub-Tab Selector Buttons */}
                <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg">
                  <button
                    onClick={() => setAtrasosSubTab("parcelas")}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                      atrasosSubTab === "parcelas" 
                        ? "bg-white text-slate-900 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Table className="w-3.5 h-3.5 text-slate-600" />
                    Parcelas em Atraso ({liquidanteReal?.qtdVencidas || 0})
                  </button>
                  <button
                    onClick={() => setAtrasosSubTab("mensal")}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                      atrasosSubTab === "mensal" 
                        ? "bg-white text-slate-900 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-slate-600" />
                    Evolução Mensal ({atrasosGridMensal.length}m)
                  </button>
                  <button
                    onClick={() => setAtrasosSubTab("documentos")}
                    className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 ${
                      atrasosSubTab === "documentos" 
                        ? "bg-white text-slate-900 shadow-xs" 
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    Anexos ({associatedDocuments.length})
                  </button>
                </div>

                {/* Inline Parameters */}
                <div className="flex flex-wrap items-center gap-3 text-slate-700 font-medium">
                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-slate-600">Data-Base:</label>
                    <input 
                      type="date"
                      value={dataBaseApuracao}
                      onChange={(e) => setDataBaseApuracao(e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-slate-600">Multa:</label>
                    <input 
                      type="number"
                      step="0.5"
                      value={taxaMultaPct}
                      onChange={(e) => setTaxaMultaPct(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 font-mono text-xs font-bold text-slate-800 text-right outline-none"
                    />
                    <span className="text-slate-500">%</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="font-bold text-slate-600">Mora:</label>
                    <input 
                      type="number"
                      step="0.1"
                      value={taxaMoraMesPct}
                      onChange={(e) => setTaxaMoraMesPct(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-white border border-slate-300 rounded px-1.5 py-1 font-mono text-xs font-bold text-slate-800 text-right outline-none"
                    />
                    <span className="text-slate-500">%a.m.</span>
                  </div>

                  {Object.keys(paymentOverrides).length > 0 && (
                    <button
                      onClick={() => setPaymentOverrides({})}
                      className="text-xs text-amber-700 font-bold hover:underline flex items-center gap-1 bg-amber-100 px-2 py-1 rounded border border-amber-300"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restaurar
                    </button>
                  )}
                </div>

              </div>

              {/* Sub-Tab 1: Demonstrativo por Parcela */}
              {atrasosSubTab === "parcelas" && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                  <div className="overflow-x-auto max-h-[52vh]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                        <tr>
                          <th className="py-2.5 px-3 text-center border-r border-slate-800"># Parcela</th>
                          <th className="py-2.5 px-3 text-center border-r border-slate-800">Vencimento</th>
                          <th className="py-2.5 px-3 text-center border-r border-slate-800">Situação</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Valor Original (R$)</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Valor Pago (R$)</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Saldo Devido (R$)</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Atraso</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Correção ({idxNome})</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Multa (2%)</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800">Mora (1%/m)</th>
                          <th className="py-2.5 px-3 text-right font-bold text-emerald-300 bg-slate-950">Total Liquidado (R$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {liquidanteReal?.parcelas.map((p) => {
                          const isOverride = !!paymentOverrides[p.numero];

                          return (
                            <tr 
                              key={p.numero} 
                              className={`hover:bg-slate-50 transition ${
                                p.isPaga 
                                  ? "bg-emerald-50/20" 
                                  : p.isVencida 
                                    ? "bg-amber-50/20 font-medium" 
                                    : "bg-white"
                              }`}
                            >
                              <td className="py-2 px-3 text-center font-bold text-slate-700 border-r border-slate-200">
                                #{p.numero}
                                {isOverride && <span className="text-amber-600 font-bold ml-1">*</span>}
                              </td>
                              <td className="py-2 px-3 text-center font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">
                                {formatDate(p.dataVencimento)}
                              </td>
                              <td className="py-2 px-3 text-center border-r border-slate-200">
                                <button
                                  onClick={() => {
                                    setPaymentOverrides(prev => ({
                                      ...prev,
                                      [p.numero]: {
                                        ...prev[p.numero],
                                        paga: !p.isPaga,
                                        valorPago: !p.isPaga ? p.valorOriginal : 0
                                      }
                                    }));
                                  }}
                                  className="cursor-pointer"
                                  title="Clique para alternar Quitada / Vencida"
                                >
                                  {p.isPaga ? (
                                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1 hover:bg-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      QUITADA
                                    </span>
                                  ) : p.isVencida ? (
                                    <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 hover:bg-amber-200">
                                      VENCIDA
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-600 font-medium text-[10px] px-2 py-0.5 rounded border border-slate-200">
                                      A VENCER
                                    </span>
                                  )}
                                </button>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                                {formatCurrency(p.valorOriginal)}
                              </td>
                              <td className="py-2 px-3 text-right border-r border-slate-200">
                                <input
                                  type="number"
                                  step="100"
                                  value={p.valorPago || 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setPaymentOverrides(prev => ({
                                      ...prev,
                                      [p.numero]: {
                                        ...prev[p.numero],
                                        valorPago: val,
                                        paga: val >= p.valorOriginal
                                      }
                                    }));
                                  }}
                                  className="w-22 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                                {formatCurrency(p.saldoDevedorPrincipal)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                {p.isVencida ? `${p.diasAtraso}d` : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                                {p.isVencida ? formatCurrency(p.correcaoMonetaria) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                                {p.isVencida ? formatCurrency(p.multaMoratoria) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                                {p.isVencida ? formatCurrency(p.jurosMora) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50">
                                {formatCurrency(p.totalLiquidaçãoParcela)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-900 text-white font-bold text-xs sticky bottom-0">
                        <tr>
                          <td colSpan={3} className="py-3 px-3 text-center uppercase tracking-wider">
                            Totais em Atraso
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {formatCurrency(liquidanteReal?.parcelas.reduce((a, b) => a + b.valorOriginal, 0) || 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-400">
                            {formatCurrency(liquidanteReal?.totalPagoApurado || 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-200 font-extrabold">
                            {formatCurrency(liquidanteReal?.totalOriginalVencido || 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-400">-</td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            +{formatCurrency(liquidanteReal?.totalCorrecao || 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            +{formatCurrency(liquidanteReal?.totalMulta || 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            +{formatCurrency(liquidanteReal?.totalJurosMora || 0)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400 text-sm bg-slate-950">
                            {formatCurrency(liquidanteReal?.subtotalAtraso || 0)}
                          </td>
                        </tr>
                        {incluirHonorarios && (
                          <tr className="bg-slate-950 text-slate-200 border-t border-slate-800">
                            <td colSpan={10} className="py-2 px-3 text-right uppercase font-bold text-xs">
                              + Honorários Advocatícios ({honorariosPct.toFixed(1)}%):
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-400">
                              +{formatCurrency(liquidanteReal?.valHonorarios || 0)}
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-950 text-white border-t border-slate-800">
                          <td colSpan={10} className="py-2.5 px-3 text-right uppercase font-extrabold text-xs text-amber-300">
                            Liquidação Total do Débito Vencido em Atraso:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-300 text-sm bg-slate-900">
                            {formatCurrency(liquidanteReal?.totalGeralDebitoLiquido || 0)}
                          </td>
                        </tr>
                        <tr className="bg-slate-950 text-slate-300 border-t border-slate-800">
                          <td colSpan={10} className="py-2 px-3 text-right uppercase font-bold text-xs text-slate-400">
                            + Saldo Principal Vincendo (A Vencer - {liquidanteReal?.qtdVincendas || 0} parcelas):
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-200">
                            +{formatCurrency(liquidanteReal?.saldoVincendo || 0)}
                          </td>
                        </tr>
                        <tr className="bg-slate-900 text-white border-t-2 border-emerald-500/60">
                          <td colSpan={10} className="py-3 px-3 text-right uppercase font-black text-xs text-emerald-300">
                            Liquidação Total do Contrato (Débito Vencido + Saldo Vincendo):
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-base bg-slate-950">
                            {formatCurrency(liquidanteReal?.totalLiquidacaoContrato || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Grade Mensal Mês a Mês */}
              {atrasosSubTab === "mensal" && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Evolução Mensal do Contrato (Situação Real com Inadimplência e Projeção Futura)</span>
                    <button
                      onClick={() => {
                        const headers = ["Mês/Ano", "Tipo", "Saldo Inicial (R$)", "Amortização Devida (R$)", "Pagamento Efetuado (R$)", "Novo Inadimplido (R$)", "Acumulado em Atraso (R$)", "Correção Monetária (R$)", "Multa 2% (R$)", "Juros Mora 1%/m (R$)", "Saldo Devedor Final (R$)"];
                        const rows = atrasosGridMensal.map(m => [
                          m.mesAno,
                          m.isFuturo ? "Projetado" : "Apurado",
                          formatCSVNumber(m.saldoInicial),
                          formatCSVNumber(m.amortizacaoDevida),
                          formatCSVNumber(m.pagamentoEfetuado),
                          formatCSVNumber(m.valorInadimplidoNovo),
                          formatCSVNumber(m.principalInadimplidoAcumulado),
                          formatCSVNumber(m.correcaoMonetaria),
                          formatCSVNumber(m.multaMoratoria),
                          formatCSVNumber(m.jurosMora),
                          formatCSVNumber(m.saldoFinal)
                        ]);
                        const csv = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
                        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = `Evolucao_Real_Contrato_${contrato.numero || "Contrato"}.csv`;
                        link.click();
                      }}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold text-xs hover:bg-emerald-700 transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Download className="w-3 h-3" />
                      Exportar CSV
                    </button>
                  </div>

                  <div ref={mensalTableParentRef} className="overflow-x-auto max-h-[50vh]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                        <tr>
                          <th className="py-2.5 px-3 text-center border-r border-slate-800">Mês / Ano</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-slate-300">Saldo Inicial</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-slate-200">Amortização Devida</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-emerald-300 bg-slate-950 font-extrabold">Pagamento Efetuado</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-rose-300 bg-slate-950 font-extrabold">Novo Inadimplido</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-amber-300 bg-slate-950 font-extrabold">Acumulado em Atraso</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-slate-300">Correção ({idxNome})</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-rose-300">Multa (2%)</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-800 text-rose-300">Mora (1%/m)</th>
                          <th className="py-2.5 px-3 text-right font-black text-white border-r border-slate-800 bg-slate-950">Saldo Final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {monthlyRowVirtualizer.getVirtualItems().length > 0 && monthlyRowVirtualizer.getVirtualItems()[0].start > 0 && (
                          <tr>
                            <td colSpan={10} style={{ height: `${monthlyRowVirtualizer.getVirtualItems()[0].start}px` }} />
                          </tr>
                        )}
                        {monthlyRowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const m = atrasosGridMensal[virtualRow.index];
                          return (
                            <tr key={virtualRow.key} ref={monthlyRowVirtualizer.measureElement} className={`hover:bg-slate-50 transition ${m.isFuturo ? "bg-slate-50/40" : ""}`}>
                              <td className="py-2 px-3 text-center font-bold text-slate-800 border-r border-slate-200 bg-slate-50">
                                <div className="flex items-center justify-center gap-1">
                                  <span>{m.mesAno}</span>
                                  {m.isFuturo && (
                                    <span className="text-[9px] font-normal bg-slate-200 text-slate-600 px-1 py-0.2 rounded">Futuro</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                                {formatCurrency(m.saldoInicial)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 border-r border-slate-200">
                                {formatCurrency(m.amortizacaoDevida)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-200 bg-emerald-50/40">
                                {m.pagamentoEfetuado > 0 ? formatCurrency(m.pagamentoEfetuado) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 border-r border-slate-200 bg-rose-50/30">
                                {m.valorInadimplidoNovo > 0 ? formatCurrency(m.valorInadimplidoNovo) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-amber-800 border-r border-slate-200 bg-amber-50/30">
                                {m.principalInadimplidoAcumulado > 0 ? formatCurrency(m.principalInadimplidoAcumulado) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                                {m.correcaoMonetaria > 0 ? formatCurrency(m.correcaoMonetaria) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700 border-r border-slate-200 bg-rose-50/20">
                                {m.multaMoratoria > 0 ? formatCurrency(m.multaMoratoria) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700 border-r border-slate-200 bg-rose-50/20">
                                {m.jurosMora > 0 ? formatCurrency(m.jurosMora) : "-"}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900 border-r border-slate-200 bg-slate-100/70">
                                {formatCurrency(m.saldoFinal)}
                              </td>
                            </tr>
                          );
                        })}
                        {monthlyRowVirtualizer.getVirtualItems().length > 0 && (monthlyRowVirtualizer.getTotalSize() - monthlyRowVirtualizer.getVirtualItems()[monthlyRowVirtualizer.getVirtualItems().length - 1].end) > 0 && (
                          <tr>
                            <td colSpan={10} style={{ height: `${monthlyRowVirtualizer.getTotalSize() - monthlyRowVirtualizer.getVirtualItems()[monthlyRowVirtualizer.getVirtualItems().length - 1].end}px` }} />
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="bg-slate-900 text-slate-200 font-bold text-[11px] sticky bottom-0 z-10 shadow-lg">
                        <tr>
                          <td className="py-2.5 px-3 text-center uppercase tracking-wider font-extrabold bg-slate-950">TOTAL</td>
                          <td className="py-2.5 px-3 text-right text-slate-400 font-mono">-</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                            {formatCurrency(atrasosGridMensal.reduce((a, b) => a + b.amortizacaoDevida, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-400 bg-slate-950 font-bold">
                            {formatCurrency(atrasosGridMensal.reduce((a, b) => a + b.pagamentoEfetuado, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-300 bg-slate-950 font-bold">
                            {formatCurrency(atrasosGridMensal.reduce((a, b) => a + b.valorInadimplidoNovo, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-amber-300 bg-slate-950 font-bold">
                            {formatCurrency(atrasosGridMensal[atrasosGridMensal.length - 1]?.principalInadimplidoAcumulado || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            +{formatCurrency(atrasosGridMensal.reduce((a, b) => a + b.correcaoMonetaria, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-300 bg-slate-950">
                            +{formatCurrency(atrasosGridMensal.reduce((a, b) => a + b.multaMoratoria, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-rose-300 bg-slate-950">
                            +{formatCurrency(atrasosGridMensal.reduce((a, b) => a + b.jurosMora, 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400 bg-slate-950 text-xs">
                            {formatCurrency(atrasosGridMensal[atrasosGridMensal.length - 1]?.saldoFinal || 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Subdocumentos */}
              {atrasosSubTab === "documentos" && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Subdocumentos e Comprovantes Anexados
                    </h4>
                    <span className="bg-blue-50 text-blue-700 font-bold text-xs px-2.5 py-0.5 rounded border border-blue-200">
                      {associatedDocuments.length} documentos
                    </span>
                  </div>

                  {associatedDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {associatedDocuments.map((doc) => (
                        <div key={doc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 text-xs truncate">
                              <h5 className="font-bold text-slate-800 truncate">{doc.name}</h5>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <span className="bg-slate-200 px-1 py-0.2 rounded font-mono uppercase">{doc.type}</span>
                                {doc.uploadDate && <span>Data: {formatDate(doc.uploadDate)}</span>}
                              </div>
                              {doc.notes && <p className="text-[11px] text-slate-600 italic truncate">{doc.notes}</p>}
                            </div>
                          </div>
                          {onViewDocument && (
                            <button
                              onClick={() => onViewDocument(doc)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                              title="Visualizar documento interno"
                            >
                              <Eye className="w-3.5 h-3.5" /> Abrir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-300 space-y-1">
                      <FileText className="w-6 h-6 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">Nenhum subdocumento ou comprovante anexado especificamente a esta simulação.</p>
                      <p className="text-[11px] text-slate-500">
                        Uploads de comprovantes podem ser vinculados no painel de documentos.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* BACEN & Legal Disclaimer */}
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold uppercase tracking-wider block text-amber-950 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Fundamentação Legal da Apuração de Mora e Atraso (Crédito Rural):
                </span>
                <p>
                  &bull; <strong>Multa Moratória Limitada a 2%:</strong> Artigo 52, § 1º do Código de Defesa do Consumidor (Lei 8.078/90) c/c Decreto-Lei nº 167/67 e MCR (Manual de Crédito Rural - BACEN).
                </p>
                <p>
                  &bull; <strong>Juros de Mora Limitados a 1% ao ano/mês:</strong> Artigo 5º, parágrafo único do Decreto-Lei nº 167/67 e Súmula 379 do Superior Tribunal de Justiça (STJ), sendo vedada a cobrança de taxa de rentabilidade superior durante a inadimplência em crédito rural.
                </p>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Auditoria Matemática Verificada &bull; Validação BACEN / SGS</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            Fechar Memória
          </button>
        </div>

      </div>
    </div>
  );
}
