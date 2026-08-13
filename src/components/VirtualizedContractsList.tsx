import React, { useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { 
  FileText, 
  FolderOpen, 
  ShieldCheck, 
  CheckCircle2, 
  PowerOff, 
  Trash2, 
  UserCheck, 
  Plus, 
  Eye, 
  Sparkles, 
  Scale,
  FileCheck2,
  Building2,
  User,
  AlertTriangle,
  AlertCircle
} from "lucide-react";
import { McrAuditBadge } from "./McrAuditBadge";

interface AssociatedDocument {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  fileName?: string;
  notes?: string;
  fileData?: string;
}

interface AuditLogEntry {
  id?: string;
  action: string;
  details: string;
  timestamp: string;
  userName: string;
  userEmail: string;
}

interface VirtualizedContractsListProps {
  items: any[];
  viewMode: "table" | "cards";
  expandedDocsSimId: string | null;
  setExpandedDocsSimId: (id: string | null) => void;
  newDocForm: any;
  setNewDocForm: (form: any) => void;
  analyzingDocId: string | null;
  user: any;
  formatCurrency: (val: number) => string;
  formatPercentage: (val: number) => string;
  onLoadToSimulator: (sim: any) => void;
  onOpenComparativo?: (sim: any) => void;
  onToggleStatus: (simId: string, currentStatus: boolean) => void;
  onRemoveSimulation: (simId: string) => void;
  onSetViewingDocument: (docItem: any) => void;
  onAnalyzeAndFill: (simId: string, docItem: any) => void;
  onDeleteAssociatedDoc: (simId: string, docId: string) => void;
  renderAttachDocumentForm: (simId: string) => React.ReactNode;
}

export const VirtualizedContractsList = React.memo(function VirtualizedContractsList({
  items,
  viewMode,
  expandedDocsSimId,
  setExpandedDocsSimId,
  newDocForm,
  setNewDocForm,
  analyzingDocId,
  user,
  formatCurrency,
  formatPercentage,
  onLoadToSimulator,
  onOpenComparativo,
  onToggleStatus,
  onRemoveSimulation,
  onSetViewingDocument,
  onAnalyzeAndFill,
  onDeleteAssociatedDoc,
  renderAttachDocumentForm
}: VirtualizedContractsListProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  // Responsive items per row detection for Cards View
  const [itemsPerRow, setItemsPerRow] = useState<number>(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return 2;
    return 1;
  });

  useEffect(() => {
    const handleResize = () => {
      setItemsPerRow(window.innerWidth >= 768 ? 2 : 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Table Virtualizer
  const tableVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 72,
    overscan: 6,
  });

  // Cards Virtualizer
  const cardRowsCount = Math.ceil(items.length / itemsPerRow);
  const cardsVirtualizer = useVirtualizer({
    count: cardRowsCount,
    getScrollElement: () => cardsContainerRef.current,
    estimateSize: () => 240,
    overscan: 5,
  });

  // Open Document Viewer for the Main Contract (Cédula/CPR)
  const handleOpenContractViewer = (sim: any) => {
    const cData = sim.contractData || sim.contrato;
    const principalDoc = sim.contractFile || sim.associatedDocuments?.find((d: any) => 
      d.type?.toLowerCase().includes("cédula") || 
      d.type?.toLowerCase().includes("contrato principal")
    );

    if (principalDoc) {
      onSetViewingDocument({
        ...principalDoc,
        contratoData: cData
      });
    } else {
      onSetViewingDocument({
        id: `contract_doc_${sim.id}`,
        name: `Cédula de Crédito / Contrato Original - Nº ${cData?.numero || "S/N"}`,
        type: cData?.modalidade || "Cédula de Crédito Rural (Contrato Principal)",
        uploadDate: sim.createdAt || new Date().toISOString(),
        fileName: `Contrato_${cData?.numero || "Original"}.pdf`,
        notes: `Cédula Mestre do contrato de crédito rural emitido para ${cData?.emitente || "Produtor Rural"}.`,
        contratoData: cData
      });
    }
  };

  if (items.length === 0) {
    return null;
  }

  if (viewMode === "table") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div 
          ref={tableContainerRef} 
          className="max-h-[640px] overflow-y-auto overflow-x-auto relative scrollbar-thin scrollbar-thumb-slate-200"
        >
          <div className="min-w-[900px]">
            {/* Sticky Table Header */}
            <div className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center shadow-2xs">
              <div className="p-3 w-[18%] shrink-0">Nº Contrato / Nome</div>
              <div className="p-3 w-[16%] shrink-0">Emitente & Credor</div>
              <div className="p-3 w-[12%] shrink-0 text-right">Valor Principal</div>
              <div className="p-3 w-[14%] shrink-0">Taxa do Contrato</div>
              <div className="p-3 w-[15%] shrink-0">Taxa / Indexador MCR</div>
              <div className="p-3 w-[12%] shrink-0">Cadastrado por</div>
              <div className="p-3 w-[13%] shrink-0 text-center">Ações</div>
            </div>

            {/* Virtualized Container */}
            <div 
              style={{ 
                height: `${tableVirtualizer.getTotalSize()}px`, 
                width: "100%", 
                position: "relative" 
              }}
            >
              {tableVirtualizer.getVirtualItems().map((virtualRow) => {
                const sim = items[virtualRow.index];
                if (!sim) return null;

                const cData = sim.contractData || sim.contrato;
                const isDocsExpanded = expandedDocsSimId === sim.id;
                const isLogsExpanded = expandedDocsSimId === `${sim.id}_logs`;
                const hasLogs = sim.auditLogs && sim.auditLogs.length > 0;

                const indexador = (cData?.indexadorOriginal || (cData as any)?.indexador || "").toString().toUpperCase();
                const isCdiOrFlutuante = indexador.includes("CDI") || indexador.includes("SELIC") || indexador.includes("FLUTUANTE") || indexador.includes("VARIAVEL");
                const taxaJuros = cData?.taxaJurosAnual || 0;
                const isTaxaElevada = taxaJuros > 12.0;
                const taxaMCR = isTaxaElevada ? 12.0 : taxaJuros;
                const indexadorMCR = isCdiOrFlutuante ? "INPC" : (cData?.indexadorOriginal || "INPC");
                const excessoTaxa = Math.max(0, taxaJuros - 12.0);

                const isDesvioMcr = isCdiOrFlutuante || isTaxaElevada;
                const detailedMcrTooltipCard = [
                  `=== CÁLCULO NORMATIVO MCR ===`,
                  `• Teto Legal MCR: 12,00% a.a. (Decreto 22.626/33 - Lei de Usura / Súmula 288 STJ)`,
                  `• Taxa Pactuada no Contrato: ${taxaJuros.toFixed(2)}% a.a.`,
                  `• Taxa MCR Recalculada: ${taxaMCR.toFixed(2)}% a.a. ${isTaxaElevada ? `(Redução de -${excessoTaxa.toFixed(2)}% a.a. pelo teto de 12%)` : '(Mantida taxa contratada de acordo com o teto de 12,00% a.a.)'}`,
                  `• Indexador do Contrato: ${cData?.indexadorOriginal || 'INPC'}`,
                  `• Indexador MCR Aplicado: ${indexadorMCR} ${isCdiOrFlutuante ? '(VEDADO: Indexador flutuante substituído por INPC - Súmula 176 STJ)' : '(Indexador conforme)'}`,
                  `• Resultado Final MCR: ${taxaMCR.toFixed(2)}% a.a. + ${indexadorMCR}`,
                  `• Status de Auditoria: ${isDesvioMcr ? '⚠️ DESVIO IDENTIFICADO (Requer adequação contratual)' : '✅ CONFORME REGRAMENTO MCR'}`
                ].join('\n');

                return (
                  <div
                    key={sim.id || virtualRow.index}
                    data-index={virtualRow.index}
                    ref={tableVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full border-b border-slate-100 hover:bg-slate-50/90 transition-colors"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="flex items-center text-xs py-2">
                      <div className="p-3 w-[18%] shrink-0 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm truncate">{sim.name}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px] border border-emerald-200 shrink-0">
                            v{sim.version || 1}
                          </span>
                          {(sim.statusPipeline || cData?.statusPipeline) === 'entregue' ? (
                            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded font-bold text-[10px] border border-emerald-300 shrink-0" title="Trabalho de perícia entregue ao cliente">
                              ✅ Entregue
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold text-[10px] border border-amber-300 shrink-0" title="Contrato em elaboração/trabalho">
                              🔨 Em Trabalho
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                          Nº {cData?.numero || "S/N"}
                        </div>
                      </div>

                      <div className="p-3 w-[16%] shrink-0 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{cData?.emitente || "Não informado"}</div>
                        <div className="text-[11px] text-slate-500 truncate">Credor: {cData?.credor || "—"}</div>
                      </div>

                      <div className="p-3 w-[12%] shrink-0 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatCurrency(cData?.valorPrincipal || 0)}
                      </div>

                      {/* COLUNA 1: TAXA DO CONTRATO */}
                      <div className="p-3 w-[14%] shrink-0">
                        <div className="font-bold text-slate-900 text-xs">
                          {formatPercentage(taxaJuros)} a.a.
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          ({cData?.indexadorOriginal || "INPC"})
                        </div>
                      </div>

                      {/* COLUNA 2: TAXA / INDEXADOR MCR */}
                      <div className="p-3 w-[15%] shrink-0">
                        <div 
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono font-semibold border transition cursor-help ${
                            isDesvioMcr 
                              ? "bg-amber-50 text-amber-950 border-amber-300 hover:bg-amber-100 hover:border-amber-400 shadow-2xs" 
                              : "bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100"
                          }`}
                          title={detailedMcrTooltipCard}
                        >
                          <div>
                            <span className={isDesvioMcr ? "font-bold text-amber-950 text-xs block" : "font-bold text-emerald-800 text-xs block"}>
                              {formatPercentage(taxaMCR)} a.a.
                            </span>
                            <span className={isDesvioMcr ? "text-[10px] text-amber-800 font-semibold block" : "text-[10px] text-emerald-700 font-semibold block"}>
                              ({indexadorMCR})
                            </span>
                          </div>
                          {isDesvioMcr ? (
                            <span className="inline-flex items-center text-amber-700 bg-amber-200/70 p-1 rounded">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-700 bg-emerald-100 p-1 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* COLUNA: CADASTRADO POR */}
                      <div className="p-3 w-[12%] shrink-0 min-w-0">
                        <div className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{sim.createdByName || sim.createdByEmail || user?.displayName || user?.email || "Fernando Gomes Santos"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(sim.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      {/* COLUNA: AÇÕES */}
                      <div className="p-3 w-[13%] shrink-0">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* Dedicated Main Contract Viewer Button */}
                          <button 
                            onClick={() => handleOpenContractViewer(sim)}
                            className="px-2 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Ver Cédula de Crédito / Contrato Original"
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-emerald-200"/>
                            <span>Ver Contrato</span>
                          </button>

                          <button 
                            onClick={() => onLoadToSimulator(sim)}
                            className="px-2 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Carregar no Simulador"
                          >
                            <FileText className="w-3.5 h-3.5"/>
                            <span>Simular</span>
                          </button>

                          {onOpenComparativo && (
                            <button
                              onClick={() => onOpenComparativo(sim)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Comparar Cenários (MCR vs Banco)"
                            >
                              <Scale className="w-3.5 h-3.5 text-emerald-600" />
                            </button>
                          )}

                          <button
                            onClick={() => setExpandedDocsSimId(isDocsExpanded ? null : sim.id)}
                            className={`px-1.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer border ${isDocsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                            title="Documentos Auxiliares do Banco"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            ({sim.associatedDocuments?.length || 0})
                          </button>

                          <button
                            onClick={() => setExpandedDocsSimId(isLogsExpanded ? null : `${sim.id}_logs`)}
                            className={`px-1.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer border ${isLogsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                            title="Logs de Operação"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSimulation(sim.id);
                            }}
                            className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Excluir Contrato Permanentemente"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table View Expanded Panel */}
                    {(isDocsExpanded || isLogsExpanded) && (
                      <div className="p-4 bg-slate-50/90 border-t border-slate-200 space-y-4">
                        {isDocsExpanded && (
                          <div className="space-y-4">
                            {/* Section 01: Contrato Principal / Cédula Base */}
                            <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                                    01. Contrato Principal (Cédula / CPR Mestre)
                                  </h4>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                                  Contrato Nº {cData?.numero || "S/N"}
                                </span>
                              </div>
                              <div className="bg-white p-3 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-900">{cData?.modalidade || "Cédula de Crédito Rural"} - Nº {cData?.numero || "S/N"}</p>
                                  <p className="text-[11px] text-slate-600">
                                    Emitente: <strong>{cData?.emitente || "—"}</strong> | Credor: <strong>{cData?.credor || "—"}</strong> | Valor: <strong>{formatCurrency(cData?.valorPrincipal || 0)}</strong>
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleOpenContractViewer(sim)}
                                    className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> Abrir Cédula Original / Digital
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Section 02: Documentos Auxiliares do Banco */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                                  02. Documentos Auxiliares do Banco (Extratos, DDC, Planilhas)
                                </h4>
                                <button
                                  onClick={() => setNewDocForm(newDocForm?.simId === sim.id ? null : { simId: sim.id, name: "", type: "Demonstrativo de Saldo Devedor", notes: "", fileName: "" })}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" /> Anexar Documento Auxiliar
                                </button>
                              </div>

                              {renderAttachDocumentForm(sim.id)}

                              <div className="space-y-2">
                                {sim.associatedDocuments && sim.associatedDocuments.length > 0 ? (
                                  sim.associatedDocuments.map((docItem: AssociatedDocument) => (
                                    <div key={docItem.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                                          <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-800">{docItem.name}</p>
                                          <p className="text-[10px] text-slate-400">{docItem.type} • {new Date(docItem.uploadDate).toLocaleDateString("pt-BR")}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button 
                                          onClick={() => onSetViewingDocument(docItem)}
                                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3.5 h-3.5" /> Abrir
                                        </button>
                                        <button 
                                          onClick={() => onAnalyzeAndFill(sim.id, docItem)}
                                          disabled={analyzingDocId === docItem.id}
                                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                        >
                                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                          {analyzingDocId === docItem.id ? "Extraindo..." : "Extrair IA"}
                                        </button>
                                        <button onClick={() => onDeleteAssociatedDoc(sim.id, docItem.id)} className="text-slate-400 hover:text-red-500 p-1.5 cursor-pointer hover:bg-red-50 rounded-lg transition">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-slate-400 text-xs italic bg-white p-3 rounded-xl border border-slate-200">
                                    Nenhum documento auxiliar anexado. Clique em "Anexar Documento Auxiliar" para adicionar extratos ou DDCs.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {isLogsExpanded && (
                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Logs de Alteração & Operador
                            </h4>
                            <div className="space-y-2">
                              {hasLogs ? (
                                sim.auditLogs.map((log: AuditLogEntry, idx: number) => (
                                  <div key={log.id || idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                                    <div className="flex justify-between items-center font-bold text-slate-800">
                                      <span>{log.action}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleDateString("pt-BR")}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-0.5">{log.details}</p>
                                    <div className="text-[10px] text-emerald-700 font-semibold mt-1">Por: {log.userName} ({log.userEmail})</div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-400 text-xs italic bg-white p-2.5 rounded-xl border border-slate-200">Nenhum log cadastrado.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Cards View Mode
  return (
    <div ref={cardsContainerRef} className="max-h-[640px] overflow-y-auto pr-1">
      <div 
        style={{ 
          height: `${cardsVirtualizer.getTotalSize()}px`, 
          width: "100%", 
          position: "relative" 
        }}
      >
        {cardsVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * itemsPerRow;
          const rowSims = items.slice(startIndex, startIndex + itemsPerRow);

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={cardsVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full grid grid-cols-1 md:grid-cols-2 gap-4 pb-4"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowSims.map((sim) => {
                const cData = sim.contractData || sim.contrato;
                const isDocsExpanded = expandedDocsSimId === sim.id;
                const isLogsExpanded = expandedDocsSimId === `${sim.id}_logs`;
                const hasLogs = sim.auditLogs && sim.auditLogs.length > 0;

                const indexador = (cData?.indexadorOriginal || (cData as any)?.indexador || "").toString().toUpperCase();
                const isCdiOrFlutuante = indexador.includes("CDI") || indexador.includes("SELIC") || indexador.includes("FLUTUANTE") || indexador.includes("VARIAVEL");
                const taxaJuros = cData?.taxaJurosAnual || 0;
                const isTaxaElevada = taxaJuros > 12.0;
                const taxaMCRCard = isTaxaElevada ? 12.0 : taxaJuros;
                const indexadorMCRCard = isCdiOrFlutuante ? "INPC" : (cData?.indexadorOriginal || "INPC");

                return (
                  <div key={sim.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-base">{sim.name}</h3>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold text-[10px] border border-emerald-200">
                            v{sim.version || 1}
                          </span>
                          {(sim.statusPipeline || cData?.statusPipeline) === 'entregue' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-bold text-[10px] border border-emerald-300">
                              ✅ Entregue
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[10px] border border-amber-300">
                              🔨 Em Trabalho
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">Nº Contrato: {cData?.numero || "S/N"}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-semibold uppercase block">Valor Principal</span>
                        <span className="text-base font-bold text-slate-900 font-mono">{formatCurrency(cData?.valorPrincipal || 0)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Emitente</span>
                        <span className="font-bold text-slate-800 truncate block">{cData?.emitente || "Não informado"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Credor</span>
                        <span className="font-bold text-slate-800 truncate block">{cData?.credor || "—"}</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">Taxa do Contrato</span>
                        <span className="font-bold text-slate-900 block">{formatPercentage(cData?.taxaJurosAnual || 0)} a.a. ({cData?.indexadorOriginal || "INPC"})</span>
                      </div>
                      <div className="mt-1">
                        <span className="text-slate-500 text-[10px] uppercase font-bold block">Taxa / Indexador MCR</span>
                        {isCdiOrFlutuante || isTaxaElevada ? (
                          <span className="font-bold text-rose-700 block">{formatPercentage(taxaMCRCard)} a.a. ({indexadorMCRCard})</span>
                        ) : (
                          <span className="font-bold text-emerald-700 block">{formatPercentage(cData?.taxaJurosAnual || 0)} a.a. ({cData?.indexadorOriginal || "INPC"})</span>
                        )}
                      </div>
                      <div className="col-span-2 mt-1 pt-2 border-t border-slate-200">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Cadastrado Por</span>
                        <span className="font-semibold text-slate-800 truncate block">{sim.createdByName || sim.createdByEmail || user?.displayName || user?.email || "Fernando Gomes Santos"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <button
                        onClick={() => handleOpenContractViewer(sim)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-200" /> Ver Contrato
                      </button>

                      <button
                        onClick={() => onLoadToSimulator(sim)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" /> Simulador
                      </button>

                      <button
                        onClick={() => setExpandedDocsSimId(isDocsExpanded ? null : sim.id)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer border ${isDocsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Docs ({sim.associatedDocuments?.length || 0})
                      </button>

                      <button
                        onClick={() => setExpandedDocsSimId(isLogsExpanded ? null : `${sim.id}_logs`)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer border ${isLogsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Logs ({hasLogs ? sim.auditLogs.length : 0})
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSimulation(sim.id);
                        }}
                        className="ml-auto px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>

                    {/* CARDS VIEW EXPANDED PANELS */}
                    {(isDocsExpanded || isLogsExpanded) && (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        {isDocsExpanded && (
                          <div className="space-y-3">
                            <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-emerald-950 text-xs uppercase tracking-wider flex items-center gap-1">
                                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-700" /> Contrato Principal
                                </span>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                  Nº {cData?.numero || "S/N"}
                                </span>
                              </div>
                              <button
                                onClick={() => handleOpenContractViewer(sim)}
                                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" /> Abrir Cédula / Contrato Original
                              </button>
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                                  <FolderOpen className="w-3.5 h-3.5 text-emerald-600" /> Documentos Auxiliares
                                </h4>
                                <button
                                  onClick={() => setNewDocForm(newDocForm?.simId === sim.id ? null : { simId: sim.id, name: "", type: "Demonstrativo de Saldo Devedor", notes: "", fileName: "" })}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" /> Anexar
                                </button>
                              </div>

                              {renderAttachDocumentForm(sim.id)}

                              <div className="space-y-2">
                                {sim.associatedDocuments && sim.associatedDocuments.length > 0 ? (
                                  sim.associatedDocuments.map((docItem: AssociatedDocument) => (
                                    <div key={docItem.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                          <FileText className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 truncate">{docItem.name}</p>
                                          <p className="text-[10px] text-slate-400">{docItem.type} • {new Date(docItem.uploadDate).toLocaleDateString("pt-BR")}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button 
                                          onClick={() => onSetViewingDocument(docItem)}
                                          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-slate-200 text-[11px] transition flex items-center gap-1 cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3" /> Abrir
                                        </button>
                                        <button 
                                          onClick={() => onAnalyzeAndFill(sim.id, docItem)}
                                          disabled={analyzingDocId === docItem.id}
                                          className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg text-[11px] transition flex items-center gap-1 cursor-pointer border border-teal-200 disabled:opacity-50"
                                        >
                                          <Sparkles className="w-3 h-3 text-amber-500" />
                                          {analyzingDocId === docItem.id ? "Extraindo..." : "Extrair IA"}
                                        </button>
                                        <button onClick={() => onDeleteAssociatedDoc(sim.id, docItem.id)} className="text-slate-400 hover:text-red-500 p-1 cursor-pointer hover:bg-red-50 rounded-lg transition">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-slate-400 text-xs italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">Nenhum documento do banco anexado.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {isLogsExpanded && (
                          <div className="space-y-2">
                            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Logs de Alteração & Operador
                            </h4>
                            <div className="space-y-2">
                              {hasLogs ? (
                                sim.auditLogs.map((log: AuditLogEntry, idx: number) => (
                                  <div key={log.id || idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                                    <div className="flex justify-between items-center font-bold text-slate-800">
                                      <span>{log.action}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">{new Date(log.timestamp).toLocaleDateString("pt-BR")}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-0.5">{log.details}</p>
                                    <div className="text-[10px] text-emerald-700 font-semibold mt-1">Por: {log.userName} ({log.userEmail})</div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-400 text-xs italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">Nenhum log cadastrado.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
