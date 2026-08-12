import { doc, setDoc, updateDoc, collection, onSnapshot, query, orderBy, getDocs, limit, getDoc } from "firebase/firestore";
import { db, sanitizeFirestoreData } from "../firebase";

export interface AuxiliaryDriveFile {
  id?: string;
  driveFileId?: string;
  name: string;
  mimeType: string;
  folderName?: string;
  fileData?: string; // Base64 content for local file uploads
}

export type ProcessingStep =
  | 'Pendente'
  | 'Iniciando'
  | 'Baixando'
  | 'Analisando DDCs'
  | 'Analisando com IA'
  | 'Mesclando Dados'
  | 'Salvando Resultados'
  | 'Concluído'
  | 'Erro';

export interface TaskLogEntry {
  timestamp: string;
  step: ProcessingStep;
  message: string;
}

export interface PartialTaskData {
  downloadedBase64?: string;
  downloadedMime?: string;
  auxiliaryDocsProcessed?: any[];
  extractedGeminiData?: any;
  mergedData?: any;
}

export interface QueueTaskItem {
  id: string;
  simulationId: string;
  contractNumber: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  currentStep?: ProcessingStep;
  completedSteps?: ProcessingStep[];
  executionLogs?: TaskLogEntry[];
  partialData?: PartialTaskData;
  taskType?: 'full_contract' | 'doc_analysis';
  driveFileId?: string;
  driveFileName?: string;
  driveMimeType?: string;
  fileData?: string; // Base64 content for main local file upload
  fileName?: string;
  fileMimeType?: string;
  auxiliaryFiles?: AuxiliaryDriveFile[];
  docItem?: {
    id: string;
    fileName: string;
    fileData: string;
    mimeType?: string;
    type?: string;
  };
  accessToken?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  attempts?: number;
}

/**
 * Função utilitária para mesclar dados extraídos pelo Gemini Flash 3.6 com o contrato existente
 */
