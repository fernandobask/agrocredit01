import { Contrato, Indexador, ProjecaoParcela, IndexadorRates, ResultadoCenario } from "../types";

// Calculates the number of days between two date strings (YYYY-MM-DD)
export function getDaysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + "T00:00:00");
  const d2 = new Date(date2 + "T00:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Format currency to Brazilian Real (R$)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Format percentage
export function formatPercentage(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value / 100);
}

// Format date to Brazilian standard DD/MM/YYYY
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
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
    new Date(a.data + "T00:00:00").getTime() - new Date(b.data + "T00:00:00").getTime()
  );

  const projecoes: ProjecaoParcela[] = [];
  let saldoDevedor = valorPrincipal;
  let dataReferenciaAnterior = dataEmissao;

  // Rate of the target indexer
  const taxaIndexadorAnual = indexadorRates[indexadorAlvo] / 100; // e.g. 10.65% -> 0.1065
  const taxaSpreadAnual = novaTaxaJurosAnual / 100; // e.g. 3.7% -> 0.037

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
  csv += `Valor Principal;${contrato.valorPrincipal.toFixed(2)}\n`;
  csv += `Data de Emissão;${formatDate(contrato.dataEmissao)}\n`;
  csv += `Data de Vencimento;${formatDate(contrato.dataVencimento)}\n`;
  csv += `Taxa Original;${contrato.taxaJurosAnual}% a.a. + ${contrato.indexadorOriginal}\n\n`;

  // Scenarios Summary Table
  csv += `RESUMO DOS CENÁRIOS COMPARATIVOS\n`;
  csv += `Cenário;Indexador;Taxa Fixa/Spread;Total Amortizado (R$);Total Juros (R$);Custo Total Financeiro (R$);Economia Gerada (R$)\n`;

  cenarios.forEach(cen => {
    csv += `${cen.nome};${cen.indexador};${cen.taxaJurosAnual.toFixed(2)}%;${cen.totalAmortizado.toFixed(2)};${cen.totalJuros.toFixed(2)};${cen.totalPago.toFixed(2)};${cen.economiaRelativa.toFixed(2)}\n`;
  });
  csv += `\n\n`;

  // Detailed Cash Flow for each scenario
  cenarios.forEach(cen => {
    csv += `DETALHAMENTO DO FLUXO DE CAIXA: ${cen.nome.toUpperCase()}\n`;
    csv += `Parcela;Data Vencimento;% Amortizacao;Saldo Inicial (R$);Amortização (R$);Juros Indexador (R$);Juros Taxa Fixa (R$);Total Parcela (R$);Saldo Final (R$)\n`;
    
    cen.parcelas.forEach(p => {
      csv += `${p.numero};${formatDate(p.data)};${p.percentualAmortizacao.toFixed(4)}%;${p.saldoDevedorInicial.toFixed(2)};${p.amortizacao.toFixed(2)};${p.jurosIndexador.toFixed(2)};${p.jurosSpread.toFixed(2)};${p.totalPago.toFixed(2)};${p.saldoDevedorFinal.toFixed(2)}\n`;
    });
    csv += `\n`;
  });

  return csv;
}
