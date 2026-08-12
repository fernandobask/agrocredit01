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
  ChevronDown, 
  ChevronUp 
} from "lucide-react";

interface AssociatedDocument {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  fileName?: string;
  notes?: string;
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
  onToggleStatus: (simId: string, currentStatus: boolean) => void;
  onRemoveSimulation: (simId: string) => void;
  onSetViewingDocument: (docItem: any) => void;
  onAnalyzeAndFill: (simId: string, docItem: any) => void;
  onDeleteAssociatedDoc: (simId: string, docId: string) => void;
  renderAttachDocumentForm: (simId: string) => React.ReactNode;
}

export const VirtualizedContractsList: React.FC<VirtualizedContractsListProps> = ({
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
  onToggleStatus,
  onRemoveSimulation,
  onSetViewingDocument,
  onAnalyzeAndFill,
  onDeleteAssociatedDoc,
  renderAttachDocumentForm
}) => {
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
              <div className="p-3 w-[24%] shrink-0">Nº Contrato / Nome</div>
              <div className="p-3 w-[22%] shrink-0">Emitente & Credor</div>
              <div className="p-3 w-[15%] shrink-0 text-right">Valor Principal</div>
              <div className="p-3 w-[14%] shrink-0">Taxa & Indexador</div>
              <div className="p-3 w-[13%] shrink-0">Cadastrado por</div>
              <div className="p-3 w-[12%] shrink-0 text-center">Ações</div>
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
                const isHistoryExpanded = expandedDocsSimId === `${sim.id}_history`;
                const isLogsExpanded = expandedDocsSimId === `${sim.id}_logs`;
                const hasLogs = sim.auditLogs && sim.auditLogs.length > 0;

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
                      <div className="p-3 w-[24%] shrink-0 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm truncate">{sim.name}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px] border border-emerald-200 shrink-0">
                            v{sim.version || 1}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                          Nº {cData?.numero || "S/N"}
                        </div>
                      </div>

                      <div className="p-3 w-[22%] shrink-0 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{cData?.emitente || "Não informado"}</div>
                        <div className="text-[11px] text-slate-500 truncate">Credor: {cData?.credor || "—"}</div>
                      </div>

                      <div className="p-3 w-[15%] shrink-0 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatCurrency(cData?.valorPrincipal || 0)}
                      </div>

                      <div className="p-3 w-[14%] shrink-0">
                        <div className="font-semibold text-slate-800">{formatPercentage(cData?.taxaJurosAnual || 0)}</div>
                        <div className="text-[11px] text-slate-500 truncate">Ind: {cData?.indexadorOriginal || "INPC"}</div>
                      </div>

                      <div className="p-3 w-[13%] shrink-0 min-w-0">
                        <div className="font-semibold text-slate-800 flex items-center gap-1 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{sim.createdByName || sim.createdByEmail || "Analista"}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(sim.createdAt).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      <div className="p-3 w-[12%] shrink-0">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => onLoadToSimulator(sim)}
                            className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Carregar no Simulador"
                          >
                            <FileText className="w-3.5 h-3.5"/> Simulador
                          </button>
                          <button
                            onClick={() => setExpandedDocsSimId(isDocsExpanded ? null : sim.id)}
                            className={`px-1.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 cursor-pointer border ${isDocsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                            title="Documentos Auxiliares"
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
                            ({hasLogs ? sim.auditLogs.length : 0})
                          </button>
                          <button
                            onClick={() => onToggleStatus(sim.id, sim.ativo !== false)}
                            className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border ${
                              sim.ativo !== false
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                            }`}
                            title={sim.ativo !== false ? "Ativo" : "Inativo"}
                          >
                            {sim.ativo !== false ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <PowerOff className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </button>
                          <button
                            onClick={() => onRemoveSimulation(sim.id)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table View Expanded Panel */}
                    {(isDocsExpanded || isLogsExpanded) && (
                      <div className="p-4 bg-slate-50/90 border-t border-slate-200">
                        {isDocsExpanded && (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                                <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                                Documentos Auxiliares do Banco
                              </h4>
                              <button
                                onClick={() => setNewDocForm(newDocForm?.simId === sim.id ? null : { simId: sim.id, name: "", type: "Demonstrativo de Saldo Devedor", notes: "", fileName: "" })}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Anexar Documento
                              </button>
                            </div>

                            {renderAttachDocumentForm(sim.id)}

                            <div className="space-y-2">
                              {sim.associatedDocuments && sim.associatedDocuments.length > 0 ? (
                                sim.associatedDocuments.map((docItem: AssociatedDocument) => (
                                  <div key={docItem.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-emerald-600" />
                                      <div>
                                        <p className="font-bold text-slate-800">{docItem.name}</p>
                                        <p className="text-[10px] text-slate-400">{docItem.type} • {new Date(docItem.uploadDate).toLocaleDateString()}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        onClick={() => onSetViewingDocument(docItem)}
                                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" /> Abrir
                                      </button>
                                      <button 
                                        onClick={() => onAnalyzeAndFill(sim.id, docItem)}
                                        disabled={analyzingDocId === docItem.id}
                                        className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        {analyzingDocId === docItem.id ? "Analisando..." : "Extrair IA"}
                                      </button>
                                      <button onClick={() => onDeleteAssociatedDoc(sim.id, docItem.id)} className="text-slate-400 hover:text-red-500 p-1 cursor-pointer">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-400 text-xs italic">Nenhum documento anexado.</p>
                              )}
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
                                <p className="text-slate-400 text-xs italic">Nenhum log cadastrado.</p>
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

  // CARDS VIEW MODE
  return (
    <div 
      ref={cardsContainerRef} 
      className="max-h-[680px] overflow-y-auto pr-1 relative scrollbar-thin scrollbar-thumb-slate-200"
    >
      <div 
        style={{ 
          height: `${cardsVirtualizer.getTotalSize()}px`, 
          width: "100%", 
          position: "relative" 
        }}
      >
        {cardsVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * itemsPerRow;
          const rowItems = items.slice(startIndex, startIndex + itemsPerRow);

          return (
            <div
              key={virtualRow.index}
              data-index={virtualRow.index}
              ref={cardsVirtualizer.measureElement}
              className="absolute top-0 left-0 w-full pb-4"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {rowItems.map((sim) => {
                  const cData = sim.contractData || sim.contrato;
                  const isDocsExpanded = expandedDocsSimId === sim.id;
                  const isLogsExpanded = expandedDocsSimId === `${sim.id}_logs`;
                  const hasLogs = sim.auditLogs && sim.auditLogs.length > 0;

                  return (
                    <div 
                      key={sim.id} 
                      className={`p-4 border rounded-xl hover:border-emerald-300 transition-all flex flex-col gap-3 bg-white ${
                        (isDocsExpanded || isLogsExpanded) ? 'border-emerald-400 shadow-md col-span-1 md:col-span-2' : 'border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 w-full">
                        <div className="space-y-1 min-w-0 w-full sm:w-auto">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="font-bold text-slate-800 text-sm md:text-base break-words">{sim.name}</span>
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px] uppercase tracking-wider border border-emerald-200 shrink-0">
                              v{sim.version || 1}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Criado em: {new Date(sim.createdAt).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded shrink-0 self-start sm:self-auto">
                          Nº {cData?.numero || "S/N"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-600 w-full">
                        <div><strong>Emitente:</strong> <span className="text-slate-800 font-medium break-words">{cData?.emitente || "Não informado"}</span></div>
                        <div><strong>Credor:</strong> <span className="text-slate-800 font-medium break-words">{cData?.credor || "Não informado"}</span></div>
                        <div><strong>Principal:</strong> <span className="text-slate-800 font-medium">{formatCurrency(cData?.valorPrincipal || 0)}</span></div>
                        <div><strong>Taxa Original:</strong> <span className="text-slate-800 font-medium">{formatPercentage(cData?.taxaJurosAnual || 0)} + {cData?.indexadorOriginal || "INPC"}</span></div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/60 w-full min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Cadastrado por: <strong className="text-slate-800 font-bold">{sim.createdByName || sim.createdByEmail || "Analista"}</strong></span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 w-full">
                        <button 
                          onClick={() => onLoadToSimulator(sim)}
                          className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5"/> Carregar Simulador
                        </button>
                        <button
                          onClick={() => setExpandedDocsSimId(isDocsExpanded ? null : sim.id)}
                          className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer border ${isDocsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Documentos ({sim.associatedDocuments?.length || 0})
                        </button>
                        <button
                          onClick={() => setExpandedDocsSimId(isLogsExpanded ? null : `${sim.id}_logs`)}
                          className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer border ${isLogsExpanded ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Logs ({hasLogs ? sim.auditLogs.length : 0})
                        </button>
                        <button
                          onClick={() => onToggleStatus(sim.id, sim.ativo !== false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                            sim.ativo !== false
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                          }`}
                          title={sim.ativo !== false ? "Contrato Ativo" : "Contrato Inativo"}
                        >
                          {sim.ativo !== false ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Ativo</span>
                            </>
                          ) : (
                            <>
                              <PowerOff className="w-3.5 h-3.5 text-amber-500" />
                              <span>Inativo</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => onRemoveSimulation(sim.id)}
                          className="ml-auto p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* CARDS VIEW EXPANDED PANELS */}
                      {(isDocsExpanded || isLogsExpanded) && (
                        <div className="pt-3 border-t border-slate-100 space-y-3">
                          {isDocsExpanded && (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                                  <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                                  Documentos Auxiliares do Banco
                                </h4>
                                <button
                                  onClick={() => setNewDocForm(newDocForm?.simId === sim.id ? null : { simId: sim.id, name: "", type: "Demonstrativo de Saldo Devedor", notes: "", fileName: "" })}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" /> Anexar Documento do Banco
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
