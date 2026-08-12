import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Calculator,
  Download,
  Printer,
  Save,
  CheckCircle,
  TrendingDown,
  DollarSign,
  Calendar,
  Percent,
  FileText,
  Sparkles,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Zap,
  Award,
  ArrowRight,
  Info,
  Maximize2,
  Minimize2,
  Edit2,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Contrato, IndexadorRates, AssociatedDocument } from "../types";
import { formatCurrency, formatPercentage, formatDate, formatCSVNumber } from "../utils/math";

interface SimuladorNegociacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contrato: Contrato | null;
  indexadorRates: IndexadorRates;
  initialProposal?: any;
  onSaveProposal?: (proposalData: any) => void;
}

export type TipoAcordo = "vista" | "parcelado";
export type SistemaAmortizacao = "PRICE" | "SAC";

export interface NovaParcelaProposta {
  numero: number;
  dataVencimento: string;
  saldoInicial: number;
  amortizacao: number;
  juros: number;
  correcaoProjetada: number;
  valorTotalParcela: number;
  saldoFinal: number;
}

export function SimuladorNegociacaoModal({
  isOpen,
  onClose,
  contrato,
  indexadorRates,
  initialProposal,
  onSaveProposal
}: SimuladorNegociacaoModalProps) {
  // Navigation sub-tab inside simulator
  const [activeTab, setActiveTab] = useState<"parametros" | "cronograma" | "termo">("parametros");
  const [isMaximized, setIsMaximized] = useState(true);

  // Negotiation Parameters
  const [tipoAcordo, setTipoAcordo] = useState<TipoAcordo>("parcelado");
  const [descontoMoraPct, setDescontoMoraPct] = useState<number>(100); // 100% discount on default interest
  const [descontoMultaPct, setDescontoMultaPct] = useState<number>(50); // 50% discount on fine
  const [descontoCorrecaoPct, setDescontoCorrecaoPct] = useState<number>(0); // 0% discount on inflation adjustment
  const [descontoPrincipalPct, setDescontoPrincipalPct] = useState<number>(0); // 0% principal rebate

  // Installments Configuration
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [dataEntrada, setDataEntrada] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [numeroParcelas, setNumeroParcelas] = useState<number>(24);
  const [sistemaAmortizacao, setSistemaAmortizacao] = useState<SistemaAmortizacao>("PRICE");
  const [taxaJurosMensal, setTaxaJurosMensal] = useState<number>(1.0); // 1.0% per month
  const [indexadorReajuste, setIndexadorReajuste] = useState<string>("IPCA");
  const [taxaIndexadorAnual, setTaxaIndexadorAnual] = useState<number>(indexadorRates.IPCA || 4.5);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });

  // Active Preset Strategy Tracking
  const [selectedPresetKey, setSelectedPresetKey] = useState<"mercado" | "conservadora" | "avista" | "longoprazo">("mercado");
  const [selectedPresetBaseline, setSelectedPresetBaseline] = useState({
    nomeBase: "Padrão Bacen",
    tipoAcordo: "parcelado" as TipoAcordo,
    descontoMoraPct: 100,
    descontoMultaPct: 50,
    descontoCorrecaoPct: 0,
    descontoPrincipalPct: 0,
    numeroParcelas: 24,
    sistemaAmortizacao: "PRICE" as SistemaAmortizacao,
    taxaJurosMensal: 0.95
  });

  // Check if a given field is altered from current preset baseline
  const isFieldAltered = (field: string) => {
    if (!selectedPresetBaseline) return false;
    switch (field) {
      case "tipoAcordo":
        return tipoAcordo !== selectedPresetBaseline.tipoAcordo;
      case "descontoMoraPct":
        return descontoMoraPct !== selectedPresetBaseline.descontoMoraPct;
      case "descontoMultaPct":
        return descontoMultaPct !== selectedPresetBaseline.descontoMultaPct;
      case "descontoCorrecaoPct":
        return descontoCorrecaoPct !== selectedPresetBaseline.descontoCorrecaoPct;
      case "descontoPrincipalPct":
        return descontoPrincipalPct !== selectedPresetBaseline.descontoPrincipalPct;
      case "numeroParcelas":
        return tipoAcordo === "parcelado" && numeroParcelas !== selectedPresetBaseline.numeroParcelas;
      case "sistemaAmortizacao":
        return tipoAcordo === "parcelado" && sistemaAmortizacao !== selectedPresetBaseline.sistemaAmortizacao;
      case "taxaJurosMensal":
        return tipoAcordo === "parcelado" && taxaJurosMensal !== selectedPresetBaseline.taxaJurosMensal;
      default:
        return false;
    }
  };

  const hasAnyAlteration = useMemo(() => {
    return [
      "tipoAcordo",
      "descontoMoraPct",
      "descontoMultaPct",
      "descontoCorrecaoPct",
      "descontoPrincipalPct",
      "numeroParcelas",
      "sistemaAmortizacao",
      "taxaJurosMensal"
    ].some(f => isFieldAltered(f));
  }, [
    tipoAcordo,
    descontoMoraPct,
    descontoMultaPct,
    descontoCorrecaoPct,
    descontoPrincipalPct,
    numeroParcelas,
    sistemaAmortizacao,
    taxaJurosMensal,
    selectedPresetBaseline
  ]);

  const currentPresetDisplayName = useMemo(() => {
    const base = selectedPresetBaseline?.nomeBase || "Padrão Bacen";
    return hasAnyAlteration ? `${base} - Personalizado` : base;
  }, [selectedPresetBaseline, hasAnyAlteration]);

  // Load / Sync saved proposal when modal opens or initialProposal changes
  useEffect(() => {
    if (isOpen && initialProposal) {
      if (initialProposal.tipoAcordo) setTipoAcordo(initialProposal.tipoAcordo);
      if (initialProposal.descontos) {
        if (typeof initialProposal.descontos.mora === "number") setDescontoMoraPct(initialProposal.descontos.mora);
        if (typeof initialProposal.descontos.multa === "number") setDescontoMultaPct(initialProposal.descontos.multa);
        if (typeof initialProposal.descontos.correcao === "number") setDescontoCorrecaoPct(initialProposal.descontos.correcao);
        if (typeof initialProposal.descontos.principal === "number") setDescontoPrincipalPct(initialProposal.descontos.principal);
      }
      if (initialProposal.condicoes) {
        if (typeof initialProposal.condicoes.valorEntrada === "number") setValorEntrada(initialProposal.condicoes.valorEntrada);
        if (initialProposal.condicoes.dataEntrada) setDataEntrada(initialProposal.condicoes.dataEntrada);
        if (typeof initialProposal.condicoes.numeroParcelas === "number") setNumeroParcelas(initialProposal.condicoes.numeroParcelas);
        if (initialProposal.condicoes.sistemaAmortizacao) setSistemaAmortizacao(initialProposal.condicoes.sistemaAmortizacao);
        if (typeof initialProposal.condicoes.taxaJurosMensal === "number") setTaxaJurosMensal(initialProposal.condicoes.taxaJurosMensal);
        if (initialProposal.condicoes.indexadorReajuste) setIndexadorReajuste(initialProposal.condicoes.indexadorReajuste);
        if (typeof initialProposal.condicoes.taxaIndexadorAnual === "number") setTaxaIndexadorAnual(initialProposal.condicoes.taxaIndexadorAnual);
        if (initialProposal.condicoes.dataPrimeiraParcela) setDataPrimeiraParcela(initialProposal.condicoes.dataPrimeiraParcela);
      }
    }
  }, [isOpen, initialProposal]);

  // State for print/saved feedback
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Reference for virtualizer table parent container
  const tableParentRef = useRef<HTMLDivElement>(null);

  // Calculate Base Liquidation Values from Contrato
  const apuracaoBase = useMemo(() => {
    if (!contrato) {
      return {
        principalResidual: 0,
        multaAcumulada: 0,
        moraAcumulada: 0,
        correcaoAcumulada: 0,
        totalDevidoApurado: 0
      };
    }

    let principal = contrato.valorPrincipal || 0;
    let multa = 0;
    let mora = 0;
    let correcao = 0;

    const dataEmissao = new Date(contrato.dataEmissao || "2023-08-31");
    const dataBase = new Date();
    const mesesDecorridos = Math.max(1, (dataBase.getFullYear() - dataEmissao.getFullYear()) * 12 + (dataBase.getMonth() - dataEmissao.getMonth()));

    const taxaIdxAnual = indexadorRates[contrato.indexadorOriginal] || 4.5;
    const taxaIdxMensal = taxaIdxAnual / 100 / 12;

    let principalInadimplido = 0;
    (contrato.cronogramaParcelas || []).forEach(p => {
      const pDate = new Date(p.data);
      if (pDate < dataBase && !p.paga) {
        const valParc = (p.percentualAmortizacao / 100) * principal;
        principalInadimplido += valParc;
      }
    });

    if (principalInadimplido > 0) {
      multa = principalInadimplido * 0.02; // 2% multa
      mora = principalInadimplido * (0.01 * (mesesDecorridos / 2)); // 1% ao mês proporcional
    }

    correcao = principal * (taxaIdxMensal * mesesDecorridos);

    const total = principal + multa + mora + correcao;

    return {
      principalResidual: principal,
      multaAcumulada: multa,
      moraAcumulada: mora,
      correcaoAcumulada: correcao,
      totalDevidoApurado: total
    };
  }, [contrato, indexadorRates]);

  // Compute Proposal Calculations
  const propostaCalculada = useMemo(() => {
    const { principalResidual, multaAcumulada, moraAcumulada, correcaoAcumulada, totalDevidoApurado } = apuracaoBase;

    // Apply discounts
    const multaNegociada = multaAcumulada * (1 - descontoMultaPct / 100);
    const moraNegociada = moraAcumulada * (1 - descontoMoraPct / 100);
    const correcaoNegociada = correcaoAcumulada * (1 - descontoCorrecaoPct / 100);
    const principalNegociado = principalResidual * (1 - descontoPrincipalPct / 100);

    const valorTotalAcordoBase = principalNegociado + multaNegociada + moraNegociada + correcaoNegociada;
    const descontoTotalValor = Math.max(0, totalDevidoApurado - valorTotalAcordoBase);
    const descontoTotalPct = totalDevidoApurado > 0 ? (descontoTotalValor / totalDevidoApurado) * 100 : 0;

    // Financial Schedule Generation
    const cronograma: NovaParcelaProposta[] = [];
    let valorAFinanciar = Math.max(0, valorTotalAcordoBase - (tipoAcordo === "parcelado" ? valorEntrada : 0));

    if (tipoAcordo === "vista") {
      cronograma.push({
        numero: 1,
        dataVencimento: dataEntrada,
        saldoInicial: valorTotalAcordoBase,
        amortizacao: valorTotalAcordoBase,
        juros: 0,
        correcaoProjetada: 0,
        valorTotalParcela: valorTotalAcordoBase,
        saldoFinal: 0
      });
    } else if (tipoAcordo === "parcelado" && numeroParcelas > 0) {
      const i = taxaJurosMensal / 100;
      const idxMensalProjetado = (taxaIndexadorAnual / 100) / 12;
      let saldo = valorAFinanciar;

      const dtInicio = new Date(dataPrimeiraParcela || new Date());

      if (sistemaAmortizacao === "PRICE") {
        const pmt = i > 0
          ? valorAFinanciar * (i * Math.pow(1 + i, numeroParcelas)) / (Math.pow(1 + i, numeroParcelas) - 1)
          : valorAFinanciar / numeroParcelas;

        for (let n = 1; n <= numeroParcelas; n++) {
          const jurosMes = saldo * i;
          const amortizacaoMes = Math.min(saldo, pmt - jurosMes);
          const correcaoMes = saldo * idxMensalProjetado;
          const totalParcela = amortizacaoMes + jurosMes + correcaoMes;
          const saldoFinalMes = Math.max(0, saldo - amortizacaoMes);

          const dtVenc = new Date(dtInicio);
          dtVenc.setMonth(dtInicio.getMonth() + (n - 1));

          cronograma.push({
            numero: n,
            dataVencimento: dtVenc.toISOString().split("T")[0],
            saldoInicial: saldo,
            amortizacao: amortizacaoMes,
            juros: jurosMes,
            correcaoProjetada: correcaoMes,
            valorTotalParcela: totalParcela,
            saldoFinal: saldoFinalMes
          });

          saldo = saldoFinalMes;
        }
      } else {
        // SAC
        const amortizacaoConstante = valorAFinanciar / numeroParcelas;
        for (let n = 1; n <= numeroParcelas; n++) {
          const jurosMes = saldo * i;
          const amortizacaoMes = Math.min(saldo, amortizacaoConstante);
          const correcaoMes = saldo * idxMensalProjetado;
          const totalParcela = amortizacaoMes + jurosMes + correcaoMes;
          const saldoFinalMes = Math.max(0, saldo - amortizacaoMes);

          const dtVenc = new Date(dtInicio);
          dtVenc.setMonth(dtInicio.getMonth() + (n - 1));

          cronograma.push({
            numero: n,
            dataVencimento: dtVenc.toISOString().split("T")[0],
            saldoInicial: saldo,
            amortizacao: amortizacaoMes,
            juros: jurosMes,
            correcaoProjetada: correcaoMes,
            valorTotalParcela: totalParcela,
            saldoFinal: saldoFinalMes
          });

          saldo = saldoFinalMes;
        }
      }
    }

    const totalFinalPagamentos = (tipoAcordo === "parcelado" ? valorEntrada : 0) + cronograma.reduce((a, b) => a + b.valorTotalParcela, 0);

    return {
      multaNegociada,
      moraNegociada,
      correcaoNegociada,
      principalNegociado,
      valorTotalAcordoBase,
      descontoTotalValor,
      descontoTotalPct,
      valorAFinanciar,
      totalFinalPagamentos,
      cronograma
    };
  }, [
    apuracaoBase,
    tipoAcordo,
    descontoMoraPct,
    descontoMultaPct,
    descontoCorrecaoPct,
    descontoPrincipalPct,
    valorEntrada,
    numeroParcelas,
    sistemaAmortizacao,
    taxaJurosMensal,
    taxaIndexadorAnual,
    dataPrimeiraParcela,
    dataEntrada
  ]);

  // Benchmark & Market Intelligence Engine
  const inteligenciaMercado = useMemo(() => {
    let score = 50; // base score out of 100
    const alertas: string[] = [];
    const elogios: string[] = [];

    // 1. Multa & Mora Discounts
    if (descontoMoraPct >= 75) {
      score += 15;
      elogios.push("Isenção de Juros de Mora (75%-100%): Totalmente alinhada às diretrizes da Febraban para recuperação de inadimplência.");
    } else {
      alertas.push("Retenção de > 25% dos Juros de Mora: Pode reduzir a propensão do devedor a assinar o acordo.");
    }

    if (descontoMultaPct >= 50) {
      score += 10;
      elogios.push("Abatimento em Multa (50%+): Respeita o limite do Art. 52 do CDC e estimula encerramento amigável.");
    }

    // 2. Principal Discount & Executive Approval Threshold
    if (descontoPrincipalPct === 0) {
      score += 20;
      elogios.push("Preservação de 100% do Valor Principal: Dispensa comitê extraordinário e acelera homologação.");
    } else if (descontoPrincipalPct <= 10) {
      score += 10;
      elogios.push(`Abatimento no Principal (${descontoPrincipalPct}%): Dentro da alçada gerencial padrão de renegociação.`);
    } else if (descontoPrincipalPct <= 20) {
      score -= 10;
      alertas.push(`Desconto no Principal (${descontoPrincipalPct}%): Requer aprovação especial do Comitê Regional de Crédito.`);
    } else {
      score -= 25;
      alertas.push(`Desconto no Principal (${descontoPrincipalPct}%): Considerado de Alto Risco. Exige deliberação de Diretoria Executiva.`);
    }

    // 3. Taxa de Juros Mensal vs. Bacen Benchmark
    if (tipoAcordo === "parcelado") {
      if (taxaJurosMensal === 0) {
        score += 20;
        elogios.push("Taxa Pré-fixada em 0,00% a.m.: Atrai liquidação garantida sem incremento de saldo residual.");
      } else if (taxaJurosMensal <= 1.2) {
        score += 15;
        elogios.push(`Taxa Negociada de ${taxaJurosMensal}% a.m.: Perfeitamente compatível com a taxa média Selic/Bacen para crédito pactuado.`);
      } else if (taxaJurosMensal <= 2.0) {
        score += 5;
        alertas.push(`Taxa de ${taxaJurosMensal}% a.m.: Moderada. Atenção ao Custo Efetivo Total (CET) anualizado.`);
      } else {
        score -= 15;
        alertas.push(`Taxa de ${taxaJurosMensal}% a.m. (> 2% a.m.): Superior à média de mercado. Risco de contestação por abusividade.`);
      }

      // 4. Sinal / Entrada
      const pctEntrada = propostaCalculada.valorTotalAcordoBase > 0 ? (valorEntrada / propostaCalculada.valorTotalAcordoBase) * 100 : 0;
      if (pctEntrada >= 15) {
        score += 15;
        elogios.push(`Entrada Consistente de ${pctEntrada.toFixed(1)}% (${formatCurrency(valorEntrada)}): Eleva o score de liquidação para 95%.`);
      } else if (pctEntrada >= 5) {
        score += 8;
        elogios.push(`Entrada de ${pctEntrada.toFixed(1)}% atende o mínimo institucional.`);
      } else {
        alertas.push("Entrada inferior a 5%: Aumenta a taxa de inadimplência da 1ª parcela pós-acordo.");
      }

      // 5. Prazo de Amortização
      if (numeroParcelas <= 24) {
        score += 10;
        elogios.push(`Prazo Enxuto (${numeroParcelas} meses): Minimiza exposure inflacionário e encerra o débito rapidamente.`);
      } else if (numeroParcelas > 60) {
        score -= 10;
        alertas.push(`Prazo Longo (${numeroParcelas} parcelas): Requer monitoramento contínuo de reajuste pelo indexador.`);
      }
    } else {
      // À Vista
      score += 25;
      elogios.push("Quitação Imediata à Vista: Elimina 100% da exposição de risco de crédito e despesas operacionais de cobrança.");
    }

    const finalScore = Math.min(100, Math.max(0, score));

    let nivel: "excelente" | "moderada" | "atencao";
    let rotulo: string;
    let corBadge: string;
    let corBarra: string;

    if (finalScore >= 78) {
      nivel = "excelente";
      rotulo = "🟢 Dentro da Prática de Mercado (Aprovação Imediata)";
      corBadge = "bg-emerald-100 text-emerald-900 border-emerald-300";
      corBarra = "bg-emerald-500";
    } else if (finalScore >= 55) {
      nivel = "moderada";
      rotulo = "🟡 Moderada / Requer Alçada Gerencial";
      corBadge = "bg-amber-100 text-amber-900 border-amber-300";
      corBarra = "bg-amber-500";
    } else {
      nivel = "atencao";
      rotulo = "🔴 Agressiva / Fora do Padrão (Comitê de Exceção)";
      corBadge = "bg-rose-100 text-rose-900 border-rose-300";
      corBarra = "bg-rose-500";
    }

    return {
      score: finalScore,
      nivel,
      rotulo,
      corBadge,
      corBarra,
      alertas,
      elogios
    };
  }, [
    descontoMoraPct,
    descontoMultaPct,
    descontoPrincipalPct,
    taxaJurosMensal,
    tipoAcordo,
    valorEntrada,
    numeroParcelas,
    propostaCalculada.valorTotalAcordoBase
  ]);

  const aplicarPresetStrategy = (estrategia: "mercado" | "conservadora" | "avista" | "longoprazo") => {
    setSelectedPresetKey(estrategia);
    if (estrategia === "mercado") {
      setTipoAcordo("parcelado");
      setDescontoMoraPct(100);
      setDescontoMultaPct(50);
      setDescontoCorrecaoPct(0);
      setDescontoPrincipalPct(0);
      setValorEntrada(Math.round(propostaCalculada.valorTotalAcordoBase * 0.15 / 100) * 100 || 1000);
      setNumeroParcelas(24);
      setSistemaAmortizacao("PRICE");
      setTaxaJurosMensal(0.95);

      setSelectedPresetBaseline({
        nomeBase: "Padrão Bacen",
        tipoAcordo: "parcelado",
        descontoMoraPct: 100,
        descontoMultaPct: 50,
        descontoCorrecaoPct: 0,
        descontoPrincipalPct: 0,
        numeroParcelas: 24,
        sistemaAmortizacao: "PRICE",
        taxaJurosMensal: 0.95
      });
    } else if (estrategia === "conservadora") {
      setTipoAcordo("parcelado");
      setDescontoMoraPct(75);
      setDescontoMultaPct(50);
      setDescontoCorrecaoPct(0);
      setDescontoPrincipalPct(0);
      setValorEntrada(Math.round(propostaCalculada.valorTotalAcordoBase * 0.10 / 100) * 100 || 500);
      setNumeroParcelas(36);
      setSistemaAmortizacao("PRICE");
      setTaxaJurosMensal(1.20);

      setSelectedPresetBaseline({
        nomeBase: "Comitê Gerencial",
        tipoAcordo: "parcelado",
        descontoMoraPct: 75,
        descontoMultaPct: 50,
        descontoCorrecaoPct: 0,
        descontoPrincipalPct: 0,
        numeroParcelas: 36,
        sistemaAmortizacao: "PRICE",
        taxaJurosMensal: 1.20
      });
    } else if (estrategia === "avista") {
      setTipoAcordo("vista");
      setDescontoMoraPct(100);
      setDescontoMultaPct(100);
      setDescontoCorrecaoPct(100);
      setDescontoPrincipalPct(10);
      setValorEntrada(0);

      setSelectedPresetBaseline({
        nomeBase: "Quitação à Vista",
        tipoAcordo: "vista",
        descontoMoraPct: 100,
        descontoMultaPct: 100,
        descontoCorrecaoPct: 100,
        descontoPrincipalPct: 10,
        numeroParcelas: 1,
        sistemaAmortizacao: "PRICE",
        taxaJurosMensal: 0
      });
    } else if (estrategia === "longoprazo") {
      setTipoAcordo("parcelado");
      setDescontoMoraPct(100);
      setDescontoMultaPct(50);
      setDescontoCorrecaoPct(0);
      setDescontoPrincipalPct(0);
      setValorEntrada(Math.round(propostaCalculada.valorTotalAcordoBase * 0.05 / 100) * 100 || 500);
      setNumeroParcelas(60);
      setSistemaAmortizacao("PRICE");
      setTaxaJurosMensal(1.0);

      setSelectedPresetBaseline({
        nomeBase: "Parcela Enxuta",
        tipoAcordo: "parcelado",
        descontoMoraPct: 100,
        descontoMultaPct: 50,
        descontoCorrecaoPct: 0,
        descontoPrincipalPct: 0,
        numeroParcelas: 60,
        sistemaAmortizacao: "PRICE",
        taxaJurosMensal: 1.0
      });
    }
  };

  // Virtualizer for the schedule table
  const rowVirtualizer = useVirtualizer({
    count: propostaCalculada.cronograma.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => 36,
    overscan: 8
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0;

  const handleExportCSV = () => {
    if (!contrato) return;
    const headers = ["Nº Parcela", "Vencimento", "Saldo Inicial (R$)", "Amortização (R$)", "Juros (R$)", "Reajuste (R$)", "Valor Parcela (R$)", "Saldo Final (R$)"];
    const rows = propostaCalculada.cronograma.map(p => [
      p.numero,
      formatDate(p.dataVencimento),
      formatCSVNumber(p.saldoInicial),
      formatCSVNumber(p.amortizacao),
      formatCSVNumber(p.juros),
      formatCSVNumber(p.correcaoProjetada),
      formatCSVNumber(p.valorTotalParcela),
      formatCSVNumber(p.saldoFinal)
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Proposta_Renegociacao_${contrato.numero || "Contrato"}.csv`;
    link.click();
  };

  const handlePrintProposal = () => {
    window.print();
  };

  const handleSave = () => {
    if (onSaveProposal) {
      onSaveProposal({
        tipoAcordo,
        descontos: {
          mora: descontoMoraPct,
          multa: descontoMultaPct,
          correcao: descontoCorrecaoPct,
          principal: descontoPrincipalPct
        },
        condicoes: {
          valorEntrada,
          dataEntrada,
          numeroParcelas,
          sistemaAmortizacao,
          taxaJurosMensal,
          indexadorReajuste,
          taxaIndexadorAnual,
          dataPrimeiraParcela
        },
        resumoFinancas: {
          totalDevidoApurado: apuracaoBase.totalDevidoApurado,
          valorTotalAcordoBase: propostaCalculada.valorTotalAcordoBase,
          descontoTotalValor: propostaCalculada.descontoTotalValor,
          descontoTotalPct: propostaCalculada.descontoTotalPct,
          totalFinalPagamentos: propostaCalculada.totalFinalPagamentos
        },
        criadoEm: new Date().toISOString()
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && contrato && (
        <div key="simulador-modal-backdrop" className={`fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs transition-all duration-200 ${isMaximized ? 'p-1 sm:p-2' : 'p-3 sm:p-4'}`}>
          <motion.div
            key="simulador-modal-content"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            className={`bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
              isMaximized 
                ? 'w-[99vw] h-[98vh] max-w-none max-h-none' 
                : 'w-full max-w-7xl h-[92vh] max-h-[94vh]'
            }`}
          >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Simulador de Negociação e Repactuação
                </h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-extrabold uppercase tracking-wider">
                  Proposta Flexível
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Contrato Nº <span className="font-mono font-bold text-amber-300">{contrato.numero}</span> • Devedor: <span className="font-bold text-white">{contrato.emitente}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Salvo no Histórico!
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Salvar Proposta no Firestore"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar Proposta
            </button>
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
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* COMPARATIVE METRICS STRIP */}
        <div className="bg-slate-900 text-white p-4 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Dívida Apurada Liquidada</span>
            <span className="text-base sm:text-lg font-black font-mono text-slate-100 mt-0.5 block">
              {formatCurrency(apuracaoBase.totalDevidoApurado)}
            </span>
            <span className="text-[10px] text-slate-400">Com Multa, Mora e Correção</span>
          </div>

          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 block">Valor Acordado Proposto</span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5 block">
              {formatCurrency(propostaCalculada.valorTotalAcordoBase)}
            </span>
            <span className="text-[10px] text-emerald-300/80 font-medium">Após abatimentos negociados</span>
          </div>

          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-300 block">Desconto Concedido</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-black font-mono text-amber-400">
                {formatCurrency(propostaCalculada.descontoTotalValor)}
              </span>
              <span className="text-xs font-bold text-amber-300">
                ({propostaCalculada.descontoTotalPct.toFixed(1)}%)
              </span>
            </div>
            <span className="text-[10px] text-amber-300/80 font-medium">Economia direta ao devedor</span>
          </div>

          <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300 block">
              {tipoAcordo === "parcelado" ? `Entrada + ${numeroParcelas}x Parcela` : "Pagamento Único"}
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-blue-300 mt-0.5 block">
              {tipoAcordo === "parcelado"
                ? `${formatCurrency(valorEntrada)} + ${formatCurrency(propostaCalculada.cronograma[0]?.valorTotalParcela || 0)}/m`
                : formatCurrency(propostaCalculada.valorTotalAcordoBase)}
            </span>
            <span className="text-[10px] text-blue-300/80 font-medium">
              {tipoAcordo === "parcelado" ? `Tabela ${sistemaAmortizacao} • ${taxaJurosMensal}% a.m.` : "Quitação Imediata"}
            </span>
          </div>
        </div>

        {/* MODAL TABS */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("parametros")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "parametros"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            1. Parâmetros da Negociação
          </button>
          <button
            onClick={() => setActiveTab("cronograma")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "cronograma"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            2. Cronograma Proposto ({propostaCalculada.cronograma.length}x)
          </button>
          <button
            onClick={() => setActiveTab("termo")}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "termo"
                ? "border-emerald-600 text-emerald-700 bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            3. Minuta do Acordo / Termo Pronta
          </button>
        </div>

        {/* MODAL BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-6">
          {/* TAB 1: PARAMETROS DA NEGOCIAÇÃO */}
          {activeTab === "parametros" && (
            <div className="space-y-6">
              {/* ESTRATÉGIAS PRÉ-SETADAS RÁPIDAS */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Preset da IA: Estratégias Pré-Configuradas de Mercado
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-lg border border-amber-800/80 font-mono">
                      Estratégia Ativa: {currentPresetDisplayName}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => aplicarPresetStrategy("mercado")}
                    className={`p-2.5 rounded-lg text-left transition cursor-pointer group flex flex-col justify-between border ${
                      selectedPresetKey === "mercado"
                        ? "bg-slate-800 border-emerald-400 ring-2 ring-emerald-500/30"
                        : "bg-slate-800/60 hover:bg-slate-750 border-slate-700 hover:border-emerald-500/40"
                    }`}
                  >
                    <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center justify-between">
                      🚀 Padrão Bacen
                      {selectedPresetKey === "mercado" && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                          {hasAnyAlteration ? "Personalizado" : "Ativo"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-300 mt-1">100% Mora • 15% Sinal • 24x (0.95% a.m.)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPresetStrategy("conservadora")}
                    className={`p-2.5 rounded-lg text-left transition cursor-pointer group flex flex-col justify-between border ${
                      selectedPresetKey === "conservadora"
                        ? "bg-slate-800 border-amber-400 ring-2 ring-amber-500/30"
                        : "bg-slate-800/60 hover:bg-slate-750 border-slate-700 hover:border-amber-500/40"
                    }`}
                  >
                    <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300 flex items-center justify-between">
                      ⚖️ Comitê Gerencial
                      {selectedPresetKey === "conservadora" && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
                          {hasAnyAlteration ? "Personalizado" : "Ativo"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-300 mt-1">75% Mora • 10% Sinal • 36x (1.20% a.m.)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPresetStrategy("avista")}
                    className={`p-2.5 rounded-lg text-left transition cursor-pointer group flex flex-col justify-between border ${
                      selectedPresetKey === "avista"
                        ? "bg-slate-800 border-blue-400 ring-2 ring-blue-500/30"
                        : "bg-slate-800/60 hover:bg-slate-750 border-slate-700 hover:border-blue-500/40"
                    }`}
                  >
                    <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center justify-between">
                      💎 Quitação à Vista
                      {selectedPresetKey === "avista" && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500 text-slate-950">
                          {hasAnyAlteration ? "Personalizado" : "Ativo"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-300 mt-1">100% Mora + 10% Abatimento no Principal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => aplicarPresetStrategy("longoprazo")}
                    className={`p-2.5 rounded-lg text-left transition cursor-pointer group flex flex-col justify-between border ${
                      selectedPresetKey === "longoprazo"
                        ? "bg-slate-800 border-purple-400 ring-2 ring-purple-500/30"
                        : "bg-slate-800/60 hover:bg-slate-750 border-slate-700 hover:border-purple-500/40"
                    }`}
                  >
                    <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300 flex items-center justify-between">
                      ⚡ Parcela Enxuta
                      {selectedPresetKey === "longoprazo" && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500 text-slate-950">
                          {hasAnyAlteration ? "Personalizado" : "Ativo"}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-300 mt-1">100% Mora • 5% Sinal • 60x (1.00% a.m.)</span>
                  </button>
                </div>
              </div>

              {/* TERMÔMETRO DE INTELÊGENCIA DE MERCADO & PARECER DE ALÇADA */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex flex-wrap items-center gap-2">
                        Termômetro de Inteligência de Crédito & Prática Legal
                        <span className="px-2.5 py-0.5 bg-slate-900 text-amber-300 text-xs font-black rounded-md border border-slate-700 font-mono flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          {currentPresetDisplayName}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Análise de aderência à jurisprudência do STJ, CDC Art. 52 e resoluções do Banco Central (Bacen).
                      </p>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${inteligenciaMercado.corBadge} shrink-0`}>
                    {inteligenciaMercado.rotulo}
                  </span>
                </div>

                {hasAnyAlteration && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                    <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Score de aprovação reanalisado em tempo real para a versão <strong>{currentPresetDisplayName}</strong>. Os parâmetros modificados estão destacados abaixo com borda e selo <span className="px-1.5 py-0.5 bg-amber-500 text-white font-extrabold rounded text-[9px] uppercase">Alterado</span>.
                    </span>
                  </div>
                )}

                {/* Meter Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      Score de Aprovação ({currentPresetDisplayName}):
                      <span className="font-mono text-sm text-slate-900 font-black">{inteligenciaMercado.score}/100 pts</span>
                    </span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {inteligenciaMercado.score >= 78 ? "Baixo Risco de Inadimplência" : inteligenciaMercado.score >= 55 ? "Risco Moderado" : "Elevada Dependência de Alçada"}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${inteligenciaMercado.corBarra}`}
                      style={{ width: `${inteligenciaMercado.score}%` }}
                    />
                  </div>
                </div>

                {/* Positives & Warnings Analysis Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                  {/* Positive Points */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[11px] uppercase tracking-wider">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Pontos Fortes & Aderência ao Mercado ({inteligenciaMercado.elogios.length})
                    </div>
                    {inteligenciaMercado.elogios.length > 0 ? (
                      <ul className="space-y-1 text-slate-700 text-[11px]">
                        {inteligenciaMercado.elogios.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Nenhum ponto forte destacado para esta combinação.</p>
                    )}
                  </div>

                  {/* Warning Points / Legal Notes */}
                  <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-[11px] uppercase tracking-wider">
                      <Info className="w-4 h-4 text-amber-600" />
                      Pontos de Atenção & Limites Legais ({inteligenciaMercado.alertas.length})
                    </div>
                    {inteligenciaMercado.alertas.length > 0 ? (
                      <ul className="space-y-1 text-slate-700 text-[11px]">
                        {inteligenciaMercado.alertas.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-600 font-bold mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Proposta plenamente ajustada sem pontos de atenção ou riscos regulatórios.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN: DESCONTOS & ABATIMENTOS */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Percent className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Política de Descontos & Incentivo de Quitação</h3>
                </div>

                {/* Tipo de Acordo Selection */}
                <div className={`space-y-2 p-2.5 rounded-xl border transition-all ${
                  isFieldAltered("tipoAcordo") ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30" : "border-transparent"
                }`}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Modalidade do Acordo</label>
                    {isFieldAltered("tipoAcordo") && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-1">
                        <Edit2 className="w-2.5 h-2.5" /> Alterado
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTipoAcordo("vista")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        tipoAcordo === "vista"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="font-bold text-xs flex items-center justify-between">
                        Liquidação à Vista
                        {tipoAcordo === "vista" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">Quitação em parcela única imediata com desconto máximo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoAcordo("parcelado")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        tipoAcordo === "parcelado"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="font-bold text-xs flex items-center justify-between">
                        Repactuação Parcelada
                        {tipoAcordo === "parcelado" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">Sinal + parcelamento de 1x a 120x com tabela Price/SAC</span>
                    </button>
                  </div>
                </div>

                {/* Sliders for Discounts */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  {/* Desconto Juros de Mora */}
                  <div className={`space-y-1 p-3 rounded-lg border transition-all ${
                    isFieldAltered("descontoMoraPct")
                      ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        Desconto em Juros de Mora (1%/m):
                        {isFieldAltered("descontoMoraPct") && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                            <Edit2 className="w-2.5 h-2.5" /> Alterado
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {descontoMoraPct}% ({formatCurrency(apuracaoBase.moraAcumulada * (descontoMoraPct / 100))})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={descontoMoraPct}
                      onChange={e => setDescontoMoraPct(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    {isFieldAltered("descontoMoraPct") && (
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        Valor base no preset ({selectedPresetBaseline.nomeBase}): {selectedPresetBaseline.descontoMoraPct}%
                      </p>
                    )}
                  </div>

                  {/* Desconto Multa Moratória */}
                  <div className={`space-y-1 p-3 rounded-lg border transition-all ${
                    isFieldAltered("descontoMultaPct")
                      ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        Desconto na Multa Moratória (2%):
                        {isFieldAltered("descontoMultaPct") && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                            <Edit2 className="w-2.5 h-2.5" /> Alterado
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {descontoMultaPct}% ({formatCurrency(apuracaoBase.multaAcumulada * (descontoMultaPct / 100))})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={descontoMultaPct}
                      onChange={e => setDescontoMultaPct(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    {isFieldAltered("descontoMultaPct") && (
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        Valor base no preset ({selectedPresetBaseline.nomeBase}): {selectedPresetBaseline.descontoMultaPct}%
                      </p>
                    )}
                  </div>

                  {/* Desconto Correção Monetária */}
                  <div className={`space-y-1 p-3 rounded-lg border transition-all ${
                    isFieldAltered("descontoCorrecaoPct")
                      ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        Abatimento na Correção Monetária:
                        {isFieldAltered("descontoCorrecaoPct") && (
                          <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                            <Edit2 className="w-2.5 h-2.5" /> Alterado
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {descontoCorrecaoPct}% ({formatCurrency(apuracaoBase.correcaoAcumulada * (descontoCorrecaoPct / 100))})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={descontoCorrecaoPct}
                      onChange={e => setDescontoCorrecaoPct(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    {isFieldAltered("descontoCorrecaoPct") && (
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        Valor base no preset ({selectedPresetBaseline.nomeBase}): {selectedPresetBaseline.descontoCorrecaoPct}%
                      </p>
                    )}
                  </div>

                  {/* Abatimento Direto no Principal */}
                  <div className={`space-y-1 p-3 rounded-lg border transition-all ${
                    isFieldAltered("descontoPrincipalPct")
                      ? "bg-amber-100/90 border-amber-500 ring-2 ring-amber-400/40"
                      : "bg-amber-50/50 border-amber-200"
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        Desconto Excepcional no Principal:
                        {isFieldAltered("descontoPrincipalPct") && (
                          <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                            <Edit2 className="w-2.5 h-2.5" /> Alterado
                          </span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-amber-800">
                        {descontoPrincipalPct}% ({formatCurrency(apuracaoBase.principalResidual * (descontoPrincipalPct / 100))})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={descontoPrincipalPct}
                      onChange={e => setDescontoPrincipalPct(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                    {isFieldAltered("descontoPrincipalPct") && (
                      <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        Valor base no preset ({selectedPresetBaseline.nomeBase}): {selectedPresetBaseline.descontoPrincipalPct}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: CONDICOES DE PARCELAMENTO */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Condições de Financimento do Acordo</h3>
                </div>

                {tipoAcordo === "parcelado" ? (
                  <div className="space-y-4">
                    {/* Entrada / Sinal */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Valor da Entrada / Sinal (R$)</label>
                        <input
                          type="number"
                          step="1000"
                          value={valorEntrada}
                          onChange={e => setValorEntrada(Math.max(0, Number(e.target.value)))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Data Vencimento da Entrada</label>
                        <input
                          type="date"
                          value={dataEntrada}
                          onChange={e => setDataEntrada(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Número de Parcelas & Presets */}
                    <div className={`space-y-1.5 p-3 rounded-lg border transition-all ${
                      isFieldAltered("numeroParcelas")
                        ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30"
                        : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          Número de Parcelas Mensais:
                          {isFieldAltered("numeroParcelas") && (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                              <Edit2 className="w-2.5 h-2.5" /> Alterado
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-emerald-700 font-extrabold">{numeroParcelas} parcelas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="120"
                          value={numeroParcelas}
                          onChange={e => setNumeroParcelas(Number(e.target.value))}
                          className="flex-1 accent-emerald-600 cursor-pointer"
                        />
                      </div>
                      {isFieldAltered("numeroParcelas") && (
                        <p className="text-[10px] text-amber-800 font-semibold mt-0.5">
                          Valor base no preset ({selectedPresetBaseline.nomeBase}): {selectedPresetBaseline.numeroParcelas} parcelas
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[6, 12, 24, 36, 48, 60, 120].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNumeroParcelas(p)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                              numeroParcelas === p
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {p}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sistema de Amortização & Taxa de Juros */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <div className={`p-2.5 rounded-lg border transition-all ${
                        isFieldAltered("sistemaAmortizacao")
                          ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Amortização</label>
                          {isFieldAltered("sistemaAmortizacao") && (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                              <Edit2 className="w-2.5 h-2.5" /> Alterado
                            </span>
                          )}
                        </div>
                        <select
                          value={sistemaAmortizacao}
                          onChange={e => setSistemaAmortizacao(e.target.value as SistemaAmortizacao)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="PRICE">Tabela PRICE (Prestação Fixa)</option>
                          <option value="SAC">Tabela SAC (Amortização Constante)</option>
                        </select>
                        {isFieldAltered("sistemaAmortizacao") && (
                          <p className="text-[10px] text-amber-800 font-semibold mt-1">
                            Base: {selectedPresetBaseline.sistemaAmortizacao}
                          </p>
                        )}
                      </div>

                      <div className={`p-2.5 rounded-lg border transition-all ${
                        isFieldAltered("taxaJurosMensal")
                          ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30"
                          : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Taxa Juros Negociada (% a.m.)</label>
                          {isFieldAltered("taxaJurosMensal") && (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded text-[9px] font-black uppercase flex items-center gap-0.5">
                              <Edit2 className="w-2.5 h-2.5" /> Alterado
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.05"
                          value={taxaJurosMensal}
                          onChange={e => setTaxaJurosMensal(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                        {isFieldAltered("taxaJurosMensal") && (
                          <p className="text-[10px] text-amber-800 font-semibold mt-1">
                            Base: {selectedPresetBaseline.taxaJurosMensal}% a.m.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Reajuste Futuro & Primeira Parcela */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Indexador Reajuste Projetado</label>
                        <div className="flex gap-2">
                          <select
                            value={indexadorReajuste}
                            onChange={e => {
                              const idx = e.target.value;
                              setIndexadorReajuste(idx);
                              setTaxaIndexadorAnual(indexadorRates[idx as keyof IndexadorRates] || 4.5);
                            }}
                            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="IPCA">IPCA ({indexadorRates.IPCA || 4.5}% a.a.)</option>
                            <option value="INPC">INPC ({indexadorRates.INPC || 4.3}% a.a.)</option>
                            <option value="SELIC">SELIC ({indexadorRates.SELIC || 14.25}% a.a.)</option>
                            <option value="CDI">CDI ({indexadorRates.CDI || 14.15}% a.a.)</option>
                            <option value="TR">TR ({indexadorRates.TR || 1.25}% a.a.)</option>
                            <option value="PRE">Pré-fixado (0% a.a.)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Vencimento da 1ª Parcela</label>
                        <input
                          type="date"
                          value={dataPrimeiraParcela}
                          onChange={e => setDataPrimeiraParcela(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-emerald-50/50 rounded-xl border border-emerald-200 text-center space-y-3">
                    <Award className="w-10 h-10 text-emerald-600 mx-auto" />
                    <div>
                      <h4 className="font-bold text-emerald-950 text-sm">Liquidação em Parcela Única</h4>
                      <p className="text-xs text-emerald-800 mt-1 max-w-md mx-auto">
                        O devedor efetuará o pagamento integral do valor negociado de <span className="font-bold font-mono">{formatCurrency(propostaCalculada.valorTotalAcordoBase)}</span> na data estipulada.
                      </p>
                    </div>
                    <div className="pt-2">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Data Limite para Quitação:</label>
                      <input
                        type="date"
                        value={dataEntrada}
                        onChange={e => setDataEntrada(e.target.value)}
                        className="bg-white border border-emerald-300 rounded-lg p-2 text-xs font-bold text-emerald-950"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* TAB 2: CRONOGRAMA PROPOSTO VIRTUALIZADO */}
          {activeTab === "cronograma" && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Cronograma Detalhado da Nova Proposta de Acordo</h3>
                  <p className="text-xs text-slate-500">Fluxo amortizável com visualização ultra-rápida (Virtualização de tabela ativa).</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar Cronograma (CSV)
                  </button>
                </div>
              </div>

              {/* Virtualized Table Container */}
              <div ref={tableParentRef} className="overflow-y-auto max-h-[55vh] border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-slate-200 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 text-center border-r border-slate-800">Parc. nº</th>
                      <th className="py-2.5 px-3 text-center border-r border-slate-800">Vencimento</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-800 text-slate-300">Saldo Inicial</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-800 text-slate-200">Amortização</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-800 text-amber-300">Juros ({taxaJurosMensal}%)</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-800 text-slate-300">Reajuste ({indexadorReajuste})</th>
                      <th className="py-2.5 px-3 text-right border-r border-slate-800 font-extrabold text-emerald-300 bg-slate-950">Valor Parcela</th>
                      <th className="py-2.5 px-3 text-right font-black text-white bg-slate-950">Saldo Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paddingTop > 0 && (
                      <tr>
                        <td colSpan={8} style={{ height: `${paddingTop}px` }} />
                      </tr>
                    )}
                    {virtualRows.map((virtualRow) => {
                      const p = propostaCalculada.cronograma[virtualRow.index];
                      return (
                        <tr
                          key={virtualRow.key}
                          ref={rowVirtualizer.measureElement}
                          className="hover:bg-slate-50 transition border-b border-slate-200"
                        >
                          <td className="py-2 px-3 text-center font-bold text-slate-800 border-r border-slate-200 bg-slate-50">
                            #{p.numero}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-semibold text-slate-700 border-r border-slate-200">
                            {formatDate(p.dataVencimento)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                            {formatCurrency(p.saldoInicial)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 border-r border-slate-200">
                            {formatCurrency(p.amortizacao)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-700 border-r border-slate-200">
                            {formatCurrency(p.juros)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                            {formatCurrency(p.correcaoProjetada)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700 bg-emerald-50/40 border-r border-slate-200">
                            {formatCurrency(p.valorTotalParcela)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-100/60">
                            {formatCurrency(p.saldoFinal)}
                          </td>
                        </tr>
                      );
                    })}
                    {paddingBottom > 0 && (
                      <tr>
                        <td colSpan={8} style={{ height: `${paddingBottom}px` }} />
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-900 text-slate-200 font-bold text-[11px] sticky bottom-0 z-20 shadow-lg">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-left uppercase tracking-wider font-extrabold bg-slate-950">
                        TOTAL REPACTUADO PROPOSTO
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {formatCurrency(propostaCalculada.cronograma.reduce((a, b) => a + b.amortizacao, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                        {formatCurrency(propostaCalculada.cronograma.reduce((a, b) => a + b.juros, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatCurrency(propostaCalculada.cronograma.reduce((a, b) => a + b.correcaoProjetada, 0))}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 bg-slate-950 font-black text-xs">
                        {formatCurrency(propostaCalculada.totalFinalPagamentos)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400 bg-slate-950">
                        R$ 0,00
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MINUTA / TERMO DE ACORDO PRONTO PARA IMPRESSAO */}
          {activeTab === "termo" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-4xl mx-auto print:shadow-none print:border-none">
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Documento de Minuta de Acordo e Repactuação</h3>
                </div>
                <button
                  onClick={handlePrintProposal}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Printer className="w-4 h-4 text-emerald-400" />
                  Imprimir / Salvar PDF
                </button>
              </div>

              {/* PRINTABLE DRAFT CONTENT */}
              <div className="space-y-6 text-slate-800 text-xs leading-relaxed font-sans print:text-black">
                <div className="text-center border-b pb-4 space-y-1">
                  <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
                    INSTRUMENTO PARTICULAR DE REPACTUAÇÃO E ACORDO DE DÍVIDA
                  </h1>
                  <p className="text-[11px] text-slate-500">
                    Proposta formal gerada em {new Date().toLocaleDateString("pt-BR")} via Simulador de Renegociação
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">DEVEDOR / EMITENTE:</span>
                    <span className="font-bold text-slate-900 text-sm">{contrato.emitente}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">CREDOR / INSTITUIÇÃO:</span>
                    <span className="font-bold text-slate-900 text-sm">{contrato.credor || "SICREDI / INSTITUIÇÃO FINANCEIRA"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">CONTRATO ORIGINAL:</span>
                    <span className="font-mono font-bold text-slate-800">{contrato.numero}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">VALOR ORIGINAL EMISSÃO:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(contrato.valorPrincipal)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">CLÁUSULA PRIMEIRA - DA APURAÇÃO E CONDIÇÕES DO ACORDO</h4>
                  <p>
                    O DEVEDOR e o CREDOR pactuam o encerramento das pendências relativas ao Contrato nº <strong>{contrato.numero}</strong>. A dívida apurada com os devidos encargos totalizava <strong>{formatCurrency(apuracaoBase.totalDevidoApurado)}</strong>.
                  </p>
                  <p>
                    Mediante concessão de abatimento especial de <strong>{formatCurrency(propostaCalculada.descontoTotalValor)} ({propostaCalculada.descontoTotalPct.toFixed(1)}%)</strong>, o valor total do presente acordo resta fixado em <strong>{formatCurrency(propostaCalculada.valorTotalAcordoBase)}</strong>.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">CLÁUSULA SEGUNDA - DA FORMA DE PAGAMENTO</h4>
                  {tipoAcordo === "parcelado" ? (
                    <p>
                      O pagamento será realizado mediante entrada no valor de <strong>{formatCurrency(valorEntrada)}</strong> com vencimento em <strong>{formatDate(dataEntrada)}</strong>, e o saldo remanescente em <strong>{numeroParcelas} parcelas mensais</strong> de aproximadamente <strong>{formatCurrency(propostaCalculada.cronograma[0]?.valorTotalParcela || 0)}</strong>, vencendo a primeira em <strong>{formatDate(dataPrimeiraParcela)}</strong>, acrescidas de juros de {taxaJurosMensal}% ao mês pela Tabela {sistemaAmortizacao} e reajuste anual pelo {indexadorReajuste}.
                    </p>
                  ) : (
                    <p>
                      O pagamento será realizado em parcela única no valor total de <strong>{formatCurrency(propostaCalculada.valorTotalAcordoBase)}</strong> na data limite de <strong>{formatDate(dataEntrada)}</strong>.
                    </p>
                  )}
                </div>

                <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs">
                  <div className="border-t border-slate-400 pt-2">
                    <p className="font-bold text-slate-900">{contrato.emitente}</p>
                    <p className="text-[10px] text-slate-500">Devedor / Emitente</p>
                  </div>
                  <div className="border-t border-slate-400 pt-2">
                    <p className="font-bold text-slate-900">{contrato.credor || "INSTITUIÇÃO FINANCEIRA"}</p>
                    <p className="text-[10px] text-slate-500">Credor / Representante Legal</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Proposta calculada com precisão matemática auditável.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Confirmar & Salvar no Banco
            </button>
          </div>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
