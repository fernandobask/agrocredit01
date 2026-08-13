import React, { useState, useMemo } from "react";
import {
  X,
  Briefcase,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Filter,
  Check,
  Building,
  User,
  Calendar,
  Sparkles,
  Printer,
  ShieldCheck,
  Clock,
  FolderArchive,
  ChevronRight,
  FolderOpen
} from "lucide-react";
import JSZip from "jszip";
import { SimulationDocument, Contrato, DivergenciaItem, ResultadoCenario, ProjecaoParcela, Indexador } from "../types";
import { formatCurrency, formatPercentage, formatDate, exportToCSV } from "../utils/math";
import { 
  generateUnifiedDossierHtml, 
  generateConsolidatedSummaryHtml, 
  generateTechnicalReportHtmlForContract, 
  generateMonthlyMemoryHtmlForContract,
  generateCsvMemoryForContract
} from "../utils/dossierReportGenerator";

interface GerarDossieModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedSimulations: SimulationDocument[];
  currentContract: Contrato;
  currentLaudo: any;
  onUpdateStatus?: (simulationId: string, status: 'em_trabalho' | 'em_renegociacao' | 'entregue' | 'arquivado') => void;
  userEmail?: string;
  userName?: string;
}

export function GerarDossieModal({
  isOpen,
  onClose,
  savedSimulations,
  currentContract,
  currentLaudo,
  onUpdateStatus,
  userEmail,
  userName
}: GerarDossieModalProps) {
  // 1. All contracts list (including active in-memory contract if not in savedSimulations)
  const allSimulationsList = useMemo(() => {
    const list = Array.isArray(savedSimulations) ? [...savedSimulations] : [];
    const currentNum = currentContract?.numero;
    const existsCurrent = currentNum ? list.some(
      s => s && (s.contractData?.numero || s.contrato?.numero) === currentNum
    ) : false;

    if (!existsCurrent && currentNum && currentContract) {
      list.unshift({
        id: "current_contract_active",
        name: `Contrato Atual - ${currentNum}`,
        contractData: currentContract,
        laudo: currentLaudo,
        statusPipeline: currentContract.statusPipeline || "em_trabalho",
        createdAt: new Date().toISOString()
      });
    }

    return list.filter(Boolean);
  }, [savedSimulations, currentContract, currentLaudo]);

  // Extract unique clients / emitentes
  const uniqueClients = useMemo(() => {
    const setClients = new Set<string>();
    allSimulationsList.forEach(sim => {
      const emit = sim.contractData?.emitente || sim.contrato?.emitente;
      if (emit) setClients.add(emit.trim().toUpperCase());
    });
    return Array.from(setClients);
  }, [allSimulationsList]);

  // Filters State
  const [selectedClient, setSelectedClient] = useState<string>("TODOS");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("TODOS");

  // Multi-selected items for Dossier
  const [selectedSimIds, setSelectedSimIds] = useState<Record<string, boolean>>({});

  // Initialize all visible as checked when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, boolean> = {};
      allSimulationsList.forEach((sim, idx) => {
        const id = sim.id || `sim_${idx}`;
        initialMap[id] = true;
      });
      setSelectedSimIds(initialMap);
    }
  }, [isOpen, allSimulationsList]);

  // Content Selection Checks
  const [includeExecutiveReport, setIncludeExecutiveReport] = useState(true);
  const [includeContractData, setIncludeContractData] = useState(true);
  const [includeLaudoMcr, setIncludeLaudoMcr] = useState(true);
  const [includeMemoriaCalculo, setIncludeMemoriaCalculo] = useState(true);
  const [includeBacenSim, setIncludeBacenSim] = useState(true);
  const [includeLegalSources, setIncludeLegalSources] = useState(true);

  // Perito / Dossier Metadata
  const [peritoNome, setPeritoNome] = useState(userName || "Dr. Fernando Bentos");
  const [peritoRegistro, setPeritoRegistro] = useState("CREA/CRA nº 48.912-D / Perito Agrônomo");
  const [dossieNumero, setDossieNumero] = useState(`DOSSIE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [observacoesEspecialista, setObservacoesEspecialista] = useState(
    "Dossiê auditado com base nas normas vigentes do Manual de Crédito Rural (MCR/BACEN), Decreto nº 22.626/33, Súmulas 176 e 288 do STJ. Identificaram-se desvios de taxa e cobranças moratórias antecipadas passíveis de repactuação administrativa ou judicial."
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  if (!isOpen) return null;

  // Filtered list based on selected client and status
  const filteredSimulations = allSimulationsList.filter(sim => {
    const emit = (sim.contractData?.emitente || sim.contrato?.emitente || "").trim().toUpperCase();
    if (selectedClient !== "TODOS" && emit !== selectedClient) return false;

    const pipeline = sim.statusPipeline || sim.contractData?.statusPipeline || "em_trabalho";
    if (selectedStatusFilter !== "TODOS" && pipeline !== selectedStatusFilter) return false;

    return true;
  });

  // Toggle check/uncheck for single item
  const toggleSelect = (id: string) => {
    setSelectedSimIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Toggle all visible
  const toggleSelectAll = (check: boolean) => {
    const nextMap = { ...selectedSimIds };
    filteredSimulations.forEach((sim, idx) => {
      const id = sim.id || `sim_${idx}`;
      nextMap[id] = check;
    });
    setSelectedSimIds(nextMap);
  };

  // Pipeline counts
  const countEmTrabalho = allSimulationsList.filter(s => (s.statusPipeline || "em_trabalho") === "em_trabalho").length;
  const countEmRenegociacao = allSimulationsList.filter(s => s.statusPipeline === "em_renegociacao").length;
  const countEntregues = allSimulationsList.filter(s => s.statusPipeline === "entregue").length;

  // Helper to bulk mark selected as "entregue"
  const handleBulkMarkEntregue = () => {
    const targetSims = filteredSimulations.filter((sim, idx) => selectedSimIds[sim.id || `sim_${idx}`]);
    if (targetSims.length === 0) {
      alert("Selecione ao menos um contrato na lista.");
      return;
    }

    targetSims.forEach(sim => {
      if (sim.id && onUpdateStatus) {
        onUpdateStatus(sim.id, "entregue");
      }
    });

    setStatusMessage(`${targetSims.length} contrato(s) marcados como ENTREGUES com sucesso!`);
    setTimeout(() => setStatusMessage(""), 4000);
  };

  // Helper to generate full consolidated HTML report using dossierReportGenerator
  const generateConsolidatedHtml = () => {
    const targetSims = filteredSimulations.filter((sim, idx) => selectedSimIds[sim.id || `sim_${idx}`]);
    const clientName = selectedClient !== "TODOS" ? selectedClient : (targetSims[0]?.contractData?.emitente || "PRODUTOR RURAL");
    
    return generateUnifiedDossierHtml(targetSims, clientName, {
      includeConsolidatedSummary: includeExecutiveReport,
      includeTechnicalReport: includeLaudoMcr,
      includeMonthlyMemory: includeMemoriaCalculo,
      includeContractData: includeContractData,
      includeBacenSim: includeBacenSim,
      includeLegalSources: includeLegalSources,
      peritoNome,
      peritoRegistro,
      dossieNumero,
      observacoesEspecialista
    });
  };

  // Generate JSZip Package
  const handleDownloadZipPackage = async () => {
    const targetSims = filteredSimulations.filter((sim, idx) => selectedSimIds[sim.id || `sim_${idx}`]);
    if (targetSims.length === 0) {
      alert("Selecione ao menos um contrato para incluir no Dossiê.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Criando estrutura de arquivos...");

    try {
      const zip = new JSZip();
      const clientFolder = selectedClient !== "TODOS" ? selectedClient.replace(/[^A-Z0-9]/gi, "_") : "CLIENTES_CONSOLIDADOS";

      // 1. Unified HTML Dossier Document
      const htmlContent = generateConsolidatedHtml();
      zip.file(`00_DOSSIE_PERICIAL_UNIFICADO_${clientFolder}.html`, htmlContent);

      // 2. Loop through contracts and add detailed files
      for (let index = 0; index < targetSims.length; index++) {
        const sim = targetSims[index];
        setStatusMessage(`Processando contrato ${index + 1} de ${targetSims.length}...`);
        await new Promise(resolve => setTimeout(resolve, 0));

        const c = sim.contractData || sim.contrato || currentContract;
        const numClean = (c.numero || `CONTRATO_${index + 1}`).replace(/[^A-Z0-9]/gi, "_");
        const folder = zip.folder(`Contrato_${numClean}`);

        if (folder) {
          if (includeContractData) {
            folder.file(`01_Parametros_Contratuais_${numClean}.json`, JSON.stringify(c, null, 2));
          }

          if (includeLaudoMcr) {
            const techHtml = generateTechnicalReportHtmlForContract(sim, {
              peritoNome,
              peritoRegistro,
              includeContractData,
              includeBacenSim,
              includeLegalSources
            });
            folder.file(`02_Relatorio_Tecnico_Auditoria_${numClean}.html`, techHtml);
          }

          if (includeMemoriaCalculo) {
            const memHtml = generateMonthlyMemoryHtmlForContract(sim);
            folder.file(`03_Memoria_Calculo_GradeExcel_${numClean}.html`, memHtml);

            const csvContent = generateCsvMemoryForContract(sim);
            folder.file(`03_Memoria_Calculo_${numClean}.csv`, csvContent);
          }

          if (includeLaudoMcr) {
            const laudoObj = sim.laudo || currentLaudo;
            const laudoText = `
Relatório de Inconformidades MCR - Contrato ${c.numero}
Emitente: ${c.emitente} | Credor: ${c.credor}
==================================================
Resumo: ${laudoObj?.resumo || "Conferência efetuada segundo regramento MCR."}
Pontos de Atenção: ${(laudoObj?.pontosDeAtencao || []).join("; ")}
Recomendação: ${laudoObj?.recomendacao || "Proceder com notificação de renegociação."}
            `;
            folder.file(`04_Laudo_Inconformidades_${numClean}.txt`, laudoText);
          }
        }
      }

      // 3. Generate Blob and Download
      setStatusMessage("Compactando arquivo ZIP (0%)...");
      const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
        setStatusMessage(`Compactando arquivo ZIP (${metadata.percent.toFixed(0)}%)...`);
      });
      const url = URL.createObjectURL(content);

      const link = document.createElement("a");
      link.href = url;
      link.download = `DOSSIE_PERICIAL_${clientFolder}_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setStatusMessage("Dossiê ZIP gerado e baixado com sucesso!");
      setTimeout(() => setStatusMessage(""), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao gerar o pacote ZIP do Dossiê: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Print Full Unified Dossier (Landscape/Portrait structured pages)
  const handlePrintDossier = () => {
    const htmlContent = generateConsolidatedHtml();
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  // Print Only Consolidated Summary Table (Doc 3)
  const handlePrintOnlyConsolidated = () => {
    const targetSims = filteredSimulations.filter((sim, idx) => selectedSimIds[sim.id || `sim_${idx}`]);
    const clientName = selectedClient !== "TODOS" ? selectedClient : (targetSims[0]?.contractData?.emitente || "PRODUTOR RURAL");
    const credorName = targetSims[0]?.contractData?.credor || "SICREDI / CREDORES CONSOLIDADOS";

    const summaryContent = generateConsolidatedSummaryHtml(targetSims, clientName, credorName, {
      peritoNome,
      peritoRegistro,
      dossieNumero
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>RESUMO CONSOLIDADO ÚNICO — ${clientName.toUpperCase()}</title>
        <style>
          @page { size: landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 12px; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
      </head>
      <body>
        ${summaryContent}
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-5xl w-full my-auto flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center justify-center shadow-inner shrink-0">
              <FolderArchive className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Gerador de Dossiê Geral de Perícia
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Pacote Consolidado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolide contratos por cliente, acompanhe o pipeline de entregas e exporte relatórios periciais completos.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-2xl transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATUS MESSAGE BANNER */}
        {statusMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 px-6 py-2.5 text-xs font-bold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          </div>
        )}

        {/* BODY CONTENT - SCROLLABLE */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 text-xs sm:text-sm">
          
          {/* BARRA SUPERIOR DE FILTROS & PIPELINE DE ENTREGAS */}
          <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-900 text-sm">Filtro de Cliente & Status de Entrega</span>
              </div>

              {/* PIPELINE COUNTERS BADGES */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Em Trabalho: {countEmTrabalho}
                </span>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                  Renegociação: {countEmRenegociacao}
                </span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  Entregues: {countEntregues}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* SELECT CLIENT */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selecione o Cliente / Produtor Rural</span>
                </label>
                <select
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                >
                  <option value="TODOS">🌐 Todos os Clientes ({uniqueClients.length} cadastrados)</option>
                  {uniqueClients.map(client => (
                    <option key={client} value={client}>
                      👤 {client}
                    </option>
                  ))}
                </select>
              </div>

              {/* SELECT PIPELINE STATUS */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Filtrar por Status do Pipeline</span>
                </label>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-2xs"
                >
                  <option value="TODOS">📋 Todos os Status (Em Trabalho + Entregues)</option>
                  <option value="em_trabalho">🔨 Apenas Em Trabalho / Análise</option>
                  <option value="em_renegociacao">🤝 Apenas Em Renegociação</option>
                  <option value="entregue">✅ Apenas Entregues / Concluídos</option>
                </select>
              </div>
            </div>
          </div>

          {/* LISTA DE CONTRATOS SELECIONÁVEIS DO CLIENTE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-emerald-600" />
                <span>Cédulas e Contratos Incluídos no Dossiê ({filteredSimulations.length})</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSelectAll(true)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  Selecionar Todos
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => toggleSelectAll(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-200 bg-white shadow-2xs max-h-60 overflow-y-auto">
              {filteredSimulations.length === 0 ? (
                <div className="p-6 text-center text-slate-500 font-medium text-xs">
                  Nenhum contrato encontrado para os filtros selecionados.
                </div>
              ) : (
                filteredSimulations.map((sim, idx) => {
                  const id = sim.id || `sim_${idx}`;
                  const c = sim.contractData || sim.contrato;
                  if (!c) return null;

                  const isChecked = !!selectedSimIds[id];
                  const currentStatus = sim.statusPipeline || c.statusPipeline || "em_trabalho";

                  return (
                    <div
                      key={id}
                      className={`p-3.5 flex items-center justify-between gap-3 transition ${
                        isChecked ? "bg-emerald-50/40" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* CHECKBOX & CONTRACT DETAILS */}
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(id)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {c.numero || "Cédula Sem Número"}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {c.credor || "Banco"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            Emitente: <strong className="text-slate-700">{c.emitente || "Produtor"}</strong> | Principal: <strong className="text-emerald-700">{formatCurrency(c.valorPrincipal || 0)}</strong> | Emissão: {c.dataEmissao ? formatDate(c.dataEmissao) : "-"}
                          </p>
                        </div>
                      </div>

                      {/* PIPELINE STATUS SELECTOR */}
                      <div className="shrink-0 flex items-center gap-2">
                        <select
                          value={currentStatus}
                          onChange={e => {
                            const newSt = e.target.value as any;
                            if (sim.id && onUpdateStatus) {
                              onUpdateStatus(sim.id, newSt);
                            }
                          }}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 border transition focus:outline-none cursor-pointer ${
                            currentStatus === "entregue"
                              ? "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
                              : currentStatus === "em_renegociacao"
                              ? "bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200"
                              : "bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                          }`}
                          title="Alterar status do pipeline deste contrato"
                        >
                          <option value="em_trabalho">🔨 Em Trabalho</option>
                          <option value="em_renegociacao">🤝 Em Renegociação</option>
                          <option value="entregue">✅ Entregue</option>
                          <option value="arquivado">📁 Arquivado</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* O QUE INCLUIR NO DOSSIÊ */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Configuração de Documentos e Módulos do Pacote</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <label className="p-3 border rounded-xl bg-slate-50/80 hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={includeExecutiveReport}
                  onChange={e => setIncludeExecutiveReport(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">Relatório Geral Executivo</div>
                  <div className="text-[11px] text-slate-500">Documento mestre consolidado em HTML/PDF com resumo geral</div>
                </div>
              </label>

              <label className="p-3 border rounded-xl bg-slate-50/80 hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={includeContractData}
                  onChange={e => setIncludeContractData(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">Fatos Geradores & Cédula</div>
                  <div className="text-[11px] text-slate-500">Estrutura técnica e parâmetros originais das cédulas</div>
                </div>
              </label>

              <label className="p-3 border rounded-xl bg-slate-50/80 hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={includeLaudoMcr}
                  onChange={e => setIncludeLaudoMcr(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">Laudo Pericial MCR</div>
                  <div className="text-[11px] text-slate-500">Mapeamento de inconformidades, teto 12% e abusividades</div>
                </div>
              </label>

              <label className="p-3 border rounded-xl bg-slate-50/80 hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={includeMemoriaCalculo}
                  onChange={e => setIncludeMemoriaCalculo(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">Memória de Cálculo (CSV)</div>
                  <div className="text-[11px] text-slate-500">Planilhas auditáveis e fluxos de caixa parcela a parcela</div>
                </div>
              </label>

              <label className="p-3 border rounded-xl bg-slate-50/80 hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={includeBacenSim}
                  onChange={e => setIncludeBacenSim(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">Simulação de Repactuação</div>
                  <div className="text-[11px] text-slate-500">Propostas de reequilíbrio BACEN e economia obtida</div>
                </div>
              </label>

              <label className="p-3 border rounded-xl bg-slate-50/80 hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={includeLegalSources}
                  onChange={e => setIncludeLegalSources(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">Fundamentação & Súmulas</div>
                  <div className="text-[11px] text-slate-500">Citações e links oficiais do STJ, Decreto 22.626/33 e MCR</div>
                </div>
              </label>
            </div>
          </div>

          {/* DADOS DO PERITO & OBSERVAÇÕES DE IDENTIFICAÇÃO */}
          <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Identificação do Perito e Observações do Dossiê</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nome do Perito Responsável</label>
                <input
                  type="text"
                  value={peritoNome}
                  onChange={e => setPeritoNome(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Registro / Qualificação</label>
                <input
                  type="text"
                  value={peritoRegistro}
                  onChange={e => setPeritoRegistro(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Identificador do Dossiê</label>
                <input
                  type="text"
                  value={dossieNumero}
                  onChange={e => setDossieNumero(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Parecer Pericial / Observações Técnicas</label>
              <textarea
                value={observacoesEspecialista}
                onChange={e => setObservacoesEspecialista(e.target.value)}
                rows={2}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <button
            onClick={handleBulkMarkEntregue}
            className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="Marcar todos os contratos selecionados como entregues e concluídos"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Marcar Selecionados como ENTREGUES ✅</span>
          </button>

          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            <button
              onClick={handlePrintOnlyConsolidated}
              className="px-3.5 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-900 font-bold text-xs sm:text-sm rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Visualizar e imprimir apenas a tabela de Resumo Consolidado Único (Paisagem)"
            >
              <Printer className="w-4 h-4 text-emerald-700" />
              <span>Apenas Resumo Consolidado</span>
            </button>

            <button
              onClick={handlePrintDossier}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
              title="Visualizar e imprimir o Dossiê Geral Completo (Resumo + Relatório Técnico + Memória de Cálculo)"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Dossiê Completo (PDF / Impressão)</span>
            </button>

            <button
              onClick={handleDownloadZipPackage}
              disabled={isGenerating}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
            >
              <Download className={`w-4 h-4 ${isGenerating ? "animate-spin text-amber-300" : "text-emerald-200"}`} />
              <span>{isGenerating ? "Gerando Pacote ZIP..." : "Baixar Dossiê Completo (.ZIP)"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
