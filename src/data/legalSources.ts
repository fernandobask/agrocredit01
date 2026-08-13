export interface LegalSourceItem {
  id: string;
  category: "lei" | "decreto" | "sumula_stj" | "mcr_bacen" | "jurisprudencia";
  title: string;
  officialNumber: string;
  organ: "Planalto (Presidência da República)" | "Banco Central do Brasil (BACEN)" | "Superior Tribunal de Justiça (STJ)" | "Conselho Monetário Nacional (CMN)";
  summary: string;
  legalQuote: string;
  applicationInApp: string;
  officialUrl: string;
}

export const LEGAL_SOURCES_DATABASE: LegalSourceItem[] = [
  {
    id: "mcr-portal-oficial",
    category: "mcr_bacen",
    title: "Portal Público do Manual de Crédito Rural (MCR) - BACEN",
    officialNumber: "Portal Público MCR (BACEN)",
    organ: "Banco Central do Brasil (BACEN)",
    summary: "Acesso direto e oficial aos manuais públicos unificados do Banco Central do Brasil contendo todas as codificações e normas vigentes do crédito rural, atualizados em tempo real.",
    legalQuote: `"O Manual de Crédito Rural (MCR) codifica as instruções aprovadas pelo Conselho Monetário Nacional e pelo Banco Central do Brasil relativas ao crédito rural a serem observadas pelas instituições financeiras."`,
    applicationInApp: "Fonte mestre de consulta normativa pública para auditoria pericial e fundamentação das operações de crédito rural no Brasil.",
    officialUrl: "https://manuais.bcb.gov.br/app/manual/mcr/publico"
  },
  {
    id: "bacen-normativos-atualizacoes",
    category: "mcr_bacen",
    title: "Central de Normativos e Resoluções do Banco Central (CMN/BACEN)",
    officialNumber: "Busca de Normativos & Resoluções BACEN",
    organ: "Banco Central do Brasil (BACEN)",
    summary: "Portal oficial de busca de atos normativos, resoluções conjuntas, resoluções do CMN e instruções normativas para acompanhamento contínuo de alterações na legislação agropastoril.",
    legalQuote: `"Canal público de acompanhamento contínuo das Resoluções CMN e Resoluções BCB aplicáveis às operações do Sistema Nacional de Crédito Rural (SNCR)."`,
    applicationInApp: "Garante o monitoramento em tempo real das novas portarias do Plano Safra e alterações de regramento emitidas pelo Banco Central.",
    officialUrl: "https://www.bcb.gov.br/estabilidadefinanceira/normativos"
  },
  {
    id: "mcr-2-6-4",
    category: "mcr_bacen",
    title: "Alongamento / Prorrogação Obrigatória de Dívidas Rurais",
    officialNumber: "MCR Capítulo 2, Seção 6, Item 4 (MCR 2-6-4)",
    organ: "Banco Central do Brasil (BACEN)",
    summary: "O MCR 2-6-4 estabelece que é DIREITO DO PRODUTOR RURAL (e dever da instituição financeira) prorrogar o vencimento dos débitos mantendo as taxas e condições originais quando houver frustração de safras, intempéries climáticas, pragas ou queda drástica de preços de mercado.",
    legalQuote: `"É devida a prorrogação da dívida, aos mesmos encargos financeiros antes pactuados no contrato, desde que comprovada pelo mutuário a incapacidade de pagamento por frustração de safras, impossibilidade de comercialização dos produtos ou ocorrência de intempéries."`,
    applicationInApp: "Fundamenta o cálculo de reestruturação do contrato aumentando o prazo em meses mantendo as taxas reguladas do Plano Safra.",
    officialUrl: "https://manuais.bcb.gov.br/app/manual/mcr/publico"
  },
  {
    id: "sumula-298-stj",
    category: "sumula_stj",
    title: "Direito Subjetivo ao Alongamento de Dívida Rural",
    officialNumber: "Súmula nº 298 do STJ",
    organ: "Superior Tribunal de Justiça (STJ)",
    summary: "A Súmula 298 pacifica que o alongamento do crédito rural não depende da 'boa vontade' ou 'discricionariedade' do banco. Preenchidos os requisitos do MCR, o banco é OBRIGADO a repactuar.",
    legalQuote: `"O alongamento de dívida originada de crédito rural não é faculdade da instituição financeira, mas direito do devedor que preencha os requisitos legais."`,
    applicationInApp: "Instrui os advogados e produtores na emissão de notificação extrajudicial e ação revisional exigindo o alongamento compulsório.",
    officialUrl: "https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2010_13_capSumula298.pdf"
  },
  {
    id: "sumula-288-stj",
    category: "sumula_stj",
    title: "Teto de Juros de 12% a.a. no Crédito Rural",
    officialNumber: "Súmula nº 288 do STJ",
    organ: "Superior Tribunal de Justiça (STJ)",
    summary: "No crédito rural, a instituição financeira não pode fixar taxas de mercado livre. Na ausência de fixação específica do CMN para aquele programa, os juros são limitados ao teto de 12% ao ano.",
    legalQuote: `"A taxa de juros remuneratórios no crédito rural está limitada a 12% ao ano, salvo se houver autorização expressa do Conselho Monetário Nacional."`,
    applicationInApp: "Base legal para o expurgo de taxas abusivas praticadas acima do limite regulado e recalculo com teto de 12% a.a.",
    officialUrl: "https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2010_13_capSumula288.pdf"
  },
  {
    id: "sumula-176-stj",
    category: "sumula_stj",
    title: "Nulidade de Taxa Flutuante / CDI em Crédito Rural",
    officialNumber: "Súmula nº 176 do STJ",
    organ: "Superior Tribunal de Justiça (STJ)",
    summary: "Declara a ilicitude e nulidade absoluta de cláusulas que vinculem o contrato de crédito rural a taxas flutuantes de mercado (como o CDI ou cotação bancária unilateral), impondo a substituição por indexador oficial ou taxa fixa.",
    legalQuote: `"É nula a cláusula contratual que sujeita o devedor ao arbítrio da instituição financeira mediante a cotação de taxa de extrato de mercado ou flutuante."`,
    applicationInApp: "Identifica e expurga o CDI flutuante praticado por cooperativas e bancos em CPRs e CCBs agropecuárias.",
    officialUrl: "https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2006_3_capSumula176.pdf"
  },
  {
    id: "decreto-22626-33",
    category: "decreto",
    title: "Lei de Usura (Teto de Juros e Vedação do Anatocismo)",
    officialNumber: "Decreto Federal nº 22.626/1933",
    organ: "Planalto (Presidência da República)",
    summary: "Proíbe a cobrança de juros superiores ao dobro da taxa legal e veda a anatocismo (capitalização de juros sobre juros em período inferior a um ano sem expressa permissão legislativa).",
    legalQuote: `"Art. 1º É vedado, e será punido nos termos desta lei, estipular em quaisquer contratos taxas de juros superiores ao dobro da taxa legal."`,
    applicationInApp: "Utilizado no recálculo pericial para expurgar a capitalização diária ou mensal indevida não pactuada regularly.",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/decreto/d22626.htm"
  },
  {
    id: "decreto-lei-167-67",
    category: "decreto",
    title: "Cédulas de Crédito Rural (Estatuto da CPR e CCR)",
    officialNumber: "Decreto-Lei nº 167/1967",
    organ: "Planalto (Presidência da República)",
    summary: "Dispõe sobre a Cédula de Crédito Rural, fixando a forma de emissão, garantias reais (penhor, hipoteca), limite de juros moratórios em 1% ao ano e vedação de encargos abusivos em inadimplência.",
    legalQuote: `"Art 5º Parágrafo único. Em caso de mora, a taxa de juros constante do título será elevada de 1% (um por cento) ao ano."`,
    applicationInApp: "Garante que em atraso o banco só pode acrescentar no máximo 1% a.a. de juros moratórios sobre a taxa original.",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del0167.htm"
  },
  {
    id: "sumula-93-stj",
    category: "sumula_stj",
    title: "Teto de Juros Moratórios de 1% a.a. na Cédula Rural",
    officialNumber: "Súmula nº 93 do STJ",
    organ: "Superior Tribunal de Justiça (STJ)",
    summary: "Confirma a aplicabilidade estrita do Decreto-Lei 167/67: em caso de inadimplência em crédito rural, o banco NÃO pode cobrar comissão de permanência ou taxas de mora de mercado, limitando-se aos juros contratuais mais 1% a.a.",
    legalQuote: `"A Cédula de Crédito Rural admite a pactuação de juros moratórios até o limite de 1% ao ano."`,
    applicationInApp: "Substitui cobranças moratórias bancárias abusivas (ex: 15% ao mês em atraso) pelo teto legal de 1% a.a.",
    officialUrl: "https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2006_1_capSumula93.pdf"
  },
  {
    id: "lei-4829-65",
    category: "lei",
    title: "Lei Institucional do Crédito Rural",
    officialNumber: "Lei Federal nº 4.829/1965",
    organ: "Planalto (Presidência da República)",
    summary: "Define os objetivos do crédito rural no Brasil (fomento à produção, amparo ao produtor, estabilização de custos) e outorga ao Conselho Monetário Nacional a regulação das taxas incentivadas.",
    legalQuote: `"Art. 14. O Conselho Monetário Nacional fixará os limites das taxas de juros, comissões e quaisquer outras despesas no crédito rural."`,
    applicationInApp: "Prova que o crédito rural é uma política pública estatal regulada e não operação de balcão de mercado livre.",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l4829.htm"
  },
  {
    id: "lei-9138-95",
    category: "lei",
    title: "Lei de Securitização do Crédito Rural",
    officialNumber: "Lei Federal nº 9.138/1995",
    organ: "Planalto (Presidência da República)",
    summary: "Dispõe sobre a renegociação e o alongamento de dívidas originadas do crédito rural, fixando que as repactuações devem manter amortizações compatíveis com a capacidade de pagamento do imóvel rural.",
    legalQuote: `"Art. 2º É autorizada a renegociação e o alongamento de operações de crédito rural com recursos públicos ou privados..."`,
    applicationInApp: "Dá suporte legal para reestruturação financeira de longo prazo mantendo a viabilidade da atividade agropastoril.",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l9138.htm"
  },
  {
    id: "cdc-art-39-venda-casada",
    category: "lei",
    title: "Vedação da Venda Casada de Seguros e Títulos",
    officialNumber: "Lei nº 8.078/1990 (CDC Art. 39, I)",
    organ: "Planalto (Presidência da República)",
    summary: "Proíbe expressamente os bancos de condicionarem a concessão de empréstimos ou financiamentos rurais à aquisição compulsória de seguros prestamistas, consórcios ou títulos de capitalização do banco.",
    legalQuote: `"Art. 39. É vedado ao fornecedor de produtos ou serviços... I - condicionar o fornecimento de produto ou de serviço ao fornecimento de outro produto ou serviço (venda casada)."`,
    applicationInApp: "Permite o expurgo e restituição de tarifas ilegais e seguros embutidos no DDC sem anuência real do produtor.",
    officialUrl: "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm"
  }
];
