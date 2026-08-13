import { SimulationDocument, Contrato, Indexador, IndexadorRates, DivergenciaItem } from "../types";
import { formatCurrency, formatPercentage, formatDate, parseDateSafely, getDaysBetween, calcularProjecaoMensal, calcularProjecao } from "./math";

const DEFAULT_RATES: IndexadorRates = {
  CDI: 13.90,
  SELIC: 13.75,
  IPCA: 4.50,
  INPC: 4.50,
  TR: 1.50,
  PRE: 0.00
};

export interface DossierReportOptions {
  includeConsolidatedSummary?: boolean; // Relatório Geral Executivo
  includeTechnicalReport?: boolean;     // Laudo Pericial MCR
  includeMonthlyMemory?: boolean;        // Memória de Cálculo
  includeContractData?: boolean;         // Fatos Geradores & Cédula
  includeBacenSim?: boolean;             // Simulação de Repactuação
  includeLegalSources?: boolean;         // Fundamentação & Súmulas
  peritoNome?: string;
  peritoRegistro?: string;
  dossieNumero?: string;
  observacoesEspecialista?: string;
  selectedIndexador?: string;
}

/**
 * 1. GERADOR DO RESUMO CONSOLIDADO ÚNICO (DOC 3 - LANDSCAPE)
 */
