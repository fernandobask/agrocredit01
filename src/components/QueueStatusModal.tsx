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
  Play,
  Maximize2,
  Minimize2
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
  const [isMaximized, setIsMaximized] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className={`bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isMaximized 
            ? "fixed inset-0 w-full h-full rounded-none max-w-none max-h-none h-full" 
            : "w-full max-w-7xl max-h-[92vh]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl border border-emerald-300 text-emerald-800">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                Fila de Processamento em Segundo Plano
                {isProcessing && (
                  <span className="flex items-center gap-1.5 text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300 font-bold animate-pulse">
                    <RotateCw className="w-3 h-3 animate-spin text-emerald-700" /> Trabalhador Ativo
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe o progresso por etapas e retome execuções de onde pararam.
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

        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden bg-white">
          {/* Left Panel: Task List */}
          <div className="md:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50/60 overflow-hidden">
            {/* Filter Tabs */}
            <div className="flex border-b border-slate-200 p-2.5 gap-1.5 overflow-x-auto text-xs sm:text-sm bg-white shrink-0">
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
                    className={`px-3 py-1.5 rounded-xl capitalize transition font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      activeTab === tab
                        ? "bg-emerald-700 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                    <span className={`text-xs px-2 py-0.2 rounded-full font-bold ${
                      activeTab === tab ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Task Items Scrollable */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
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
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                        isSelected
                          ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/20 shadow-xs"
                          : "bg-white hover:bg-slate-100/80 border-slate-200/90 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          Contrato {t.contractNumber}
                        </span>
                        <StatusBadge status={t.status} isCurrent={isCurrent} />
                      </div>

                      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
                        <span className="truncate max-w-[180px]">
                          {t.fileName || t.driveFileName || "PDF CPR"}
                        </span>
                        <span className="text-xs text-emerald-700 font-semibold">
                          {t.currentStep || "Pendente"}
                        </span>
                      </div>

                      {t.errorMessage && (
                        <p className="text-xs text-rose-700 line-clamp-2 bg-rose-50 p-2 rounded-lg border border-rose-200 leading-relaxed font-medium">
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
          <div className="md:col-span-7 flex flex-col p-6 overflow-y-auto bg-white space-y-6">
            {selectedTask ? (
              <>
                {/* Task Summary Banner */}
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      Contrato CPR: {selectedTask.contractNumber}
                      <span className="text-xs font-normal text-slate-500">
                        (Task ID: {selectedTask.id})
                      </span>
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">
                      Arquivo: <span className="text-slate-900 font-semibold">{selectedTask.fileName || selectedTask.driveFileName || "Documento Local"}</span>
                    </p>
                  </div>

                  {selectedTask.status === "erro" && (
                    <button
                      onClick={() => onRetryTask(selectedTask.id, selectedTask.simulationId)}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <RotateCw className="w-4 h-4" /> Retomar da última etapa
                    </button>
                  )}
                </div>

                {/* Step Progress Checklist */}
                <div className="space-y-3">
                  <h4 className="text-xs sm:text-sm uppercase tracking-wider text-slate-700 font-bold flex items-center gap-2">
                    <Layers className="w-4.5 h-4.5 text-emerald-700" />
                    Etapas de Processamento & Retomada
                  </h4>

                  <div className="grid grid-cols-1 gap-2.5">
                    {ALL_STEPS.map((stepObj, idx) => {
                      const IconComp = stepObj.icon;
                      const isCompleted = selectedTask.completedSteps?.includes(stepObj.key) || 
                        (selectedTask.status === "concluido");
                      const isCurrentStep = selectedTask.currentStep === stepObj.key && selectedTask.status === "processando";
                      const isFailedStep = selectedTask.currentStep === stepObj.key && selectedTask.status === "erro";

                      return (
                        <div
                          key={stepObj.key}
                          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition ${
                            isCompleted
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium"
                              : isCurrentStep
                              ? "bg-amber-50 border-amber-400 text-amber-950 animate-pulse font-semibold"
                              : isFailedStep
                              ? "bg-rose-50 border-rose-300 text-rose-950 font-medium"
                              : "bg-slate-50 border-slate-200 text-slate-500"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-slate-200 text-slate-800">
                              {idx + 1}
                            </span>
                            <IconComp className="w-4.5 h-4.5 shrink-0" />
                            <span className="font-semibold text-slate-900">{stepObj.label}</span>
                          </div>

                          <div>
                            {isCompleted && (
                              <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                                <CheckCircle2 className="w-4 h-4" /> Concluído
                              </span>
                            )}
                            {isCurrentStep && (
                              <span className="flex items-center gap-1.5 text-amber-800 font-bold">
                                <RotateCw className="w-4 h-4 animate-spin" /> Em Execução...
                              </span>
                            )}
                            {isFailedStep && (
                              <span className="flex items-center gap-1.5 text-rose-800 font-bold">
                                <AlertTriangle className="w-4 h-4" /> Interrompido
                              </span>
                            )}
                            {!isCompleted && !isCurrentStep && !isFailedStep && (
                              <span className="text-slate-500 font-medium">Pendente</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Execution Logs Terminal */}
                <div className="space-y-2">
                  <h4 className="text-xs sm:text-sm uppercase tracking-wider text-slate-700 font-bold flex items-center gap-2">
                    <Terminal className="w-4.5 h-4.5 text-slate-700" />
                    Log Detalhado de Execução
                  </h4>

                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 max-h-52 overflow-y-auto space-y-1.5 shadow-inner">
                    {selectedTask.executionLogs && selectedTask.executionLogs.length > 0 ? (
                      selectedTask.executionLogs.map((log, lIdx) => (
                        <div key={lIdx} className="flex gap-2.5 hover:bg-slate-800/60 p-1 rounded">
                          <span className="text-slate-400 select-none">
                            {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                          </span>
                          <span className="text-emerald-400 font-semibold shrink-0">
                            [{log.step}]
                          </span>
                          <span className="text-slate-100">{log.message}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 italic">
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
      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
      </span>
    );
  }
  if (status === "erro") {
    return (
      <span className="bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
        <AlertTriangle className="w-3.5 h-3.5" /> Erro
      </span>
    );
  }
  if (status === "processando" || isCurrent) {
    return (
      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1">
        <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-700" /> Em Fila
      </span>
    );
  }
  return (
    <span className="bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
      <Clock className="w-3.5 h-3.5" /> Pendente
    </span>
  );
};
