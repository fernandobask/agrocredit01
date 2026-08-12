import { Contrato, Indexador, ProjecaoParcela, ProjecaoMensal, IndexadorRates, ResultadoCenario } from "../types";

// Parses any date string safely (handles ISO strings, YYYY-MM-DD, and missing values)
export function parseDateSafely(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const cleanStr = String(dateStr).split("T")[0];
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) return dateObj;
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

// Calculates the number of days between two date strings (YYYY-MM-DD)
export function getDaysBetween(date1: string, date2: string): number {
  const d1 = parseDateSafely(date1);
  const d2 = parseDateSafely(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Format currency to Brazilian Real (R$)
export function formatCurrency(value: number): string {
  if (isNaN(value) || value === undefined || value === null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Format percentage
export function formatPercentage(value: number): string {
  if (isNaN(value) || value === undefined || value === null) return "0,00%";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value / 100);
}

// Format date to Brazilian standard DD/MM/YYYY
export function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const cleanStr = String(dateStr).split("T")[0];
  const parts = cleanStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return cleanStr;
}

// Computes month-by-month financial projection (grade mensal estilo Excel)
export function calcularProjecaoMensal(
  contrato: Contrato,
  indexadorAlvo: Indexador,
  novaTaxaJurosAnual: number,
  indexadorRates: IndexadorRates
): ProjecaoMensal[] {
  const { valorPrincipal, dataEmissao, dataVencimento, cronogramaParcelas } = contrato;
  if (!valorPrincipal || valorPrincipal <= 0) return [];

  const dtInicio = parseDateSafely(dataEmissao || new Date().toISOString().split("T")[0]);
  
  // Find last date from installments or contract maturity
  let dtFim = parseDateSafely(dataVencimento || dataEmissao);
  if (cronogramaParcelas && cronogramaParcelas.length > 0) {
    cronogramaParcelas.forEach(p => {
      const pDate = parseDateSafely(p.data);
      if (pDate.getTime() > dtFim.getTime()) {
        dtFim = pDate;
      }
    });
  }

  // Ensure dtFim is strictly after dtInicio
  if (dtFim.getTime() <= dtInicio.getTime()) {
    dtFim = new Date(dtInicio.getFullYear() + 1, dtInicio.getMonth(), dtInicio.getDate());
  }

  // Calculate total projection by installments first to know exact amortization per installment
  const parcelasProjetadas = calcularProjecao(contrato, indexadorAlvo, novaTaxaJurosAnual, indexadorRates);

  const mensalGrid: ProjecaoMensal[] = [];
  let saldoDevedor = valorPrincipal;
  let currDate = new Date(dtInicio.getTime());
  let mesIndex = 1;

  const taxaIndexadorAnual = ((indexadorRates && indexadorRates[indexadorAlvo]) || 0) / 100;
  const taxaSpreadAnual = (novaTaxaJurosAnual || 0) / 100;
  const taxaCombinadaAnual = (1 + taxaSpreadAnual) * (1 + taxaIndexadorAnual) - 1;

  let maxLoop = 360; // 30 years max safety cap
  while ((currDate.getTime() < dtFim.getTime() || mesIndex === 1) && maxLoop > 0) {
    maxLoop--;
    const dataInicioStr = currDate.toISOString().split("T")[0];
    
    // Move 1 month ahead
    const nextDate = new Date(currDate.getFullYear(), currDate.getMonth() + 1, currDate.getDate());
    // Cap at dtFim if next month exceeds final maturity
    const actualNextDate = nextDate.getTime() > dtFim.getTime() ? new Date(dtFim.getTime()) : nextDate;
    const dataFimStr = actualNextDate.toISOString().split("T")[0];

    const diasNoMes = Math.max(1, getDaysBetween(dataInicioStr, dataFimStr));
    const fractionOfYear = diasNoMes / 365;

    // Monthly interest calculation
    const jurosTotalMes = saldoDevedor * (Math.pow(1 + taxaCombinadaAnual, fractionOfYear) - 1);
    const jurosSpreadMes = saldoDevedor * (Math.pow(1 + taxaSpreadAnual, fractionOfYear) - 1);
    const jurosIndexadorMes = Math.max(0, jurosTotalMes - jurosSpreadMes);

    // Check if any installment falls within this month window
    let amortizacaoMes = 0;
    let isMesParcela = false;
    let numeroParcela: number | undefined = undefined;

    parcelasProjetadas.forEach(p => {
      const pTime = parseDateSafely(p.data).getTime();
      const startTime = parseDateSafely(dataInicioStr).getTime();
      const endTime = parseDateSafely(dataFimStr).getTime();

      if (pTime >= startTime && pTime <= endTime) {
        amortizacaoMes += p.amortizacao;
        isMesParcela = true;
        numeroParcela = p.numero;
      }
    });

    // Cap amortization at outstanding balance
    if (amortizacaoMes > saldoDevedor) {
      amortizacaoMes = saldoDevedor;
    }

    // On final month step or when balance is almost paid
    if (actualNextDate.getTime() >= dtFim.getTime()) {
      if (saldoDevedor > 0 && isMesParcela) {
        amortizacaoMes = saldoDevedor;
      }
    }

    const totalFluxoMes = amortizacaoMes + jurosTotalMes;
    const saldoDevedorFinal = Math.max(0, saldoDevedor - amortizacaoMes);

    const mesStr = String(currDate.getMonth() + 1).padStart(2, "0");
    const anoStr = currDate.getFullYear();

    mensalGrid.push({
      mesIndex,
      anoMesStr: `${mesStr}/${anoStr}`,
      dataInicio: dataInicioStr,
      dataFim: dataFimStr,
      diasNoMes,
      saldoDevedorInicial: saldoDevedor,
      jurosSpreadMes,
      jurosIndexadorMes,
      jurosTotalMes,
      amortizacaoMes,
      totalFluxoMes,
      saldoDevedorFinal,
      isMesParcela,
      numeroParcela
    });

    saldoDevedor = saldoDevedorFinal;
    if (actualNextDate.getTime() >= dtFim.getTime() || saldoDevedor <= 0) {
      break;
    }
    currDate = actualNextDate;
    mesIndex++;
  }

  return mensalGrid;
}

// Formats numbers with comma decimal separator for PT-BR Excel compatibility
export function formatCSVNumber(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) return "0," + "0".repeat(decimals);
  return value.toFixed(decimals).replace(".", ",");
}

// Export monthly breakdown to CSV (Excel compatible)
export function exportMensalToCSV(mensalGrid: ProjecaoMensal[], contrato: Contrato, indexadorNome: string): string {
  let csv = "\uFEFF"; // UTF-8 BOM

  csv += `MEMÓRIA DE CÁLCULO MENSAL DETALHADA - VISÃO EXCEL ESPECIALISTA\n`;
  csv += `Contrato Nº;${contrato.numero}\n`;
  csv += `Emitente / Devedor;${contrato.emitente}\n`;
  csv += `Credor / Instituição;${contrato.credor}\n`;
  csv += `Valor Principal;${formatCSVNumber(contrato.valorPrincipal)}\n`;
  csv += `Indexador;${indexadorNome}\n\n`;

  csv += `Mês nº;Período Ref.;Início Período;Fim Período;Dias;Saldo Devedor Inicial (R$);Juros Taxa Fixa (R$);Juros Indexador (R$);Juros Total Mês (R$);Amortização Principal (R$);Fluxo Total Mês (R$);Saldo Devedor Final (R$);Evento / Parcela\n`;

  mensalGrid.forEach(m => {
    const eventoStr = m.isMesParcela ? `Vencimento Parcela #${m.numeroParcela || ''}` : "Acumulação Mensal";
    csv += `${m.mesIndex};${m.anoMesStr};${formatDate(m.dataInicio)};${formatDate(m.dataFim)};${m.diasNoMes};${formatCSVNumber(m.saldoDevedorInicial)};${formatCSVNumber(m.jurosSpreadMes)};${formatCSVNumber(m.jurosIndexadorMes)};${formatCSVNumber(m.jurosTotalMes)};${formatCSVNumber(m.amortizacaoMes)};${formatCSVNumber(m.totalFluxoMes)};${formatCSVNumber(m.saldoDevedorFinal)};${eventoStr}\n`;
  });

  return csv;
}

// Computes the Cash Flow projection for a contract and an indexer scenario
export function calcularProjecao(
  contrato: Contrato,
  indexadorAlvo: Indexador,
  novaTaxaJurosAnual: number, // spread ou taxa fixa
  indexadorRates: IndexadorRates
): ProjecaoParcela[] {
  const { valorPrincipal, dataEmissao, cronogramaParcelas } = contrato;
  
  if (!cronogramaParcelas || cronogramaParcelas.length === 0) {
    return [];
  }

  // Sort installments by date
  const sortedParcelas = [...cronogramaParcelas].sort((a, b) => 
    parseDateSafely(a.data).getTime() - parseDateSafely(b.data).getTime()
  );

  const projecoes: ProjecaoParcela[] = [];
  let saldoDevedor = valorPrincipal;
  let dataReferenciaAnterior = dataEmissao;

  // Rate of the target indexer
  const taxaIndexadorAnual = ((indexadorRates && indexadorRates[indexadorAlvo]) || 0) / 100;
  const taxaSpreadAnual = (novaTaxaJurosAnual || 0) / 100;

  // Combined interest rate (B3 compounding convention)
  // (1 + spread) * (1 + indexer) - 1
  const taxaCombinadaAnual = (1 + taxaSpreadAnual) * (1 + taxaIndexadorAnual) - 1;

  sortedParcelas.forEach((parcela, index) => {
    const numParcela = index + 1;
    const diasNoPeriodo = getDaysBetween(dataReferenciaAnterior, parcela.data);
    const fractionOfYear = diasNoPeriodo / 365;

    // Standard compound financial interest: Saldo * ((1 + i)^t - 1)
    const jurosTotal = saldoDevedor * (Math.pow(1 + taxaCombinadaAnual, fractionOfYear) - 1);
    
    // Separate into indexer and spread components for transparent breakdown
    // Just for analytical presentation, we split proportionally or by formula:
    const jurosSpreadComponent = saldoDevedor * (Math.pow(1 + taxaSpreadAnual, fractionOfYear) - 1);
    const jurosIndexerComponent = Math.max(0, jurosTotal - jurosSpreadComponent);

    // Determine if percentages are based on remaining outstanding balance or original principal
    const sumPercentuais = sortedParcelas.reduce((sum, p) => sum + p.percentualAmortizacao, 0);
    const isBaseDevedor = sumPercentuais > 110;

    let amortizacao = isBaseDevedor
      ? saldoDevedor * (parcela.percentualAmortizacao / 100)
      : valorPrincipal * (parcela.percentualAmortizacao / 100);

    // Ensure we do not amortize more than the remaining debt
    if (amortizacao > saldoDevedor) {
      amortizacao = saldoDevedor;
    }

    // On the last installment, ensure we fully amortize any remaining balance to avoid rounding issues
    if (index === sortedParcelas.length - 1) {
      amortizacao = saldoDevedor;
    }

    const totalPago = amortizacao + jurosTotal;
    const saldoDevedorFinal = Math.max(0, saldoDevedor - amortizacao);

    projecoes.push({
      numero: numParcela,
      data: parcela.data,
      percentualAmortizacao: parcela.percentualAmortizacao,
      saldoDevedorInicial: saldoDevedor,
      amortizacao: amortizacao,
      jurosOriginal: jurosTotal,
      jurosIndexador: jurosIndexerComponent,
      jurosSpread: jurosSpreadComponent,
      totalPago: totalPago,
      saldoDevedorFinal: saldoDevedorFinal,
    });

    saldoDevedor = saldoDevedorFinal;
    dataReferenciaAnterior = parcela.data;
  });

  return projecoes;
}

// Generate the fully simulated scenario result
export function processarCenario(
  id: string,
  nome: string,
  indexadorAlvo: Indexador,
  taxaJurosAnual: number,
  contrato: Contrato,
  indexadorRates: IndexadorRates,
  custoOriginalTotal: number = 0
): ResultadoCenario {
  const parcelas = calcularProjecao(contrato, indexadorAlvo, taxaJurosAnual, indexadorRates);
  
  let totalPago = 0;
  let totalJuros = 0;
  let totalAmortizado = 0;

  parcelas.forEach(p => {
    totalPago += p.totalPago;
    totalJuros += p.jurosOriginal;
    totalAmortizado += p.amortizacao;
  });

  const economiaRelativa = custoOriginalTotal > 0 ? custoOriginalTotal - totalPago : 0;

  return {
    id,
    nome,
    indexador: indexadorAlvo,
    taxaJurosAnual,
    totalPago,
    totalJuros,
    totalAmortizado,
    economiaRelativa,
    parcelas
  };
}

// Export scenario data to Excel-compatible CSV format
export function exportToCSV(cenarios: ResultadoCenario[], contrato: Contrato): string {
  let csv = "\uFEFF"; // UTF-8 BOM for Excel compatibility

  // Contract header
  csv += `SIMULAÇÃO DE RENEGOCIAÇÃO DE CRÉDITO RURAL\n`;
  csv += `Contrato Nº;${contrato.numero}\n`;
  csv += `Emitente;${contrato.emitente}\n`;
  csv += `Credor;${contrato.credor}\n`;
  csv += `Valor Principal;${formatCSVNumber(contrato.valorPrincipal)}\n`;
  csv += `Data de Emissão;${formatDate(contrato.dataEmissao)}\n`;
  csv += `Data de Vencimento;${formatDate(contrato.dataVencimento)}\n`;
  csv += `Taxa Original;${formatCSVNumber(contrato.taxaJurosAnual)}% a.a. + ${contrato.indexadorOriginal}\n\n`;

  // Scenarios Summary Table
  csv += `RESUMO DOS CENÁRIOS COMPARATIVOS\n`;
  csv += `Cenário;Indexador;Taxa Fixa/Spread;Total Amortizado (R$);Total Juros (R$);Custo Total Financeiro (R$);Economia Gerada (R$)\n`;

  cenarios.forEach(cen => {
    csv += `${cen.nome};${cen.indexador};${formatCSVNumber(cen.taxaJurosAnual)}%;${formatCSVNumber(cen.totalAmortizado)};${formatCSVNumber(cen.totalJuros)};${formatCSVNumber(cen.totalPago)};${formatCSVNumber(cen.economiaRelativa)}\n`;
  });
  csv += `\n\n`;

  // Detailed Cash Flow for each scenario
  cenarios.forEach(cen => {
    csv += `DETALHAMENTO DO FLUXO DE CAIXA: ${cen.nome.toUpperCase()}\n`;
    csv += `Parcela;Data Vencimento;% Amortizacao;Saldo Inicial (R$);Amortização (R$);Juros Indexador (R$);Juros Taxa Fixa (R$);Total Parcela (R$);Saldo Final (R$)\n`;
    
    cen.parcelas.forEach(p => {
      csv += `${p.numero};${formatDate(p.data)};${formatCSVNumber(p.percentualAmortizacao, 4)}%;${formatCSVNumber(p.saldoDevedorInicial)};${formatCSVNumber(p.amortizacao)};${formatCSVNumber(p.jurosIndexador)};${formatCSVNumber(p.jurosSpread)};${formatCSVNumber(p.totalPago)};${formatCSVNumber(p.saldoDevedorFinal)}\n`;
    });
    csv += `\n`;
  });

  return csv;
}