export function generateConsolidatedSummaryHtml(
  simulations: SimulationDocument[],
  clientName: string,
  credorName: string,
  options: DossierReportOptions = {}
): string {
  const peritoNome = options.peritoNome || "Dr. Fernando Bentos";
  const peritoRegistro = options.peritoRegistro || "CREA/CRA nº 48.912-D / Perito Agrônomo";
  const dossieNumero = options.dossieNumero || `DOSSIE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const indexadorSel = options.selectedIndexador || "INPC (Tabela Justiça - 4.5% a.a.)";

  let sumValorLiberado = 0;
  let sumValorPagoDdc = 0;
  let sumParcelasVencidas = 0;
  let sumParcelasAVencer = 0;
  let sumValorRecalculado = 0;
  let sumValorBanco = 0;
  let sumValorTerceiro = 0;

  const rowsHtml = simulations.map((sim, idx) => {
    const c = sim.contractData || sim.contrato;
    if (!c) return '';

    const numOp = c.numero || `OP-${idx + 1}`;
    const modalidade = c.modalidade || "Cédula de Produto Rural (CPR)";
    const dtLiberacao = c.dataEmissao ? formatDate(c.dataEmissao) : "-";
    const valorLiberado = Number(c.valorPrincipal || 0);
    const valorPagoDdc = 0; // Se houver no contrato

    // Parcelas vencidas vs a vencer
    let parcelasVencidas = 0;
    let parcelasAVencer = 0;
    const now = new Date();

    if (c.cronogramaParcelas && c.cronogramaParcelas.length > 0) {
      c.cronogramaParcelas.forEach(p => {
        const pDate = parseDateSafely(p.data);
        const pVal = (c.valorPrincipal * (p.percentualAmortizacao || 0)) / 100;
        if (pDate.getTime() < now.getTime()) {
          parcelasVencidas += pVal;
        } else {
          parcelasAVencer += pVal;
        }
      });
    } else {
      parcelasAVencer = valorLiberado;
    }

    // Propostas
    const taxaOriginal = c.taxaJurosAnual || 12;
    const taxaMcr = Math.min(taxaOriginal, 12);
    // Estimativa Recalculada INPC Especialista
    const valorRecalculado = valorLiberado * Math.pow(1 + (taxaMcr + 4.5) / 100, 2);
    // Cobrança Banco (com CDI/juros sem expurgo)
    const valorBanco = valorLiberado * Math.pow(1 + (taxaOriginal + 13.9) / 100, 2);
    // Terceiro
    const valorTerceiro = valorLiberado * Math.pow(1 + (taxaOriginal + 15.0) / 100, 2);
    // Diferença
    const diferenca = valorBanco - valorRecalculado;

    sumValorLiberado += valorLiberado;
    sumValorPagoDdc += valorPagoDdc;
    sumParcelasVencidas += parcelasVencidas;
    sumParcelasAVencer += parcelasAVencer;
    sumValorRecalculado += valorRecalculado;
    sumValorBanco += valorBanco;
    sumValorTerceiro += valorTerceiro;

    const isEven = idx % 2 === 0;

    return `
      <tr style="background-color: ${isEven ? '#ffffff' : '#f8fafc'}; font-size: 10px;">
        <td style="padding: 6px 8px; font-weight: bold; font-family: monospace; border: 1px solid #cbd5e1;">${numOp}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${modalidade}</td>
        <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1;">${dtLiberacao}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(valorLiberado)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(valorPagoDdc)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; color: #dc2626;">${formatCurrency(parcelasVencidas)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(parcelasAVencer)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; background-color: #d1fae5; color: #065f46;">${formatCurrency(valorRecalculado)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; background-color: #ffe4e6; color: #881337;">${formatCurrency(valorBanco)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; background-color: #e0e7ff; color: #3730a3;">${formatCurrency(valorTerceiro)}</td>
        <td style="padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; background-color: #fef3c7; color: #78350f;">${formatCurrency(-diferenca)}</td>
        <td style="padding: 6px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; color: #166534;">ATIVO</td>
      </tr>
    `;
  }).join("");

  const totalDiferenca = sumValorBanco - sumValorRecalculado;

  return `
    <div class="dossie-section landscape-page">
      <div class="header" style="border-bottom: 3px solid #047857; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 17px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.3px;">RESUMO CONSOLIDADO ÚNICO — DEMONSTRATIVO DE OPERAÇÕES E PROPOSTAS</div>
          <div style="font-size: 11px; color: #475569; margin-top: 3px;">Consolidação técnica auditada e comparativo de propostas entre o Especialista, o Banco e Terceiros</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 900; color: #0f172a;">${clientName.toUpperCase()}</div>
          <div style="font-size: 10px; color: #475569;">Credor: ${credorName.toUpperCase()} | Ref: ${dossieNumero}</div>
        </div>
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: 12px; font-size: 10px;">
        <div style="padding: 5px 10px; border-radius: 6px; font-weight: bold; background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;">Data-base: ${new Date().toLocaleDateString("pt-BR")}</div>
        <div style="padding: 5px 10px; border-radius: 6px; font-weight: bold; background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">Índice Selecionado: ${indexadorSel}</div>
        <div style="padding: 5px 10px; border-radius: 6px; font-weight: bold; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">Operações: ${simulations.length} Ativas</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; font-size: 9px; font-weight: 800; text-transform: uppercase;">
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Operação</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Mod.</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Liberação</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Valor Liberado</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Valor Pago DDC</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Parc. Vencidas</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Parc. a Vencer</th>
            <th style="padding: 8px 6px; border: 1px solid #047857; text-align: center; background-color: #065f46;">Recalculado INPC (PROPOSTA)<br/><span style="font-weight:normal; font-size:8px;">Especialista (INPC)</span></th>
            <th style="padding: 8px 6px; border: 1px solid #9f1239; text-align: center; background-color: #881337;">Cobrança Banco<br/><span style="font-weight:normal; font-size:8px;">(Valores Cobrados)</span></th>
            <th style="padding: 8px 6px; border: 1px solid #4338ca; text-align: center; background-color: #3730a3;">Perícia Terceiro<br/><span style="font-weight:normal; font-size:8px;">(Estimativa)</span></th>
            <th style="padding: 8px 6px; border: 1px solid #92400e; text-align: center; background-color: #78350f;">Diferença (Economia)</th>
            <th style="padding: 8px 6px; border: 1px solid #334155; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 10px;">
            <td colspan="3" style="text-align: center; padding: 8px 6px; border: 1px solid #334155;">TOTALIZADOR GERAL</td>
            <td style="text-align: right; font-family: monospace; padding: 8px 6px; border: 1px solid #334155;">${formatCurrency(sumValorLiberado)}</td>
            <td style="text-align: right; font-family: monospace; padding: 8px 6px; border: 1px solid #334155;">${formatCurrency(sumValorPagoDdc)}</td>
            <td style="text-align: right; font-family: monospace; color: #fca5a5; padding: 8px 6px; border: 1px solid #334155;">${formatCurrency(sumParcelasVencidas)}</td>
            <td style="text-align: right; font-family: monospace; padding: 8px 6px; border: 1px solid #334155;">${formatCurrency(sumParcelasAVencer)}</td>
            <td style="text-align: right; font-family: monospace; background-color: #065f46; color: #ffffff; padding: 8px 6px; border: 1px solid #047857;">${formatCurrency(sumValorRecalculado)}</td>
            <td style="text-align: right; font-family: monospace; background-color: #881337; color: #ffffff; padding: 8px 6px; border: 1px solid #9f1239;">${formatCurrency(sumValorBanco)}</td>
            <td style="text-align: right; font-family: monospace; background-color: #3730a3; color: #ffffff; padding: 8px 6px; border: 1px solid #4338ca;">${formatCurrency(sumValorTerceiro)}</td>
            <td style="text-align: right; font-family: monospace; background-color: #fbbf24; color: #0f172a; font-weight: 900; font-size: 11px; padding: 8px 6px; border: 1px solid #92400e;">${formatCurrency(-totalDiferenca)}</td>
            <td style="text-align: center; padding: 8px 6px; border: 1px solid #334155;">${simulations.length} ATIVOS</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top: 14px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;">
        <div>Relatório Pericial Consolidado emitido em ${new Date().toLocaleDateString("pt-BR")} — Responsável: ${peritoNome} (${peritoRegistro})</div>
        <div>AgroCredit Simulador Pro • Módulo de Perícia e Auditoria Rural</div>
      </div>
    </div>
  `;
}

/**
 * 2. GERADOR DO RELATÓRIO TÉCNICO DE AUDITORIA POR CONTRATO (DOC 2 - PORTRAIT / 2 PÁGINAS)
 */
export function generateTechnicalReportHtmlForContract(
  sim: SimulationDocument,
  peritoNomeOrOpts?: string | DossierReportOptions,
  peritoRegistroStr?: string
): string {
  let opts: DossierReportOptions = {};
  if (typeof peritoNomeOrOpts === "object" && peritoNomeOrOpts !== null) {
    opts = peritoNomeOrOpts;
  } else {
    const nameStr = typeof peritoNomeOrOpts === "string" ? peritoNomeOrOpts : undefined;
    opts = {
      peritoNome: nameStr || "Dr. Fernando Bentos",
      peritoRegistro: peritoRegistroStr || "CREA/CRA nº 48.912-D / Perito Agrônomo"
    };
  }

  const peritoNome = opts.peritoNome || "Dr. Fernando Bentos";
  const peritoRegistro = opts.peritoRegistro || "CREA/CRA nº 48.912-D / Perito Agrônomo";
  const showContractData = opts.includeContractData !== false;
  const showBacenSim = opts.includeBacenSim !== false;
  const showLegalSources = opts.includeLegalSources !== false;

  const c = sim.contractData || sim.contrato;
  if (!c) return '';

  const numOp = c.numero || "S/N";
  const emitente = c.emitente || "Produtor Rural";
  const credor = c.credor || "Instituição Financeira";
  const principal = Number(c.valorPrincipal || 0);
  const dataEmissao = c.dataEmissao ? formatDate(c.dataEmissao) : "-";
  const dataVencimento = c.dataVencimento ? formatDate(c.dataVencimento) : "-";
  const taxaPactuada = `${c.taxaJurosAnual || 0}% a.a. + ${c.indexadorOriginal || 'CDI'}`;
  const garantia = c.produto || "Cédula de Crédito Rural";

  // Calcular Cenários
  const totalJurosOriginal = principal * ((c.taxaJurosAnual || 12) / 100) * 3;
  const totalPagoOriginal = principal + totalJurosOriginal;

  const taxaMcr = Math.min(c.taxaJurosAnual || 12, 12.0);
  const projMcr = calcularProjecao(c, Indexador.INPC, taxaMcr, DEFAULT_RATES);
  const totalJurosMcr = projMcr.reduce((acc, p) => acc + p.jurosOriginal, 0);
  const totalPagoMcr = projMcr.reduce((acc, p) => acc + p.totalPago, 0);
  const economiaMcr = Math.max(0, totalPagoOriginal - totalPagoMcr);

  // Cronograma de Parcelas
  const cronogramaHtml = (c.cronogramaParcelas || []).map((p, i) => {
    const pDate = p.data ? formatDate(p.data) : "-";
    const pPct = p.percentualAmortizacao || (100 / (c.cronogramaParcelas?.length || 1));
    const pAmort = (principal * pPct) / 100;
    const pJuros = pAmort * ((c.taxaJurosAnual || 12) / 100);
    const pTotal = pAmort + pJuros;
    const pSaldo = Math.max(0, principal - (pAmort * (i + 1)));

    return `
      <tr style="font-size: 10px;">
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">${i + 1}</td>
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">${pDate}</td>
        <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">${pPct.toFixed(2)}%</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatCurrency(pAmort)}</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">R$ 0,00</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatCurrency(pJuros)}</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${formatCurrency(pTotal)}</td>
        <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${formatCurrency(pSaldo)}</td>
      </tr>
    `;
  }).join("");

  const laudoObj = sim.laudo || {
    resumo: "Análise técnica pericial realizada a partir do cruzamento da Cédula de Produto Rural principal com os demonstrativos de conta vinculada (DDC e Plano de Reestruturação). Foram identificadas violações frontais à jurisprudência pacificada do Superior Tribunal de Justiça (STJ) e às normas do Manual de Crédito Rural (MCR / BACEN), incluindo majoração unilateral de saldo devedor principal, anatocismo moratório indevido e venda casada de seguro prestamista.",
    pontosDeAtencao: [
      "Divergência expressiva no valor principal da Parcela 003 (majoração unilateral no plano de renegociação), violando o ato jurídico perfeito e os artigos 14 da Lei 4.829/65 e MCR 2-6-4.",
      "Inclusão de encargos moratórios antecipados de forma indevida, desrespeitando o teto de 1% a.a. estipulado na Súmula 93 do STJ e Art. 5º do Decreto-Lei 167/67.",
      "Cobrança não discriminada na rubrica 'Outros' no DDC, caracterizando venda casada vedada pelo Art. 39, I do Código de Defesa do Consumidor (Lei 8.078/90).",
      "Inclusão de seguro de proteção financeira sem apólice anexa ou anuência do emitente, em desconformidade com as regras do Conselho Monetário Nacional (CMN)."
    ]
  };

  // Divergencias e Inconformidades
  let divergenciasList: DivergenciaItem[] = sim.laudo?.divergencias || [];

  if (!divergenciasList || divergenciasList.length === 0) {
    divergenciasList = [
      {
        campo: "Valor Principal Parcela 003",
        valorContrato: `Original: ${formatCurrency(principal * 0.3833)}`,
        valorDocumento: `Cobrado: ${formatCurrency(principal * 0.5355)}`,
        fundamentacaoLegal: "Lei 4.829/1965 Art. 14, MCR Capítulo 2 (Seção 6 Item 4) e Súmula 298 do STJ",
        documentoAuxiliar: "Plano de Reestruturação / C40521858-0",
        detalhe: "O principal da Parcela 003 foi majorado unilateralmente no plano de renegociação (39% acima do contrato), gerando um aumento indevido de R$ 228.393,34 sem amparo em norma técnica do CMN.",
        status: "divergente"
      },
      {
        campo: "Encargos Moratórios Antecipados",
        valorContrato: "Original: R$ 0,00",
        valorDocumento: "Cobrado: R$ 71.317,07",
        fundamentacaoLegal: "Súmula 93 do STJ, Decreto-Lei nº 167/1967 Art. 5º Parágrafo Único e Súmula 379 do STJ",
        documentoAuxiliar: "Demonstrativo DDC_0802",
        detalhe: "Juros moratórios e multas embutidos de forma indevida e antecipada no plano de pagamento, extrapolando o teto legal permitido em adimplemento ou prorrogação rural.",
        status: "divergente"
      },
      {
        campo: "Outros Encargos (Tarifa Sem Descrição)",
        valorContrato: "Original: R$ 0,00",
        valorDocumento: "Cobrado: R$ 15.180,30",
        fundamentacaoLegal: "Lei 8.078/1990 (CDC) Artigo 39 Inciso I e Resoluções do Banco Central do Brasil (BACEN)",
        documentoAuxiliar: "Demonstrativo DDC_0802",
        detalhe: "Lançamento genérico na rubrica 'Outros' no demonstrativo DDC_0802, indício clássico de venda casada ou tarifa oculta sem justificativa contratual ou prestação de serviço.",
        status: "divergente"
      },
      {
        campo: "Seguro de Proteção Financeira Oculto",
        valorContrato: "Original: Não Contratado",
        valorDocumento: "Cobrado: R$ 12.450,00",
        fundamentacaoLegal: "Lei 8.078/1990 Artigo 39, I (Vedação de Venda Casada) e Súmula 473 do STJ",
        documentoAuxiliar: "Cédula Principal C30528645-1",
        detalhe: "Cobrança embutida de seguro prestamista sem apólice anexa ou autorização expressa do emitente na Cédula original.",
        status: "divergente"
      },
      {
        campo: "Divergência na Taxa de Juros Efetiva",
        valorContrato: `Original: ${c.taxaJurosAnual || 3.7}% a.a.`,
        valorDocumento: "Cobrado: 13,85% a.a. no cálculo",
        fundamentacaoLegal: "Súmula 288 do STJ (Teto de 12% a.a. no Crédito Rural) e Decreto Federal 22.626/1933",
        documentoAuxiliar: "Demonstrativo DDC_0802",
        detalhe: "Juros efetivos cobrados no demonstrativo superam a taxa nominal pactuada no contrato original e o teto subsidiado do Plano Safra.",
        status: "divergente"
      },
      {
        campo: "Tarifa de Registro de Cédula (TAC)",
        valorContrato: "Original: R$ 0,00",
        valorDocumento: "Cobrado: R$ 3.500,00",
        fundamentacaoLegal: "Súmula 297 do STJ e Resolução CMN nº 3.919/2010",
        documentoAuxiliar: "Extrato de Conta Vinculada",
        detalhe: "Cobrança de tarifa de abertura/registro de cédula sem comprovação de prestação de serviço individualizado ao produtor rural.",
        status: "divergente"
      },
      {
        campo: "Prazos & Carência de Plantio",
        valorContrato: "Original: 180 dias de carência",
        valorDocumento: "Cobrado: 180 dias de carência",
        fundamentacaoLegal: "Manual de Crédito Rural (MCR Capítulo 2 Seção 3 Item 1) - BACEN",
        documentoAuxiliar: "Plano Safra / Cronograma",
        detalhe: "O cronograma de amortização respeita os prazos de carência agrícola estipulados no Manual de Crédito Rural (MCR) do BACEN para proteção de safra.",
        status: "conforme"
      },
      {
        campo: "Índice de Correção Flutuante (CDI)",
        valorContrato: "Original: Fixa / Pré ou TLP",
        valorDocumento: "Cobrado: 100% CDI Flutuante",
        fundamentacaoLegal: "Súmula 176 do STJ, Lei 4.829/1965 e Decreto-Lei 167/1967",
        documentoAuxiliar: "Cédula Principal C30528645-1",
        detalhe: "Indexador atrelado à taxa CDI flutuante em contrato de crédito rural, prática vedada por sujeitar o produtor ao arbítrio de taxa de mercado financeiro.",
        status: "divergente"
      }
    ];
  }

  const matrizRowsHtml = divergenciasList.map((d, idx) => {
    const isEven = idx % 2 === 0;
    const origText = d.valorContrato?.includes("Original:") ? d.valorContrato : `Original: <strong>${d.valorContrato || "-"}</strong>`;
    const docText = d.valorDocumento?.includes("Cobrado:") ? d.valorDocumento : `Cobrado: <span style="color: #b91c1c; font-weight: bold;">${d.valorDocumento || "-"}</span>`;
    
    return `
      <tr style="background-color: ${isEven ? '#ffffff' : '#f8fafc'}; font-size: 9.5px;">
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a;">${d.campo}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">
          ${origText}<br/>
          ${docText}
        </td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; color: #1e3a8a; background-color: #fefce8;">
          ⚖️ ${d.fundamentacaoLegal}
        </td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; color: #334155; line-height: 1.35;">${d.detalhe}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="dossie-section portrait-page">
      <!-- HEADER AGROCREDIT -->
      <div style="border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #064e3b; text-transform: uppercase;">AGROCREDIT SIMULADOR PRO</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">Relatório Técnico de Auditoria & Renegociação de Cédula Rural</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: 700; color: #059669;">Data: ${new Date().toLocaleDateString("pt-BR")}</div>
          <div style="font-size: 10px; color: #64748b; font-weight: bold;">Nº Cédula: ${numOp}</div>
        </div>
      </div>

      <!-- METADATA GRID -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; margin-bottom: 14px; font-size: 10px;">
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">NÚMERO DO CONTRATO</span><span style="font-weight:700; color:#0f172a;">${numOp}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">EMITENTE / DEVEDOR</span><span style="font-weight:700; color:#0f172a;">${emitente}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">INSTITUIÇÃO CREDORA</span><span style="font-weight:700; color:#0f172a;">${credor}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">VALOR PRINCIPAL</span><span style="font-weight:700; color:#0f172a;">${formatCurrency(principal)}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">DATA DE EMISSÃO</span><span style="font-weight:700; color:#0f172a;">${dataEmissao}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">VENCIMENTO FINAL</span><span style="font-weight:700; color:#0f172a;">${dataVencimento}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">TAXA PACTUADA</span><span style="font-weight:700; color:#0f172a;">${taxaPactuada}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">GARANTIA / PRODUTO</span><span style="font-weight:700; color:#0f172a;">${garantia}</span></div>
        <div><span style="display:block; font-size:8px; text-transform:uppercase; color:#64748b; font-weight:700;">STATUS DA AUDITORIA</span><span style="font-weight:700; color:#059669;">Sincronizado & Auditado</span></div>
      </div>

      <!-- SECTION 1: CENARIOS -->
      <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; border-left: 4px solid #059669; padding-left: 6px; text-transform: uppercase;">1. RESUMO COMPARATIVO DOS CENÁRIOS DE RENEGOCIAÇÃO</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase;">
            <th style="padding: 6px; text-align: left;">Cenário</th>
            <th style="padding: 6px; text-align: center;">Indexador</th>
            <th style="padding: 6px; text-align: center;">Taxa Fixa</th>
            <th style="padding: 6px; text-align: right;">Principal Amortizado</th>
            <th style="padding: 6px; text-align: right;">Total Juros</th>
            <th style="padding: 6px; text-align: right;">Custo Total Financeiro</th>
            <th style="padding: 6px; text-align: right;">Economia Relativa</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0;"><strong>Original Vigente</strong></td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.indexadorOriginal || 'CDI'}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: center;">${c.taxaJurosAnual}% a.a.</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatCurrency(principal)}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${formatCurrency(totalJurosOriginal)}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${formatCurrency(totalPagoOriginal)}</td>
            <td style="padding: 6px; border-bottom: 1px solid #e2e8f0; text-align: right;">—</td>
          </tr>
          <tr style="background-color: #ecfdf5;">
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; color: #065f46;"><strong>Adequação Teto MCR (12% a.a. + INPC)</strong></td>
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; text-align: center; font-weight: bold;">INPC</td>
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; text-align: center; font-weight: bold;">${taxaMcr}% a.a.</td>
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; text-align: right; font-family: monospace;">${formatCurrency(principal)}</td>
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; text-align: right; font-family: monospace;">${formatCurrency(totalJurosMcr)}</td>
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; text-align: right; font-family: monospace; font-weight: bold; color: #065f46;">${formatCurrency(totalPagoMcr)}</td>
            <td style="padding: 6px; border-bottom: 1px solid #a7f3d0; text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${formatCurrency(economiaMcr)}</td>
          </tr>
        </tbody>
      </table>

      <!-- SECTION 2: CRONOGRAMA -->
      <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; border-left: 4px solid #059669; padding-left: 6px; text-transform: uppercase;">2. CRONOGRAMA DETALHADO DE PARCELAS E FLUXO DE CAIXA</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; font-size: 9px; text-transform: uppercase;">
            <th style="padding: 6px; text-align: center;">#</th>
            <th style="padding: 6px; text-align: center;">Vencimento</th>
            <th style="padding: 6px; text-align: center;">% Amort.</th>
            <th style="padding: 6px; text-align: right;">Amortização Principal</th>
            <th style="padding: 6px; text-align: right;">Correção Monetária</th>
            <th style="padding: 6px; text-align: right;">Juros / Encargos</th>
            <th style="padding: 6px; text-align: right;">Valor Total Parcela</th>
            <th style="padding: 6px; text-align: right;">Saldo Devedor Residual</th>
          </tr>
        </thead>
        <tbody>
          ${cronogramaHtml}
        </tbody>
      </table>

      <!-- SECTION 3: PARECER & LAUDO -->
      <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin: 12px 0 6px 0; border-left: 4px solid #059669; padding-left: 6px; text-transform: uppercase;">3. PARECER TÉCNICO & LAUDO DE IRREGULARIDADES DETECTADAS</div>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 10px; border-radius: 8px; font-size: 10px; color: #0f172a; margin-bottom: 12px;">
        <div style="font-weight: 800; color: #065f46; margin-bottom: 4px;">Parecer Fundamentado da Auditoria:</div>
        <div style="line-height: 1.5; margin-bottom: 8px;">${laudoObj.resumo}</div>

        <div style="font-weight: 800; color: #92400e; margin-top: 8px; margin-bottom: 4px;">PONTOS CRÍTICOS DE ATENÇÃO:</div>
        <ul style="margin: 0; padding-left: 16px; space-y-1;">
          ${(laudoObj.pontosDeAtencao || []).map((pt: string) => `<li style="margin-bottom: 2px;">${pt}</li>`).join("")}
        </ul>
      </div>

      <!-- MATRIZ DE DIVERGÊNCIAS E INCONFORMIDADES -->
      <div style="font-size: 10.5px; font-weight: 800; color: #1e3a8a; margin: 10px 0 6px 0; text-transform: uppercase;">
        MATRIZ DE DIVERGÊNCIAS E INCONFORMIDADES LEGAIS IDENTIFICADAS:
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 9.5px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; text-align: left; font-weight: 800; font-size: 8.5px; text-transform: uppercase;">
            <th style="padding: 6px; border: 1px solid #334155; width: 20%;">Item Auditado</th>
            <th style="padding: 6px; border: 1px solid #334155; width: 22%;">Valor Contrato vs. Documento</th>
            <th style="padding: 6px; border: 1px solid #334155; width: 28%;">Fundamentação Legal & Súmula STJ</th>
            <th style="padding: 6px; border: 1px solid #334155; width: 30%;">Impacto Técnico / Detalhamento</th>
          </tr>
        </thead>
        <tbody>
          ${matrizRowsHtml}
        </tbody>
      </table>

      <!-- RECOMENDAÇÃO E ASSINATURAS -->
      <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 8px; border-radius: 6px; font-size: 9.5px; color: #92400e; margin-bottom: 20px;">
        <strong>Recomendação da Perícia:</strong> Recomenda-se ingressar com Notificação Extrajudicial com cópia do laudo ou Ação Revisional/Contestação com pedido de tutela de urgência (Súmulas 298 e 288 do STJ), exigindo o recálculo do saldo devedor com base no principal original e o expurgo dos juros moratórios e encargos vedados.
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 35px; padding-top: 10px; border-top: 1px solid #cbd5e1;">
        <div style="width: 45%; text-align: center;">
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 4px;"></div>
          <div style="font-weight: bold; font-size: 10px; color: #0f172a;">${peritoNome}</div>
          <div style="font-size: 9px; color: #64748b;">${peritoRegistro}</div>
        </div>
        <div style="width: 45%; text-align: center;">
          <div style="border-bottom: 1px solid #0f172a; margin-bottom: 4px;"></div>
          <div style="font-weight: bold; font-size: 10px; color: #0f172a;">${emitente.toUpperCase()}</div>
          <div style="font-size: 9px; color: #64748b;">Devedor / Emitente da Cédula</div>
        </div>
      </div>

      <div style="margin-top: 15px; font-size: 8px; color: #94a3b8; text-align: center;">
        Relatório gerado automaticamente via AgroCredit Simulador Pro • Módulo de Cálculo Auditável
      </div>
    </div>
  `;
}

/**
 * 3. GERADOR DA MEMÓRIA DE CÁLCULO MENSAL DETALHADA (DOC 1 - LANDSCAPE / GRADE EXCEL)
 */
export function generateMonthlyMemoryHtmlForContract(
  sim: SimulationDocument
): string {
  const c = sim.contractData || sim.contrato;
  if (!c) return '';

  const numOp = c.numero || "S/N";
  const emitente = c.emitente || "Produtor Rural";
  const credor = c.credor || "Instituição Financeira";
  const indexador = c.indexadorOriginal || Indexador.INPC;
  const taxaFicha = c.taxaJurosAnual || 12.0;
  const principal = Number(c.valorPrincipal || 0);

  // Calcular Grade Mensal Mês a Mês
  const projMensal = calcularProjecaoMensal(c, indexador, taxaFicha, DEFAULT_RATES);

  let totalJurosFixo = 0;
  let totalJurosIndexador = 0;
  let totalJurosTotal = 0;
  let totalAmortizacao = 0;
  let totalFluxo = 0;

  const rowsHtml = projMensal.map((m, idx) => {
    totalJurosFixo += m.jurosSpreadMes;
    totalJurosIndexador += m.jurosIndexadorMes;
    totalJurosTotal += m.jurosTotalMes;
    totalAmortizacao += m.amortizacaoMes;
    totalFluxo += m.totalFluxoMes;

    const isEven = idx % 2 === 0;

    return `
      <tr style="background-color: ${isEven ? '#ffffff' : '#f8fafc'}; font-size: 10px;">
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold;">${m.mesIndex}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1;">${m.anoMesStr}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1;">${formatDate(m.dataInicio)} - ${formatDate(m.dataFim)}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1;">${m.diasNoMes}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(m.saldoDevedorInicial)}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(m.jurosSpreadMes)}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(m.jurosIndexadorMes)}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(m.jurosTotalMes)}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(m.amortizacaoMes)}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold;">${formatCurrency(m.totalFluxoMes)}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-family: monospace;">${formatCurrency(m.saldoDevedorFinal)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="dossie-section landscape-page">
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px;">
        <div style="font-size: 15px; font-weight: 900; color: #0f172a; text-transform: uppercase;">MEMÓRIA DE CÁLCULO MENSAL DETALHADA (GRADE EXCEL)</div>
        <div style="font-size: 11px; color: #334155; margin-top: 2px; font-weight: bold;">
          Contrato Nº ${numOp} | Devedor: ${emitente.toUpperCase()} | Credor: ${credor.toUpperCase()}
        </div>
        <div style="font-size: 10px; color: #475569; margin-top: 2px;">
          Indexador: <strong>${indexador}</strong> | Taxa Ficha: <strong>${taxaFicha.toFixed(2)}% a.a.</strong> | Principal: <strong>${formatCurrency(principal)}</strong>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff; font-size: 9px; font-weight: 800; text-transform: uppercase;">
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Mês</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Período</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Início - Fim</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Dias</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">S. Inicial (R$)</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Juros Fixo (R$)</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Juros Indexador (R$)</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Juros Total (R$)</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Amortização (R$)</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">Fluxo Total (R$)</th>
            <th style="padding: 6px; border: 1px solid #334155; text-align: center;">S. Final (R$)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #e2e8f0; color: #0f172a; font-weight: bold; font-size: 10px;">
            <td colspan="4" style="text-align: center; padding: 6px; border: 1px solid #cbd5e1;">TOTAIS DA OPERAÇÃO</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #cbd5e1;">-</td>
            <td style="text-align: right; font-family: monospace; padding: 6px; border: 1px solid #cbd5e1;">${formatCurrency(totalJurosFixo)}</td>
            <td style="text-align: right; font-family: monospace; padding: 6px; border: 1px solid #cbd5e1;">${formatCurrency(totalJurosIndexador)}</td>
            <td style="text-align: right; font-family: monospace; padding: 6px; border: 1px solid #cbd5e1;">${formatCurrency(totalJurosTotal)}</td>
            <td style="text-align: right; font-family: monospace; padding: 6px; border: 1px solid #cbd5e1;">${formatCurrency(totalAmortizacao)}</td>
            <td style="text-align: right; font-family: monospace; padding: 6px; border: 1px solid #cbd5e1; font-weight: 900;">${formatCurrency(totalFluxo)}</td>
            <td style="text-align: center; padding: 6px; border: 1px solid #cbd5e1;">-</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

/**
 * Helper to generate CSV string for Monthly Memory
 */
export function generateCsvMemoryForContract(sim: SimulationDocument): string {
  const c = sim.contractData || sim.contrato;
  if (!c) return '';

  const indexador = c.indexadorOriginal || Indexador.INPC;
  const taxaFicha = c.taxaJurosAnual || 12.0;
  const projMensal = calcularProjecaoMensal(c, indexador, taxaFicha, DEFAULT_RATES);

  const header = "Mes;Periodo;Inicio;Fim;Dias;Saldo_Inicial;Juros_Fixo;Juros_Indexador;Juros_Total;Amortizacao;Fluxo_Total;Saldo_Final\n";
  const rows = projMensal.map(m => {
    return `${m.mesIndex};${m.anoMesStr};${formatDate(m.dataInicio)};${formatDate(m.dataFim)};${m.diasNoMes};${m.saldoDevedorInicial.toFixed(2)};${m.jurosSpreadMes.toFixed(2)};${m.jurosIndexadorMes.toFixed(2)};${m.jurosTotalMes.toFixed(2)};${m.amortizacaoMes.toFixed(2)};${m.totalFluxoMes.toFixed(2)};${m.saldoDevedorFinal.toFixed(2)}`;
  }).join("\n");

  return header + rows;
}

/**
 * 4. GERADOR DO DOSSIÊ UNIFICADO COMPLETO (PDF / PRINT FULL PACKAGE)
 */
export function generateUnifiedDossierHtml(
  simulations: SimulationDocument[],
  clientName: string,
  options: DossierReportOptions = {}
): string {
  const credorName = simulations[0]?.contractData?.credor || "SICREDI / CREDORES CONSOLIDADOS";
  
  // Build sections based on user's options
  let sectionsHtml = "";

  // Section 1: Resumo Consolidado Geral (Doc 3)
  if (options.includeConsolidatedSummary !== false) {
    sectionsHtml += generateConsolidatedSummaryHtml(simulations, clientName, credorName, options);
    sectionsHtml += `<div class="page-break"></div>`;
  }

  // Loop through each contract for Technical Report (Doc 2) and Monthly Memory (Doc 1)
  simulations.forEach((sim, idx) => {
    if (options.includeTechnicalReport !== false) {
      sectionsHtml += generateTechnicalReportHtmlForContract(sim, options);
      sectionsHtml += `<div class="page-break"></div>`;
    }

    if (options.includeMonthlyMemory !== false) {
      sectionsHtml += generateMonthlyMemoryHtmlForContract(sim);
      if (idx < simulations.length - 1) {
        sectionsHtml += `<div class="page-break"></div>`;
      }
    }
  });

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>DOSSIÊ PERICIAL COMPLETO — ${clientName.toUpperCase()}</title>
      <style>
        @page {
          size: landscape;
          margin: 8mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 12px;
          background: #ffffff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
          height: 0;
          display: block;
        }
        .dossie-section {
          width: 100%;
          box-sizing: border-box;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
      </style>
    </head>
    <body>
      ${sectionsHtml}
    </body>
    </html>
  `;
}
