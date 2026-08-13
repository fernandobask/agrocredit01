import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, ExternalLink } from "lucide-react";
import { Contrato, Laudo } from "../types";

interface McrAuditBadgeProps {
  contrato: Contrato;
  laudo?: Laudo | null;
  compact?: boolean;
  onOpenLegalSources?: (sourceId?: string) => void;
}

export const McrAuditBadge: React.FC<McrAuditBadgeProps> = ({
  contrato,
  laudo,
  compact = false,
  onOpenLegalSources
}) => {
  if (!contrato) return null;

  const taxaJuros = contrato.taxaJurosAnual || 0;
  const indexador = (contrato.indexadorOriginal || (contrato as any).indexador || "").toString().toUpperCase();
  const isCdiOrFlutuante = indexador.includes("CDI") || indexador.includes("SELIC") || indexador.includes("FLUTUANTE") || indexador.includes("VARIAVEL");
  const isTaxaElevada = taxaJuros > 12.0; // Benchmark MCR / Usura Decreto 22.626/33
  const hasLaudoIrregularidade = laudo && laudo.irregularidadesEncontradas;
  const hasDivergencias = laudo?.divergencias && laudo.divergencias.some(d => d.status === 'divergente');

  // Determine Overall Status
  let status: 'conforme' | 'atencao' | 'irregular' = 'conforme';
  let badgeLabel = 'Conforme MCR';

  if (hasLaudoIrregularidade || hasDivergencias) {
    status = 'irregular';
    badgeLabel = 'Divergência DDC vs Cédula';
  } else if (isCdiOrFlutuante && isTaxaElevada) {
    status = 'irregular';
    badgeLabel = `🚨 CDI + Taxa Abusiva (${taxaJuros.toFixed(2)}% a.a.)`;
  } else if (isCdiOrFlutuante) {
    status = 'irregular';
    badgeLabel = `🚨 Indexador Flutuante (CDI em Crédito Rural)`;
  } else if (isTaxaElevada) {
    status = 'atencao';
    badgeLabel = `Taxa ${taxaJuros.toFixed(2)}% a.a. (>12% MCR)`;
  }

  if (compact) {
    if (status === 'conforme') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200 shrink-0" title="Contrato em conformidade com o MCR">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>MCR OK</span>
        </span>
      );
    }
    if (status === 'atencao') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-900 text-[10px] font-extrabold rounded border border-amber-300 shrink-0" title={`Taxa de ${taxaJuros}% a.a. excede teto legal do MCR (12% a.a.)`}>
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>{badgeLabel}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-900 text-[10px] font-extrabold rounded border border-rose-300 shrink-0" title={isCdiOrFlutuante ? "Indexador CDI flutuante é nulo/abusivo em Crédito Rural segundo MCR BACEN" : "Irregularidades ou divergências encontradas"}>
        <ShieldAlert className="w-3 h-3 text-rose-600" />
        <span>{badgeLabel}</span>
      </span>
    );
  }

  // DETAILED BADGE CARD
  return (
    <div className={`p-3 rounded-xl border text-xs space-y-2 ${
      status === 'conforme'
        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        : status === 'atencao'
        ? 'bg-amber-50/80 border-amber-300 text-amber-950'
        : 'bg-rose-50/90 border-rose-300 text-rose-950'
    }`}>
      <div className="flex items-center justify-between font-extrabold">
        <div className="flex items-center gap-1.5">
          {status === 'conforme' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : status === 'atencao' ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>Auditoria Pericial MCR: {badgeLabel}</span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-700">
        {status === 'conforme' && "Contrato apresenta taxa fixa e prazos alinhados com as diretrizes normativas do Crédito Rural (MCR - BACEN)."}
        {status === 'atencao' && "Taxa contratual excede o patamar limite de 12% a.a. (Decreto 22.626/33 / MCR). Ação de repactuação recomendada."}
        {status === 'irregular' && isCdiOrFlutuante && "O uso do indexador CDI flutuante em Cédula de Crédito Rural é abusivo perante o MCR/BACEN. A jurisprudência impõe a substituição do CDI por taxa fixa ou INPC/TJLP e limitação dos juros a 12% a.a."}
        {status === 'irregular' && !isCdiOrFlutuante && "Identificadas divergências relevantes entre a Cédula Rural original e o Demonstrativo de Evolução da Dívida (DDC)."}
      </p>

      {/* Direct Verified Citation Badges */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60">
        <span className="text-[10px] font-bold text-slate-500 uppercase">Fontes Legais:</span>
        {isCdiOrFlutuante && (
          <a
            href="https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2006_3_capSumula176.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-100/90 text-rose-900 text-[10px] font-extrabold rounded border border-rose-300 hover:underline"
            title="Súmula 176 STJ: Nulidade de taxas flutuantes ao arbítrio do banco"
          >
            <ExternalLink className="w-2.5 h-2.5 text-rose-700" /> Súmula 176 STJ (CDI Nulo)
          </a>
        )}
        {isTaxaElevada && (
          <a
            href="https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2010_13_capSumula288.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100/90 text-amber-900 text-[10px] font-extrabold rounded border border-amber-300 hover:underline"
            title="Súmula 288 STJ: Limitação dos juros remuneratórios rurais a 12% ao ano"
          >
            <ExternalLink className="w-2.5 h-2.5 text-amber-700" /> Súmula 288 STJ (Teto 12%)
          </a>
        )}
        <a
          href="https://manuais.bcb.gov.br/app/manual/mcr/publico"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100/90 text-emerald-900 text-[10px] font-extrabold rounded border border-emerald-300 hover:underline"
          title="Portal Público On-Line do Manual de Crédito Rural - Banco Central do Brasil"
        >
          <ExternalLink className="w-2.5 h-2.5 text-emerald-700" /> MCR BACEN (Portal Oficial)
        </a>

        {onOpenLegalSources && (
          <button
            onClick={() => onOpenLegalSources()}
            className="text-[10px] font-bold text-blue-700 hover:text-blue-900 underline ml-auto cursor-pointer"
          >
            Ver Todas as Fontes
          </button>
        )}
      </div>
    </div>
  );
};