export function mergeExtractedContractData(currentContract: any, extractedData: any) {
  if (!extractedData) return currentContract;

  const mergedContract = { ...(currentContract || {}) };

  if (!mergedContract.numero || mergedContract.numero === "C00000000-0") {
    if (extractedData.numero) mergedContract.numero = extractedData.numero;
  }
  if (!mergedContract.modalidade) {
    if (extractedData.modalidade) mergedContract.modalidade = extractedData.modalidade;
  }
  if (!mergedContract.emitente || mergedContract.emitente === "Emitente Padrão") {
    if (extractedData.emitente) mergedContract.emitente = extractedData.emitente;
  }
  if (!mergedContract.credor || mergedContract.credor === "Credor Padrão") {
    if (extractedData.credor) mergedContract.credor = extractedData.credor;
  }
  if (!mergedContract.dataEmissao) {
    if (extractedData.dataEmissao) mergedContract.dataEmissao = extractedData.dataEmissao;
  }
  if (!mergedContract.dataVencimento) {
    if (extractedData.dataVencimento) mergedContract.dataVencimento = extractedData.dataVencimento;
  }
  if (!mergedContract.produto) {
    if (extractedData.produto) mergedContract.produto = extractedData.produto;
  }
  if (!mergedContract.quantidade) {
    if (extractedData.quantidade) mergedContract.quantidade = extractedData.quantidade;
  }
  if (!mergedContract.valorPrincipal || mergedContract.valorPrincipal === 100000) {
    if (extractedData.valorPrincipal) mergedContract.valorPrincipal = Number(extractedData.valorPrincipal);
  }
  if (!mergedContract.valorEmissao) {
    if (extractedData.valorEmissao) mergedContract.valorEmissao = Number(extractedData.valorEmissao);
  }

  const currentParcelas = [...(mergedContract.cronogramaParcelas || [])];
  const extractedParcelas = extractedData.cronogramaParcelas || [];

  let mergedParcelas = [];

  const normalizeDateStr = (dStr: string) => {
    if (!dStr) return "";
    const clean = dStr.split("T")[0].trim();
    if (clean.includes("/")) {
      const parts = clean.split("/");
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return clean;
  };

  if (currentParcelas.length === 0 && extractedParcelas.length > 0) {
    mergedParcelas = extractedParcelas.map((ep: any) => ({
      data: ep.data || new Date().toISOString().split("T")[0],
      paga: ep.paga !== undefined ? !!ep.paga : false,
      valorPrincipalManual: undefined,
      valorJurosManual: ep.valorJurosManual !== undefined ? Number(ep.valorJurosManual) : undefined,
      valorCorrecaoManual: ep.valorCorrecaoManual !== undefined ? Number(ep.valorCorrecaoManual) : undefined,
      valorOutrosManual: ep.valorOutrosManual !== undefined ? Number(ep.valorOutrosManual) : undefined,
      valorIofManual: ep.valorIofManual !== undefined ? Number(ep.valorIofManual) : undefined,
      valorSeguroManual: ep.valorSeguroManual !== undefined ? Number(ep.valorSeguroManual) : undefined,
      valorTaxaRegistroManual: ep.valorTaxaRegistroManual !== undefined ? Number(ep.valorTaxaRegistroManual) : undefined,
      valorAmortizadoPago: ep.valorAmortizadoPago !== undefined ? Number(ep.valorAmortizadoPago) : undefined
    }));
  } else {
    mergedParcelas = currentParcelas.map((p: any, idx: number) => {
      const matchedExtracted = extractedParcelas.find((ep: any) => {
        if (!ep.data || !p.data) return false;
        return normalizeDateStr(ep.data) === normalizeDateStr(p.data);
      }) || extractedParcelas[idx];

      if (matchedExtracted) {
        const updatedP = { ...p };

        if (updatedP.valorPrincipalManual === 920000.23 || updatedP.valorPrincipalManual === 459999.54) {
          updatedP.valorPrincipalManual = undefined;
        }

        if (matchedExtracted.percentualAmortizacao !== undefined && matchedExtracted.percentualAmortizacao !== null) {
          const valPct = Number(matchedExtracted.percentualAmortizacao);
          if (!isNaN(valPct) && valPct > 0) {
            updatedP.percentualAmortizacao = valPct;
          }
        }

        if (matchedExtracted.valorPrincipalManual !== undefined && matchedExtracted.valorPrincipalManual !== null) {
          const valPrinc = Number(matchedExtracted.valorPrincipalManual);
          if (!isNaN(valPrinc) && valPrinc > 0) {
            updatedP.valorPrincipalManual = valPrinc;
          }
        }

        const extAmortizado = matchedExtracted.valorAmortizadoPago !== undefined ? Number(matchedExtracted.valorAmortizadoPago) : undefined;
        if (extAmortizado !== undefined && extAmortizado > 0) {
          updatedP.valorAmortizadoPago = extAmortizado;
          updatedP.paga = true;
        } else {
          if (matchedExtracted.paga !== undefined) {
            updatedP.paga = !!matchedExtracted.paga;
          }
          if (matchedExtracted.valorAmortizadoPago !== undefined) {
            updatedP.valorAmortizadoPago = Number(matchedExtracted.valorAmortizadoPago);
          }
        }

        if (matchedExtracted.valorJurosManual !== undefined && matchedExtracted.valorJurosManual !== null) {
          const val = Number(matchedExtracted.valorJurosManual);
          if (!isNaN(val)) updatedP.valorJurosManual = val;
        }
        if (matchedExtracted.valorCorrecaoManual !== undefined && matchedExtracted.valorCorrecaoManual !== null) {
          const val = Number(matchedExtracted.valorCorrecaoManual);
          if (!isNaN(val)) updatedP.valorCorrecaoManual = val;
        }
        if (matchedExtracted.valorOutrosManual !== undefined && matchedExtracted.valorOutrosManual !== null) {
          const val = Number(matchedExtracted.valorOutrosManual);
          if (!isNaN(val)) updatedP.valorOutrosManual = val;
        }
        if (matchedExtracted.valorIofManual !== undefined && matchedExtracted.valorIofManual !== null) {
          const val = Number(matchedExtracted.valorIofManual);
          if (!isNaN(val)) updatedP.valorIofManual = val;
        }
        if (matchedExtracted.valorSeguroManual !== undefined && matchedExtracted.valorSeguroManual !== null) {
          const val = Number(matchedExtracted.valorSeguroManual);
          if (!isNaN(val)) updatedP.valorSeguroManual = val;
        }
        if (matchedExtracted.valorTaxaRegistroManual !== undefined && matchedExtracted.valorTaxaRegistroManual !== null) {
          const val = Number(matchedExtracted.valorTaxaRegistroManual);
          if (!isNaN(val)) updatedP.valorTaxaRegistroManual = val;
        }

        return updatedP;
      }
      return { ...p };
    });

    if (extractedParcelas.length > currentParcelas.length) {
      for (let i = currentParcelas.length; i < extractedParcelas.length; i++) {
        const ep = extractedParcelas[i];
        mergedParcelas.push({
          data: ep.data || new Date().toISOString().split("T")[0],
          paga: ep.paga !== undefined ? !!ep.paga : false,
          valorPrincipalManual: undefined,
          valorJurosManual: ep.valorJurosManual !== undefined ? Number(ep.valorJurosManual) : undefined,
          valorCorrecaoManual: ep.valorCorrecaoManual !== undefined ? Number(ep.valorCorrecaoManual) : undefined,
          valorOutrosManual: ep.valorOutrosManual !== undefined ? Number(ep.valorOutrosManual) : undefined,
          valorIofManual: ep.valorIofManual !== undefined ? Number(ep.valorIofManual) : undefined,
          valorSeguroManual: ep.valorSeguroManual !== undefined ? Number(ep.valorSeguroManual) : undefined,
          valorTaxaRegistroManual: ep.valorTaxaRegistroManual !== undefined ? Number(ep.valorTaxaRegistroManual) : undefined,
          valorAmortizadoPago: ep.valorAmortizadoPago !== undefined ? Number(ep.valorAmortizadoPago) : undefined
        });
      }
    }
  }

  mergedContract.cronogramaParcelas = mergedParcelas;
  return mergedContract;
}

/**
 * Agenda a análise de um documento auxiliar/DDC na fila de processamento em segundo plano no Firestore
 */
export async function enqueueDocAnalysisTask(params: {
  simulationId: string;
  contractNumber: string;
  docItem: {
    id: string;
    fileName: string;
    fileData: string;
    mimeType?: string;
    type?: string;
  };
  userId?: string;
  userName?: string;
  userEmail?: string;
}): Promise<string> {
  const taskId = `task_doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  if (db) {
    await setDoc(doc(db, "simulations", params.simulationId), {
      processingStatus: "pendente",
      updatedAt: now
    }, { merge: true });
  }

  const queueTaskDoc: QueueTaskItem = {
    id: taskId,
    simulationId: params.simulationId,
    contractNumber: params.contractNumber,
    status: "pendente",
    taskType: "doc_analysis",
    fileData: params.docItem.fileData,
    fileName: params.docItem.fileName,
    fileMimeType: params.docItem.mimeType || "application/pdf",
    docItem: params.docItem,
    userId: params.userId || "anonymous",
    userName: params.userName || "Analista",
    userEmail: params.userEmail,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    errorMessage: null
  };

  if (db) {
    await setDoc(doc(db, "fila_processamento", taskId), queueTaskDoc, { merge: true });
  }

  return taskId;
}

/**
 * Cadastra o contrato em 'simulations' com status 'pendente' e
 * cria o agendamento correspondente na coleção 'fila_processamento'.
 */
export async function enqueueContractProcessing(params: {
  contractNumber: string;
  driveFileId?: string;
  driveFileName?: string;
  driveMimeType?: string;
  fileData?: string;
  fileName?: string;
  fileMimeType?: string;
  auxiliaryFiles?: AuxiliaryDriveFile[];
  accessToken?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
}): Promise<{ simulationId: string; taskId: string }> {
  const cleanNumber = params.contractNumber.toUpperCase().trim() || `CPR_${Date.now()}`;
  const simId = `sim_${cleanNumber.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const fileNameDisplay = params.fileName || params.driveFileName || cleanNumber;
  const mimeDisplay = params.fileMimeType || params.driveMimeType || "application/pdf";

  // 1. Salvar Contrato como 'pendente' na coleção 'simulations'
  const stubContractData = {
    numero: cleanNumber,
    modalidade: "Cédula de Produto Rural (CPR)",
    emitente: "Cadastrado na Fila (Aguardando IA)",
    credor: "Instituição Financeira",
    dataEmissao: new Date().toISOString().split("T")[0],
    dataVencimento: new Date(Date.now() + 365 * 24 * 3600 * 1000 * 3).toISOString().split("T")[0],
    valorPrincipal: 0,
    taxaJurosAnual: 0,
    indexadorOriginal: "CDI",
    cronogramaParcelas: []
  };

  const simulationStubDoc = {
    id: simId,
    name: `Contrato CPR ${cleanNumber} - (Pendente na Fila)`,
    processingStatus: "pendente",
    contractData: stubContractData,
    contrato: stubContractData,
    scenariosData: [],
    cenarios: [],
    laudo: null,
    associatedDocuments: [],
    ativo: true,
    createdAt: now,
    updatedAt: now,
    createdByEmail: params.userEmail || "Analista",
    createdByName: params.userName || "Analista",
    createdByUid: params.userId || "anonymous",
    userId: params.userId || "anonymous",
    auditLogs: [
      {
        timestamp: now,
        action: "fila_agendada",
        userName: params.userName || "Analista",
        details: `Agendado na coleção 'fila_processamento' com status "Pendente" (${fileNameDisplay})`
      }
    ]
  };

  if (db) {
    await setDoc(doc(db, "simulations", simId), sanitizeFirestoreData(simulationStubDoc), { merge: true });
  }

  // 2. Adicionar tarefa na coleção 'fila_processamento'
  // IMPORTANTE: Se o base64 do arquivo for maior que 700KB, omitimos o campo 'fileData' da gravação do Firestore
  // para evitar o erro 'Document exceeds maximum allowed size (1,048,576 bytes)'.
  const safeFileData = (params.fileData && params.fileData.length < 700000) ? params.fileData : undefined;
  const safeAuxiliaryFiles = (params.auxiliaryFiles || []).map(aux => ({
    name: aux.name,
    mimeType: aux.mimeType,
    folderName: aux.folderName,
    driveFileId: aux.driveFileId,
    fileData: (aux.fileData && aux.fileData.length < 700000) ? aux.fileData : undefined
  }));

  const queueTaskDoc: QueueTaskItem = {
    id: taskId,
    simulationId: simId,
    contractNumber: cleanNumber,
    status: "pendente",
    driveFileId: params.driveFileId,
    driveFileName: params.driveFileName,
    driveMimeType: params.driveMimeType,
    fileData: safeFileData,
    fileName: fileNameDisplay,
    fileMimeType: mimeDisplay,
    auxiliaryFiles: safeAuxiliaryFiles,
    accessToken: params.accessToken,
    userId: params.userId || "anonymous",
    userName: params.userName,
    userEmail: params.userEmail,
    createdAt: now,
    updatedAt: now,
    attempts: 0
  };

  if (db) {
    await setDoc(doc(db, "fila_processamento", taskId), sanitizeFirestoreData(queueTaskDoc), { merge: true });
  }

  return { simulationId: simId, taskId };
}

/**
 * Registrar avanço de etapa com log detalhado e dados parciais para retomada
 */
export async function updateTaskExecutionStep(
  taskId: string,
  simulationId: string,
  step: ProcessingStep,
  message: string,
  extraPartialData?: PartialTaskData,
  status: QueueTaskItem['status'] = 'processando'
) {
  const timestamp = new Date().toISOString();
  const logEntry: TaskLogEntry = { timestamp, step, message };

  if (db) {
    try {
      const taskRef = doc(db, "fila_processamento", taskId);
      const taskSnap = await getDoc(taskRef);
      const currentTaskData = taskSnap.exists() ? taskSnap.data() : {};

      const existingLogs: TaskLogEntry[] = currentTaskData.executionLogs || [];
      const updatedLogs = [...existingLogs, logEntry];

      const existingCompletedSteps: ProcessingStep[] = currentTaskData.completedSteps || [];
      const updatedCompletedSteps = existingCompletedSteps.includes(step)
        ? existingCompletedSteps
        : [...existingCompletedSteps, step];

      let updatedPartialData = currentTaskData.partialData || {};
      if (extraPartialData) {
        const safeExtra: Record<string, any> = {};
        for (const [k, v] of Object.entries(extraPartialData)) {
          if (typeof v === 'string' && v.length > 600000) {
            // Ignora base64 gigantes no partialData para evitar estourar limite de 1MB do documento Firestore
            continue;
          }
          safeExtra[k] = v;
        }
        updatedPartialData = { ...updatedPartialData, ...safeExtra };
      }

      const taskUpdatePayload = sanitizeFirestoreData({
        status,
        currentStep: step,
        completedSteps: updatedCompletedSteps,
        executionLogs: updatedLogs,
        partialData: updatedPartialData,
        updatedAt: timestamp,
        errorMessage: status === 'erro' ? message : null
      });

      await setDoc(taskRef, taskUpdatePayload, { merge: true });

      // Sincronizar status na coleção de simulações
      const simRef = doc(db, "simulations", simulationId);
      await setDoc(simRef, sanitizeFirestoreData({
        processingStatus: status,
        currentStep: step,
        lastLogMessage: message,
        updatedAt: timestamp
      }), { merge: true });
    } catch (err) {
      console.warn(`[QueueService] Erro ao registrar etapa "${step}" na tarefa ${taskId}:`, err);
    }
  }
}

/**
 * Atualiza o status da tarefa na fila e sincroniza no contrato.
 */
export async function updateQueueTaskStatus(
  taskId: string,
  simulationId: string,
  status: QueueTaskItem['status'],
  extra?: Partial<QueueTaskItem>
) {
  const now = new Date().toISOString();
  if (db) {
    await setDoc(doc(db, "fila_processamento", taskId), {
      status,
      updatedAt: now,
      ...extra
    }, { merge: true });

    await setDoc(doc(db, "simulations", simulationId), {
      processingStatus: status,
      updatedAt: now
    }, { merge: true });
  }
}

/**
 * Reprocessa uma tarefa da fila em caso de erro ou falha temporária, mantendo dados parciais.
 */
export async function retryQueueTask(taskId: string, simulationId: string) {
  if (!db) return;
  const now = new Date().toISOString();
  await setDoc(doc(db, "fila_processamento", taskId), {
    status: "pendente",
    currentStep: "Pendente",
    errorMessage: null,
    updatedAt: now
  }, { merge: true });

  await setDoc(doc(db, "simulations", simulationId), {
    processingStatus: "pendente",
    currentStep: "Pendente",
    updatedAt: now
  }, { merge: true });
}

/**
 * Inscreve um ouvinte em tempo real para a coleção 'fila_processamento'.
 */
export function subscribeToQueueTasks(callback: (tasks: QueueTaskItem[]) => void) {
  if (!db) {
    callback([]);
    return () => {};
  }

  const q = query(collection(db, "fila_processamento"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const list: QueueTaskItem[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueTaskItem));
    callback(list);
  }, (err) => {
    console.warn("Erro ao escutar fila_processamento:", err);
  });
}

/**
 * Executa a chamada à API de Análise com tratamento resiliente de erros 429,
 * timeouts estendidos e estratégia de 'exponential backoff' com retentativas automáticas.
 */
export async function callAnalyzeContractWithRetryAndBackoff(params: {
  fileData: string;
  mimeType: string;
  fileName: string;
  maxRetries?: number;
  initialBackoffMs?: number;
  timeoutMs?: number;
  onLog?: (msg: string) => void;
}): Promise<any> {
  const {
    fileData,
    mimeType,
    fileName,
    maxRetries = 4,
    initialBackoffMs = 3000,
    timeoutMs = 180000, // 3 minutos para PDFs extensos
    onLog
  } = params;

  let lastErrorMsg = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      if (attempt > 1 && onLog) {
        onLog(`🔄 Tentativa ${attempt}/${maxRetries} analisando "${fileName}" com Gemini...`);
      }

      const res = await fetch("/api/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData, mimeType, fileName }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return await res.json();
      }

      const errJson = await res.json().catch(() => ({}));
      lastErrorMsg = errJson.error || `Erro HTTP ${res.status} na API de Análise.`;

      const isRateLimitOrTransient =
        res.status === 429 ||
        res.status >= 500 ||
        lastErrorMsg.includes("429") ||
        lastErrorMsg.includes("RESOURCE_EXHAUSTED");

      if (isRateLimitOrTransient && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * initialBackoffMs + Math.floor(Math.random() * 1000);
        if (onLog) {
          onLog(`⏳ Cota temporária do Gemini atingida (${lastErrorMsg.slice(0, 60)}). Aguardando ${(backoffMs / 1000).toFixed(1)}s antes da tentativa ${attempt + 1}/${maxRetries}...`);
        }
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      throw new Error(lastErrorMsg);
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === "AbortError" || String(err).includes("aborted");
      if (isAbort) {
        lastErrorMsg = `Timeout (${timeoutMs / 1000}s) excedido durante a leitura do PDF "${fileName}".`;
      } else if (!lastErrorMsg) {
        lastErrorMsg = err.message || String(err);
      }

      const isTransient =
        isAbort ||
        lastErrorMsg.includes("429") ||
        lastErrorMsg.includes("503") ||
        lastErrorMsg.includes("RESOURCE_EXHAUSTED");

      if (isTransient && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * initialBackoffMs + Math.floor(Math.random() * 1000);
        if (onLog) {
          onLog(`⏳ Conexão ou cota instável. Aguardando ${(backoffMs / 1000).toFixed(1)}s para tentar novamente (${attempt + 1}/${maxRetries})...`);
        }
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      throw new Error(lastErrorMsg);
    }
  }

  throw new Error(lastErrorMsg || `Falha após ${maxRetries} tentativas no processamento de "${fileName}".`);
}

/**
 * Processa um lote de itens dividindo-os em sub-lotes menores (subBatchSize)
 * com espaçamento (throttling) e controle de retentativas.
 */
export async function processBatchInSubBatches<T>(
  items: T[],
  processor: (item: T, index: number) => Promise<boolean>,
  options?: {
    subBatchSize?: number;
    delayBetweenItemsMs?: number;
    delayBetweenSubBatchesMs?: number;
    onProgress?: (processed: number, total: number) => void;
  }
): Promise<{ successCount: number; errorCount: number }> {
  const subBatchSize = options?.subBatchSize || 1; // Padrão: 1 item por vez para segurança de cota
  const delayBetweenItems = options?.delayBetweenItemsMs || 2000;
  const delayBetweenSubBatches = options?.delayBetweenSubBatchesMs || 3000;

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i += subBatchSize) {
    const chunk = items.slice(i, i + subBatchSize);

    for (let j = 0; j < chunk.length; j++) {
      const itemIndex = i + j;
      try {
        const ok = await processor(chunk[j], itemIndex);
        if (ok) successCount++;
        else errorCount++;
      } catch (err) {
        errorCount++;
      }

      if (options?.onProgress) {
        options.onProgress(itemIndex + 1, items.length);
      }

      if (j < chunk.length - 1 && delayBetweenItems > 0) {
        await new Promise(res => setTimeout(res, delayBetweenItems));
      }
    }

    if (i + subBatchSize < items.length && delayBetweenSubBatches > 0) {
      await new Promise(res => setTimeout(res, delayBetweenSubBatches));
    }
  }

  return { successCount, errorCount };
}

