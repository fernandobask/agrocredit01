import React, { useState } from "react";
import {
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileSpreadsheet,
  Zap,
  HelpCircle,
  TrendingDown,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Info,
  Maximize2,
  Minimize2
} from "lucide-react";
import { motion } from "motion/react";

interface McrExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBatchImport?: () => void;
  onOpenLegalSources?: () => void;
}

export function McrExplanationModal({
  isOpen,
  onClose,
  onOpenBatchImport,
  onOpenLegalSources
}: McrExplanationModalProps) {
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={`bg-slate-50 border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized 
            ? "fixed inset-0 w-full h-full rounded-none max-w-none max-h-none" 
            : "w-full max-w-7xl max-h-[94vh] rounded-2xl"
        }`}
      >
        {/* Header */}
        <div className="bg-white p-4 md:p-5 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center border border-emerald-300 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-black text-slate-900">Guia MCR Auto-Serviço & Base Legal Verificável</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md border border-emerald-300">
                  Norma BACEN / STJ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Fundamentação jurídica real com links diretos para conferência no Planalto, Banco Central e STJ.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title={isMaximized ? "Restaurar tamanho da janela" : "Maximizar janela"}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 text-sm leading-relaxed bg-slate-50">
          
          {/* Card 1: O que é o MCR + Links Oficiais */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-800 font-black text-base">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <h4>1. Afinal, o que é o MCR (Manual de Crédito Rural)?</h4>
              </div>

              {onOpenLegalSources && (
                <button
                  onClick={onOpenLegalSources}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  <Scale className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ver Biblioteca de Leis & Súmulas Completa</span>
                </button>
              )}
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              O <strong>MCR (Manual de Crédito Rural)</strong> é o conjunto oficial de normas e regramentos editados pelo <strong>Banco Central do Brasil (BACEN)</strong> e pelo Conselho Monetário Nacional (CMN). Ele dita todas as regras legais que as instituições financeiras (bancos e cooperativas) <strong>são obrigadas a cumprir</strong> na emissão de Cédulas de Crédito Rural (CPR), Cédulas de Crédito Bancário (CCB) e financiamentos do agronegócio.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <a
                href="https://manuais.bcb.gov.br/app/manual/mcr/publico"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold rounded-xl border border-emerald-300 transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                <span>Portal Público MCR On-Line (BACEN)</span>
              </a>
              <a
                href="https://www.bcb.gov.br/estabilidadefinanceira/normativos"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Busca de Normativos & Resoluções BACEN/CMN</span>
              </a>
              <a
                href="https://www.planalto.gov.br/ccivil_03/leis/l4829.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Lei 4.829/1965 (Planalto)</span>
              </a>
              <a
                href="https://www.planalto.gov.br/ccivil_03/decreto-lei/del0167.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl border border-slate-300 transition shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Decreto-Lei 167/1967 (Cédula Rural)</span>
              </a>
            </div>
          </div>

          {/* Card 2: Principais Direitos do Produtor Rural e Abusividades + Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/70 border border-emerald-200/80 p-4 sm:p-5 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm uppercase tracking-wider">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                  Direitos Legais Assegurados pelo MCR
                </div>
              </div>

              <ul className="text-sm text-slate-800 space-y-3 font-normal leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span><strong>MCR 2-6-4 (Alongamento Compulsório):</strong> Direito de prorrogar o vencimento da dívida mantendo as taxas originais quando houver frustração de safra.</span>
                    <a href="https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2010_13_capSumula298.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-800 font-semibold hover:underline mt-1 block">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Súmula 298 do STJ (PDF)
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span><strong>Teto de Juros em 12% a.a.:</strong> Ausente autorização do CMN, os juros contratuais rurais são limitados a 12% ao ano.</span>
                    <a href="https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2010_13_capSumula288.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-800 font-semibold hover:underline mt-1 block">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Súmula 288 do STJ / Decreto 22.626/33
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span><strong>Vedação de Venda Casada:</strong> Proibição de condicionar a liberação do crédito à compra compulsória de seguros prestamistas.</span>
                    <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078.htm" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-800 font-semibold hover:underline mt-1 block">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Artigo 39, I do CDC (Lei 8.078/90)
                    </a>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-rose-50/70 border border-rose-200/80 p-4 sm:p-5 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-rose-950 text-sm uppercase tracking-wider">
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-600" />
                  Abusividades e Nulidades Frequentes
                </div>
              </div>

              <ul className="text-sm text-slate-800 space-y-3 font-normal leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <TrendingDown className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span><strong>Indexador CDI Flutuante:</strong> O uso de CDI em crédito rural é ilegal e considerado cláusula abusiva pela jurisprudência.</span>
                    <a href="https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2006_3_capSumula176.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-rose-800 font-semibold hover:underline mt-1 block">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Súmula 176 do STJ (Nulidade do CDI)
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <TrendingDown className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span><strong>Capitalização Indevida de Juros:</strong> Expurgo do anatocismo não expressamente autorizado por lei especial.</span>
                    <a href="https://www.planalto.gov.br/ccivil_03/decreto/d22626.htm" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-rose-800 font-semibold hover:underline mt-1 block">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Decreto 22.626/1933 (Lei de Usura)
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <TrendingDown className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span><strong>Multa Moratória Excessiva:</strong> Juros de mora em atraso no crédito rural são limitados no máximo a 1% ao ano.</span>
                    <a href="https://www.stj.jus.br/docs_internet/revista/eletronica/stj-revista-sumulas-2006_1_capSumula93.pdf" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-rose-800 font-semibold hover:underline mt-1 block">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver Súmula 93 do STJ (Teto de Mora)
                    </a>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 3: Como a Plataforma Funciona Auto-Serviço */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base">
              <Zap className="w-5 h-5 text-amber-500" />
              <h4>2. Passo a Passo do Sistema Auto-Serviço (100% Autônomo)</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-7 h-7 bg-slate-900 text-white font-bold text-xs rounded-lg flex items-center justify-center">
                  1
                </div>
                <div className="font-bold text-sm text-slate-900">Importação do PDF</div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Envie a foto ou PDF da Cédula (CPR/CCB) ou Demonstrativo de Débito (DDC).
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-7 h-7 bg-emerald-600 text-white font-bold text-xs rounded-lg flex items-center justify-center">
                  2
                </div>
                <div className="font-bold text-sm text-slate-900">Leitura por IA</div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  O Gemini 2.5 Flash lê e extrai os valores, taxas e parcelas em segundos.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-7 h-7 bg-blue-600 text-white font-bold text-xs rounded-lg flex items-center justify-center">
                  3
                </div>
                <div className="font-bold text-sm text-slate-900">Conferência com Original</div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Abra o PDF original no visualizador lado a lado para validar os números.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="w-7 h-7 bg-purple-600 text-white font-bold text-xs rounded-lg flex items-center justify-center">
                  4
                </div>
                <div className="font-bold text-sm text-slate-900">Laudo / Repactuação</div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Gere o relatório pericial em PDF para protocolar a renegociação MCR no banco.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="bg-white border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-sm">
          <div className="text-xs sm:text-sm text-slate-600 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Ferramenta calibrada de acordo com as Resoluções do Banco Central do Brasil.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              Entendido
            </button>

            {onOpenBatchImport && (
              <button
                onClick={() => {
                  onClose();
                  onOpenBatchImport();
                }}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Iniciar Importação de Contratos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

