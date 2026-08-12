import { useState, useEffect, useRef, useCallback } from "react";
import { 
  QueueTaskItem, 
  subscribeToQueueTasks, 
  processSingleQueueItem,
  updateQueueTaskStatus 
} from "../lib/queueService";

export function useQueueWorker(autoStart: boolean = true) {
  const [tasks, setTasks] = useState<QueueTaskItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<QueueTaskItem | null>(null);
  const [lastLog, setLastLog] = useState<string>("");

  const isProcessingRef = useRef<boolean>(false);

  // Inscrever para mudanças na fila em tempo real
  useEffect(() => {
    const unsubscribe = subscribeToQueueTasks((fetchedTasks) => {
      setTasks(fetchedTasks);
    });
    return () => unsubscribe();
  }, []);

  // Função para processar o próximo item pendente da fila
  const processNextPendingTask = useCallback(async () => {
    if (isProcessingRef.current) return;

    const pendingTasks = tasks.filter(t => t.status === "pendente");
    if (pendingTasks.length === 0) return;

    const nextTask = pendingTasks[0];
    isProcessingRef.current = true;
    setIsProcessing(true);
    setCurrentTask(nextTask);

    try {
      await processSingleQueueItem(nextTask, (msg) => {
        setLastLog(msg);
      });
    } catch (err) {
      console.error("Erro inesperado no trabalhador de fila:", err);
    } finally {
      // Pause 2.5s between queue items to prevent burst rate-limiting (429) on Gemini API
      await new Promise(res => setTimeout(res, 2500));
      isProcessingRef.current = false;
      setIsProcessing(false);
      setCurrentTask(null);
    }
  }, [tasks]);

  // Worker loop em segundo plano: verifica continuamente se há tarefas pendentes
  useEffect(() => {
    if (!autoStart) return;
    if (isProcessingRef.current) return;

    const pending = tasks.filter(t => t.status === "pendente");
    if (pending.length > 0) {
      processNextPendingTask();
    }
  }, [tasks, autoStart, processNextPendingTask]);

  // Métricas da fila
  const pendingCount = tasks.filter(t => t.status === "pendente").length;
  const processingCount = tasks.filter(t => t.status === "processando").length;
  const doneCount = tasks.filter(t => t.status === "concluido").length;
  const errorCount = tasks.filter(t => t.status === "erro").length;

  return {
    tasks,
    isProcessing,
    currentTask,
    lastLog,
    pendingCount,
    processingCount,
    doneCount,
    errorCount,
    totalCount: tasks.length,
    processNextPendingTask
  };
}