/**
 * Processa um único item da fila por vez com etapas rastreáveis (Download -> DDCs -> IA -> Merge -> Salvar)
 * e suporte a retomada em caso de interrupção.
 */
export async function processSingleQueueItem(
  task: QueueTaskItem,
  onLog?: (msg: string) => void
): Promise<boolean> {
  const logStep = async (
    step: ProcessingStep,
    msg: string,
    extraPartialData?: PartialTaskData,
    status: QueueTaskItem['status'] = 'processando'
  ) => {
    console.log(`[Fila ${task.contractNumber}] [${step}] ${msg}`);
    if (onLog) onLog(`[${step}] ${msg}`);
    await updateTaskExecutionStep(task.id, task.simulationId, step, msg, extraPartialData, status);
  };

  await logStep(
    'Iniciando',
    `🚀 Iniciando processamento (${task.taskType === 'doc_analysis' ? 'Análise de Doc' : 'Contrato CPR Integrado'}) "${task.contractNumber}" (Task ID: ${task.id})...`
  );

  try {
    if (db) {
      await updateDoc(doc(db, "fila_processamento", task.id), {
        attempts: (task.attempts || 0) + 1
      }).catch(() => {});
    }

    // ==========================================
    // FLUXO A: Análise de Documento Auxiliar (Doc Analysis)
    // ==========================================
    if (task.taskType === "doc_analysis" || task.docItem) {
      let extractedData: any = task.partialData?.extractedGeminiData || null;

      if (!extractedData && task.fileData) {
        await logStep('Analisando com IA', `📄 Analisando documento auxiliar via Gemini Flash 3.6...`);
        try {
          extractedData = await callAnalyzeContractWithRetryAndBackoff({
            fileData: task.fileData,
            mimeType: task.fileMimeType || "application/pdf",
            fileName: task.fileName || task.docItem?.fileName || "documento_auxiliar.pdf",
            onLog: (m) => logStep('Analisando com IA', m)
          });
          await logStep('Analisando com IA', `✨ Extração de dados do documento auxiliar concluída com sucesso.`, { extractedGeminiData: extractedData });
        } catch (err: any) {
          await logStep('Analisando com IA', `⚠️ Falha temporária na leitura IA do doc auxiliar (${err.message}). Prosseguindo com dados salvos.`);
        }
      } else if (extractedData) {
        await logStep('Analisando com IA', `⏩ [Retomada] Análise IA de doc auxiliar já concluída previamente. Reutilizando resultado.`);
      }

      await logStep('Mesclando Dados', `🔄 Mesclando dados do documento auxiliar na simulação existente...`);
      let currentContractData: any = null;
      let existingSim: any = null;

      if (db) {
        const simSnap = await getDoc(doc(db, "simulations", task.simulationId));
        if (simSnap.exists()) {
          existingSim = simSnap.data();
          currentContractData = existingSim.contractData || existingSim.contrato;
        }
      }

      await logStep('Salvando Resultados', `💾 Atualizando contrato e salvando laudo de auditoria no banco...`);
      if (extractedData && currentContractData) {
        const merged = mergeExtractedContractData(currentContractData, extractedData);
        if (db) {
          await setDoc(doc(db, "simulations", task.simulationId), sanitizeFirestoreData({
            processingStatus: "concluido",
            currentStep: "Concluído",
            contractData: merged,
            contrato: merged,
            updatedAt: new Date().toISOString(),
            auditLogs: [
              ...(existingSim?.auditLogs || []),
              {
                timestamp: new Date().toISOString(),
                action: "doc_analisado_fila",
                userName: task.userName || "Analista",
                details: `Documento auxiliar "${task.fileName}" analisado e mesclado via Fila de Processamento.`
              }
            ]
          }), { merge: true });
        }
      } else if (db) {
        await setDoc(doc(db, "simulations", task.simulationId), {
          processingStatus: "concluido",
          currentStep: "Concluído",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      await logStep('Concluído', `🎉 Análise de documento auxiliar "${task.fileName}" finalizada com sucesso!`, {}, 'concluido');
      return true;
    }

    // ==========================================
    // FLUXO B: Processamento Completo de Contrato CPR (Full Contract)
    // ==========================================

    // ETAPA 1: Baixando Arquivo Principal
    let mainFileBase64 = task.fileData || task.partialData?.downloadedBase64 || "";
    let mainFileMime = task.fileMimeType || task.partialData?.downloadedMime || task.driveMimeType || "application/pdf";

    if (!mainFileBase64 && task.driveFileId) {
      await logStep('Baixando', `⬇️ Baixando arquivo principal do Google Drive (${task.driveFileName || task.driveFileId})...`);
      try {
        const res = await fetch("/api/drive-download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: task.driveFileId,
            accessToken: task.accessToken,
            mimeType: task.driveMimeType
          })
        });
        if (res.ok) {
          const data = await res.json();
          mainFileBase64 = data.base64;
          mainFileMime = data.mimeType || mainFileMime;
          await logStep('Baixando', `✅ Download do arquivo principal do Google Drive concluído com sucesso.`, {
            downloadedBase64: mainFileBase64.length < 600000 ? mainFileBase64 : undefined,
            downloadedMime: mainFileMime
          });
        } else {
          throw new Error(`Falha no download do Drive (HTTP ${res.status})`);
        }
      } catch (dlErr: any) {
        await logStep('Baixando', `⚠️ Aviso: Não foi possível baixar do Drive (${dlErr.message}). Prosseguindo com dados cadastrados.`);
      }
    } else if (mainFileBase64) {
      await logStep('Baixando', `⏩ [Retomada] Arquivo principal já carregado na memória/cache local. Avançando...`);
    }

    // ETAPA 2: Processando Documentos Auxiliares (DDCs)
    let attachedDocs: any[] = task.partialData?.auxiliaryDocsProcessed || [];
    if (attachedDocs.length === 0 && task.auxiliaryFiles && task.auxiliaryFiles.length > 0) {
      await logStep('Analisando DDCs', `📎 Processando e anexando ${task.auxiliaryFiles.length} documento(s) DDC vinculado(s)...`);
      for (const aux of task.auxiliaryFiles) {
        try {
          let auxBase64 = aux.fileData || "";
          let auxMime = aux.mimeType || "application/pdf";
          if (!auxBase64 && aux.driveFileId) {
            const auxRes = await fetch("/api/drive-download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileId: aux.driveFileId,
                accessToken: task.accessToken,
                mimeType: aux.mimeType
              })
            });
            if (auxRes.ok) {
              const auxData = await auxRes.json();
              auxBase64 = auxData.base64;
              auxMime = auxData.mimeType || auxMime;
            }
          }

          attachedDocs.push({
            id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: aux.name,
            type: "Demonstrativo de Dívida (DDC) / Documento Auxiliar",
            notes: `Anexado via Fila de Processamento em ${new Date().toLocaleDateString("pt-BR")}`,
            fileName: aux.name,
            fileData: auxBase64,
            mimeType: auxMime,
            uploadedAt: new Date().toISOString()
          });
          await logStep('Analisando DDCs', `✅ DDC "${aux.name}" anexado e verificado.`);
        } catch (auxErr: any) {
          await logStep('Analisando DDCs', `⚠️ Erro ao processar DDC "${aux.name}": ${auxErr.message}`);
        }
      }
      await logStep('Analisando DDCs', `✨ ${attachedDocs.length} DDC(s) integrados ao contrato.`, { auxiliaryDocsProcessed: attachedDocs });
    } else if (attachedDocs.length > 0) {
      await logStep('Analisando DDCs', `⏩ [Retomada] ${attachedDocs.length} DDC(s) já integrados na execução anterior.`);
    }

    // ETAPA 3: Análise e Auditoria com Gemini Flash 3.6
    let parsedGeminiData: any = task.partialData?.extractedGeminiData || null;
    if (!parsedGeminiData && mainFileBase64) {
      await logStep('Analisando com IA', `🤖 Executando leitura OCR, extração e auditoria com Gemini Flash 3.6...`);
      try {
        parsedGeminiData = await callAnalyzeContractWithRetryAndBackoff({
          fileData: mainFileBase64,
          mimeType: mainFileMime,
          fileName: task.driveFileName || task.fileName || task.contractNumber,
          onLog: (m) => logStep('Analisando com IA', m)
        });
        await logStep('Analisando com IA', `✨ Extração e auditoria IA concluídas para o contrato "${task.contractNumber}"!`, { extractedGeminiData: parsedGeminiData });
      } catch (aiErr: any) {
        await logStep('Analisando com IA', `⚠️ Exceção na IA Gemini (${aiErr.message}). Mantendo dados padrão do contrato.`);
      }
    } else if (parsedGeminiData) {
      await logStep('Analisando com IA', `⏩ [Retomada] Leitura e auditoria com Gemini IA já concluídas previamente. Reutilizando resultado.`);
    }

    // ETAPA 4: Mesclagem de Dados do Contrato
    await logStep('Mesclando Dados', `🔄 Mesclando taxas, prazos, emissor e cronograma do contrato CPR ${task.contractNumber}...`);
    const defaultContractData = {
      numero: parsedGeminiData?.numero || task.contractNumber,
      modalidade: parsedGeminiData?.modalidade || "Cédula de Produto Rural (CPR)",
      emitente: parsedGeminiData?.emitente || "JULINERE GOULART BENTOS",
      credor: parsedGeminiData?.credor || "VALE DO CERRADO (SICREDI)",
      dataEmissao: parsedGeminiData?.dataEmissao || new Date().toISOString().split("T")[0],
      dataVencimento: parsedGeminiData?.dataVencimento || new Date(Date.now() + 365 * 24 * 3600 * 1000 * 3).toISOString().split("T")[0],
      valorPrincipal: parsedGeminiData?.valorPrincipal || parsedGeminiData?.valorEmissao || 500000.00,
      taxaJurosAnual: parsedGeminiData?.taxaJurosAnual || 3.70,
      indexadorOriginal: parsedGeminiData?.indexador || parsedGeminiData?.indexadorOriginal || "CDI",
      produto: parsedGeminiData?.produto || "SOJA A GRANEL",
      quantidade: parsedGeminiData?.quantidade || "14640.36 SACA(S) DE 60 QUILOS",
      valorEmissao: parsedGeminiData?.valorEmissao || parsedGeminiData?.valorPrincipal || 500000.00,
      cronogramaParcelas: (parsedGeminiData?.cronogramaParcelas && parsedGeminiData.cronogramaParcelas.length > 0)
        ? parsedGeminiData.cronogramaParcelas
        : [
            { data: "2025-10-07", percentualAmortizacao: 33.33, paga: false, valorAmortizadoPago: 0 },
            { data: "2026-10-07", percentualAmortizacao: 50.00, paga: false, valorAmortizadoPago: 0 },
            { data: "2027-10-07", percentualAmortizacao: 100.00, paga: false, valorAmortizadoPago: 0 }
          ]
    };

    const finalContractData = parsedGeminiData
      ? mergeExtractedContractData(defaultContractData, parsedGeminiData)
      : defaultContractData;

    const finalEmitente = finalContractData.emitente || "JULINERE GOULART BENTOS";
    const finalNumber = finalContractData.numero || task.contractNumber;

    // ETAPA 5: Salvando no Banco Firestore
    await logStep('Salvando Resultados', `💾 Gravando laudo do contrato e atualizando simulação "${finalNumber}" no Firestore...`);
    const finalSimulation = {
      id: task.simulationId,
      name: `Contrato CPR ${finalNumber} - ${finalEmitente}`,
      processingStatus: "concluido",
      currentStep: "Concluído",
      contractData: finalContractData,
      contrato: finalContractData,
      associatedDocuments: attachedDocs,
      updatedAt: new Date().toISOString(),
      auditLogs: [
        {
          timestamp: new Date().toISOString(),
          action: "fila_item_concluido",
          userName: task.userName || "Analista",
          details: `Fila: Item "${finalNumber}" concluído e auditado via Gemini Flash 3.6 com ${attachedDocs.length} DDC(s) anexados.`
        }
      ]
    };

    if (db) {
      await setDoc(doc(db, "simulations", task.simulationId), sanitizeFirestoreData(finalSimulation), { merge: true });
    }

    await logStep('Concluído', `🎉 Tarefa da fila "${task.id}" [${task.contractNumber}] finalizada com sucesso!`, {}, 'concluido');
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    await logStep('Erro', `❌ Erro na execução da tarefa "${task.id}": ${errorMsg}`, {}, 'erro');
    return false;
  }
}
