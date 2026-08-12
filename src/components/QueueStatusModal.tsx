import React, { useState } from "react";
import { 
  X, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  FileText, 
  Cpu, 
  Download, 
  Save, 
  Terminal, 
  ChevronDown, 
  ChevronUp,
  Play
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QueueTaskItem, ProcessingStep } from "../lib/queueService";

interface QueueStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: QueueTaskItem[];
  isProcessing: boolean;
  currentTask: QueueTaskItem | null;
  onRetryTask: (taskId: string, simulationId: string) => Promise<void>;
}

const ALL_STEPS: { key: ProcessingStep; label: string; icon: any }[] = [
  { key: "Iniciando", label: "Iniciando Fila", icon: Play },
  { key: "Baixando", label: "Baixando PDF / Drive", icon: Download },
  { key: "Analisando DDCs", label: "Analisando DDCs", icon: FileText },
  { key: "Analisando com IA", label: "Leitura IA (Gemini)", icon: Cpu },
  { key: "Mesclando Dados", label: "Calculando & Mesclando", icon: Layers },
  { key: "Salvando Resultados", label: "Salvando no Banco", icon: Save },
  { key: "Concluído", label: "Concluído", icon: CheckCircle2 }
];

export const QueueStatusModal: React.FC<QueueStatusModalProps> = ({
  isOpen,
  onClose,
  tasks,
  isProcessing,
  currentTask,
  onRetryTask
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"todas" | "pendentes" | "processando" | "concluidas" | "erros">("todas");

  if (!isOpen) return null;

  const filteredTasks = tasks.filter(t => {
    if (activeTab === "pendentes") return t.status === "pendente";
    if (activeTab === "processando") return t.status === "processando";
    if (activeTab === "concluidas") return t.status === "concluido";
    if (activeTab === "erros") return t.status === "erro";
    return true;
  });

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || currentTask || tasks[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Fila de Processamento em Segundo Plano
                {isProcessing && (
                  <span className="flex items-center gap-1.5 text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                    <RotateCw className="w-3 h-3 animate-spin" /> Trabalhador Ativo
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhe o progresso por etapas e retome execuções de onde pararam.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Panel: Task List */}
          <div className="md:col-span-5 border-r border-slate-800 flex flex-col bg-slate-950/30 overflow-hidden">
            {/* Filter Tabs */}
            <div className="flex border-b border-slate-800 p-2 gap-1 overflow-x-auto text-xs bg-slate-900/40">
              {(["todas", "processando", "pendentes", "concluidas", "erros"] as const).map(tab => {
                const count = tasks.filter(t => {
                  if (tab === "pendentes") return t.status === "pendente";
                  if (tab === "processando") return t.status === "processando";
                  if (tab === "concluidas") return t.status === "concluido";
                  if (tab === "erros") return t.status === "erro";
                  return true;
                }).length;

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition font-medium flex items-center gap-1 whitespace-nowrap ${
                      activeTab === tab
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {tab}
                    <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.2 rounded-full text-slate-300">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Task Items Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  Nenhuma tarefa encontrada na fila.
                </div>
              ) : (
                filteredTasks.map(t => {
                  const isSelected = selectedTask?.id === t.id;
                  const isCurrent = currentTask?.id === t.id;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                        isSelected
                          ? "bg-slate-800/90 border-emerald-500/50 shadow-md"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-200 truncate">
                          Contrato {t.contractNumber}
                        </span>
                        <StatusBadge status={t.status} isCurrent={isCurrent} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="truncate max-w-[180px]">
                          {t.fileName || t.driveFileName || "PDF CPR"}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">
                          {t.currentStep || "Pendente"}
                        </span>
                      </div>

                      {t.errorMessage && (
                        <p className="text-[11px] text-red-400 line-clamp-1 bg-red-950/30 p-1.5 rounded border border-red-900/40">
                          {t.errorMessage}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Step-by-Step Progress & Execution Log */}
          <div className="md:col-span-7 flex flex-col p-6 overflow-y-auto bg-slate-900 space-y-6">
            {selectedTask ? (
              <>
                {/* Task Summary Banner */}
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Contrato CPR: {selectedTask.contractNumber}
                      <span className="text-xs font-normal text-slate-400">
                        (Task ID: {selectedTask.id})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Arquivo: <span className="text-slate-200 font-medium">{selectedTask.fileName || selectedTask.driveFileName || "Documento Local"}</span>
                    </p>
                  </div>

                  {selectedTask.status === "erro" && (
                    <button
                      onClick={() => onRetryTask(selectedTask.id, selectedTask.simulationId)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Retomar da última etapa
                    </button>
                  )}
                </div>

                {/* Step Progress Checklist */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Etapas de Processamento & Retomada
                  </h4>

                  <div className="grid grid-cols-1 gap-2">
                    {ALL_STEPS.map((stepObj, idx) => {
                      const IconComp = stepObj.icon;
                      const isCompleted = selectedTask.completedSteps?.includes(stepObj.key) || 
                        (selectedTask.status === "concluido");
                      const isCurrentStep = selectedTask.currentStep === stepObj.key && selectedTask.status === "processando";
                      const isFailedStep = selectedTask.currentStep === stepObj.key && selectedTask.status === "erro";

                      return (
                        <div
                          key={stepObj.key}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                            isCompleted
                              ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                              : isCurrentStep
                              ? "bg-amber-950/30 border-amber-500/50 text-amber-200 animate-pulse"
                              : isFailedStep
                              ? "bg-red-950/30 border-red-500/40 text-red-300"
                              : "bg-slate-950/30 border-slate-800/80 text-slate-500"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-slate-800 text-slate-300">
                              {idx + 1}
                            </span>
                            <IconComp className="w-4 h-4" />
                            <span className="font-medium">{stepObj.label}</span>
                          </div>

                          <div>
                            {isCompleted && (
                              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-4 h-4" /> Concluído
                              </span>
                            )}
                            {isCurrentStep && (
                              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                                <RotateCw className="w-3.5 h-3.5 animate-spin" /> Em Execução...
                              </span>
                            )}
                            {isFailedStep && (
                              <span className="flex items-center gap-1 text-red-400 font-semibold">
                                <AlertTriangle className="w-4 h-4" /> Interrompido
                              </span>
                            )}
                            {!isCompleted && !isCurrentStep && !isFailedStep && (
                              <span className="text-slate-600">Pendente</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Execution Logs Terminal */}
                <div className="space-y-2">
                  <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Log Detalhado de Execução
                  </h4>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
                    {selectedTask.executionLogs && selectedTask.executionLogs.length > 0 ? (
                      selectedTask.executionLogs.map((log, lIdx) => (
                        <div key={lIdx} className="flex gap-2 hover:bg-slate-900/50 p-1 rounded">
                          <span className="text-slate-500 select-none">
                            {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                          </span>
                          <span className="text-emerald-400 font-bold min-w-[110px]">
                            [{log.step}]
                          </span>
                          <span className="text-slate-200">{log.message}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-600 italic">
                        Aguardando logs de execução em tempo real...
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-slate-500 text-sm">
                Selecione uma tarefa à esquerda para visualizar o histórico detalhado por etapas.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: QueueTaskItem["status"]; isCurrent?: boolean }> = ({ status, isCurrent }) => {
  if (status === "concluido") {
    return (
      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Concluído
      </span>
    );
  }
  if (status === "erro") {
    return (
      <span className="bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Erro
      </span>
    );
  }
  if (status === "processando" || isCurrent) {
    return (
      <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1">
        <RotateCw className="w-3 h-3 animate-spin" /> Em Fila
      </span>
    );
  }
  return (
    <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
      <Clock className="w-3 h-3" /> Pendente
    </span>
  );
};
