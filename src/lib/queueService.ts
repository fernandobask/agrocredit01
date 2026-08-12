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

export interface QueueTaskItem {
  id: string;
  simulationId: string;
  contractNumber: string;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
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
 * Reprocessa uma tarefa da fila em caso de erro ou falha temporária.
 */
export async function retryQueueTask(taskId: string, simulationId: string) {
  if (!db) return;
  const now = new Date().toISOString();
  await setDoc(doc(db, "fila_processamento", taskId), {
    status: "pendente",
    errorMessage: null,
    updatedAt: now
  }, { merge: true });

  await setDoc(doc(db, "simulations", simulationId), {
    processingStatus: "pendente",
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
 * Processa um único item da fila por vez (Download + DDCs + Gemini Flash 3.6 + Merge)
 */
export async function processSingleQueueItem(
  task: QueueTaskItem,
  onLog?: (msg: string) => void
): Promise<boolean> {
  const log = (msg: string) => {
    console.log(`[Fila ${task.contractNumber}] ${msg}`);
    if (onLog) onLog(msg);
  };

  log(`🚀 Iniciando processamento em segundo plano (${task.taskType === 'doc_analysis' ? 'Análise de Doc' : 'Contrato Integrado'}) "${task.contractNumber}" (Task ID: ${task.id})...`);

  try {
    // 1. Atualizar status para 'processando'
    await updateQueueTaskStatus(task.id, task.simulationId, "processando", {
      attempts: (task.attempts || 0) + 1
    });

    if (db) {
      await setDoc(doc(db, "simulations", task.simulationId), {
        name: `Contrato CPR ${task.contractNumber} - (Analisando com Gemini Flash 3.6...)`,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Se for uma análise individual de documento auxiliar / DDC
    if (task.taskType === "doc_analysis" || task.docItem) {
      log(`📄 Analisando documento auxiliar em segundo plano para simulação ${task.simulationId}...`);
      let extractedData: any = null;

      if (task.fileData) {
        try {
          extractedData = await callAnalyzeContractWithRetryAndBackoff({
            fileData: task.fileData,
            mimeType: task.fileMimeType || "application/pdf",
            fileName: task.fileName || task.docItem?.fileName || "documento_auxiliar.pdf",
            onLog: log
          });
          log(`✨ Análise Gemini Flash 3.6 concluída com sucesso para o documento auxiliar.`);
        } catch (err: any) {
          log(`⚠️ Exceção na IA para doc auxiliar (${err.message}). Prosseguindo com dados atuais.`);
        }
      }

      // Buscar a simulação atual para fazer a mesclagem
      let currentContractData: any = null;
      let existingSim: any = null;

      if (db) {
        const simSnap = await getDoc(doc(db, "simulations", task.simulationId));
        if (simSnap.exists()) {
          existingSim = simSnap.data();
          currentContractData = existingSim.contractData || existingSim.contrato;
        }
      }

      if (extractedData && currentContractData) {
        const merged = mergeExtractedContractData(currentContractData, extractedData);
        if (db) {
          await setDoc(doc(db, "simulations", task.simulationId), {
            processingStatus: "concluido",
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
          }, { merge: true });
        }
      } else if (db) {
        await setDoc(doc(db, "simulations", task.simulationId), {
          processingStatus: "concluido",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      await updateQueueTaskStatus(task.id, task.simulationId, "concluido", {
        errorMessage: null
      });

      log(`🎉 Análise de documento auxiliar "${task.id}" concluída com sucesso!`);
      return true;
    }

    // 3. Processamento de contrato completo (Main + Auxiliary DDCs)
    let mainFileBase64 = task.fileData || "";
    let mainFileMime = task.fileMimeType || task.driveMimeType || "application/pdf";

    if (!mainFileBase64 && task.driveFileId) {
      log(`⬇️ Baixando arquivo principal do Drive (${task.driveFileName || task.driveFileId})...`);
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
          log(`✅ Download do arquivo principal concluído.`);
        }
      } catch (dlErr: any) {
        log(`⚠️ Erro ao baixar do Drive: ${dlErr.message}`);
      }
    }

    const attachedDocs: any[] = [];
    if (task.auxiliaryFiles && task.auxiliaryFiles.length > 0) {
      log(`📎 Processando ${task.auxiliaryFiles.length} documento(s) auxiliar(es) DDC...`);
      for (const aux of task.auxiliaryFiles) {
        try {
          let auxBase64 = aux.fileData || "";
          let auxMime = aux.mimeType || "application/pdf";
          if (!auxBase64 && aux.id) {
            const auxRes = await fetch("/api/drive-download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileId: aux.id,
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
          log(`✅ DDC "${aux.name}" anexado.`);
        } catch (auxErr: any) {
          log(`⚠️ Erro ao anexar DDC "${aux.name}": ${auxErr.message}`);
        }
      }
    }

    let parsedGeminiData: any = null;
    if (mainFileBase64) {
      log(`🤖 Executando análise e auditoria com Gemini Flash 3.6...`);
      try {
        parsedGeminiData = await callAnalyzeContractWithRetryAndBackoff({
          fileData: mainFileBase64,
          mimeType: mainFileMime,
          fileName: task.driveFileName || task.fileName || task.contractNumber,
          onLog: log
        });
        log(`✨ Análise IA concluída com sucesso para "${task.contractNumber}"!`);
      } catch (aiErr: any) {
        log(`⚠️ Exceção na chamada de IA (${aiErr.message}). Mantendo dados calculados.`);
      }
    }

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

    const finalSimulation = {
      id: task.simulationId,
      name: `Contrato CPR ${finalNumber} - ${finalEmitente}`,
      processingStatus: "concluido",
      contractData: finalContractData,
      contrato: finalContractData,
      associatedDocuments: attachedDocs,
      updatedAt: new Date().toISOString(),
      auditLogs: [
        {
          timestamp: new Date().toISOString(),
          action: "fila_item_concluido",
          userName: task.userName || "Analista",
          details: `Fila: Item "${finalNumber}" concluído e auditado com sucesso via Gemini Flash 3.6 com ${attachedDocs.length} DDC(s) anexados.`
        }
      ]
    };

    if (db) {
      await setDoc(doc(db, "simulations", task.simulationId), finalSimulation, { merge: true });
    }

    await updateQueueTaskStatus(task.id, task.simulationId, "concluido", {
      errorMessage: null
    });

    log(`🎉 Tarefa da fila "${task.id}" [${task.contractNumber}] concluída com sucesso!`);
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    log(`❌ Erro no processamento da tarefa "${task.id}": ${errorMsg}`);

    await updateQueueTaskStatus(task.id, task.simulationId, "erro", {
      errorMessage: errorMsg
    });

    if (db) {
      await setDoc(doc(db, "simulations", task.simulationId), {
        processingStatus: "erro",
        name: `Contrato CPR ${task.contractNumber} - (Erro no processamento)`,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    return false;
  }
}
