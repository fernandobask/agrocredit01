export interface ProjecaoMensal {
  mesIndex: number;
  anoMesStr: string; // e.g. "05/2024"
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  diasNoMes: number;
  saldoDevedorInicial: number;
  jurosSpreadMes: number;
  jurosIndexadorMes: number;
  jurosTotalMes: number;
  amortizacaoMes: number;
  totalFluxoMes: number;
  saldoDevedorFinal: number;
  isMesParcela: boolean;
  numeroParcela?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details?: string;
}

export enum Indexador {
  CDI = "CDI",
  SELIC = "SELIC",
  IPCA = "IPCA",
  INPC = "INPC",
  TR = "TR",
  PRE = "PRE" // Pré-fixado
}

export interface ParcelaScheduling {
  data: string; // YYYY-MM-DD
  percentualAmortizacao: number; // e.g. 20 for 20%
  paga?: boolean; // Se a parcela foi paga / liquidada
  valorAmortizadoPago?: number; // O valor total pago de fato (R$)
  valorPrincipalManual?: number; // Valor do Principal (R$) informado manualmente
  valorJurosManual?: number; // Valor dos Juros (R$) informado manualmente
  valorCorrecaoManual?: number; // Valor da Correção Monetária (R$) informado manualmente
  valorOutrosManual?: number; // Valor de Outros (R$) informado manualmente
  valorIofManual?: number; // Valor do IOF (R$) informado manualmente
  valorSeguroManual?: number; // Valor do Seguro (R$) informado manualmente
  valorTaxaRegistroManual?: number; // Valor da Taxa de Registro (R$) informado manualmente
}

export interface Contrato {
  numero: string;
  modalidade?: ModalidadeContrato;
  emitente: string;
  credor: string;
  dataEmissao: string; // YYYY-MM-DD
  dataVencimento: string; // YYYY-MM-DD
  valorPrincipal: number;
  taxaJurosAnual: number; // e.g. 3.7 for 3.7% p.a.
  indexadorOriginal: Indexador;
  cronogramaParcelas: ParcelaScheduling[];
  produto?: string;
  quantidade?: string;
  valorEmissao?: number;
}

export interface ProjecaoParcela {
  numero: number;
  data: string;
  percentualAmortizacao: number;
  saldoDevedorInicial: number;
  amortizacao: number;
  jurosOriginal: number; // Juros do indexador original + spread
  jurosIndexador: number; // Componente do indexador
  jurosSpread: number; // Componente do spread/taxa fixa
  totalPago: number;
  saldoDevedorFinal: number;
}

export interface IndexadorRates {
  CDI: number; // % p.a.
  SELIC: number; // % p.a.
  IPCA: number; // % p.a. (últimos 12 meses)
  INPC: number; // % p.a.
  TR: number; // % p.a.
  PRE: number; // % p.a. (0 por definição)
}

export interface SimuloCenario {
  id: string;
  nome: string;
  indexador: Indexador;
  taxaJurosAnual: number; // spread ou taxa fixa
  prazosMeses?: number;
}

export interface ResultadoCenario {
  id: string;
  nome: string;
  indexador: Indexador;
  taxaJurosAnual: number;
  totalPago: number;
  totalJuros: number;
  totalAmortizado: number;
  economiaRelativa: number; // Comparado ao cenário original
  parcelas: ProjecaoParcela[];
}

export enum ModalidadeContrato {
  CPR = "Cédula de Produto Rural (CPR)",
  CCR = "Cédula de Crédito Rural (CCR)",
  NCR = "Nota de Crédito Rural (NCR)",
  NCE = "Nota de Crédito à Exportação (NCE)",
  CCE = "Cédula de Crédito à Exportação (CCE)",
  OUTRO = "Outro"
}

export interface DivergenciaItem {
  campo: string; // e.g. "Taxa de Juros", "Saldo Devedor", "Carência", etc.
  valorContrato: string; // e.g. "8.5% a.a."
  valorDocumento: string; // e.g. "11.5% a.a."
  status: 'divergente' | 'conforme' | 'atencao';
  documentoAuxiliar: string; // e.g. "Demonstrativo de Evolução da Dívida"
  detalhe: string; // Description of the inconsistency or verification
}

export interface Laudo {
  irregularidadesEncontradas: boolean;
  resumo: string;
  pontosDeAtencao: string[];
  recomendacao: string;
  divergencias?: DivergenciaItem[];
}

export interface AssociatedDocument {
  id: string;
  name: string;
  type: string; // e.g. "Demonstrativo", "Planilha de Cálculos", "Notificação", "Laudo", "Outro"
  uploadDate: string;
  fileName: string;
  notes?: string;
  fileData?: string;
  mimeType?: string;
}

export interface ContractHistoryEntry {
  version: number;
  contractData: Contrato;
  updatedAt: string;
  changeSummary: string;
}

