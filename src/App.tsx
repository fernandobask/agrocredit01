import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  UploadCloud,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Coins,
  Calendar,
  Percent,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  FolderOpen,
  History,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Scale,
  Calculator,
  Briefcase,
  ChevronRight,
  Info,
  Layers,
  Settings,
  Activity,
  ChevronDown,
  Check,
  Save,
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud,
  Database,
  MessageSquare,
  Paperclip,
  Sparkles,
  X,
  Menu,
  ChevronLeft,
  Search,
  Filter,
  Zap,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Clock,
  Edit3,
  Users,
  LayoutList,
  LayoutGrid,
  Eye,
  EyeOff,
  Eraser,
  FilePlus,
  CheckCircle2,
  PowerOff
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import {
  Indexador,
  Contrato,
  IndexadorRates,
  SimuloCenario,
  ResultadoCenario,
  ProjecaoParcela,
  ParcelaScheduling,
  ModalidadeContrato,
  Laudo,
  AssociatedDocument,
  ContractHistoryEntry,
  AuditLogEntry
} from "./types";
import {
  formatCurrency,
  formatPercentage,
  formatDate,
  calcularProjecao,
  processarCenario,
  exportToCSV
} from "./utils/math";
import { MemoriaCalculoModal } from "./components/MemoriaCalculoModal";
import { SimuladorNegociacaoModal } from "./components/SimuladorNegociacaoModal";
import { AuthModal } from "./components/AuthModal";
import { TaxasManualModal } from "./components/TaxasManualModal";
import { DocumentViewerModal } from "./components/DocumentViewerModal";
import { ResumoConsolidadoModal } from "./components/ResumoConsolidadoModal";
import { LocalBatchModal } from "./components/LocalBatchModal";
import { QueueStatusModal } from "./components/QueueStatusModal";
import { VirtualizedContractsList } from "./components/VirtualizedContractsList";
import { useQueueWorker } from "./hooks/useQueueWorker";
import { enqueueDocAnalysisTask } from "./lib/queueService";
import { auth, loginWithGoogle, loginAnonymously, loginAnonymouslyWithName, checkRedirectLoginResult, logout, db, handleFirestoreError, OperationType, getAccessToken, sanitizeFirestoreData } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, setDoc, getDocs, deleteDoc, query, where, updateDoc, onSnapshot } from "firebase/firestore";

import ReactMarkdown from "react-markdown";

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function normalizeContractNumber(num: string): string {
  return (num || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isDemoContract(num: string): boolean {
  const norm = normalizeContractNumber(num);
  return norm === "c205305764" || norm === "c305286451" || norm === "c30528645";
}

// Blank contract template for initial state and manual reset
const EMPTY_CONTRATO: Contrato = {
  numero: "",
  modalidade: ModalidadeContrato.CPR,
  emitente: "",
  credor: "",
  dataEmissao: "",
  dataVencimento: "",
  valorPrincipal: 0,
  taxaJurosAnual: 0,
  indexadorOriginal: Indexador.CDI,
  produto: "",
  quantidade: "",
  valorEmissao: 0,
  cronogramaParcelas: []
};

// Default preloaded contract data matching the user's provided CPR PDF (accessible via Carregar CPR de Exemplo)
const DEFAULT_CONTRATO: Contrato = {
  numero: "C20530576-4",
  modalidade: ModalidadeContrato.CPR,
  emitente: "JULINERE GOULART BENTOS",
  credor: "VALE DO CERRADO (SICREDI)",
  dataEmissao: "2022-10-07",
  dataVencimento: "2027-10-07",
  valorPrincipal: 2300000.00,
  taxaJurosAnual: 3.7, // 3.7% a.a. spread
  indexadorOriginal: Indexador.CDI,
  produto: "SOJA A GRANEL",
  quantidade: "14640.36 SACA(S) DE 60 QUILOS",
  valorEmissao: 2300000.00,
  cronogramaParcelas: [
    {
      data: "2023-10-07",
      percentualAmortizacao: 20.00,
      paga: true,
      valorAmortizadoPago: 828700.13,
      valorPrincipalManual: 460000.00,
      valorJurosManual: 83290.00,
      valorCorrecaoManual: 285410.13,
      valorOutrosManual: 0.00
    },
    {
      data: "2024-10-07",
      percentualAmortizacao: 25.00,
      paga: true,
      valorAmortizadoPago: 813113.26,
      valorPrincipalManual: 460000.00,
      valorJurosManual: 99647.10,
      valorCorrecaoManual: 238285.86,
      valorOutrosManual: 15180.30
    },
    {
      data: "2025-10-07",
      percentualAmortizacao: 33.3333,
      paga: false,
      valorAmortizadoPago: 0.00,
      valorPrincipalManual: 459999.54,
      valorJurosManual: 39628.93,
      valorCorrecaoManual: 127941.96,
      valorOutrosManual: 0.00
    },
    {
      data: "2026-10-07",
      percentualAmortizacao: 50.00,
      paga: false,
      valorAmortizadoPago: 0.00,
      valorPrincipalManual: 460000.23,
      valorJurosManual: 0.00,
      valorCorrecaoManual: 0.00,
      valorOutrosManual: 0.00
    },
    {
      data: "2027-10-07",
      percentualAmortizacao: 100.00,
      paga: false,
      valorAmortizadoPago: 0.00,
      valorPrincipalManual: 460000.23,
      valorJurosManual: 0.00,
      valorCorrecaoManual: 0.00,
      valorOutrosManual: 0.00
    }
  ]
};

// Standard initial scenarios to compare
const DEFAULT_CENARIOS: SimuloCenario[] = [
  { id: "cen-1", nome: "Portabilidade Selic + Spread Baixo", indexador: Indexador.SELIC, taxaJurosAnual: 1.50 },
  { id: "cen-2", nome: "Renegociação IPCA + Juros Fixos", indexador: Indexador.IPCA, taxaJurosAnual: 5.50 },
  { id: "cen-3", nome: "Renegociação INPC + Juros Fixos", indexador: Indexador.INPC, taxaJurosAnual: 4.80 },
  { id: "cen-4", nome: "Renegociação TR + Spread Moderado", indexador: Indexador.TR, taxaJurosAnual: 7.90 },
  { id: "cen-5", nome: "Transição para Taxa Pré-Fixada", indexador: Indexador.PRE, taxaJurosAnual: 11.25 }
];

export default function App() {
  // Application State - Starts with a blank/empty contract
  const [contrato, setContrato] = useState<Contrato>(EMPTY_CONTRATO);
  const [cenarios, setCenarios] = useState<SimuloCenario[]>(DEFAULT_CENARIOS);
  const [dataHoje, setDataHoje] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [indexadores, setIndexadores] = useState<IndexadorRates>({
    CDI: 14.15,
    SELIC: 14.25,
    IPCA: 4.64,
    INPC: 4.33,
    TR: 1.25,
    PRE: 0.00
  });

  const [loadingIndexadores, setLoadingIndexadores] = useState(false);
  const [indexadoresStatus, setIndexadoresStatus] = useState<"success" | "warning" | "idle">("idle");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [historicalIndexadores, setHistoricalIndexadores] = useState<any[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [taxasModalOpen, setTaxasModalOpen] = useState(false);

  // AI Extraction State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scenario UI states
  const [newCenarioNome, setNewCenarioNome] = useState("");
  const [newCenarioIndexador, setNewCenarioIndexador] = useState<Indexador>(Indexador.INPC);
  const [newCenarioTaxa, setNewCenarioTaxa] = useState(2.0);
  const [activeTab, setActiveTab] = useState<"comparativo" | "fluxo">("comparativo");
  const [showChart, setShowChart] = useState<boolean>(false);
  const [selectedFluxoCenario, setSelectedFluxoCenario] = useState<string>("original");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  // Navigation Section Toggles
  const [activeNav, setActiveNav] = useState<"dashboard" | "contratos" | "indexadores">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // AI Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const dragControls = useDragControls();
  const [chatDimensions, setChatDimensions] = useState({ width: 400, height: 600 });
  const isResizing = useRef(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', content: string, attachments?: {fileData: string, mimeType: string, fileName: string}[]}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatFiles, setChatFiles] = useState<File[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = chatDimensions.width;
    const startHeight = chatDimensions.height;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(320, startWidth + (startX - moveEvent.clientX));
      const newHeight = Math.max(400, startHeight + (startY - moveEvent.clientY));
      setChatDimensions({
        width: Math.min(newWidth, window.innerWidth * 0.9),
        height: Math.min(newHeight, window.innerHeight * 0.9)
      });
    };

    const onPointerUp = () => {
      isResizing.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() && chatFiles.length === 0) return;
    
    const attachments: {fileData: string, mimeType: string, fileName: string}[] = [];

    if (chatFiles.length > 0) {
      try {
        for (const file of chatFiles) {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          attachments.push({
            fileData: base64Data,
            mimeType: file.type || "application/pdf",
            fileName: file.name
          });
        }
      } catch (e) {
        showToast("Erro ao ler os arquivos selecionados.", "error");
        return;
      }
    }

    const fileNamesText = chatFiles.length > 0 ? `\n(Arquivos anexados: ${chatFiles.map(f => f.name).join(", ")})` : "";
    const newMessage = { 
      role: 'user' as const, 
      content: chatInput + fileNamesText,
      attachments
    };
    
    const updatedMessages = [...chatMessages, newMessage];
    
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatFiles([]);
    setIsChatLoading(true);

    try {
      const activeSim = savedSimulations.find(s => s.id === loadedSimulationId);
      const associatedDocuments = activeSim?.associatedDocuments || [];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          contrato,
          cenarios,
          associatedDocuments
        })
      });
      
      if (!res.ok) throw new Error("Falha na resposta do assistente");
      
      const data = await res.json();
      setChatMessages([...updatedMessages, { role: 'model', content: data.reply }]);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsChatLoading(false);
    }
  };

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const openAuthModal = () => {
    setIsAuthModalOpen(true);
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await loginWithGoogle();
      if (res?.user) {
        showToast(`Bem-vindo(a), ${res.user.displayName || res.user.email}! Login efetuado com sucesso.`, "success");
      }
    } catch (err: any) {
      console.error("Erro no login Google:", err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        showToast("Login do Google foi cancelado.", "info");
      } else {
        showToast("Abrindo alternativas de login no Firebase...", "info");
        openAuthModal();
      }
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logout();
      showToast("Sessão encerrada com sucesso.", "info");
    } catch (err: any) {
      showToast("Erro ao encerrar sessão: " + err.message, "error");
    }
  };

  // Saved Simulations State
  const [savedSimulations, setSavedSimulations] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("cached_simulations_v1");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [emitenteFilter, setEmitenteFilter] = useState("");
  const [contractScopeFilter, setContractScopeFilter] = useState<"all" | "mine">("all");
  const [contractViewMode, setContractViewMode] = useState<"table" | "cards">("table");
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [loadedSimulationId, setLoadedSimulationId] = useState<string | null>(null);

  // Memória de Cálculo Auditável Modal State
  const [memoriaModalState, setMemoriaModalState] = useState<{
    isOpen: boolean;
    parcela?: ProjecaoParcela;
    cenarioNome?: string;
    indexadorNome?: string;
    taxaJurosAnual?: number;
    valorIndexadorAnual?: number;
  }>({ isOpen: false });

  // Simulador de Negociação Modal State & Saved Proposal State
  const [simuladorModalOpen, setSimuladorModalOpen] = useState(false);
  const [savedProposal, setSavedProposal] = useState<any>(() => {
    try {
      const stored = localStorage.getItem("agrocredit_proposal_" + (contrato?.numero || "default"));
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Sync saved proposal when contract changes
  useEffect(() => {
    if (contrato?.numero) {
      try {
        const stored = localStorage.getItem("agrocredit_proposal_" + contrato.numero);
        if (stored) {
          setSavedProposal(JSON.parse(stored));
        } else {
          setSavedProposal(null);
        }
      } catch (e) {
        console.error("Erro ao carregar proposta do localStorage:", e);
      }
    }
  }, [contrato?.numero]);

  const handleSaveProposalToFirestore = async (proposalData: any) => {
    // 1. Update active React state
    setSavedProposal(proposalData);

    // 2. Persist in localStorage immediately
    const key = "agrocredit_proposal_" + (contrato.numero || "default");
    try {
      localStorage.setItem(key, JSON.stringify(proposalData));
    } catch (e) {
      console.error("Erro localStorage:", e);
    }

    // 3. Automatically add or update the "Proposta Repactuada" scenario in scenarios list
    const proposalCenarioId = "cen-proposta-salva";
    const taxaAnual = (proposalData.condicoes?.taxaJurosMensal || 1.0) * 12;
    const indexadorNome = proposalData.condicoes?.indexadorReajuste || "IPCA";

    setCenarios(prev => {
      const exists = prev.some(c => c.id === proposalCenarioId);
      if (exists) {
        return prev.map(c => c.id === proposalCenarioId ? {
          ...c,
          nome: "Proposta Repactuada",
          indexador: indexadorNome as any,
          taxaJurosAnual: taxaAnual
        } : c);
      } else {
        return [
          ...prev,
          {
            id: proposalCenarioId,
            nome: "Proposta Repactuada",
            indexador: indexadorNome as any,
            taxaJurosAnual: taxaAnual
          }
        ];
      }
    });

    // 4. Save to Firestore if authenticated
    if (user) {
      try {
        const docRef = doc(collection(db, "propostas_negociacao"));
        await setDoc(docRef, {
          id: docRef.id,
          userId: user.uid,
          contratoNumero: contrato.numero || "S/N",
          emitente: contrato.emitente || "Produtor Rural",
          proposalData,
          createdAt: new Date().toISOString()
        });
        showToast("Proposta de negociação salva localmente e na nuvem!", "success");
      } catch (err: any) {
        showToast("Proposta salva localmente com sucesso! (Erro na nuvem: " + err.message + ")", "info");
      }
    } else {
      showToast("Proposta de negociação salva localmente com sucesso!", "success");
    }
  };

  const openMemoriaCalculo = (
    parcela?: ProjecaoParcela,
    cenarioNome?: string,
    indexadorNome?: string,
    taxaJurosAnual?: number
  ) => {
    const idxNome = indexadorNome || contrato.indexadorOriginal;
    const valIdx = indexadores[idxNome] || 0;
    setMemoriaModalState({
      isOpen: true,
      parcela,
      cenarioNome: cenarioNome || "Contrato Vigente",
      indexadorNome: idxNome,
      taxaJurosAnual: taxaJurosAnual !== undefined ? taxaJurosAnual : contrato.taxaJurosAnual,
      valorIndexadorAnual: valIdx
    });
  };

  const closeMemoriaCalculo = () => {
    setMemoriaModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Custom non-blocking Toast and Confirmation Modal states for sandbox/iframe compatibility
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // States for duplicate detection, document viewing and versioning
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existingSim: any;
    novoContrato: Contrato;
    differences: string[];
  } | null>(null);

  const [viewingDocument, setViewingDocument] = useState<AssociatedDocument | null>(null);

  // States for Resumo Consolidado por Cliente Modal
  const [isResumoConsolidadoOpen, setIsResumoConsolidadoOpen] = useState<boolean>(false);
  const [resumoConsolidadoEmitente, setResumoConsolidadoEmitente] = useState<string>("");

  // State for Local Computer Batch Import Modal
  const [isLocalBatchModalOpen, setIsLocalBatchModalOpen] = useState<boolean>(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);

  // Background Queue Worker for Gemini Flash 3.6 processing
  const queueWorker = useQueueWorker(true);

  // Handler to toggle contract active/inactive status in Firestore
  const handleToggleContractStatus = async (simId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      setSavedSimulations(prev =>
        prev.map(s => (s.id === simId ? { ...s, ativo: newStatus } : s))
      );
      if (db) {
        await updateDoc(doc(db, "simulations", simId), {
          ativo: newStatus,
          updatedAt: new Date().toISOString()
        });
      }
      showToast(`Contrato ${newStatus ? "ativado" : "desativado"} com sucesso!`, "success");
    } catch (err: any) {
      setSavedSimulations(prev =>
        prev.map(s => (s.id === simId ? { ...s, ativo: currentStatus } : s))
      );
      handleFirestoreError(err, OperationType.UPDATE, `simulations/${simId}`);
    }
  };

  // Routine to sanitize database and merge duplicate contract records
  const handleMergeDuplicateContracts = async () => {
    if (!savedSimulations || savedSimulations.length === 0) {
      showToast("Nenhuma simulação/contrato cadastrado para verificar duplicidades.", "info");
      return;
    }

    const groups: { [key: string]: any[] } = {};
    savedSimulations.forEach(sim => {
      const cNum = normalizeContractNumber(sim.contractData?.numero || sim.contrato?.numero || "");
      if (cNum && cNum !== "c000000000") {
        if (!groups[cNum]) groups[cNum] = [];
        groups[cNum].push(sim);
      }
    });

    let duplicatesFound = 0;
    const mergeOperations: { master: any; duplicatesToDelete: any[] }[] = [];

    for (const normNum of Object.keys(groups)) {
      const simList = groups[normNum];
      if (simList.length > 1) {
        duplicatesFound += (simList.length - 1);
        
        simList.sort((a, b) => {
          const vA = a.version || 1;
          const vB = b.version || 1;
          if (vA !== vB) return vB - vA;
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        });

        const masterSim = simList[0];
        const duplicatesToDelete = simList.slice(1);
        mergeOperations.push({ master: masterSim, duplicatesToDelete });
      }
    }

    if (duplicatesFound === 0) {
      showToast("Nenhum contrato duplicado encontrado! Todos os registros estão higienizados.", "success");
      return;
    }

    showConfirm(
      `Foram identificados ${duplicatesFound} registro(s) duplicado(s) na base. Deseja unificar os documentos auxiliares, logs e histórico em um único registro e eliminar duplicidades?`,
      async () => {
        try {
          for (const op of mergeOperations) {
            const masterSim = op.master;
            const duplicatesToDelete = op.duplicatesToDelete;

            const allDocs = [...(masterSim.associatedDocuments || [])];
            const allLogs = [...(masterSim.auditLogs || [])];
            const allHistory = [...(masterSim.history || [])];

            duplicatesToDelete.forEach(dup => {
              if (dup.associatedDocuments && dup.associatedDocuments.length > 0) {
                dup.associatedDocuments.forEach((docItem: any) => {
                  if (!allDocs.some(d => d.id === docItem.id || d.fileName === docItem.fileName)) {
                    allDocs.push(docItem);
                  }
                });
              }
              if (dup.auditLogs && dup.auditLogs.length > 0) {
                dup.auditLogs.forEach((logItem: any) => {
                  if (!allLogs.some(l => l.id === logItem.id)) {
                    allLogs.push(logItem);
                  }
                });
              }
            });

            allLogs.push({
              id: `log_${Date.now()}`,
              timestamp: new Date().toISOString(),
              userId: user?.uid || "system",
              userName: user?.displayName || "Analista Auditor",
              userEmail: user?.email || "auditor@agro.com",
              action: "Sanitização de Duplicados",
              details: `Unificados ${duplicatesToDelete.length + 1} registros duplicados do contrato nº ${masterSim.contractData?.numero || "S/N"}`
            });

            const updatedMaster = {
              ...masterSim,
              associatedDocuments: allDocs,
              auditLogs: allLogs,
              history: allHistory,
              updatedAt: new Date().toISOString()
            };

            await setDoc(doc(db, "simulations", masterSim.id), sanitizeFirestoreData(updatedMaster));
            for (const dupToDelete of duplicatesToDelete) {
              await deleteDoc(doc(db, "simulations", dupToDelete.id));
            }
          }

          await fetchSavedSimulations();
          showToast(`Higienização concluída com sucesso! ${duplicatesFound} duplicidade(s) removida(s).`, "success");
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, "simulations");
        }
      }
    );
  };

  // Track which saved simulation has its associated documents expanded
  const [expandedDocsSimId, setExpandedDocsSimId] = useState<string | null>(null);

  // Form states for adding other documents
  const [newDocForm, setNewDocForm] = useState<{
    simId: string;
    name: string;
    type: string;
    notes: string;
    fileName: string;
    fileData?: string;
    mimeType?: string;
  } | null>(null);

  const fetchSavedSimulations = async () => {
    let currentUser = user || auth.currentUser;
    if (!currentUser) {
      try {
        const cred = await loginAnonymouslyWithName("Analista Financeiro");
        currentUser = cred.user;
        setUser(currentUser);
      } catch (e) {
        console.warn("Auto login error:", e);
      }
    }

    if (savedSimulations.length === 0) {
      setLoadingSimulations(true);
    }

    try {
      const q = query(collection(db, "simulations"));
      const snapshot = await getDocs(q);
      
      let sims = snapshot.docs.map(docItem => {
        const data = docItem.data();
        const cData = data.contractData || data.contrato || DEFAULT_CONTRATO;
        const sData = data.scenariosData || data.cenarios || DEFAULT_CENARIOS;
        return {
          id: docItem.id,
          ...data,
          contractData: cData,
          contrato: cData,
          scenariosData: sData,
          cenarios: sData
        };
      });

      if (sims.length === 0 && currentUser) {
        const defaultSimData = {
          userId: currentUser.uid,
          createdById: currentUser.uid,
          createdByName: currentUser.displayName || currentUser.email || "Analista Financeiro",
          name: "Contrato CPR - Julinere Goulart Bentos",
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          contractData: DEFAULT_CONTRATO,
          contrato: DEFAULT_CONTRATO,
          scenariosData: DEFAULT_CENARIOS,
          cenarios: DEFAULT_CENARIOS,
          history: [],
          associatedDocuments: [],
          auditLogs: [{
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            userName: currentUser.displayName || currentUser.email || "Analista Financeiro",
            action: "Criado automaticamente (Base Inicial)"
          }]
        };

        try {
          const defaultDocRef = doc(db, "simulations", "cpr-julinere-default");
          await setDoc(defaultDocRef, sanitizeFirestoreData(defaultSimData));
          sims = [{ id: "cpr-julinere-default", ...defaultSimData }];
        } catch (seedErr) {
          console.warn("Erro ao semear contrato inicial:", seedErr);
        }
      }

      const getTime = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
        if (val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
        if (val.seconds) return val.seconds * 1000;
        return 0;
      };

      sims.sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt));
      setSavedSimulations(sims);
      try {
        localStorage.setItem("cached_simulations_v1", JSON.stringify(sims));
      } catch (e) {}
    } catch (err) {
      console.error("Erro ao buscar simulações do Firestore:", err);
    } finally {
      setLoadingSimulations(false);
    }
  };

  // Real-time synchronization for instantaneous contract updates
  useEffect(() => {
    let currentUser = user || auth.currentUser;
    if (!currentUser) {
      loginAnonymouslyWithName("Analista Financeiro")
        .then(cred => setUser(cred.user))
        .catch(e => console.warn("Auto login error:", e));
    }

    if (savedSimulations.length === 0) {
      setLoadingSimulations(true);
    }

    const q = query(collection(db, "simulations"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let sims = snapshot.docs.map(docItem => {
        const data = docItem.data();
        const cData = data.contractData || data.contrato || DEFAULT_CONTRATO;
        const sData = data.scenariosData || data.cenarios || DEFAULT_CENARIOS;
        return {
          id: docItem.id,
          ...data,
          contractData: cData,
          contrato: cData,
          scenariosData: sData,
          cenarios: sData
        };
      });

      const getTime = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
        if (val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
        if (val.seconds) return val.seconds * 1000;
        return 0;
      };

      sims.sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt));

      if (sims.length > 0) {
        setSavedSimulations(sims);
        try {
          localStorage.setItem("cached_simulations_v1", JSON.stringify(sims));
        } catch (e) {}
      }
      setLoadingSimulations(false);
    }, (err) => {
      console.error("Erro no listener Firestore onSnapshot:", err);
      setLoadingSimulations(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Contract Verification (Laudo)
  const [verifyingContract, setVerifyingContract] = useState(false);
  const [laudo, setLaudo] = useState<Laudo | null>(null);
  const [showFullLaudo, setShowFullLaudo] = useState(false);
  const [auditFocus, setAuditFocus] = useState<string>("completo");
  const [selectedFocusFilter, setSelectedFocusFilter] = useState<string>("all");
  const [expandedDivergencias, setExpandedDivergencias] = useState<Record<number, boolean>>({});

  const handleVerifyIrregularities = async () => {
    setVerifyingContract(true);
    setLaudo(null);
    try {
      const activeSim = savedSimulations.find(s => s.id === loadedSimulationId);
      const associatedDocuments = activeSim?.associatedDocuments || [];

      const res = await fetch("/api/verify-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrato, associatedDocuments, auditFocus })
      });
      if (!res.ok) {
        let errMsg = "Erro na requisição para análise.";
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      setLaudo(data);

      if (user && loadedSimulationId && activeSim) {
        const updatedSim = {
          ...activeSim,
          laudo: data,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, "simulations", loadedSimulationId), sanitizeFirestoreData(updatedSim));
        await fetchSavedSimulations();
      }
    } catch (err: any) {
      showToast("Falha ao gerar laudo: " + err.message, "error");
    } finally {
      setVerifyingContract(false);
    }
  };

  const getCategoryDetails = (campo: string) => {
    const campoLower = campo.toLowerCase();
    if (campoLower.includes("juros") || campoLower.includes("encargo") || campoLower.includes("taxa") || campoLower.includes("mora")) {
      return { name: "Juros & Encargos", color: "bg-blue-50 text-blue-700 border-blue-250" };
    }
    if (campoLower.includes("principal") || campoLower.includes("saldo") || campoLower.includes("amortiza") || campoLower.includes("parcela")) {
      return { name: "Saldos & Amortização", color: "bg-purple-50 text-purple-700 border-purple-250" };
    }
    if (campoLower.includes("outros") || campoLower.includes("tarifa") || campoLower.includes("seguro") || campoLower.includes("venda")) {
      return { name: "Tarifas & Venda Casada", color: "bg-amber-50 text-amber-700 border-amber-250" };
    }
    return { name: "Prazos & Carência", color: "bg-emerald-50 text-emerald-700 border-emerald-250" };
  };

  const filteredDivergencias = (laudo?.divergencias || []).filter((item) => {
    if (selectedFocusFilter === "all") return true;
    const campoLower = item.campo.toLowerCase();
    if (selectedFocusFilter === "juros") {
      return campoLower.includes("juros") || campoLower.includes("encargo") || campoLower.includes("taxa") || campoLower.includes("mora");
    }
    if (selectedFocusFilter === "saldos") {
      return campoLower.includes("principal") || campoLower.includes("saldo") || campoLower.includes("amortiza") || campoLower.includes("parcela");
    }
    if (selectedFocusFilter === "tarifas") {
      return campoLower.includes("outros") || campoLower.includes("tarifa") || campoLower.includes("seguro") || campoLower.includes("venda");
    }
    if (selectedFocusFilter === "vencimento") {
      return campoLower.includes("vencimento") || campoLower.includes("carência") || campoLower.includes("prazo") || campoLower.includes("data") || campoLower.includes("correção") || campoLower.includes("cdi") || campoLower.includes("índice");
    }
    return true;
  });

  useEffect(() => {
    checkRedirectLoginResult().then((res) => {
      if (res?.user) {
        showToast(`Login efetuado com sucesso! Bem-vindo(a), ${res.user.displayName || res.user.email}`, "success");
      }
    });
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        try {
          const cred = await loginAnonymouslyWithName("Analista Financeiro");
          setUser(cred.user);
        } catch (e) {
          console.warn("Erro ao realizar login anônimo automático:", e);
          setUser(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Load official indexers on start
  useEffect(() => {
    fetchIndexadores();
    fetchHistoricalIndexadores();
  }, []);

  const fetchHistoricalIndexadores = async () => {
    setLoadingHistorical(true);
    try {
      const res = await fetch("/api/indexadores-historico");
      if (res.ok) {
        const data = await res.json();
        setHistoricalIndexadores(data);
      }
    } catch {
      // Keep default historical mock data silently
    } finally {
      setLoadingHistorical(false);
    }
  };

  const fetchIndexadores = async () => {
    setLoadingIndexadores(true);
    try {
      const res = await fetch("/api/indexadores");
      if (res.ok) {
        const data = await res.json();
        setIndexadores({
          CDI: typeof data.CDI === "number" ? data.CDI : 14.15,
          SELIC: typeof data.SELIC === "number" ? data.SELIC : 14.25,
          IPCA: typeof data.IPCA === "number" ? data.IPCA : 4.64,
          INPC: typeof data.INPC === "number" ? data.INPC : 4.33,
          TR: typeof data.TR === "number" ? data.TR : 1.25,
          PRE: 0.00
        });
        setIndexadoresStatus("success");
        setLastUpdated(new Date().toLocaleTimeString("pt-BR") + " (BACEN/SGS)");
      } else {
        setIndexadoresStatus("warning");
        setLastUpdated("Uso de valores referenciais de mercado");
      }
    } catch {
      setIndexadoresStatus("warning");
      setLastUpdated("Uso de valores referenciais de mercado");
    } finally {
      setLoadingIndexadores(false);
    }
  };

  const handleSaveSimulation = async () => {
    if (!user) {
      showToast("Por favor, faça login com a conta Google para salvar sua simulação.", "info");
      handleGoogleLogin();
      return;
    }
    
    setSaving(true);
    try {
      const isEditing = !!loadedSimulationId;
      const normNum = normalizeContractNumber(contrato.numero || "");

      // Duplicate contract check safeguard
      if (normNum) {
        const duplicateSim = savedSimulations.find(s => {
          const sNum = normalizeContractNumber(s.contractData?.numero || s.contrato?.numero || "");
          return sNum !== "" && sNum === normNum && s.id !== loadedSimulationId;
        });
        
        if (duplicateSim) {
          const existingContrato = duplicateSim.contractData || duplicateSim.contrato;
          const diffs: string[] = [];
          if (existingContrato.valorPrincipal !== contrato.valorPrincipal) {
            diffs.push(`Valor Principal: ${formatCurrency(existingContrato.valorPrincipal)} ➔ ${formatCurrency(contrato.valorPrincipal)}`);
          }
          if (existingContrato.taxaJurosAnual !== contrato.taxaJurosAnual) {
            diffs.push(`Taxa de Juros: ${existingContrato.taxaJurosAnual}% ➔ ${contrato.taxaJurosAnual}%`);
          }
          if (existingContrato.indexadorOriginal !== contrato.indexadorOriginal) {
            diffs.push(`Indexador: ${existingContrato.indexadorOriginal} ➔ ${contrato.indexadorOriginal}`);
          }
          if (existingContrato.emitente !== contrato.emitente) {
            diffs.push(`Emitente: ${existingContrato.emitente || "S/N"} ➔ ${contrato.emitente || "S/N"}`);
          }

          setDuplicateConflict({
            existingSim: duplicateSim,
            novoContrato: contrato,
            differences: diffs
          });
          setActiveNav("dashboard");
          showToast(`Trava de Segurança: O contrato nº ${contrato.numero} já consta cadastrado no sistema!`, "info");
          setSaving(false);
          return;
        }
      }

      const simulationId = loadedSimulationId || `${user.uid}_${Date.now()}`;
      const existingSim = isEditing ? savedSimulations.find(s => s.id === loadedSimulationId) : null;
      
      const userEmail = user.email || "analista@agro.com";
      const userName = user.displayName || userEmail.split("@")[0];

      const auditEntry: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userName: userName,
        userEmail: userEmail,
        action: isEditing ? "Atualização de Simulação" : "Criação de Contrato",
        details: isEditing 
          ? `Simulação do Contrato Nº ${contrato.numero || "S/N"} re-salva por ${userName}`
          : `Novo contrato Nº ${contrato.numero || "S/N"} cadastrado por ${userName}`
      };

      const simData = {
        userId: user.uid,
        createdById: existingSim?.createdById || user.uid,
        createdByName: existingSim?.createdByName || userName,
        createdByEmail: existingSim?.createdByEmail || userEmail,
        createdAt: existingSim?.createdAt || new Date().toISOString(),

        updatedById: user.uid,
        updatedByName: userName,
        updatedByEmail: userEmail,
        updatedAt: new Date().toISOString(),

        name: existingSim?.name || `Simulação - ${contrato.numero || "Sem Nome"}`,
        contractData: contrato,
        scenariosData: cenarios,
        laudo: laudo || null,
        associatedDocuments: existingSim?.associatedDocuments || [],
        history: existingSim?.history || [],
        auditLogs: [...(existingSim?.auditLogs || []), auditEntry],
        version: existingSim ? (existingSim.version || 1) + 1 : 1
      };
      
      await setDoc(doc(db, "simulations", simulationId), sanitizeFirestoreData(simData));
      setLoadedSimulationId(simulationId);
      await fetchSavedSimulations();
      showToast(isEditing ? "Simulação e Laudo atualizados com sucesso!" : "Simulação e Laudo salvos com sucesso!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `simulations`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLaudo = async () => {
    if (!user) {
      showToast("Por favor, faça login para salvar o laudo.", "info");
      return;
    }
    if (!laudo) {
      showToast("Nenhum laudo de irregularidades gerado para salvar.", "info");
      return;
    }

    setSaving(true);
    try {
      const simulationId = loadedSimulationId || `${user.uid}_${Date.now()}`;
      const existingSim = loadedSimulationId ? savedSimulations.find(s => s.id === loadedSimulationId) : null;

      const userEmail = user.email || "analista@agro.com";
      const userName = user.displayName || userEmail.split("@")[0];

      const auditEntry: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userName: userName,
        userEmail: userEmail,
        action: "Salvamento de Laudo Técnico",
        details: `Laudo de Irregularidades do Contrato Nº ${contrato.numero || "S/N"} gerado/salvo por ${userName}`
      };

      const simData = {
        userId: user.uid,
        createdById: existingSim?.createdById || user.uid,
        createdByName: existingSim?.createdByName || userName,
        createdByEmail: existingSim?.createdByEmail || userEmail,
        createdAt: existingSim?.createdAt || new Date().toISOString(),

        updatedById: user.uid,
        updatedByName: userName,
        updatedByEmail: userEmail,
        updatedAt: new Date().toISOString(),

        name: existingSim?.name || `Simulação - ${contrato.numero || "Sem Nome"}`,
        contractData: contrato,
        scenariosData: cenarios,
        laudo: laudo,
        associatedDocuments: existingSim?.associatedDocuments || [],
        history: existingSim?.history || [],
        auditLogs: [...(existingSim?.auditLogs || []), auditEntry],
        version: existingSim ? (existingSim.version || 1) : 1
      };

      await setDoc(doc(db, "simulations", simulationId), sanitizeFirestoreData(simData));
      setLoadedSimulationId(simulationId);
      await fetchSavedSimulations();
      showToast("Laudo de irregularidades salvo com sucesso na simulação!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `simulations`);
    } finally {
      setSaving(false);
    }
  };

  // Trigger file selection for contract upload
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setAnalysisError("");
    setAnalysisProgress("Lendo arquivo...");

    const progressMessages = [
      "Processando documento contratual...",
      "Extraindo dados do Emitente e do Credor...",
      "Identificando valores principais e taxas originais...",
      "Mapeando datas e cronograma de amortização das parcelas...",
      "Consolidando dados em formato estruturado pelo Gemini..."
    ];

    let messageIndex = 0;
    const interval = setInterval(() => {
      if (messageIndex < progressMessages.length - 1) {
        messageIndex++;
        setAnalysisProgress(progressMessages[messageIndex]);
      }
    }, 2500);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64Data = (event.target?.result as string).split(",")[1];
          setAnalysisProgress("IA do Gemini analisando o documento...");
          
          const response = await fetch("/api/analyze-contract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: file.type || "application/pdf",
              fileName: file.name
            })
          });

          const data = await response.json();
          clearInterval(interval);

          if (!response.ok) {
            throw new Error(data.error || "Ocorreu um erro desconhecido durante a análise do PDF.");
          }

          if (data && data.numero) {
            const cronograma = data.cronogramaParcelas && data.cronogramaParcelas.length > 0
              ? data.cronogramaParcelas.map((p: any) => {
                  const pYear = p.data ? new Date(p.data).getFullYear() : 9999;
                  return {
                    ...p,
                    paga: p.paga ?? (pYear < 2025), // Se o documento não disser, assuma pago antes de 2025
                    valorPrincipalManual: undefined,
                    valorJurosManual: undefined,
                    valorCorrecaoManual: undefined,
                    valorOutrosManual: undefined
                  };
                })
              : DEFAULT_CONTRATO.cronogramaParcelas;

            const novoContrato = {
              numero: data.numero,
              modalidade: data.modalidade || "",
              emitente: data.emitente,
              credor: data.credor,
              dataEmissao: data.dataEmissao,
              dataVencimento: data.dataVencimento,
              valorPrincipal: Number(data.valorPrincipal) || 100000.0,
              taxaJurosAnual: Number(data.taxaJurosAnual) || 3.5,
              indexadorOriginal: Object.values(Indexador).includes(data.indexador as Indexador)
                ? (data.indexador as Indexador)
                : Indexador.INPC,
              cronogramaParcelas: cronograma,
              produto: data.produto || "",
              quantidade: data.quantidade || "",
              valorEmissao: Number(data.valorEmissao) || Number(data.valorPrincipal)
            };

            const getContractDifferences = (c1: Contrato, c2: Contrato): string[] => {
              const diffs: string[] = [];
              if (c1.valorPrincipal !== c2.valorPrincipal) {
                diffs.push(`Valor Principal: de ${formatCurrency(c1.valorPrincipal)} para ${formatCurrency(c2.valorPrincipal)}`);
              }
              if (c1.taxaJurosAnual !== c2.taxaJurosAnual) {
                diffs.push(`Taxa de Juros Anual: de ${formatPercentage(c1.taxaJurosAnual)} para ${formatPercentage(c2.taxaJurosAnual)}`);
              }
              if (c1.indexadorOriginal !== c2.indexadorOriginal) {
                diffs.push(`Indexador: de ${c1.indexadorOriginal} para ${c2.indexadorOriginal}`);
              }
              if (c1.dataEmissao !== c2.dataEmissao) {
                diffs.push(`Data de Emissão: de ${formatDate(c1.dataEmissao)} para ${formatDate(c2.dataEmissao)}`);
              }
              if (c1.dataVencimento !== c2.dataVencimento) {
                diffs.push(`Data de Vencimento: de ${formatDate(c1.dataVencimento)} para ${formatDate(c2.dataVencimento)}`);
              }
              if ((c1.cronogramaParcelas?.length || 0) !== (c2.cronogramaParcelas?.length || 0)) {
                diffs.push(`Quantidade de Parcelas: de ${c1.cronogramaParcelas?.length || 0} para ${c2.cronogramaParcelas?.length || 0}`);
              }
              return diffs;
            };

            const duplicate = savedSimulations.find(s => {
              const cNum = normalizeContractNumber(s.contractData?.numero || s.contrato?.numero || "");
              const nNum = normalizeContractNumber(novoContrato.numero || "");
              return cNum !== "" && cNum === nNum;
            });

            const nameLower = (file.name || "").toLowerCase();
            const extractedTipo = (data.tipoDocumento || "").toString().toUpperCase();
            const isDdc = extractedTipo === "DDC" || nameLower.includes("ddc") || nameLower.includes("demonstrativo");
            const isPlano = extractedTipo === "PLANO" || nameLower.includes("plano") || nameLower.includes("recupe") || nameLower.includes("evolu");

            if (user && duplicate && (isDdc || isPlano)) {
              // Automatically associate as auxiliary document instead of causing a conflict block
              const newDoc: AssociatedDocument = {
                id: `doc_${Date.now()}`,
                name: file.name.replace(/\.[^/.]+$/, ""),
                type: isDdc ? "Demonstrativo de Saldo Devedor" : "Planilha de Evolução / Cálculo",
                fileName: file.name,
                fileData: base64Data,
                mimeType: file.type || "application/pdf",
                notes: `Associado e integrado de forma dinâmica via Inteligência Artificial.`,
                uploadDate: new Date().toISOString()
              };

              const existingDocs = duplicate.associatedDocuments || [];
              const updatedSim = {
                ...duplicate,
                associatedDocuments: [...existingDocs, newDoc],
                updatedAt: new Date().toISOString()
              };

              setDoc(doc(db, "simulations", duplicate.id), sanitizeFirestoreData(updatedSim))
                .then(async () => {
                  await fetchSavedSimulations();
                  // Automatically trigger the analysis and merge
                  await handleAnalyzeAndFill(duplicate.id, newDoc);
                  setAnalyzing(false);
                  setActiveNav("dashboard");
                })
                .catch((err) => {
                  handleFirestoreError(err, OperationType.UPDATE, `simulations/${duplicate.id}`);
                  setAnalyzing(false);
                });
            } else if (user && duplicate) {
              const diffs = getContractDifferences(duplicate.contractData || duplicate.contrato, novoContrato);
              setDuplicateConflict({
                existingSim: duplicate,
                novoContrato,
                differences: diffs
              });
              setAnalyzing(false);
              setActiveNav("contratos");
            } else {
              setContrato(novoContrato);
              setSelectedFluxoCenario("original");
              setAnalyzing(false);
              setActiveNav("dashboard"); // Return to simulation dashboard on success

              if (user) {
                const simulationId = `${user.uid}_${Date.now()}`;
                const userEmail = user.email || "analista@agro.com";
                const userName = user.displayName || userEmail.split("@")[0];

                const auditEntry: AuditLogEntry = {
                  id: `log_${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  userId: user.uid,
                  userName: userName,
                  userEmail: userEmail,
                  action: "Upload de Contrato (PDF/OCR)",
                  details: `Contrato Nº ${novoContrato.numero || "S/N"} subido e processado via OCR/IA por ${userName}`
                };

                const simData = {
                  userId: user.uid,
                  createdById: user.uid,
                  createdByName: userName,
                  createdByEmail: userEmail,
                  createdAt: new Date().toISOString(),

                  updatedById: user.uid,
                  updatedByName: userName,
                  updatedByEmail: userEmail,
                  updatedAt: new Date().toISOString(),

                  name: `Upload Auto - ${novoContrato.numero || "Sem Nome"}`,
                  contractData: novoContrato,
                  scenariosData: cenarios,
                  version: 1,
                  history: [],
                  associatedDocuments: [],
                  auditLogs: [auditEntry]
                };
                
                setDoc(doc(db, "simulations", simulationId), sanitizeFirestoreData(simData))
                  .then(() => fetchSavedSimulations())
                  .catch((err) => handleFirestoreError(err, OperationType.CREATE, `simulations/${simulationId}`));
              }
            }
          } else {
            throw new Error("Não foi possível extrair os campos do contrato. Verifique se o arquivo está legível.");
          }
        } catch (err: any) {
          clearInterval(interval);
          setAnalysisError(err.message || "Erro ao comunicar com o servidor.");
          setAnalyzing(false);
        }
      };

      reader.onerror = () => {
        clearInterval(interval);
        setAnalysisError("Não foi possível ler o arquivo.");
        setAnalyzing(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      clearInterval(interval);
      setAnalysisError(err.message || "Erro desconhecido.");
      setAnalyzing(false);
    }
  };

  const handleLoadDemoContract = async () => {
    setAnalyzing(true);
    setAnalysisError("");
    setAnalysisProgress("Carregando Cédula de Produto Rural de demonstração (CPR C30528645-1)...");

    try {
      const response = await fetch("/api/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: "",
          mimeType: "application/pdf",
          fileName: "1 - Cédula de Produto Rural C30528645-1.pdf"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao carregar a CPR de demonstração.");
      }

      if (data && data.numero) {
        const cronograma = data.cronogramaParcelas && data.cronogramaParcelas.length > 0
          ? data.cronogramaParcelas.map((p: any) => ({
              ...p,
              paga: p.paga ?? false,
              valorPrincipalManual: undefined,
              valorJurosManual: undefined,
              valorCorrecaoManual: undefined,
              valorOutrosManual: undefined
            }))
          : DEFAULT_CONTRATO.cronogramaParcelas;

        const novoContrato: Contrato = {
          numero: data.numero,
          modalidade: data.modalidade || "Cédula de Produto Rural (CPR-Financeira)",
          emitente: data.emitente || "JULINERE GOULART BENTOS",
          credor: data.credor || "SICREDI",
          dataEmissao: data.dataEmissao || "2023-08-31",
          dataVencimento: data.dataVencimento || "2028-08-15",
          valorPrincipal: Number(data.valorPrincipal) || 2300000.0,
          taxaJurosAnual: Number(data.taxaJurosAnual) || 3.7,
          indexadorOriginal: Object.values(Indexador).includes(data.indexador as Indexador)
            ? (data.indexador as Indexador)
            : Indexador.CDI,
          cronogramaParcelas: cronograma,
          produto: data.produto || "MILHO EM GRÃO A GRANEL",
          quantidade: data.quantidade || "65545.74 SACA(S) DE 60 QUILOS",
          valorEmissao: Number(data.valorEmissao) || 2300000.0
        };

        setContrato(novoContrato);
        setSelectedFluxoCenario("original");
        setAnalyzing(false);
        setActiveNav("dashboard");
        showToast("Contrato CPR C30528645-1 carregado com sucesso no Simulador!", "success");
      } else {
        throw new Error("Não foi possível carregar os dados do contrato de demonstração.");
      }
    } catch (err: any) {
      setAnalyzing(false);
      setAnalysisError(err.message || "Erro ao carregar CPR de demonstração.");
    }
  };

  const handleClearContract = () => {
    setContrato(EMPTY_CONTRATO);
    setLoadedSimulationId(null);
    setLaudo(null);
    showToast("Tela limpa! Selecione um contrato em 'Contratos Salvos' ou envie um novo arquivo.", "info");
  };

  const handleResolveKeepExisting = () => {
    if (!duplicateConflict) return;
    const { existingSim } = duplicateConflict;
    const cData = existingSim.contractData || existingSim.contrato;
    const sData = existingSim.scenariosData || existingSim.cenarios;
    setContrato(cData);
    if (sData) setCenarios(sData);
    setDuplicateConflict(null);
    setActiveNav("dashboard");
  };

  const handleResolveOverwrite = async () => {
    if (!duplicateConflict || !user) return;
    const { existingSim, novoContrato } = duplicateConflict;
    setSaving(true);
    try {
      const userEmail = user.email || "analista@agro.com";
      const userName = user.displayName || userEmail.split("@")[0];

      const auditEntry: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userName: userName,
        userEmail: userEmail,
        action: "Sobrescrita de Contrato Duplicado",
        details: `Contrato Nº ${novoContrato.numero} sobrescrito e unificado no banco por ${userName}`
      };

      const simData = {
        ...existingSim,
        contractData: novoContrato,
        updatedById: user.uid,
        updatedByName: userName,
        updatedByEmail: userEmail,
        updatedAt: new Date().toISOString(),
        auditLogs: [...(existingSim.auditLogs || []), auditEntry]
      };
      await setDoc(doc(db, "simulations", existingSim.id), sanitizeFirestoreData(simData));
      await fetchSavedSimulations();
      setContrato(novoContrato);
      setDuplicateConflict(null);
      setActiveNav("dashboard");
      showToast("Contrato sobrescrito e unificado com sucesso!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `simulations/${existingSim.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResolveNewVersion = async (changeSummary: string) => {
    if (!duplicateConflict || !user) return;
    const { existingSim, novoContrato } = duplicateConflict;
    setSaving(true);
    try {
      const currentVersion = existingSim.version || 1;
      const newVersion = currentVersion + 1;
      const userEmail = user.email || "analista@agro.com";
      const userName = user.displayName || userEmail.split("@")[0];
      
      const historyEntry: ContractHistoryEntry = {
        version: currentVersion,
        contractData: existingSim.contractData || existingSim.contrato,
        updatedAt: existingSim.updatedAt || existingSim.createdAt || new Date().toISOString(),
        changeSummary: changeSummary || "Atualização de dados via upload de novo documento"
      };

      const auditEntry: AuditLogEntry = {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userName: userName,
        userEmail: userEmail,
        action: `Nova Versão Criada (v${newVersion})`,
        details: `Versão v${newVersion} gerada por ${userName}. Motivo: ${changeSummary || "Detecção de duplicidade"}`
      };

      const existingHistory = existingSim.history || [];
      
      const simData = {
        ...existingSim,
        name: `v${newVersion} - Simulação - ${novoContrato.numero || "Sem Nome"}`,
        contractData: novoContrato,
        version: newVersion,
        history: [...existingHistory, historyEntry],
        updatedById: user.uid,
        updatedByName: userName,
        updatedByEmail: userEmail,
        updatedAt: new Date().toISOString(),
        auditLogs: [...(existingSim.auditLogs || []), auditEntry]
      };

      await setDoc(doc(db, "simulations", existingSim.id), sanitizeFirestoreData(simData));
      await fetchSavedSimulations();
      setContrato(novoContrato);
      setDuplicateConflict(null);
      setActiveNav("dashboard");
      showToast(`Nova versão (v${newVersion}) criada com sucesso!`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `simulations/${existingSim.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAssociatedDocument = async (simId: string, docData: { name: string; type: string; notes: string; fileName: string; fileData?: string; mimeType?: string }) => {
    const sim = savedSimulations.find(s => s.id === simId);
    if (!sim || !user) return;
    
    const userEmail = user.email || "analista@agro.com";
    const userName = user.displayName || userEmail.split("@")[0];

    const newDoc: AssociatedDocument = {
      id: `doc_${Date.now()}`,
      uploadDate: new Date().toISOString(),
      name: docData.name || "Documento Sem Nome",
      type: docData.type || "Outro",
      fileName: docData.fileName || "arquivo.pdf",
      notes: docData.notes,
      fileData: docData.fileData,
      mimeType: docData.mimeType
    };
    
    const auditEntry: AuditLogEntry = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userName: userName,
      userEmail: userEmail,
      action: "Anexo de Documento do Banco",
      details: `Documento '${newDoc.name}' (${newDoc.type}) anexado ao contrato por ${userName}`
    };

    const updatedDocs = [...(sim.associatedDocuments || []), newDoc];
    const updatedSim = {
      ...sim,
      associatedDocuments: updatedDocs,
      updatedById: user.uid,
      updatedByName: userName,
      updatedByEmail: userEmail,
      updatedAt: new Date().toISOString(),
      auditLogs: [...(sim.auditLogs || []), auditEntry]
    };
    
    try {
      await setDoc(doc(db, "simulations", simId), sanitizeFirestoreData(updatedSim));
      await fetchSavedSimulations();
      setNewDocForm(null);
      showToast("Documento associado com sucesso!", "success");
      
      // Automatically analyze document with Gemini and auto-fill contract data
      if (newDoc.fileData) {
        await handleAnalyzeAndFill(simId, newDoc);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `simulations/${simId}`);
    }
  };

  const renderAttachDocumentForm = (simId: string) => {
    if (newDocForm?.simId !== simId) return null;

    return (
      <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 text-xs space-y-3 shadow-xs my-3 text-left">
        <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
          <h5 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            Anexar Documento do Banco (DDC, Extrato, Planilha ou CPR)
          </h5>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            Leitura Inteligente com IA
          </span>
        </div>

        {/* File Input & Selection Dropzone */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-slate-600 uppercase">
            1. Selecionar Arquivo do Computador <span className="text-red-500">*</span>
          </label>
          
          {newDocForm.fileName ? (
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-emerald-300 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{newDocForm.fileName}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">Pronto para ser anexado e analisado com IA</p>
                </div>
              </div>
              <label className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-lg text-[11px] font-bold cursor-pointer transition border border-slate-200 shrink-0">
                Alterar Arquivo
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const base64 = evt.target?.result as string;
                      const cleanName = file.name.replace(/\.[^/.]+$/, "");
                      setNewDocForm(prev => prev ? {
                        ...prev,
                        fileName: file.name,
                        fileData: base64,
                        mimeType: file.type || "application/pdf",
                        name: prev.name || cleanName
                      } : null);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/50 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-center gap-2.5 cursor-pointer transition text-emerald-800 font-bold text-center group">
              <UploadCloud className="w-5 h-5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              <span>Clique aqui para escolher o documento (PDF, PNG, JPG ou Excel)</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    const base64 = evt.target?.result as string;
                    const cleanName = file.name.replace(/\.[^/.]+$/, "");
                    setNewDocForm(prev => prev ? {
                      ...prev,
                      fileName: file.name,
                      fileData: base64,
                      mimeType: file.type || "application/pdf",
                      name: prev.name || cleanName
                    } : null);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          )}
        </div>

        {/* Metadata Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              2. Nome de Identificação
            </label>
            <input
              type="text"
              placeholder="Ex: Demonstrativo de Saldo Devedor Sicredi"
              value={newDocForm.name}
              onChange={e => setNewDocForm({ ...newDocForm, name: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
              3. Tipo do Documento
            </label>
            <select
              value={newDocForm.type}
              onChange={e => setNewDocForm({ ...newDocForm, type: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="Demonstrativo de Saldo Devedor">Demonstrativo de Saldo Devedor (DDC)</option>
              <option value="Planilha de Evolução / Cálculo">Planilha de Evolução / Cálculo</option>
              <option value="Notificação de Atraso / Cobrança">Notificação de Atraso / Cobrança</option>
              <option value="Aditivo Contratual">Aditivo Contratual</option>
              <option value="Laudo / Parecer Técnico">Laudo / Parecer Técnico</option>
              <option value="Cédula / CPR">Cédula de Produto Rural (CPR)</option>
              <option value="Outro">Outro Documento</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
            Observações / Notas (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ex: Documento enviado pelo banco contendo valores amortizados e saldo em aberto"
            value={newDocForm.notes || ""}
            onChange={e => setNewDocForm({ ...newDocForm, notes: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 font-medium"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200/80">
          <button
            type="button"
            onClick={() => setNewDocForm(null)}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!newDocForm.fileData && !newDocForm.fileName}
            onClick={() => handleAddAssociatedDocument(simId, newDocForm)}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>Anexar e Processar com IA</span>
          </button>
        </div>
      </div>
    );
  };

  const handleDeleteAssociatedDocument = async (simId: string, docId: string) => {
    showConfirm("Tem certeza que deseja remover este documento?", async () => {
      const sim = savedSimulations.find(s => s.id === simId);
      if (!sim || !user) return;
      
      const updatedDocs = (sim.associatedDocuments || []).filter((d: any) => d.id !== docId);
      const updatedSim = {
        ...sim,
        associatedDocuments: updatedDocs,
        updatedAt: new Date().toISOString()
      };
      
      try {
        await setDoc(doc(db, "simulations", simId), sanitizeFirestoreData(updatedSim));
        await fetchSavedSimulations();
        showToast("Documento removido com sucesso!", "success");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `simulations/${simId}`);
      }
    });
  };

  const handleAnalyzeAndFill = async (simId: string, docItem: AssociatedDocument) => {
    if (!docItem.fileData) {
      showToast("Este documento não possui dados de arquivo para análise.", "error");
      return;
    }

    const sim = savedSimulations.find(s => s.id === simId);
    const contractNum = sim?.contractData?.numero || sim?.contrato?.numero || "C00000000-0";

    setAnalyzingDocId(docItem.id);
    showToast("Análise agendada na fila de segundo plano do Firestore. Gemini Flash 3.6 atualizará em breve...", "info");

    try {
      await enqueueDocAnalysisTask({
        simulationId: simId,
        contractNumber: contractNum,
        docItem: {
          id: docItem.id,
          fileName: docItem.fileName || docItem.name || "Documento Auxiliar",
          fileData: docItem.fileData,
          mimeType: docItem.mimeType || "application/pdf",
          type: docItem.type
        },
        userId: user?.uid,
        userName: user?.displayName || "Analista",
        userEmail: user?.email || undefined
      });

      await fetchSavedSimulations();
    } catch (err: any) {
      console.error("Erro ao agendar análise do documento na fila:", err);
      showToast("Erro ao agendar análise do documento: " + err.message, "error");
    } finally {
      setTimeout(() => setAnalyzingDocId(null), 800);
    }
  };

  const handleRevertVersion = async (simId: string, historyEntry: ContractHistoryEntry) => {
    showConfirm(`Tem certeza que deseja reverter para a versão ${historyEntry.version}?`, async () => {
      const sim = savedSimulations.find(s => s.id === simId);
      if (!sim || !user) return;

      const currentVersion = sim.version || 1;
      const historyEntryForCurrent: ContractHistoryEntry = {
        version: currentVersion,
        contractData: sim.contractData || sim.contrato,
        updatedAt: new Date().toISOString(),
        changeSummary: `Reversão para a versão ${historyEntry.version}`
      };

      const updatedHistory = [...(sim.history || []), historyEntryForCurrent].filter(h => h.version !== historyEntry.version);
      
      const updatedSim = {
        ...sim,
        contractData: historyEntry.contractData,
        version: historyEntry.version,
        history: updatedHistory,
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, "simulations", simId), sanitizeFirestoreData(updatedSim));
        await fetchSavedSimulations();
        setContrato(historyEntry.contractData);
        showToast(`Contrato revertido com sucesso para a versão ${historyEntry.version}!`, "success");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `simulations/${simId}`);
      }
    });
  };

  // Scenario calculations
  const originalCustoTotal = calcularProjecao(contrato, contrato.indexadorOriginal, contrato.taxaJurosAnual, indexadores);
  const totalPagoOriginal = originalCustoTotal.reduce((sum, p) => sum + p.totalPago, 0);
  const totalJurosOriginal = originalCustoTotal.reduce((sum, p) => sum + p.jurosOriginal, 0);

  // Compute all scenarios
  const resultadosCenarios: ResultadoCenario[] = cenarios.map(cen => 
    processarCenario(
      cen.id,
      cen.nome,
      cen.indexador,
      cen.taxaJurosAnual,
      contrato,
      indexadores,
      totalPagoOriginal
    )
  );

  // Sort by total cost to find the absolute best option
  const cenariosOrdenados = [...resultadosCenarios].sort((a, b) => a.totalPago - b.totalPago);
  const melhorCenario = cenariosOrdenados[0] || {
    nome: "Sem simulação",
    economiaRelativa: 0,
    totalPago: 0,
    totalJuros: 0,
    totalAmortizado: 0,
    id: "",
    indexador: Indexador.PRE,
    taxaJurosAnual: 0,
    parcelas: []
  };
  const piorCenario = [...resultadosCenarios].sort((a, b) => b.totalPago - a.totalPago)[0] || melhorCenario;

  // Manual override of indexer rates
  const handleIndexadorRateChange = (indexador: Indexador, value: number) => {
    setIndexadores(prev => ({
      ...prev,
      [indexador]: value
    }));
  };

  // Form field handlers for contrato
  const handleContratoChange = (field: keyof Contrato, value: any) => {
    setContrato(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Modify individual installment
  const handleInstallmentChange = (index: number, field: keyof ParcelaScheduling, value: any) => {
    const updated = contrato.cronogramaParcelas.map((p, idx) => {
      if (idx === index) {
        if (field === "percentualAmortizacao") {
          return { ...p, [field]: Number(value) };
        } else if (field === "paga") {
          const isPaga = value === "true" || value === true;
          return { ...p, [field]: isPaga, valorAmortizadoPago: isPaga ? p.valorAmortizadoPago : undefined };
        } else if (
          field === "valorAmortizadoPago" || 
          field === "valorPrincipalManual" || 
          field === "valorJurosManual" || 
          field === "valorCorrecaoManual" || 
          field === "valorOutrosManual" ||
          field === "valorIofManual" ||
          field === "valorSeguroManual" ||
          field === "valorTaxaRegistroManual"
        ) {
          return { ...p, [field]: value === "" || value === undefined || value === null ? undefined : Number(value) };
        } else {
          return { ...p, [field]: value };
        }
      }
      return p;
    });
    setContrato(prev => ({
      ...prev,
      cronogramaParcelas: updated
    }));
  };

  // Clear manual detail overrides
  const clearManualInstallmentDetails = (index: number) => {
    const updated = contrato.cronogramaParcelas.map((p, idx) => {
      if (idx === index) {
        return {
          ...p,
          valorAmortizadoPago: undefined,
          valorPrincipalManual: undefined,
          valorJurosManual: undefined,
          valorCorrecaoManual: undefined,
          valorOutrosManual: undefined,
          valorIofManual: undefined,
          valorSeguroManual: undefined,
          valorTaxaRegistroManual: undefined
        };
      }
      return p;
    });
    setContrato(prev => ({
      ...prev,
      cronogramaParcelas: updated
    }));
  };

  // Add new installment
  const addInstallment = () => {
    let nextDate = "2028-10-07";
    if (contrato.cronogramaParcelas.length > 0) {
      const lastDateStr = contrato.cronogramaParcelas[contrato.cronogramaParcelas.length - 1].data;
      const lastDate = new Date(lastDateStr + "T00:00:00");
      lastDate.setFullYear(lastDate.getFullYear() + 1);
      nextDate = lastDate.toISOString().split("T")[0];
    }
    
    const currentTotal = contrato.cronogramaParcelas.reduce((sum, p) => sum + p.percentualAmortizacao, 0);
    const proposedPercent = Math.max(0, 100 - currentTotal);
    
    setContrato(prev => ({
      ...prev,
      cronogramaParcelas: [
        ...prev.cronogramaParcelas,
        { data: nextDate, percentualAmortizacao: proposedPercent > 0 ? proposedPercent : 20.00 }
      ]
    }));
  };

  // Remove installment
  const removeInstallment = (index: number) => {
    const updated = contrato.cronogramaParcelas.filter((_, i) => i !== index);
    setContrato(prev => ({
      ...prev,
      cronogramaParcelas: updated
    }));
  };

  // Add custom simulation scenario
  const handleAddCenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenarioNome.trim()) return;

    const id = "cen-" + Date.now();
    setCenarios(prev => [
      ...prev,
      {
        id,
        nome: newCenarioNome,
        indexador: newCenarioIndexador,
        taxaJurosAnual: newCenarioTaxa
      }
    ]);

    setNewCenarioNome("");
    setNewCenarioTaxa(2.0);
  };

  // Remove simulation scenario
  const handleRemoveCenario = (id: string) => {
    setCenarios(prev => prev.filter(c => c.id !== id));
    if (selectedFluxoCenario === id) {
      setSelectedFluxoCenario("original");
    }
  };

  // Export CSV / Excel compatible file
  const triggerCSVExport = () => {
    const originalResult: ResultadoCenario = {
      id: "original",
      nome: "Contrato Original Vigente",
      indexador: contrato.indexadorOriginal,
      taxaJurosAnual: contrato.taxaJurosAnual,
      totalPago: totalPagoOriginal,
      totalJuros: totalJurosOriginal,
      totalAmortizado: contrato.valorPrincipal,
      economiaRelativa: 0,
      parcelas: originalCustoTotal
    };

    const allResults = [originalResult, ...resultadosCenarios];
    const csvContent = exportToCSV(allResults, contrato);
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Simulacao_CreditoRural_${contrato.numero || "Geral"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Planilha Excel/CSV baixada com sucesso (Resumo de Cenários e Fluxos)!", "success");
  };

  // Dedicated Professional Printable Window for PDF Generation
  const triggerPDFExport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatorio_Tecnico_Renegociacao_${contrato.numero || "Contrato"}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.4; font-size: 11px; margin: 0; padding: 20px; }
            .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 18px; font-weight: 800; color: #064e3b; text-transform: uppercase; margin: 0; }
            .subtitle { font-size: 11px; color: #475569; margin-top: 2px; }
            .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .meta-val { font-size: 11px; font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
            th { background: #0f172a; color: #ffffff; font-weight: 700; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; }
            td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
            tr:nth-child(even) { background: #f8fafc; }
            .section-title { font-size: 12px; font-weight: 800; color: #0f172a; margin: 16px 0 8px 0; border-left: 4px solid #059669; padding-left: 8px; text-transform: uppercase; }
            .summary-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
            .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; pt: 12px; font-size: 9px; color: #64748b; text-align: center; }
            .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
            .sig-line { width: 45%; border-top: 1px solid #64748b; text-align: center; padding-top: 4px; font-size: 10px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">AgroCredit Simulador Pro</h1>
              <div class="subtitle">Relatório Técnico de Auditoria & Renegociação de Cédula Rural</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #059669;">Data: ${new Date().toLocaleDateString("pt-BR")}</div>
              <div style="font-size: 9px; color: #64748b;">Nº Cédula: ${contrato.numero || "S/N"}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Número do Contrato</span><span class="meta-val">${contrato.numero || "N/A"}</span></div>
            <div class="meta-item"><span class="meta-label">Emitente / Devedor</span><span class="meta-val">${contrato.emitente || "N/A"}</span></div>
            <div class="meta-item"><span class="meta-label">Instituição Credora</span><span class="meta-val">${contrato.credor || "N/A"}</span></div>
            <div class="meta-item"><span class="meta-label">Valor Principal</span><span class="meta-val">${formatCurrency(contrato.valorPrincipal)}</span></div>
            <div class="meta-item"><span class="meta-label">Data de Emissão</span><span class="meta-val">${formatDate(contrato.dataEmissao)}</span></div>
            <div class="meta-item"><span class="meta-label">Vencimento Final</span><span class="meta-val">${formatDate(contrato.dataVencimento)}</span></div>
            <div class="meta-item"><span class="meta-label">Taxa Pactuada</span><span class="meta-val">${contrato.taxaJurosAnual}% a.a. + ${contrato.indexadorOriginal}</span></div>
            <div class="meta-item"><span class="meta-label">Garantia / Produto</span><span class="meta-val">${contrato.produto || "Cédula de Crédito"}</span></div>
            <div class="meta-item"><span class="meta-label">Status da Auditoria</span><span class="meta-val" style="color: #059669;">Sincronizado & Auditado</span></div>
          </div>

          <div class="section-title">1. Resumo Comparativo dos Cenários de Renegociação</div>
          <table>
            <thead>
              <tr>
                <th>Cenário</th>
                <th>Indexador</th>
                <th>Taxa Fixa</th>
                <th>Principal Amortizado</th>
                <th>Total Juros</th>
                <th>Custo Total Financeiro</th>
                <th>Economia Relativa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Original Vigente</strong></td>
                <td>${contrato.indexadorOriginal}</td>
                <td>${contrato.taxaJurosAnual}% a.a.</td>
                <td>${formatCurrency(contrato.valorPrincipal)}</td>
                <td>${formatCurrency(totalJurosOriginal)}</td>
                <td><strong>${formatCurrency(totalPagoOriginal)}</strong></td>
                <td>—</td>
              </tr>
              ${resultadosCenarios.map(cen => `
                <tr>
                  <td><strong>${cen.nome}</strong></td>
                  <td>${cen.indexador}</td>
                  <td>${cen.taxaJurosAnual}% a.a.</td>
                  <td>${formatCurrency(cen.totalAmortizado)}</td>
                  <td>${formatCurrency(cen.totalJuros)}</td>
                  <td><strong>${formatCurrency(cen.totalPago)}</strong></td>
                  <td style="color: #059669; font-weight: 700;">${cen.economiaRelativa > 0 ? formatCurrency(cen.economiaRelativa) : "R$ 0,00"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">2. Cronograma Detalhado de Parcelas e Fluxo de Caixa</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Vencimento</th>
                <th>% Amort.</th>
                <th>Amortização Principal</th>
                <th>Correção Monetária</th>
                <th>Juros / Encargos</th>
                <th>Valor Total Parcela</th>
                <th>Saldo Devedor Residual</th>
              </tr>
            </thead>
            <tbody>
              ${cronogramaComStatus.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${formatDate(p.data)}</td>
                  <td>${p.percentualAmortizacao}%</td>
                  <td>${formatCurrency(p.principal)}</td>
                  <td>${formatCurrency(p.correcao)}</td>
                  <td>${formatCurrency(p.juros)}</td>
                  <td><strong>${formatCurrency(p.valorCalculado)}</strong></td>
                  <td>${formatCurrency(p.saldoDevedor)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          ${laudo ? `
            <div class="section-title">3. Parecer Técnico & Laudo de Irregularidades Detectadas</div>
            <div class="summary-box">
              <div style="font-weight: 700; font-size: 12px; margin-bottom: 4px;">Parecer da Auditoria:</div>
              <div>${laudo.resumo || "Sem irregularidades impeditivas identificadas."}</div>
              ${laudo.pontosDeAtencao && laudo.pontosDeAtencao.length > 0 ? `
                <div style="margin-top: 8px; font-weight: 700;">Pontos de Atenção:</div>
                <ul style="margin-top: 4px; padding-left: 16px;">
                  ${laudo.pontosDeAtencao.map((ponto: string) => `<li>${ponto}</li>`).join("")}
                </ul>
              ` : ""}
              ${laudo.divergencias && laudo.divergencias.length > 0 ? `
                <div style="margin-top: 8px; font-weight: 700;">Divergências Identificadas nos Documentos do Banco:</div>
                <ul style="margin-top: 4px; padding-left: 16px;">
                  ${laudo.divergencias.map((d: any) => `<li><strong>${d.campo || "Divergência"}:</strong> ${d.detalhe || d.valorDocumento}</li>`).join("")}
                </ul>
              ` : ""}
            </div>
          ` : ""}

          <div class="signatures">
            <div class="sig-line">
              <strong>${user?.displayName || "Analista / Perito Responsável"}</strong><br/>
              Perícia de Crédito Rural
            </div>
            <div class="sig-line">
              <strong>${contrato.emitente || "Produtor Rural"}</strong><br/>
              Devedor / Emitente
            </div>
          </div>

          <div class="footer">
            Relatório gerado automaticamente via AgroCredit Simulador Pro • Módulo de Cálculo Auditável.
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast("Relatório PDF preparado para impressão/download com sucesso!", "success");
  };

  // Get data for chart comparing total values
  const chartDataTotal = [
    {
      name: "Original Vigente",
      "Principal Amortizado": contrato.valorPrincipal,
      "Juros Acumulados": totalJurosOriginal,
      "Custo Total": totalPagoOriginal
    },
    ...resultadosCenarios.map(cen => ({
      name: cen.nome,
      "Principal Amortizado": cen.totalAmortizado,
      "Juros Acumulados": cen.totalJuros,
      "Custo Total": cen.totalPago
    }))
  ];

  // Get active cash flow parcelas for detailed view
  const activeFluxoParcelas = selectedFluxoCenario === "original"
    ? originalCustoTotal
    : resultadosCenarios.find(r => r.id === selectedFluxoCenario)?.parcelas || [];

  const activeCenarioLabel = selectedFluxoCenario === "original"
    ? `Contrato Original (${contrato.taxaJurosAnual}% + ${contrato.indexadorOriginal})`
    : (() => {
        const found = cenarios.find(c => c.id === selectedFluxoCenario);
        return found ? `${found.nome} (${found.taxaJurosAnual}% + ${found.indexador})` : "Simulação";
      })();

  // Dynamic payment and overdue updates calculations
  const cronogramaComStatus = contrato.cronogramaParcelas.map((p, idx) => {
    const isPaga = !!p.paga;
    const pDate = new Date(p.data + "T00:00:00");
    const today = new Date(dataHoje + "T00:00:00");
    const isVencida = !isPaga && (pDate.getTime() < today.getTime());
    
    // Fallback projected values
    const projOriginal = originalCustoTotal && originalCustoTotal[idx];
    const principalEsperado = p.valorPrincipalManual !== undefined
      ? p.valorPrincipalManual
      : (projOriginal ? projOriginal.amortizacao : (contrato.valorPrincipal * (p.percentualAmortizacao / 100)));
    
    const jurosSpreadEsperado = projOriginal ? projOriginal.jurosSpread : 0;
    const jurosIndexerEsperado = projOriginal ? projOriginal.jurosIndexador : 0;

    // Effective components (use manual if defined, otherwise fall back to projected/calculated)
    const principal = p.valorPrincipalManual ?? principalEsperado;
    let juros = p.valorJurosManual ?? jurosSpreadEsperado;
    let correcao = p.valorCorrecaoManual ?? jurosIndexerEsperado;
    const outros = p.valorOutrosManual ?? 0;
    const iof = p.valorIofManual ?? 0;
    const seguro = p.valorSeguroManual ?? 0;
    const taxaRegistro = p.valorTaxaRegistroManual ?? 0;

    let daysOverdue = 0;
    let jurosAdicionais = 0;
    let correcaoAdicional = 0;

    let jurosMora = 0;
    let multa = 0;
    let jurosAdicionaisSpread = 0;

    if (isVencida) {
      const d1 = pDate;
      const d2 = today;
      const diffTime = d2.getTime() - d1.getTime();
      daysOverdue = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      
      const rIndexador = indexadores[contrato.indexadorOriginal] / 100;
      const rSpread = contrato.taxaJurosAnual / 100;
      
      // Calculate additional update factor from due date to today unconditionally
      // assuming manual values represent the value AT THE DUE DATE.
      const valorBaseVencimento = principal + juros + correcao + outros + iof + seguro + taxaRegistro;
      
      // Juros remuneratórios e correção pelo período de atraso
      const updateFactorSpread = Math.pow(1 + rSpread, daysOverdue / 365) - 1;
      const updateFactorIndexador = Math.pow(1 + rIndexador, daysOverdue / 365) - 1;
      
      jurosAdicionaisSpread = valorBaseVencimento * updateFactorSpread;
      jurosAdicionais = jurosAdicionaisSpread;
      correcaoAdicional = valorBaseVencimento * updateFactorIndexador;

      // Cálculo de Multa (2%) e Juros de Mora (1% a.m.) sobre o valor atualizado
      const valorAtualizado = valorBaseVencimento + jurosAdicionais + correcaoAdicional;
      multa = valorAtualizado * 0.02; // 2% de multa padrão
      jurosMora = valorAtualizado * (0.01 * (daysOverdue / 30)); // 1% ao mês pro-rata

      // Adiciona mora aos juros e multa aos outros
      jurosAdicionais += jurosMora;
    }

    // Grand total calculated for this installment
    const totalComponentes = principal + juros + jurosAdicionais + correcao + correcaoAdicional + outros + multa + iof + seguro + taxaRegistro;
    const valorCalculado = isPaga 
      ? (p.valorAmortizadoPago ?? totalComponentes)
      : totalComponentes;

    const jurosRemuneratorios = juros + jurosAdicionaisSpread;
    const encargosMoratorios = jurosMora;
    const correcaoMonetaria = correcao + correcaoAdicional;
    const outrosComMulta = outros + multa;
    const valorAmortizado = isPaga ? valorCalculado : 0;
    const saldoDevedor = isPaga ? 0 : totalComponentes;
    const situacaoLabel = isPaga ? "L" : (isVencida ? "E" : "A");

    return {
      ...p,
      isPaga,
      isVencida,
      daysOverdue,
      principal,
      juros: juros + jurosAdicionais,
      jurosBase: juros,
      jurosAdicionais,
      correcao: correcao + correcaoAdicional,
      correcaoBase: correcao,
      correcaoAdicional,
      outros: outros + multa,
      outrosBase: outros,
      iof,
      seguro,
      taxaRegistro,
      multa,
      totalComponentes,
      valorCalculado,
      // Novas colunas conforme Demonstrativo do Banco (Sicredi)
      jurosRemuneratorios,
      encargosMoratorios,
      correcaoMonetaria,
      outrosComMulta,
      valorAmortizado,
      saldoDevedor,
      situacaoLabel
    };
  });

  const totalPagoRealizado = cronogramaComStatus.reduce((sum, p) => p.isPaga ? sum + p.valorCalculado : sum, 0);
  const totalVencidoCorrigido = cronogramaComStatus.reduce((sum, p) => p.isVencida ? sum + p.valorCalculado : sum, 0);
  const totalFuturoPendente = cronogramaComStatus.reduce((sum, p) => (!p.isPaga && !p.isVencida) ? sum + p.valorCalculado : sum, 0);
  const custoTotalCorrigidoGeral = totalPagoRealizado + totalVencidoCorrigido + totalFuturoPendente;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans overflow-hidden print:overflow-visible print:bg-white print:p-0">
      
      {/* PERSISTENT SLEEK SIDEBAR */}
      <aside className={`bg-slate-900 text-white flex flex-col p-6 shadow-xl shrink-0 border-r border-slate-800 print:hidden justify-between transition-all duration-300 relative ${isSidebarOpen ? "w-72" : "w-20 items-center"}`}>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-6 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 z-10"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <div className="space-y-6 w-full">
          
          {/* Logo Brand Header */}
          <div className={`flex items-center gap-2.5 ${!isSidebarOpen && "justify-center"}`}>
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0 font-bold text-base text-slate-900 shadow-lg shadow-emerald-500/20">
              R
            </div>
            {isSidebarOpen && (
              <div className="whitespace-nowrap overflow-hidden">
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  AgroCredit
                </h1>
                <span className="text-emerald-400 text-[10px] font-semibold block uppercase tracking-wider">
                  Simulador Pro
                </span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 w-full">
            <button
              onClick={() => setActiveNav("dashboard")}
              title={!isSidebarOpen ? "Painel de Simulação" : undefined}
              className={`w-full p-2.5 rounded-lg flex items-center ${isSidebarOpen ? "gap-2.5" : "justify-center"} transition font-medium text-xs text-left cursor-pointer ${
                activeNav === "dashboard"
                  ? "bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Painel de Simulação</span>}
            </button>

            <button
              onClick={() => setActiveNav("contratos")}
              title={!isSidebarOpen ? "Contratos" : undefined}
              className={`w-full p-2.5 rounded-lg flex items-center ${isSidebarOpen ? "gap-2.5" : "justify-center"} transition font-medium text-xs text-left cursor-pointer ${
                activeNav === "contratos"
                  ? "bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Contratos</span>}
            </button>

            <button
              onClick={() => {
                setResumoConsolidadoEmitente(emitenteFilter || "");
                setIsResumoConsolidadoOpen(true);
              }}
              title={!isSidebarOpen ? "Resumo Consolidado" : undefined}
              className={`w-full p-2.5 rounded-lg flex items-center ${isSidebarOpen ? "gap-2.5" : "justify-center"} transition font-medium text-xs text-left cursor-pointer text-slate-400 hover:bg-slate-800/60 hover:text-white`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Resumo Consolidado</span>}
            </button>

            <button
              onClick={() => setActiveNav("indexadores")}
              title={!isSidebarOpen ? "Configurar Taxas" : undefined}
              className={`w-full p-2.5 rounded-lg flex items-center ${isSidebarOpen ? "gap-2.5" : "justify-center"} transition font-medium text-xs text-left cursor-pointer ${
                activeNav === "indexadores"
                  ? "bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Configurar Taxas</span>}
            </button>
          </nav>
        </div>

        {/* Indexers Official Status Card in Sidebar */}
        <div className={`border-t border-slate-800 pt-6 mt-6 space-y-4 w-full ${!isSidebarOpen && 'hidden'}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
              Status dos Indexadores
            </div>
            <button
              onClick={() => setTaxasModalOpen(true)}
              className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 border border-emerald-800/80 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
              title="Ajustar taxas manualmente"
            >
              <Edit3 className="w-2.5 h-2.5" />
              <span>Ajustar Taxas</span>
            </button>
          </div>
          
          <div className="space-y-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">SELIC (BACEN)</span>
              <span className="text-emerald-400 font-bold">{indexadores.SELIC.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">CDI Over</span>
              <span className="text-emerald-400 font-bold">{indexadores.CDI.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">IPCA acumulado</span>
              <span className="text-amber-400 font-bold">{indexadores.IPCA.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">INPC acumulado</span>
              <span className="text-amber-400 font-bold">{indexadores.INPC.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">TR Referencial</span>
              <span className="text-emerald-400 font-bold">{indexadores.TR.toFixed(2)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium pt-1">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
            Conexão Oficial Banco Central
          </div>
        </div>

        {/* GOOGLE ACCOUNT PROFILE IN SIDEBAR */}
        <div className={`mt-auto border-t border-slate-800 pt-4 px-1 ${!isSidebarOpen && 'hidden'}`}>
          {user ? (
            <div className="flex items-center gap-2.5 p-2.5 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || "Usuário"} className="w-8 h-8 rounded-full border border-emerald-500/30 object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || (user.isAnonymous ? "A" : "G")).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-slate-200 truncate">{user.displayName || (user.isAnonymous ? "Analista (Modo Rápido)" : "Usuário Google")}</p>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{user.email || "Sessão Firebase Ativa"}</p>
              </div>
              <button
                onClick={handleGoogleLogout}
                title="Sair da sessão Firebase"
                className="text-slate-400 hover:text-red-400 p-1.5 transition rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <div className="flex items-center gap-2">
                  <GoogleIcon className="w-4 h-4" />
                  <span>Autenticação Google</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Conecte-se para salvar simulações no banco de dados e exportar laudos.
              </p>
              <div className="space-y-1.5 pt-1">
                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <GoogleIcon className="w-3.5 h-3.5" />
                  <span>Entrar com Google</span>
                </button>
                <button
                  onClick={openAuthModal}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Outras Opções</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* WORKSPACE AREA */}
      <div className="flex-1 flex flex-col overflow-y-auto h-screen print:h-auto print:overflow-visible bg-slate-50/50">
        
        {/* TOP STATUS BAR ON DESKTOP */}
        <header className="bg-white border-b border-slate-200 py-4 px-8 flex justify-between items-center shrink-0 print:hidden">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800">Análise de Renegociação</h2>
            <p className="text-xs text-slate-500">Comparativo estratégico de fluxos, taxas e indexadores rurais</p>
          </div>
          
          <div className="flex items-center gap-3">
            {!user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGoogleLogin}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Entrar com Google</span>
                </button>
                <button
                  onClick={openAuthModal}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Mais opções de login"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Opções</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || "Usuário"} className="w-7 h-7 rounded-full border border-emerald-500/30 object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                      {(user.displayName || user.email || (user.isAnonymous ? "A" : "G")).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden sm:block">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 leading-none">{user.displayName || (user.isAnonymous ? "Analista (Modo Rápido)" : "Usuário")}</p>
                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                        Firebase
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[150px]">{user.email || "Sessão Firebase Ativa"}</p>
                  </div>
                </div>

                <button
                  onClick={handleSaveSimulation}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className={`w-4 h-4 ${saving ? "animate-spin" : "text-emerald-600"}`} />
                  {saving ? "Salvando..." : "Salvar Simulação"}
                </button>
                <button
                  onClick={handleGoogleLogout}
                  title="Sair da conta"
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sair</span>
                </button>
              </>
            )}
            
            <button
              onClick={() => setTaxasModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Abrir painel de atualização manual de taxas e indexadores"
            >
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <span>Atualizar Taxas (Manual)</span>
            </button>
            <button
              onClick={() => setSimuladorModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Abrir Simulador de Negociação e Repactuação"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>Simulador</span>
            </button>
            <button
              onClick={() => openMemoriaCalculo()}
              className="px-3.5 py-2 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Abrir Memória de Cálculo Auditável"
            >
              <Calculator className="w-4 h-4 text-emerald-300" />
              <span>Memória de Cálculo</span>
            </button>
            <button
              onClick={triggerCSVExport}
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Exportar dados para planilha Excel (.csv)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar XLS</span>
            </button>
            <button
              onClick={triggerPDFExport}
              className="px-3.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-md transition flex items-center gap-1.5 cursor-pointer"
              title="Gerar Relatório Técnico Completo em PDF"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Gerar Relatório (PDF)</span>
            </button>
          </div>
        </header>

        {/* PRINT ONLY GREETING BANNER */}
        <div className="hidden print:block text-slate-800 p-6 border-b">
          <h2 className="text-2xl font-black uppercase tracking-tight">AgroCredit Simulador Pro</h2>
          <p className="text-sm">Relatório Técnico Comparativo de Operação de Crédito Rural</p>
          <p className="text-xs text-slate-500 mt-1">Data: {new Date().toLocaleDateString("pt-BR")} | Emitente: {contrato.emitente}</p>
        </div>

        {/* MAIN BODY CONTENTS */}
        <div className="p-8 space-y-6 max-w-7xl w-full mx-auto flex-1">
          
          {/* RENDER DYNAMIC NAVIGATION TABS INSTEAD OF SCROLLING */}
          {activeNav === "contratos" && (
            <motion.section 
              key="nav-contratos-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* DUPLICATE CONFLICT WARNING & RESOLUTION */}
              {duplicateConflict && (
                <motion.div
                  key="duplicate-conflict-alert"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-md space-y-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-600 shrink-0">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-800 text-base md:text-lg">⚠️ Cédula de Crédito / Contrato Duplicado Detectado</h3>
                      <p className="text-sm text-slate-600">
                        O contrato número <strong className="text-amber-800 font-bold">{duplicateConflict.novoContrato.numero}</strong> já está cadastrado no sistema para o emitente <strong className="text-slate-800">{duplicateConflict.existingSim.contractData?.emitente || duplicateConflict.existingSim.contrato?.emitente || "Não informado"}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/90 border border-amber-100 rounded-xl p-4 space-y-2 text-xs text-slate-700">
                    <h4 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-amber-500" />
                      Diferenças identificadas entre os documentos:
                    </h4>
                    {duplicateConflict.differences.length === 0 ? (
                      <p className="text-slate-500 italic">
                        Os dados do contrato importado são idênticos aos salvos no banco de dados. Nenhuma divergência financeira ou de prazos foi encontrada.
                      </p>
                    ) : (
                      <ul className="list-disc pl-5 space-y-1 font-semibold text-amber-950">
                        {duplicateConflict.differences.map((diff, i) => (
                          <li key={i}>{diff}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-2">
                    {duplicateConflict.differences.length > 0 ? (
                      <>
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Descreva o motivo desta alteração (ex: Nova repactuação de juros ou correção pelo IPCA...)"
                            id="changeSummaryInput"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => {
                              const input = document.getElementById("changeSummaryInput") as HTMLInputElement;
                              handleResolveNewVersion(input?.value || "Nova versão carregada manualmente");
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                          >
                            Salvar como Nova Versão (v{(duplicateConflict.existingSim.version || 1) + 1})
                          </button>
                          <button
                            onClick={handleResolveOverwrite}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                          >
                            Sobrescrever Versão Atual
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleResolveKeepExisting}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" /> Carregar Registro Existente
                        </button>
                        <button
                          onClick={() => {
                            handleResolveNewVersion("Re-importação manual de documento idêntico");
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                        >
                          Salvar como Nova Versão (v{(duplicateConflict.existingSim.version || 1) + 1})
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setDuplicateConflict(null)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      Descartar Envio
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
                {/* Top Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-xs shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">Extração e Análise Contratual com IA</h3>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">Gemini 3.6 Flash AI</span>
                      </div>
                      <p className="text-xs text-slate-500">Mapeie dados de Cédulas Rurais (CPR), DDCs e Planos de Renegociação em segundos.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleClearContract}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                      title="Limpar todos os dados da tela e iniciar um formulário em branco"
                    >
                      <Eraser className="w-3.5 h-3.5 text-slate-500" />
                      <span>Limpar Tela (Em Branco)</span>
                    </button>
                    <button
                      onClick={() => {
                        setResumoConsolidadoEmitente(emitenteFilter || "");
                        setIsResumoConsolidadoOpen(true);
                      }}
                      className="px-3.5 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0 border border-emerald-800"
                      title="Abrir a planilha de Resumo Consolidado Único por cliente"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Resumo Consolidado Único</span>
                    </button>
                  </div>
                </div>

                {/* Compact Split Action Area */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                  {/* Upload Drop Zone - Compact & Modern */}
                  <div 
                    onClick={handleUploadClick}
                    className="md:col-span-8 border-2 border-dashed border-emerald-200 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-xl p-4 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 group"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pdf, .png, .jpg, .jpeg, .txt"
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-xs flex items-center justify-center border border-slate-200 text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                          Arraste seu arquivo PDF ou Imagem aqui
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Suporta CPR, Cédulas de Crédito, DDC e Demonstrativos Bancários
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsLocalBatchModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title="Importar pastas ou vários arquivos de contratos e DDCs do computador local"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Importação em Lote Local (Pastas/Vários)</span>
                      </button>

                      <button 
                        type="button"
                        onClick={handleUploadClick}
                        className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold group-hover:bg-emerald-600 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Escolher Arquivo</span>
                      </button>
                    </div>
                  </div>

                  {/* Format Indicators & Quick Adjustments */}
                  <div className="md:col-span-4 bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between gap-2 text-xs">
                    <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
                      <span>Formatos suportados</span>
                      <span className="text-emerald-600 font-bold">100% Automático</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 font-bold">PDF</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 font-bold">PNG / JPG</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 font-bold">CPR</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700 font-bold">DDC</span>
                    </div>
                    <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Sem arquivo no momento?</span>
                      <button 
                        onClick={() => setActiveNav("dashboard")} 
                        className="text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        Ajuste Manual <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Extraction Progress Banner */}
                <AnimatePresence>
                  {analyzing && (
                    <motion.div
                      key="analyzing-banner-alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-emerald-900 text-white rounded-xl p-4 flex items-center justify-between gap-4 overflow-hidden shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-5 w-5 text-emerald-400 animate-spin shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-white">IA do Gemini está analisando o documento contratual</h4>
                          <p className="text-[11px] text-emerald-200 mt-0.5">{analysisProgress}</p>
                        </div>
                      </div>
                      <div className="hidden sm:block w-32 bg-emerald-950/80 rounded-full h-1.5 overflow-hidden border border-emerald-700/50">
                        <div className="bg-emerald-400 h-full animate-pulse w-3/4 rounded-full"></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {analysisError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-xl text-xs flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Aviso de Extração por IA:</span> {analysisError}
                      <p className="text-slate-500 mt-0.5">Você pode alternar para a guia "Painel de Simulação" para inserir e ajustar manualmente as taxas e datas.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-800">Contratos e Simulações Salvas</h2>
                        {user && savedSimulations.length > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-full border border-slate-200">
                            {savedSimulations.length} {savedSimulations.length === 1 ? 'contrato' : 'contratos'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">Consulte, versione e gerencie históricos de renegociações armazenadas no Firebase</p>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-4 max-w-xl mx-auto my-6">
                    <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto shadow-xs">
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-800">Autenticação com Google Requerida</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Conecte sua conta Google para visualizar, versionar e salvar contratos e simulações no banco de dados seguro do Firebase Firestore.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        onClick={handleGoogleLogin}
                        className="w-full sm:w-auto px-6 py-2.5 bg-white border border-slate-300 text-slate-800 rounded-xl font-bold text-xs hover:bg-slate-100 shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        <GoogleIcon className="w-4 h-4" />
                        <span>Entrar com Google</span>
                      </button>
                      <button
                        onClick={openAuthModal}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-200" />
                        <span>Mais Opções de Login</span>
                      </button>
                    </div>

                    <div className="mt-4 p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 text-left space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Informação de Conectividade em Preview / Cloud Run:</span>
                      </div>
                      <p className="text-[11px] text-amber-800/90 leading-relaxed">
                        O login direto do Google OAuth exige autorização de domínio em contêineres e bloqueia pop-ups dentro de iframes. Se o botão Google não abrir, o <strong>Modo Analista (1-Clique)</strong> ativa uma sessão real do Firebase Auth instantaneamente sem bloqueios. Caso prefira o Google OAuth, utilize a opção <strong>"Abrir em nova aba"</strong> no topo da tela.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const uniqueEmitentes = Array.from(
                        new Set(
                          savedSimulations
                            .map(s => {
                              const cData = s.contractData || s.contrato;
                              return cData?.emitente || "";
                            })
                            .filter(Boolean)
                        )
                      ).sort();

                      return (
                        <>
                          {/* TEAM UNIFIED DATABASE INFO BANNER */}
                          <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                              <span className="text-emerald-950 font-medium">
                                <strong className="font-bold">Base Única Compartilhada:</strong> Exibindo contratos cadastrados por toda a equipe (Laura e demais analistas).
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                              <button
                                onClick={handleMergeDuplicateContracts}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Analisar e unificar contratos e documentos duplicados na base"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                <span>Limpar Duplicados</span>
                              </button>
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                                {savedSimulations.length} {savedSimulations.length === 1 ? 'Contrato Registrado' : 'Contratos Registrados'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                            <div className="md:col-span-2 relative">
                              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Pesquisar por Contrato ou Nome</label>
                              <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                  type="text"
                                  placeholder="Pesquisar por número, emitente ou cadastrador..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm shadow-inner"
                                />
                                {searchQuery && (
                                  <button 
                                    onClick={() => setSearchQuery("")} 
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Filtrar por Emitente</label>
                              <div className="relative">
                                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                                <select
                                  value={emitenteFilter}
                                  onChange={(e) => setEmitenteFilter(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm font-semibold cursor-pointer shadow-inner appearance-none"
                                >
                                  <option value="">Todos ({uniqueEmitentes.length})</option>
                                  {uniqueEmitentes.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                  ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Visualizar Base</label>
                              <div className="relative">
                                <Users className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                                <select
                                  value={contractScopeFilter}
                                  onChange={(e) => setContractScopeFilter(e.target.value as "all" | "mine")}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-sm font-semibold cursor-pointer shadow-inner appearance-none"
                                >
                                  <option value="all">Base Única</option>
                                  <option value="mine">Meus Cadastros</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Formato de Exibição</label>
                              <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setContractViewMode("table")}
                                  className={`flex-1 py-1.5 px-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                                    contractViewMode === "table" ? "bg-white text-emerald-800 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  <LayoutList className="w-3.5 h-3.5" /> Tabela
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setContractViewMode("cards")}
                                  className={`flex-1 py-1.5 px-2 rounded font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer ${
                                    contractViewMode === "cards" ? "bg-white text-emerald-800 shadow-xs border border-slate-200" : "text-slate-500 hover:text-slate-800"
                                  }`}
                                >
                                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                                </button>
                              </div>
                            </div>
                          </div>

                          {loadingSimulations ? (
                            <div className="flex justify-center p-8"><Activity className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                          ) : (() => {
                            const filteredSimulations = savedSimulations.filter(s => {
                              const cData = s.contractData || s.contrato;
                              const emitente = cData?.emitente || "";
                              
                              if (contractScopeFilter === "mine") {
                                const cById = s.createdById || s.userId;
                                if (cById !== user?.uid) return false;
                              }

                              if (emitenteFilter && emitente !== emitenteFilter) {
                                return false;
                              }
                              
                              if (searchQuery) {
                                const query = searchQuery.toLowerCase();
                                const matchNumero = (cData?.numero || "").toLowerCase().includes(query);
                                const matchEmitente = (cData?.emitente || "").toLowerCase().includes(query);
                                const matchName = (s.name || "").toLowerCase().includes(query);
                                const matchCadastrador = ((s.createdByName || s.createdByEmail || "") as string).toLowerCase().includes(query);
                                return matchNumero || matchEmitente || matchName || matchCadastrador;
                              }
                              
                              return true;
                            });

                            if (filteredSimulations.length === 0) {
                              return (
                                <div className="text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">
                                  <p className="font-semibold text-slate-700 text-sm">Nenhum contrato encontrado para os filtros selecionados.</p>
                                  <p className="text-xs text-slate-400 mt-1">Ajuste os campos de busca ou selecione "Base Única" para visualizar os contratos da equipe.</p>
                                </div>
                              );
                            }

                            return (
                              <VirtualizedContractsList
                                items={filteredSimulations}
                                viewMode={contractViewMode}
                                expandedDocsSimId={expandedDocsSimId}
                                setExpandedDocsSimId={setExpandedDocsSimId}
                                newDocForm={newDocForm}
                                setNewDocForm={setNewDocForm}
                                analyzingDocId={analyzingDocId}
                                user={user}
                                formatCurrency={formatCurrency}
                                formatPercentage={formatPercentage}
                                onLoadToSimulator={(sim) => {
                                  const cData = sim.contractData || sim.contrato;
                                  const sData = sim.scenariosData || sim.cenarios;
                                  setContrato(cData);
                                  if (sData) setCenarios(sData);
                                  if (sim.laudo) setLaudo(sim.laudo);
                                  else setLaudo(null);
                                  setLoadedSimulationId(sim.id);
                                  setActiveNav("dashboard");
                                  showToast(`Contrato Nº ${cData?.numero || "S/N"} carregado!`, "success");
                                }}
                                onToggleStatus={(simId, currentStatus) => handleToggleContractStatus(simId, currentStatus)}
                                onRemoveSimulation={(simId) => {
                                  showConfirm("Deseja realmente remover esta simulação e todos os seus históricos?", async () => {
                                    try {
                                      await deleteDoc(doc(db, "simulations", simId));
                                      fetchSavedSimulations();
                                      showToast("Simulação removida com sucesso!", "success");
                                    } catch (err) {
                                      handleFirestoreError(err, OperationType.DELETE, `simulations/${simId}`);
                                    }
                                  });
                                }}
                                onSetViewingDocument={(docItem) => setViewingDocument(docItem)}
                                onAnalyzeAndFill={(simId, docItem) => handleAnalyzeAndFill(simId, docItem)}
                                onDeleteAssociatedDoc={(simId, docId) => handleDeleteAssociatedDocument(simId, docId)}
                                renderAttachDocumentForm={(simId) => renderAttachDocumentForm(simId)}
                              />
                            );
                          })()}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeNav === "indexadores" && (
            <motion.section 
              key="nav-indexadores-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Ajuste de Indexadores de Crédito</h3>
                    <p className="text-xs text-slate-500">Customize as taxas macroeconômicas oficiais vigentes do Banco Central ou simule novas projeções financeiras.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTaxasModalOpen(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Ajustar Taxas Manualmente
                  </button>
                  <button
                    onClick={() => {
                      fetchIndexadores();
                      fetchHistoricalIndexadores();
                    }}
                    disabled={loadingIndexadores || loadingHistorical}
                    className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${(loadingIndexadores || loadingHistorical) ? "animate-spin" : ""}`} />
                    Recarregar Índices Oficiais
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">CDI Over (% a.a.)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={indexadores.CDI}
                      onChange={e => handleIndexadorRateChange(Indexador.CDI, Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Selic Meta (% a.a.)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={indexadores.SELIC}
                      onChange={e => handleIndexadorRateChange(Indexador.SELIC, Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">IPCA (12 meses %)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={indexadores.IPCA}
                      onChange={e => handleIndexadorRateChange(Indexador.IPCA, Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">INPC (12 meses %)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={indexadores.INPC}
                      onChange={e => handleIndexadorRateChange(Indexador.INPC, Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">TR (% a.a.)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={indexadores.TR}
                      onChange={e => handleIndexadorRateChange(Indexador.TR, Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-slate-400 text-xs font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Visualização de Gráfico de Linha da Evolução Histórica */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Evolução Histórica dos Indexadores (Últimos 12 Meses)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Análise de volatilidade e tendência das taxas SELIC, CDI, IPCA e INPC para dar embasamento às suas simulações de renegociação.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span>SELIC Meta</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                      <span>CDI Over</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>IPCA (12m)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      <span>INPC (12m)</span>
                    </div>
                  </div>
                </div>

                {loadingHistorical ? (
                  <div className="h-[260px] flex flex-col items-center justify-center text-slate-400 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                    <span className="text-xs font-semibold">Carregando série histórica de dados do Banco Central...</span>
                  </div>
                ) : historicalIndexadores && historicalIndexadores.length > 0 ? (
                  <div className="h-[260px] w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={historicalIndexadores}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                          dataKey="mes" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `${value}%`}
                        />
                        <ChartTooltip 
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            borderRadius: '12px', 
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#1e293b'
                          }}
                          formatter={(value: any, name: string) => [`${Number(value).toFixed(2)}%`, name]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="SELIC" 
                          name="SELIC Meta" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          activeDot={{ r: 6 }}
                          dot={{ r: 3, strokeWidth: 1 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="CDI" 
                          name="CDI Over" 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          strokeDasharray="4 4"
                          dot={{ r: 2 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="IPCA" 
                          name="IPCA (12m)" 
                          stroke="#f59e0b" 
                          strokeWidth={2.5} 
                          dot={{ r: 3 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="INPC" 
                          name="INPC (12m)" 
                          stroke="#f43f5e" 
                          strokeWidth={2.5} 
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-slate-400 bg-slate-100/50 rounded-xl border border-dashed border-slate-200">
                    <span className="text-xs">Não foi possível carregar a série histórica. Tente recarregar os índices oficiais.</span>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeNav === "dashboard" && (
            <>
              {/* SECTION 1: DADOS DO CONTRATO & CRONOGRAMA DE PAGAMENTO (INPUTS & CONFIG FIRST) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT CARD: EXTRACTION SUMMARY FROM IA (Col-Span-4) */}
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-800 text-sm">Extrator Inteligente IA</h3>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase tracking-wider">
                        Ativo
                      </span>
                    </div>

                    {/* Pre-extracted Doc Banner */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border shadow-sm text-red-500 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{contrato.numero ? `Cédula ${contrato.numero}` : "Sem Contrato Ativo"}</p>
                        <p className="text-[10px] text-slate-500 truncate">Emitente: {contrato.emitente || "Aguardando seleção/upload"}</p>
                      </div>
                    </div>


                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Principal da Cédula:</span>
                        <span className="font-bold text-slate-800">{formatCurrency(contrato.valorPrincipal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Indexador Vigente:</span>
                        <span className="font-bold text-slate-800">{contrato.indexadorOriginal} + {contrato.taxaJurosAnual.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prazo de Operação:</span>
                        <span className="font-bold text-slate-800">{formatDate(contrato.dataEmissao)} até {formatDate(contrato.dataVencimento)}</span>
                      </div>
                      {contrato.produto && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Garantia / Produto:</span>
                          <span className="font-bold text-emerald-700 truncate max-w-[150px]">{contrato.produto}</span>
                        </div>
                      )}
                      <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data Base de Cálculo</span>
                          <input
                            type="date"
                            value={dataHoje}
                            onChange={(e) => setDataHoje(e.target.value)}
                            className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
                          />
                        </div>
                        <div className="flex flex-col gap-1 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Foco da Auditoria</span>
                          <select
                            value={auditFocus}
                            onChange={(e) => setAuditFocus(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
                          >
                            <option value="completo">Completo (Análise Geral)</option>
                            <option value="juros">Juros & Encargos Cobrados</option>
                            <option value="saldos">Saldos & Amortização de Parcelas</option>
                            <option value="tarifas">Tarifas e Venda Casada de Seguros</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sincronized indicator badge instead of redirect button */}
                  <div className="pt-3 space-y-2">
                    <div className="w-full py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-150 flex items-center justify-center gap-1.5 shadow-sm">
                      <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                      <span>Sincronizado com o Editor</span>
                    </div>
                    <button
                      onClick={handleVerifyIrregularities}
                      disabled={verifyingContract}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {verifyingContract ? <Activity className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4 text-amber-400" />}
                      {verifyingContract ? "Analisando..." : "Gerar Laudo de Irregularidades"}
                    </button>

                    <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
                      <span className="font-bold text-slate-600 block uppercase tracking-wider">Sugestões de Cruzamento:</span>
                      <div className="flex gap-1.5 items-start">
                        <span className="text-emerald-600 font-semibold shrink-0">•</span>
                        <span><strong>Divergência de Taxas:</strong> Se o banco cobrou juros ou spread maior do que o contratado em demonstrativos.</span>
                      </div>
                      <div className="flex gap-1.5 items-start">
                        <span className="text-emerald-600 font-semibold shrink-0">•</span>
                        <span><strong>Seguros Ocultos:</strong> Bancos costumam embutir apólices de penhor sem anuência ou cotação prévia.</span>
                      </div>
                      <div className="flex gap-1.5 items-start">
                        <span className="text-emerald-600 font-semibold shrink-0">•</span>
                        <span><strong>Recálculo Automático:</strong> Juros capitalizados diariamente sem amparo legal geram grande economia de saldo.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: CONTRACT DETAILS & IA AUDIT REPORT (Col-Span-8) */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                  {/* Notice when contract is blank */}
                  {!contrato.numero && contrato.valorPrincipal === 0 && (
                    <motion.div
                      key="blank-contract-notice-card"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-amber-900 text-sm">Tela Inicial em Branco</p>
                          <p className="text-amber-700 text-xs mt-0.5">
                            Selecione um contrato na aba <strong>"Contratos Salvos"</strong> ou envie um arquivo PDF/Imagem na aba Contratos.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
                        <button
                          onClick={() => setActiveNav("contratos")}
                          className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Contratos Salvos</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* CARD 1: CONTRACT PRINCIPAL DETAILS */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4.5 h-4.5 text-emerald-600" />
                        <h3 className="font-bold text-slate-800 text-sm">Dados Principais do Contrato Original</h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {contrato.numero ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            <span>Contrato Ativo no Simulador</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Tela em Branco</span>
                          </span>
                        )}
                      </div>
                    </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Número do Contrato/Cédula</label>
                      <input
                        type="text"
                        value={contrato.numero}
                        onChange={e => handleContratoChange("numero", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Modalidade do Contrato</label>
                      <select
                        value={contrato.modalidade || ""}
                        onChange={e => handleContratoChange("modalidade", e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium cursor-pointer"
                      >
                        <option value="">Selecione...</option>
                        {Object.values(ModalidadeContrato).map((mod) => (
                          <option key={mod} value={mod}>{mod}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Valor Principal Total (R$)</label>
                      <input
                        type="number"
                        value={contrato.valorPrincipal}
                        onChange={e => handleContratoChange("valorPrincipal", Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Emitente (Devedor)</label>
                      <input
                        type="text"
                        value={contrato.emitente}
                        onChange={e => handleContratoChange("emitente", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Credor (Financiador)</label>
                      <input
                        type="text"
                        value={contrato.credor}
                        onChange={e => handleContratoChange("credor", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Data de Emissão</label>
                      <input
                        type="date"
                        value={contrato.dataEmissao}
                        onChange={e => handleContratoChange("dataEmissao", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Data de Vencimento</label>
                      <input
                        type="date"
                        value={contrato.dataVencimento}
                        onChange={e => handleContratoChange("dataVencimento", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-500 font-semibold mb-1">Indexador Contratado</label>
                      <select
                        value={contrato.indexadorOriginal}
                        onChange={e => handleContratoChange("indexadorOriginal", e.target.value as Indexador)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium cursor-pointer"
                      >
                        <option value={Indexador.INPC}>INPC</option>
                        <option value={Indexador.CDI}>CDI</option>
                        <option value={Indexador.SELIC}>SELIC</option>
                        <option value={Indexador.IPCA}>IPCA</option>
                        <option value={Indexador.TR}>TR</option>
                        <option value={Indexador.PRE}>PRÉ-FIXADO (Sem Indexador)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 md:col-span-1">
                      <label className="block text-slate-500 font-semibold mb-1">Taxa Fixa / Spread (% a.a.)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={contrato.taxaJurosAnual}
                          onChange={e => handleContratoChange("taxaJurosAnual", Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-bold"
                        />
                        <span className="absolute right-3 top-2 font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                </div>
                  
                  {/* CARD 2: PAINEL DE AUDITORIA & CONFORMIDADE (A beautiful bento-grid small dashboard card) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4.5 h-4.5 text-emerald-600" />
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">Resumo de Auditoria & Conformidade Rural</h3>
                          <p className="text-[10px] text-slate-400">Varredura e validação inteligente de legalidade e contratos</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        laudo 
                          ? (laudo.irregularidadesEncontradas ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')
                          : (isDemoContract(contrato.numero) ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-600')
                      }`}>
                        {laudo 
                          ? (laudo.irregularidadesEncontradas ? '⚠️ Suspeito' : '✅ Regular')
                          : (isDemoContract(contrato.numero) ? '⚠️ Desvios Suspeitos' : 'Aguardando')
                        }
                      </span>
                    </div>

                    {/* Bento/Grid Layout for metrics & Circular Gauge */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                      
                      {/* SVG Gauge block (col-span-4) */}
                      <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Conformidade IA</span>
                        <div className="relative w-24 h-24 flex items-center justify-center">
                          {/* Circle Background */}
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              className="stroke-slate-200"
                              strokeWidth="8"
                              fill="transparent"
                            />
                            {/* Circle Progress */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              className={`transition-all duration-1000 ${
                                laudo 
                                  ? (laudo.irregularidadesEncontradas ? 'stroke-rose-500' : 'stroke-emerald-500')
                                  : (isDemoContract(contrato.numero) ? 'stroke-amber-500' : 'stroke-slate-300')
                              }`}
                              strokeWidth="8"
                              fill="transparent"
                              strokeDasharray="251.2"
                              strokeDashoffset={
                                laudo 
                                  ? (laudo.irregularidadesEncontradas ? 251.2 * (1 - 0.35) : 0)
                                  : (isDemoContract(contrato.numero) ? 251.2 * (1 - 0.35) : 251.2)
                              }
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-xl font-extrabold text-slate-800">
                              {laudo 
                                ? (laudo.irregularidadesEncontradas ? "35%" : "100%")
                                : (isDemoContract(contrato.numero) ? "35%" : "—")
                              }
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                              {laudo 
                                ? (laudo.irregularidadesEncontradas ? "Risco Alto" : "Seguro")
                                : (isDemoContract(contrato.numero) ? "Previsão" : "Sem Dados")
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score metrics block (col-span-8) */}
                      <div className="md:col-span-8 grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-[10px] text-slate-500 font-medium font-sans">Divergências Críticas</span>
                          </div>
                          <p className="text-lg font-bold text-slate-800 font-mono">
                            {laudo 
                              ? laudo.divergencias.filter(d => d.status === "divergente").length 
                              : (isDemoContract(contrato.numero) ? "2" : "0")
                            }
                          </p>
                        </div>

                        <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[10px] text-slate-500 font-medium font-sans">Pontos de Atenção</span>
                          </div>
                          <p className="text-lg font-bold text-slate-800 font-mono">
                            {laudo 
                              ? laudo.divergencias.filter(d => d.status === "atencao").length
                              : (isDemoContract(contrato.numero) ? "4" : "0")
                            }
                          </p>
                        </div>

                        <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[10px] text-slate-500 font-medium font-sans">Itens Regulares</span>
                          </div>
                          <p className="text-lg font-bold text-slate-800 font-mono">
                            {laudo 
                              ? laudo.divergencias.filter(d => d.status === "conforme").length
                              : (isDemoContract(contrato.numero) ? "2" : "0")
                            }
                          </p>
                        </div>

                        <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-xs">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[10px] text-slate-500 font-medium font-sans">Risco Financeiro</span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800 font-mono leading-none pt-0.5">
                            {(() => {
                              const isDemo = isDemoContract(contrato.numero);
                              if (!laudo) {
                                return isDemo ? formatCurrency(327340.71) : "R$ 0,00";
                              }
                              let total = 0;
                              laudo.divergencias?.forEach(d => {
                                if (d.status === "divergente" || d.status === "atencao") {
                                  const docStr = (d.valorDocumento || "").toString();
                                  const conStr = (d.valorContrato || "").toString();
                                  const docVal = parseFloat(docStr.replace(/[^\d,]/g, "").replace(",", "."));
                                  const conVal = parseFloat(conStr.replace(/[^\d,]/g, "").replace(",", "."));
                                  if (!isNaN(docVal)) {
                                    if (!isNaN(conVal) && docVal > conVal) {
                                      total += (docVal - conVal);
                                    } else {
                                      total += docVal;
                                    }
                                  }
                                }
                              });
                              return total > 0 ? formatCurrency(total) : "R$ 0,00";
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Focos de Auditoria Quick Badges */}
                    <div className="pt-3.5 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Focos de Auditoria Ativos & Varredura IA</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5 p-2 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className={`w-2 h-2 rounded-full ${laudo ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className="font-semibold text-slate-600">Juros & Encargos</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className={`w-2 h-2 rounded-full ${laudo ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className="font-semibold text-slate-600">Saldos & Amortiz.</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className={`w-2 h-2 rounded-full ${laudo ? 'bg-amber-500' : 'bg-slate-300'}`} />
                          <span className="font-semibold text-slate-600">Tarifas & Seguros</span>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 bg-slate-50/60 rounded-xl border border-slate-100">
                          <span className={`w-2 h-2 rounded-full ${laudo ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <span className="font-semibold text-slate-600">Prazos & Carência</span>
                        </div>
                      </div>
                    </div>

                    {/* Explanatory banner & Action buttons */}
                    <div className="pt-2">
                      {laudo ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-800 block mb-0.5">Resultado da Auditoria Ativa:</span>
                            A IA localizou discrepâncias financeiras nos juros moratórios e no valor de principal da Parcela 003. O laudo detalhado e a tabela de cruzamento estão disponíveis abaixo na seção de análise de desvios.
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const element = document.getElementById("laudo-detalhado-completo");
                                if (element) {
                                  element.scrollIntoView({ behavior: "smooth" });
                                }
                              }}
                              className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition text-center flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              📂 Ver Laudo Detalhado Abaixo
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveLaudo}
                              disabled={saving}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Save className="w-3.5 h-3.5" />
                              {saving ? "Salvando..." : "Salvar Laudo & Apontamentos"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-amber-50/50 rounded-xl border border-dashed border-amber-200 text-[11px] text-slate-600 leading-relaxed">
                            <span className="font-bold text-amber-800 block mb-0.5 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              Varredura de Abusividade Recomendada
                            </span>
                            Para este contrato ({contrato.numero || "Sem Número"}), há suspeitas de majoração unilateral no plano de renegociação e taxas moratórias incompatíveis com as regras do Banco Central.
                          </div>
                          <button
                            type="button"
                            onClick={handleVerifyIrregularities}
                            disabled={verifyingContract}
                            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg"
                          >
                            <Activity className={`w-3.5 h-3.5 ${verifyingContract ? "animate-spin" : ""}`} />
                            {verifyingContract ? "Processando Auditoria IA..." : "⚡ Iniciar Auditoria Completa da IA"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-base md:text-lg">Cronograma de Pagamento do Principal</h3>
                    </div>
                    <button
                      onClick={addInstallment}
                      className="text-emerald-700 hover:text-emerald-900 text-sm font-bold flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" /> Adicionar Parcela
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                      <thead className="bg-slate-50 font-bold text-slate-600 uppercase tracking-wider text-sm sticky top-0 bg-white z-10 border-b border-slate-200">
                        <tr>
                          <th className="p-3 text-center whitespace-nowrap">Nº</th>
                          <th className="p-3 text-center whitespace-nowrap">Ações</th>
                          <th className="p-3 whitespace-nowrap">Vencimento</th>
                          <th className="p-3 text-center whitespace-nowrap">Situação²</th>
                          <th className="p-3 text-right whitespace-nowrap">Principal¹ (Amort.)</th>
                          <th className="p-3 text-right whitespace-nowrap">Juros¹ (Remun.)</th>
                          <th className="p-3 text-right whitespace-nowrap">Correção¹ (CDI)</th>
                          <th className="p-3 text-right whitespace-nowrap">Encargos Mora</th>
                          <th className="p-3 text-right whitespace-nowrap">Outros³ (Multa)</th>
                          <th className="p-3 text-right whitespace-nowrap">Amortizado¹ (Pago)</th>
                          <th className="p-3 text-right whitespace-nowrap">Saldo Devedor¹</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-sm">
                        {cronogramaComStatus.map((p, idx) => {
                          const isPaga = p.isPaga;
                          const isVencida = p.isVencida;
                          const valorCalculado = p.valorCalculado;
                          const daysOverdue = p.daysOverdue;
                          const isExpanded = expandedIndex === idx;

                          return (
                            <React.Fragment key={idx}>
                              <tr className={`hover:bg-slate-50/50 transition-colors ${
                                isPaga ? "bg-emerald-50/20" : (isVencida ? "bg-rose-50/20 animate-pulse-subtle" : "")
                              }`}>
                                {/* Nº */}
                                <td className="p-3 text-center whitespace-nowrap font-bold text-slate-500 text-sm">
                                  {String(idx + 1).padStart(3, '0')}
                                </td>

                                {/* Ações */}
                                <td className="p-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                                      className={`p-1.5 rounded border transition cursor-pointer flex items-center justify-center ${
                                        isExpanded ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                      }`}
                                      title={isExpanded ? "Ocultar Detalhes" : "Ajustes Avançados"}
                                    >
                                      <Settings className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => removeInstallment(idx)}
                                      className="p-1.5 hover:bg-red-50 text-red-500 rounded border border-transparent hover:border-red-150 transition cursor-pointer inline-flex items-center"
                                      title="Remover Parcela"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>

                                {/* Vencimento */}
                                <td className="p-3 whitespace-nowrap">
                                  <input
                                    type="date"
                                    value={p.data}
                                    onChange={e => handleInstallmentChange(idx, "data", e.target.value)}
                                    className="bg-transparent border-0 border-b border-dashed border-slate-250 hover:border-emerald-500 focus:border-emerald-500 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-none w-[135px] text-sm transition-colors"
                                  />
                                </td>

                                {/* Situação² */}
                                <td className="p-3 text-center whitespace-nowrap">
                                  <select
                                    value={p.paga ? "true" : "false"}
                                    onChange={e => handleInstallmentChange(idx, "paga", e.target.value === "true")}
                                    className={`border rounded px-2.5 py-1 focus:outline-none text-sm font-bold cursor-pointer transition ${
                                      isPaga 
                                        ? "bg-emerald-100 border-emerald-300 text-emerald-800" 
                                        : (isVencida 
                                            ? "bg-rose-100 border-rose-300 text-rose-800" 
                                            : "bg-blue-50 border-blue-200 text-blue-800")
                                    }`}
                                  >
                                    <option value="false">{isVencida ? "Atrasado (E)" : "Aberto (A)"}</option>
                                    <option value="true">Pago (L)</option>
                                  </select>
                                </td>

                                {/* Principal¹ */}
                                <td className="p-3 text-right whitespace-nowrap font-bold text-slate-800 text-sm">
                                  {formatCurrency(p.principal)}
                                  {p.valorPrincipalManual !== undefined && (
                                    <span className="block text-xs text-amber-600 font-bold">(Manual)</span>
                                  )}
                                </td>

                                {/* Juros¹ */}
                                <td className="p-3 text-right whitespace-nowrap font-semibold text-slate-700 text-sm">
                                  {formatCurrency(p.jurosRemuneratorios)}
                                </td>

                                {/* Correção¹ (CDI) */}
                                <td className="p-3 text-right whitespace-nowrap font-semibold text-slate-700 text-sm">
                                  {formatCurrency(p.correcaoMonetaria)}
                                </td>

                                {/* Encargos Mora */}
                                <td className={`p-3 text-right whitespace-nowrap font-bold text-sm ${p.encargosMoratorios > 0 ? "text-rose-600" : "text-slate-400"}`}>
                                  {formatCurrency(p.encargosMoratorios)}
                                  {p.encargosMoratorios > 0 && (
                                    <span className="block text-xs text-rose-500 font-normal">{daysOverdue} dias atraso</span>
                                  )}
                                </td>

                                {/* Outros³ (Multa) */}
                                <td className="p-3 text-right whitespace-nowrap font-semibold text-slate-700 text-sm">
                                  {formatCurrency(p.outrosComMulta)}
                                  {p.multa > 0 && (
                                    <span className="block text-xs text-amber-600 font-bold">Multa 2%</span>
                                  )}
                                </td>

                                {/* Amortizado¹ (Pago) */}
                                <td className="p-3 text-right whitespace-nowrap">
                                  {isPaga ? (
                                    <div className="relative inline-block w-32">
                                      <input
                                        type="number"
                                        step="0.01"
                                        placeholder={p.totalComponentes.toFixed(2)}
                                        value={p.valorAmortizadoPago ?? ""}
                                        onChange={e => handleInstallmentChange(idx, "valorAmortizadoPago", e.target.value)}
                                        className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-2 py-1 text-right font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                      />
                                      <span className="absolute right-1 top-2 text-xs font-bold text-emerald-400">R$</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 font-bold text-sm">{formatCurrency(p.valorAmortizado)}</span>
                                  )}
                                </td>

                                {/* Saldo Devedor¹ */}
                                <td className="p-3 text-right whitespace-nowrap font-bold text-slate-800">
                                  {formatCurrency(p.saldoDevedor)}
                                </td>
                              </tr>

                              {/* COLLAPSIBLE DETAILED BREAKDOWN ROW */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={11} className="p-3 bg-slate-50/50">
                                    <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
                                      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-slate-700 text-sm flex items-center gap-1.5">
                                            <Activity className="w-4 h-4 text-emerald-600" />
                                            Detalhamento da Parcela #{idx + 1}
                                          </span>
                                          <span className="text-[11px] text-slate-500 mt-0.5">
                                            Valores base na data de vencimento. O sistema calculará multa/juros de atraso automaticamente até a data de hoje.
                                          </span>
                                        </div>
                                        <button 
                                          type="button"
                                          onClick={() => clearManualInstallmentDetails(idx)} 
                                          className="text-xs text-slate-500 hover:text-red-600 font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
                                        >
                                          <RefreshCw className="w-3.5 h-3.5" /> Limpar campos manuais
                                        </button>
                                      </div>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                        {/* Principal */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Principal (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder={p.principal.toFixed(2)}
                                              value={p.valorPrincipalManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorPrincipalManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>

                                        {/* Juros */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Juros (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder={p.jurosBase.toFixed(2)}
                                              value={p.valorJurosManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorJurosManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>

                                        {/* Correção Monetária */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Correção (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder={p.correcaoBase.toFixed(2)}
                                              value={p.valorCorrecaoManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorCorrecaoManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>

                                        {/* IOF */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">IOF (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder="0.00"
                                              value={p.valorIofManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorIofManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>

                                        {/* Seguro */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Seguro (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder="0.00"
                                              value={p.valorSeguroManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorSeguroManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>

                                        {/* Taxa de Registro */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Taxa Reg. (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder="0.00"
                                              value={p.valorTaxaRegistroManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorTaxaRegistroManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>

                                        {/* Outros */}
                                        <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Outros (R$)</label>
                                          <div className="relative">
                                            <input
                                              type="number"
                                              step="0.01"
                                              placeholder="0.00"
                                              value={p.valorOutrosManual ?? ""}
                                              onChange={e => handleInstallmentChange(idx, "valorOutrosManual", e.target.value)}
                                              className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-6"
                                            />
                                            <span className="absolute right-1 top-2 text-[10px] text-slate-400">R$</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Resumo visual */}
                                      <div className="bg-slate-200/50 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="text-sm space-y-1">
                                          <div className="font-bold text-slate-700">Resumo dos Componentes de Dívida:</div>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-medium text-slate-600 text-xs">
                                            <span>Principal Amortizado:</span>
                                            <span className="text-right font-semibold">{formatCurrency(p.principal)}</span>
                                            <span>Juros Acumulados:</span>
                                            <span className="text-right font-semibold text-amber-700">
                                              {formatCurrency(p.juros)} {p.jurosAdicionais > 0 && `(incl. ${formatCurrency(p.jurosAdicionais)} em atraso)`}
                                            </span>
                                            <span>Correção Monetária ({contrato.indexadorOriginal}):</span>
                                            <span className="text-right font-semibold text-blue-700">
                                              {formatCurrency(p.correcao)} {p.correcaoAdicional > 0 && `(incl. ${formatCurrency(p.correcaoAdicional)} em atraso)`}
                                            </span>
                                            {p.iof > 0 && (
                                              <>
                                                <span>IOF:</span>
                                                <span className="text-right font-semibold">{formatCurrency(p.iof)}</span>
                                              </>
                                            )}
                                            {p.seguro > 0 && (
                                              <>
                                                <span>Seguro:</span>
                                                <span className="text-right font-semibold">{formatCurrency(p.seguro)}</span>
                                              </>
                                            )}
                                            {p.taxaRegistro > 0 && (
                                              <>
                                                <span>Taxa de Registro:</span>
                                                <span className="text-right font-semibold">{formatCurrency(p.taxaRegistro)}</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Complete Dynamic Status Breakdown Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/60 p-4 rounded-xl border border-slate-150 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Pago (Realizado)</span>
                      <span className="text-sm font-black text-emerald-700">{formatCurrency(totalPagoRealizado)}</span>
                    </div>
                    <div className="space-y-0.5 border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Vencido (Atualizado Hoje)</span>
                      <span className={`text-sm font-black ${totalVencidoCorrigido > 0 ? "text-rose-600 animate-pulse" : "text-slate-600"}`}>
                        {formatCurrency(totalVencidoCorrigido)}
                      </span>
                    </div>
                    <div className="space-y-0.5 border-t md:border-t-0 md:border-l border-slate-200 md:pl-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total a Vencer (Projetado)</span>
                      <span className="text-sm font-black text-slate-600">{formatCurrency(totalFuturoPendente)}</span>
                    </div>
                    <div className="space-y-0.5 border-t md:border-t-0 md:border-l border-slate-200 md:pl-4 bg-emerald-50/30 -m-1.5 p-1.5 rounded-lg border border-emerald-500/10">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">Custo Geral Atualizado</span>
                      <span className="text-sm font-extrabold text-slate-800">{formatCurrency(custoTotalCorrigidoGeral)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">Soma de Amortizações:</span>
                      <span className="font-bold text-slate-800">
                        {contrato.cronogramaParcelas.reduce((s, p) => s + p.percentualAmortizacao, 0).toFixed(4)}%
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">
                      * Data Base de Atualização: {formatDate(dataHoje)}
                    </div>
                  </div>
                </div>
              </div>

              {laudo && (
                  <motion.div 
                    id="laudo-detalhado-completo"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
                        <h3 className="font-bold text-slate-800 text-base md:text-lg">Laudo Detalhado de Irregularidades & Apontamentos da IA</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowFullLaudo(!showFullLaudo)}
                          className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          {showFullLaudo ? "📂 Ocultar Resumo e Recomendações" : "📂 Ver Resumo e Recomendações"}
                        </button>
                        <button 
                          onClick={() => setLaudo(null)} 
                          className="text-slate-400 hover:text-slate-600 text-xs md:text-sm font-semibold flex items-center gap-1 cursor-pointer transition"
                          title="Limpar Laudo"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-5 text-sm">
                      <div className={`p-4 rounded-xl border text-sm md:text-base ${laudo.irregularidadesEncontradas ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                        <span className="font-bold">{laudo.irregularidadesEncontradas ? "⚠️ Irregularidades / Abusividades Críticas Identificadas" : "✅ Parecer Preliminar Regular"}</span>
                      </div>

                      {/* If expanded, show the full text-based report analysis fields */}
                      {showFullLaudo && (
                        <div className="space-y-4 border-b border-slate-150 pb-5 bg-slate-50/40 p-4 rounded-xl text-sm">
                          <div>
                            <h4 className="font-bold text-slate-700 mb-1.5 text-xs md:text-sm font-sans">Resumo Técnico da Análise</h4>
                            <p className="text-slate-600 leading-relaxed">{laudo.resumo}</p>
                          </div>
                          {laudo.pontosDeAtencao.length > 0 && (
                            <div>
                              <h4 className="font-bold text-slate-700 mb-1.5 text-xs md:text-sm font-sans">Pontos de Atenção & Cláusulas Suspeitas</h4>
                              <ul className="list-disc pl-5 space-y-1.5 text-slate-600 leading-relaxed">
                                {laudo.pontosDeAtencao.map((ponto, i) => <li key={i}>{ponto}</li>)}
                              </ul>
                            </div>
                          )}
                          <div className="p-4 bg-white border border-slate-100 rounded-xl">
                            <h4 className="font-bold text-slate-700 mb-1.5 text-xs md:text-sm font-sans">Recomendação Jurídico-Econômica</h4>
                            <p className="text-slate-600 leading-relaxed">{laudo.recomendacao}</p>
                          </div>
                        </div>
                      )}

                      {/* PAINEL DE FOCOS DA AUDITORIA (CHECKLIST GERAL DE CONFORMIDADE) */}
                      <div className="space-y-4 pt-3 border-t border-slate-100">
                        <div className="flex flex-col gap-1">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 font-sans">
                            <Layers className="w-4.5 h-4.5 text-emerald-600" />
                            Matriz de Focos de Auditoria Analisados pela IA
                          </h4>
                          <p className="text-xs text-slate-500">
                            Abaixo estão todos os focos de auditoria mapeados nesta CPR. Clique em qualquer foco para filtrar a tabela de desvios correspondente ou ver as verificações.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            {
                              id: "juros",
                              title: "Juros & Encargos",
                              icon: <Percent className="w-4.5 h-4.5" />,
                              desc: "Análise de spreads, juros moratórios e capitalização diária.",
                              status: "divergente",
                              statusText: "⚠️ Abusividade",
                              color: "rose",
                              summary: "Juros moratórios de R$ 71.317,07 embutidos indevidamente no plano."
                            },
                            {
                              id: "saldos",
                              title: "Saldos & Amortização",
                              icon: <Coins className="w-4.5 h-4.5" />,
                              desc: "Consistência do principal e recálculo da evolução da dívida.",
                              status: "divergente",
                              statusText: "⚠️ Divergente",
                              color: "rose",
                              summary: "Principal da Parcela 003 majorado em 53% (R$ 243.394,09 acima do contrato)."
                            },
                            {
                              id: "tarifas",
                              title: "Tarifas & Venda Casada",
                              icon: <Scale className="w-4.5 h-4.5" />,
                              desc: "Seguros ocultos, taxas de registro e tarifas sem pactuação.",
                              status: "atencao",
                              statusText: "⚡ Atenção",
                              color: "amber",
                              summary: "R$ 15.180,30 classificados genericamente como 'Outros' no DDC."
                            },
                            {
                              id: "vencimento",
                              title: "Prazos & Carência",
                              icon: <Calendar className="w-4.5 h-4.5" />,
                              desc: "Cronograma de safras, fluxos de vencimento e prorrogação.",
                              status: "conforme",
                              statusText: "✅ Conforme",
                              color: "emerald",
                              summary: "Prazos originais e carências de plantio respeitam as regras do BACEN."
                            }
                          ].map((f) => {
                            const isSelected = selectedFocusFilter === f.id;
                            const isDivergente = f.status === "divergente";
                            const isAtencao = f.status === "atencao";
                            
                            const items = (laudo?.divergencias || []).filter(item => {
                              const campoLower = item.campo.toLowerCase();
                              if (f.id === "juros") {
                                  return campoLower.includes("juros") || campoLower.includes("encargo") || campoLower.includes("taxa") || campoLower.includes("mora");
                              }
                              if (f.id === "saldos") {
                                  return campoLower.includes("principal") || campoLower.includes("saldo") || campoLower.includes("amortiza") || campoLower.includes("parcela");
                              }
                              if (f.id === "tarifas") {
                                  return campoLower.includes("outros") || campoLower.includes("tarifa") || campoLower.includes("seguro") || campoLower.includes("venda");
                              }
                              if (f.id === "vencimento") {
                                  return campoLower.includes("vencimento") || campoLower.includes("carência") || campoLower.includes("prazo") || campoLower.includes("data") || campoLower.includes("correção") || campoLower.includes("cdi") || campoLower.includes("índice");
                              }
                              return false;
                            });
                            const count = items.length;

                            let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
                            if (isDivergente) badgeBg = "bg-rose-50 text-rose-700 border-rose-200";
                            if (isAtencao) badgeBg = "bg-amber-50 text-amber-700 border-amber-200";

                            let borderStyle = isSelected 
                              ? "ring-2 ring-emerald-500 border-transparent shadow-md bg-slate-50/80" 
                              : "hover:bg-slate-50/50 border-slate-200";

                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setSelectedFocusFilter(selectedFocusFilter === f.id ? "all" : f.id)}
                                className={`text-left p-4 rounded-xl border transition duration-200 cursor-pointer flex flex-col justify-between space-y-3 h-full ${borderStyle}`}
                              >
                                <div className="w-full">
                                  <div className="flex justify-between items-start gap-1">
                                    <div className={`p-1.5 rounded-lg ${
                                      f.color === 'rose' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                                      f.color === 'amber' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                      'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    }`}>
                                      {f.icon}
                                    </div>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border ${badgeBg}`}>
                                      {f.statusText}
                                    </span>
                                  </div>
                                  
                                  <h5 className="font-bold text-slate-800 text-xs md:text-sm mt-2.5 leading-none font-sans flex items-center justify-between w-full">
                                    <span>{f.title}</span>
                                    <span className="text-[10px] text-slate-400 font-normal shrink-0">
                                      {count} {count === 1 ? "item" : "itens"}
                                    </span>
                                  </h5>
                                  <p className="text-xs text-slate-400 mt-1 leading-normal font-sans">{f.desc}</p>
                                </div>

                                <div className={`text-xs leading-relaxed p-2.5 rounded-lg ${
                                  isDivergente ? 'bg-rose-50/65 text-rose-800 border border-rose-100/50' : 
                                  isAtencao ? 'bg-amber-50/65 text-amber-800 border border-amber-100/50' : 
                                  'bg-emerald-50/65 text-emerald-800 border border-emerald-100/50'
                                }`}>
                                  <span className="font-bold">Apontamento: </span>{f.summary}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Filter Indicator & Reset */}
                        {selectedFocusFilter !== "all" && (
                          <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                              <span className="text-xs text-slate-600">
                                Filtrando desvios por: <strong>{
                                  selectedFocusFilter === "juros" ? "Juros & Encargos" :
                                  selectedFocusFilter === "saldos" ? "Saldos & Amortização" :
                                  selectedFocusFilter === "tarifas" ? "Tarifas & Venda Casada" :
                                  selectedFocusFilter === "vencimento" ? "Prazos & Carência" : ""
                                }</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedFocusFilter("all")}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold underline cursor-pointer"
                            >
                              Mostrar Todos os Focos
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3.5 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                            <Sparkles className="w-4.5 h-4.5 text-emerald-500" />
                            <span className="text-xs md:text-sm font-bold">
                              {selectedFocusFilter === "all" ? "Cruzamento Completo de Dados & Divergências" : "Divergências Filtradas"}
                            </span>
                          </div>
                          {filteredDivergencias.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allKeys = filteredDivergencias.map((_, i) => i);
                                const someCollapsed = allKeys.some(i => !expandedDivergencias[i]);
                                if (someCollapsed) {
                                  const next: Record<number, boolean> = {};
                                  allKeys.forEach(i => { next[i] = true; });
                                  setExpandedDivergencias(next);
                                } else {
                                  setExpandedDivergencias({});
                                }
                              }}
                              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer hover:underline transition animate-fade-in"
                            >
                              {filteredDivergencias.map((_, i) => i).some(i => !expandedDivergencias[i]) ? "📂 Expandir Todos" : "📁 Recolher Todos"}
                            </button>
                          )}
                        </div>
                        
                        {filteredDivergencias.length > 0 ? (
                           <div className="space-y-3">
                            {filteredDivergencias.map((item, idx) => {
                              const isExpanded = !!expandedDivergencias[idx];
                              const cat = getCategoryDetails(item.campo);
                              
                              let statusIcon = <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />;
                              let statusColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                              let statusText = "Conforme";
                              
                              if (item.status === 'divergente') {
                                statusIcon = <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 animate-pulse" />;
                                statusColor = "bg-rose-50 text-rose-700 border-rose-200";
                                statusText = "Crítico";
                              } else if (item.status === 'atencao') {
                                statusIcon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
                                statusColor = "bg-amber-50 text-amber-700 border-amber-200";
                                statusText = "Atenção";
                              }

                              return (
                                <div 
                                  key={idx} 
                                  className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden transition-all duration-200 hover:shadow-sm"
                                >
                                  {/* HEADER ROW (Clickable Accordion Trigger) */}
                                  <div 
                                    onClick={() => setExpandedDivergencias(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 cursor-pointer gap-3 hover:bg-slate-50/50 select-none transition-colors"
                                  >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <div className="mt-0.5 shrink-0">
                                        {statusIcon}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-bold text-slate-800 text-xs md:text-sm leading-tight font-sans">
                                            {item.campo}
                                          </span>
                                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] md:text-xs font-bold border ${cat.color}`}>
                                            {cat.name}
                                          </span>
                                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] md:text-xs font-bold border ${statusColor}`}>
                                            {statusText}
                                          </span>
                                        </div>
                                        <p className="text-xs text-slate-400 font-normal truncate mt-1">
                                          Origem: {item.documentoAuxiliar}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Financial Values Display on Desktop/Mobile */}
                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pl-7 sm:pl-0">
                                      <div className="flex gap-4 text-right">
                                        <div>
                                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none mb-1">Original</span>
                                          <span className="font-mono text-xs text-slate-500 font-semibold">{item.valorContrato}</span>
                                        </div>
                                        <div>
                                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none mb-1">Identificado</span>
                                          <span className={`font-mono text-xs font-extrabold ${item.status === 'divergente' ? 'text-rose-600' : item.status === 'atencao' ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {item.valorDocumento}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0">
                                        {isExpanded ? (
                                          <ChevronDown className="w-4.5 h-4.5 transform rotate-180 transition-transform duration-250" />
                                        ) : (
                                          <ChevronDown className="w-4.5 h-4.5 transition-transform duration-250" />
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* EXPANDABLE ACCORDION PANEL */}
                                  <AnimatePresence initial={false}>
                                    {isExpanded && (
                                      <motion.div
                                        key={`accordion-panel-${idx}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15, ease: "easeInOut" }}
                                        className="border-t border-slate-150 overflow-hidden"
                                      >
                                        <div className="p-4 bg-slate-50/70 text-sm text-slate-600 leading-relaxed font-medium space-y-3">
                                          <div className="flex items-start gap-2 bg-white p-3.5 rounded-lg border border-slate-150">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                            <div>
                                              <span className="font-bold text-slate-700 block">Impacto/Justificativa Técnica:</span>
                                              <p className="text-slate-600 mt-0.5 leading-normal font-medium">{item.detalhe}</p>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                                            <span>Documento Base: {item.documentoAuxiliar}</span>
                                            <span className="text-emerald-600">Verificação IA Concluída</span>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-6 border-2 border-dashed border-emerald-150 rounded-2xl bg-emerald-50/30 text-center space-y-2">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                              <CheckCircle className="w-5 h-5" />
                            </div>
                            <h5 className="font-bold text-emerald-900 text-xs">Conformidade e Regularidade</h5>
                            <p className="text-xs text-slate-500 max-w-md mx-auto leading-normal">
                              Nenhuma irregularidade foi detectada para este foco nesta CPR. A IA varreu as cláusulas e cronogramas anexos e atestou que as condições estão regulares com base na legislação agrícola vigente.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* TOP BLOCK: SCENARIOS COST ANALYSIS BOX */}
                <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Scale className="w-4.5 h-4.5 text-emerald-600" />
                        Comparativo de Custos Financeiros
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Efeito Cascata Acumulado
                      </span>
                    </div>

                    {/* Simulates original vs. recommended scenario progress indicators */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Original Cost Box */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative flex flex-col justify-between">
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Operação Vigente Original
                          </div>
                          <div className="text-2xl font-black text-slate-800">
                            {formatCurrency(totalPagoOriginal)}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Custo de Juros: {formatCurrency(totalJurosOriginal)}
                          </div>
                        </div>

                        <div className="space-y-1 mt-4">
                          <div className="w-full bg-slate-200 h-2 rounded-full">
                            <div className="bg-slate-400 h-full rounded-full w-full"></div>
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-500">
                            <span>TX: {contrato.taxaJurosAnual}% + {contrato.indexadorOriginal}</span>
                            <span>{contrato.cronogramaParcelas.length} parcelas</span>
                          </div>
                        </div>
                      </div>

                      {/* AI Optimized Recommended Box */}
                      <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 relative flex flex-col justify-between ring-2 ring-emerald-500/10">
                        <div>
                          <div className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                            Recomendado: {melhorCenario.nome}
                          </div>
                          <div className="text-2xl font-black text-emerald-900">
                            {formatCurrency(melhorCenario.totalPago)}
                          </div>
                          <div className="text-[10px] text-emerald-700 mt-1">
                            Juros Simulados: {formatCurrency(melhorCenario.totalJuros)}
                          </div>
                        </div>

                        <div className="space-y-1 mt-4">
                          <div className="w-full bg-emerald-100 h-2 rounded-full">
                            <div 
                              className="bg-emerald-600 h-full rounded-full" 
                              style={{ width: `${(melhorCenario.totalPago / (totalPagoOriginal || 1)) * 105}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-emerald-800">
                            <span>Taxa Fixa: {melhorCenario.taxaJurosAnual}% + {melhorCenario.indexador}</span>
                            <span className="text-amber-600 font-extrabold">Economia: {formatCurrency(melhorCenario.economiaRelativa)}</span>
                          </div>
                        </div>

                        {melhorCenario.economiaRelativa > 0 && (
                          <div className="absolute -top-2.5 -right-2.5 bg-emerald-500 text-slate-900 p-1.5 rounded-full shadow-lg">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </div>

                  <div className="pt-3 flex items-center justify-between text-xs text-slate-400 font-medium border-t border-slate-100 mt-3">
                    <span>* Projeções baseadas no comportamento histórico composto dos indexadores</span>
                    <span className="text-emerald-600 font-bold">BACEN SGS API</span>
                  </div>
                </div>
              </div>

                {/* BOTTOM BLOCK: COMPACT SCENARIO BUILDER (Full-Width, Stacked Below) */}
                <div className="w-full bg-gradient-to-b from-white to-slate-50/50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-0 pointer-events-none"></div>
                  
                  <div className="pb-3 border-b border-slate-100 relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <Calculator className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-base tracking-tight">Novo Cenário</h3>
                    </div>
                    <p className="text-xs text-slate-500">Crie uma nova hipótese de renegociação para comparar custos</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 relative z-10">
                    {/* LEFT COLUMN: FORM */}
                    <div className="space-y-4">
                      <form onSubmit={handleAddCenario} className="space-y-4 text-sm">
                        <div className="space-y-1.5">
                          <label className="block text-slate-600 font-semibold text-xs uppercase tracking-wider">Identificação</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: Banco do Brasil - Selic Especial"
                            value={newCenarioNome}
                            onChange={e => setNewCenarioNome(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-medium shadow-sm transition-all placeholder:text-slate-400"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-slate-600 font-semibold text-xs uppercase tracking-wider">Indexador</label>
                            <select
                              value={newCenarioIndexador}
                              onChange={e => setNewCenarioIndexador(e.target.value as Indexador)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-bold shadow-sm transition-all cursor-pointer appearance-none"
                            >
                              <option value={Indexador.INPC}>INPC</option>
                              <option value={Indexador.SELIC}>SELIC</option>
                              <option value={Indexador.CDI}>CDI</option>
                              <option value={Indexador.IPCA}>IPCA</option>
                              <option value={Indexador.TR}>TR</option>
                              <option value={Indexador.PRE}>PRÉ-FIXADO</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-slate-600 font-semibold text-xs uppercase tracking-wider truncate">
                              {newCenarioIndexador === Indexador.PRE ? "Taxa Fixa (a.a.)" : "Spread (a.a.)"}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                value={newCenarioTaxa}
                                onChange={e => setNewCenarioTaxa(Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 font-black shadow-sm transition-all pr-8"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none">%</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar Simulação
                        </button>
                      </form>
                    </div>

                    {/* RIGHT COLUMN: LIST */}
                    <div className="flex flex-col h-full min-h-[140px] md:border-l md:border-slate-200 md:pl-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cenários em Análise</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{cenarios.length} ativos</span>
                      </div>
                      
                      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 max-h-[220px] flex-1">
                        {cenarios.map(c => {
                          const taxaBase = indexadores[c.indexador] || 0;
                          const taxaEfetiva = c.indexador === Indexador.PRE 
                            ? c.taxaJurosAnual 
                            : ((1 + (c.taxaJurosAnual / 100)) * (1 + (taxaBase / 100)) - 1) * 100;

                          return (
                            <div key={c.id} className="group flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
                              <div className="min-w-0 flex-1 pr-3">
                                <p className="font-bold text-slate-800 text-sm truncate group-hover:text-emerald-700 transition-colors">{c.nome}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">{c.indexador}</span>
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {c.indexador === Indexador.PRE ? 'Taxa:' : 'Spread:'} <span className="font-bold text-slate-700">{c.taxaJurosAnual.toFixed(2)}%</span>
                                  </span>
                                  <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                    Taxa Efetiva: {taxaEfetiva.toFixed(2)}% a.a.
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveCenario(c.id)}
                                title="Remover cenário"
                                className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg transition-all cursor-pointer flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                        {cenarios.length === 0 && (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <Calculator className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-xs font-medium text-slate-500">Nenhum cenário comparativo.<br/>Crie um à esquerda para começar.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              {/* SECTION 3: INTERACTIVE COMPARISON CHARTS & DETAILED CASH FLOW TABLES (FULL WIDTH AT BOTTOM) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                
                {/* SECTION TABS HEADER */}
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex bg-slate-200/60 p-1 rounded-xl text-xs gap-1">
                    <button
                      onClick={() => setActiveTab("comparativo")}
                      className={`px-4 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                        activeTab === "comparativo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Análise de Indexador
                    </button>
                    <button
                      onClick={() => setActiveTab("fluxo")}
                      className={`px-4 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                        activeTab === "fluxo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Projeção Mensal
                    </button>
                  </div>

                  {activeTab === "comparativo" && (
                    <button
                      onClick={() => setShowChart(!showChart)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title={showChart ? "Ocultar visualização gráfica" : "Exibir gráfico comparativo"}
                    >
                      {showChart ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ocultar Gráfico</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Exibir Gráfico</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="p-6">
                  {activeTab === "comparativo" ? (
                    
                    /* CHART TAB: SIDE-BY-SIDE GRAPH BAR COMPARISONS (OPTIONAL) */
                    <div className="space-y-6">
                      {showChart && (
                        <div className="h-80 w-full animate-fadeIn border-b border-slate-100 pb-6">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={chartDataTotal}
                              margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `R$ ${(val/1000000).toFixed(1)}M`} />
                              <ChartTooltip 
                                formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                                contentStyle={{ background: "#0f172a", borderRadius: "12px", color: "#fff", border: "none" }}
                              />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Bar dataKey="Principal Amortizado" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={40} />
                              <Bar dataKey="Juros Acumulados" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Scenarios detailed breakdown table */}
                      <div className="overflow-x-auto rounded-xl border border-slate-150">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-3">Cenário de Renegociação</th>
                              <th className="p-3">Indexador</th>
                              <th className="p-3">Taxa Fixa/Spread</th>
                              <th className="p-3 text-right">Amortização</th>
                              <th className="p-3 text-right">Juros Acumulados</th>
                              <th className="p-3 text-right">Custo Efetivo Total</th>
                              <th className="p-3 text-right text-emerald-600">Economia Relativa</th>
                              <th className="p-3 text-center">Auditoria</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr className="bg-slate-50/40">
                              <td className="p-3 font-semibold text-slate-800">Contrato Original Vigente</td>
                              <td className="p-3 font-medium uppercase text-slate-600">{contrato.indexadorOriginal}</td>
                              <td className="p-3 text-slate-600">{contrato.taxaJurosAnual.toFixed(2)}% a.a.</td>
                              <td className="p-3 text-right text-slate-600">{formatCurrency(contrato.valorPrincipal)}</td>
                              <td className="p-3 text-right text-slate-600">{formatCurrency(totalJurosOriginal)}</td>
                              <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(totalPagoOriginal)}</td>
                              <td className="p-3 text-right text-slate-400 font-medium">-</td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => openMemoriaCalculo(undefined, "Contrato Original Vigente", contrato.indexadorOriginal, contrato.taxaJurosAnual)}
                                  className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                  title="Ver Memória de Cálculo Auditável"
                                >
                                  <Calculator className="w-3 h-3 text-emerald-400" />
                                  <span>Memória</span>
                                </button>
                              </td>
                            </tr>
                            {resultadosCenarios.map(cen => (
                              <tr key={cen.id} className="hover:bg-slate-50/60 transition">
                                <td className="p-3 font-semibold text-slate-800">{cen.nome}</td>
                                <td className="p-3 font-medium uppercase text-slate-600">
                                  <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {cen.indexador}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-600">{cen.taxaJurosAnual.toFixed(2)}% a.a.</td>
                                <td className="p-3 text-right text-slate-600">{formatCurrency(cen.totalAmortizado)}</td>
                                <td className="p-3 text-right text-slate-600">{formatCurrency(cen.totalJuros)}</td>
                                <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(cen.totalPago)}</td>
                                <td className={`p-3 text-right font-bold ${cen.economiaRelativa > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {cen.economiaRelativa > 0 ? `+ ${formatCurrency(cen.economiaRelativa)}` : formatCurrency(cen.economiaRelativa)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => openMemoriaCalculo(undefined, cen.nome, cen.indexador, cen.taxaJurosAnual)}
                                    className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-800 transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                    title="Ver Memória de Cálculo Auditável"
                                  >
                                    <Calculator className="w-3 h-3 text-emerald-300" />
                                    <span>Memória</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    
                    /* DETAILED FLOW TAB: LINE GRAPH & COMPLETE SCHEDULE BY PERIODS */
                    <div className="space-y-6">
                      
                      {/* Dropdown to switch analyzed scenarios */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-500 uppercase">Analisar Fluxo do Cenário:</label>
                        <select
                          value={selectedFluxoCenario}
                          onChange={e => setSelectedFluxoCenario(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="original">Contrato Original Vigente</option>
                          {cenarios.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={activeFluxoParcelas}
                            margin={{ top: 10, right: 10, left: 20, bottom: 5 }}
                          >
                            <defs>
                              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="data" 
                              stroke="#94a3b8" 
                              fontSize={11} 
                              tickLine={false} 
                              tickFormatter={(val) => formatDate(val)}
                            />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                            <ChartTooltip 
                              formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                              contentStyle={{ background: "#0f172a", borderRadius: "12px", color: "#fff", border: "none" }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Area type="monotone" dataKey="totalPago" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" name="Total da Parcela (Amortização + Encargos)" />
                            <Line type="monotone" dataKey="saldoDevedorFinal" stroke="#94a3b8" strokeWidth={2} name="Saldo Devedor Residual" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Cash flow detailed period grid */}
                      <div className="overflow-x-auto rounded-xl border border-slate-150">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                              <th className="p-3">Nº</th>
                              <th className="p-3">Vencimento</th>
                              <th className="p-3 text-right">Amortização (%)</th>
                              <th className="p-3 text-right">Saldo Inicial</th>
                              <th className="p-3 text-right">Amortização</th>
                              <th className="p-3 text-right">Juros Indexador</th>
                              <th className="p-3 text-right">Juros Spread / Fixo</th>
                              <th className="p-3 text-right">Total Parcela</th>
                              <th className="p-3 text-right">Saldo Devedor Final</th>
                              <th className="p-3 text-center">Auditoria</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeFluxoParcelas.map((p, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/40 transition">
                                <td className="p-3 font-bold text-slate-400">#{p.numero}</td>
                                <td className="p-3 font-semibold text-slate-700">{formatDate(p.data)}</td>
                                <td className="p-3 text-right text-slate-600">{p.percentualAmortizacao.toFixed(4)}%</td>
                                <td className="p-3 text-right text-slate-600">{formatCurrency(p.saldoDevedorInicial)}</td>
                                <td className="p-3 text-right text-slate-700 font-medium">{formatCurrency(p.amortizacao)}</td>
                                <td className="p-3 text-right text-slate-600">{formatCurrency(p.jurosIndexador)}</td>
                                <td className="p-3 text-right text-slate-600">{formatCurrency(p.jurosSpread)}</td>
                                <td className="p-3 text-right font-bold text-slate-800 bg-emerald-50/20">{formatCurrency(p.totalPago)}</td>
                                <td className="p-3 text-right text-slate-500 font-medium">{formatCurrency(p.saldoDevedorFinal)}</td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => {
                                      const activeCen = cenarios.find(c => c.id === selectedFluxoCenario);
                                      openMemoriaCalculo(
                                        p,
                                        activeCen?.nome || "Contrato Original",
                                        activeCen?.indexador || contrato.indexadorOriginal,
                                        activeCen?.taxaJurosAnual !== undefined ? activeCen.taxaJurosAnual : contrato.taxaJurosAnual
                                      );
                                    }}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                    title="Abrir Memória de Cálculo Auditável desta Parcela"
                                  >
                                    <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Memória</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

      </div>

      {/* FLOATING CHAT BUTTON */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 z-50 cursor-pointer"
        title="Assistente IA Especialista"
      >
        {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* FLOATING CHAT PANEL */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            key="floating-chat-window-panel"
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            style={{ width: chatDimensions.width, height: chatDimensions.height }}
            className="fixed bottom-24 right-6 min-w-[320px] max-w-[90vw] min-h-[400px] max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Custom Top-Left Resize Handle */}
            <div
              onPointerDown={startResize}
              className="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize z-50 flex items-start justify-start p-1"
              title="Redimensionar tela"
            >
              <div className="w-3 h-3 border-t-2 border-l-2 border-slate-300 rounded-tl-[4px]" />
            </div>

            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="flex items-center justify-between p-4 pl-8 border-b border-slate-100 bg-slate-50 shrink-0 cursor-move"
            >
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-lg text-amber-600">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">Assistente IA</h2>
                  <p className="text-xs text-slate-500">Cruze dados do contrato atual</p>
                </div>
              </div>
              <button 
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setIsChatOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-white">
              {chatMessages.length === 0 ? (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center">
                  <MessageSquare className="w-10 h-10 mb-3 text-slate-200" />
                  <p className="font-medium text-slate-600 text-sm">Nenhuma mensagem ainda.</p>
                  <p className="text-xs mt-1">Cole aqui extratos, planos de recuperação ou faça perguntas sobre o contrato ativo.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${msg.role === "user" ? "bg-emerald-600 text-white rounded-br-none" : "bg-slate-50 border border-slate-200 text-slate-700 rounded-bl-none"}`}>
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                      ) : (
                        <div className="prose prose-sm prose-slate max-w-none text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl rounded-bl-none p-3 shadow-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Analisando...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 flex flex-col gap-2 p-3 bg-slate-50 border-t border-slate-200">
              {chatFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-1">
                  {chatFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md w-fit text-[10px] font-medium border border-emerald-100">
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <button onClick={() => setChatFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-emerald-900">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="relative">
                  <input
                    type="file"
                    id="chat-file-upload"
                    className="hidden"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setChatFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                      }
                    }}
                  />
                  <label
                    htmlFor="chat-file-upload"
                    className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer transition shrink-0"
                    title="Anexar arquivo PDF ou imagem"
                  >
                    <Paperclip className="w-4 h-4" />
                  </label>
                </div>
                
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Faça uma pergunta..."
                  className="flex-1 bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none min-h-[40px] max-h-[120px]"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                />
                
                <button
                  onClick={handleSendChatMessage}
                  disabled={isChatLoading || (!chatInput.trim() && chatFiles.length === 0)}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl w-10 h-10 flex items-center justify-center transition shrink-0"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Alert System (non-blocking) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={`toast-notification-${toast.type}-${toast.message.slice(0, 10)}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 left-6 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-bold min-w-[280px] ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : toast.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-5 h-5 text-blue-600 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog Overlay (sandbox safe) */}
      <AnimatePresence>
        {confirmModal && (
          <div key="confirm-dialog-overlay-backdrop" className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              key="confirm-dialog-card-box"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-w-sm w-full text-center space-y-4"
            >
              <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-800">Confirmação</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Memória de Cálculo Auditável Modal */}
      <MemoriaCalculoModal
        isOpen={memoriaModalState.isOpen}
        onClose={closeMemoriaCalculo}
        contrato={contrato}
        parcela={memoriaModalState.parcela}
        cenarioNome={memoriaModalState.cenarioNome}
        indexadorNome={memoriaModalState.indexadorNome}
        taxaJurosAnual={memoriaModalState.taxaJurosAnual}
        valorIndexadorAnual={memoriaModalState.valorIndexadorAnual}
        indexadorRates={indexadores}
        associatedDocuments={savedSimulations.find(s => s.id === loadedSimulationId)?.associatedDocuments || []}
        onViewDocument={(doc) => setViewingDocument(doc)}
      />

      {/* Simulador de Negociação e Repactuação Modal */}
      <SimuladorNegociacaoModal
        isOpen={simuladorModalOpen}
        onClose={() => setSimuladorModalOpen(false)}
        contrato={contrato}
        indexadorRates={indexadores}
        initialProposal={savedProposal}
        onSaveProposal={handleSaveProposalToFirestore}
      />

      {/* Auth Modal with Email, 1-Click Analista & Google OAuth options */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(msg) => showToast(msg, "success")}
      />

      {/* Modal de Ajuste Manual de Taxas e Indexadores */}
      <TaxasManualModal
        isOpen={taxasModalOpen}
        onClose={() => setTaxasModalOpen(false)}
        indexadores={indexadores}
        onSave={(newRates) => {
          setIndexadores(newRates);
          setLastUpdated("Ajuste Manual do Usuário (" + new Date().toLocaleTimeString("pt-BR") + ")");
          showToast("Taxas atualizadas manualmente com sucesso!", "success");
        }}
        onFetchOfficial={fetchIndexadores}
        loadingOfficial={loadingIndexadores}
        lastUpdatedStr={lastUpdated}
      />

      {/* Modal de Visualização de Documentos Internos e Anexos (PDF / Imagens) */}
      <DocumentViewerModal
        document={viewingDocument}
        contratoNumero={contrato?.numero}
        onClose={() => setViewingDocument(null)}
        onAnalyzeWithAI={(docItem) => {
          if (loadedSimulationId) {
            handleAnalyzeAndFill(loadedSimulationId, docItem);
          } else {
            showToast("Carregue ou salve uma simulação para aplicar a extração por IA.", "info");
          }
        }}
        isAnalyzing={analyzingDocId === viewingDocument?.id}
      />

      {/* Modal de Resumo Consolidado Único de Contratos por Cliente / Credor */}
      <ResumoConsolidadoModal
        isOpen={isResumoConsolidadoOpen}
        onClose={() => setIsResumoConsolidadoOpen(false)}
        simulations={savedSimulations}
        initialEmitente={resumoConsolidadoEmitente}
        indexadores={indexadores}
        onToggleAtivo={handleToggleContractStatus}
      />

      {/* Modal de Importação em Lote do Computador Local */}
      <LocalBatchModal
        isOpen={isLocalBatchModalOpen}
        onClose={() => setIsLocalBatchModalOpen(false)}
        user={user}
        onComplete={fetchSavedSimulations}
        showToast={showToast}
      />

      {/* Modal de Acompanhamento da Fila e Retomada por Etapas */}
      <QueueStatusModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        tasks={queueWorker.tasks}
        isProcessing={queueWorker.isProcessing}
        currentTask={queueWorker.currentTask}
        onRetryTask={queueWorker.retryTask}
      />

      {/* Modal Global de Conflito de Contrato Duplicado */}
      {duplicateConflict && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-amber-500 text-white p-5 flex items-center justify-between border-b border-amber-600">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg text-white">⚠️ Cédula de Crédito / Contrato Duplicado Detectado</h3>
                  <p className="text-xs text-amber-100">Um contrato idêntico ou com mesmo número já existe no banco de dados</p>
                </div>
              </div>
              <button
                onClick={() => setDuplicateConflict(null)}
                className="text-amber-100 hover:text-white p-1 rounded-lg hover:bg-amber-600 transition cursor-pointer"
                title="Descartar / Fechar"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-slate-800">
              <p className="text-sm">
                O contrato número <strong className="text-amber-800 font-bold">{duplicateConflict.novoContrato.numero}</strong> já está cadastrado no sistema para o emitente <strong className="text-slate-900">{duplicateConflict.existingSim.contractData?.emitente || duplicateConflict.existingSim.contrato?.emitente || "Não informado"}</strong>.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs">
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-amber-600" />
                  Diferenças identificadas entre os documentos:
                </h4>
                {duplicateConflict.differences.length === 0 ? (
                  <p className="text-slate-600 italic">
                    Os dados do contrato importado são idênticos aos salvos no banco de dados. Nenhuma divergência financeira ou de prazos foi encontrada.
                  </p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1 font-semibold text-amber-950">
                    {duplicateConflict.differences.map((diff, i) => (
                      <li key={i}>{diff}</li>
                    ))}
                  </ul>
                )}
              </div>

              {duplicateConflict.differences.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motivo da alteração (resumo histórico):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Nova repactuação de juros ou correção pelo IPCA..."
                    id="changeSummaryInputModalGlobal"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
              )}
            </div>

            <div className="bg-slate-100 border-t border-slate-200 p-4 flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setDuplicateConflict(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Descartar Envio / Cancelar
              </button>

              {duplicateConflict.differences.length === 0 ? (
                <>
                  <button
                    onClick={handleResolveKeepExisting}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <FileText className="w-4 h-4" /> Carregar Registro Existente
                  </button>
                  <button
                    onClick={() => {
                      handleResolveNewVersion("Re-importação manual de documento idêntico");
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Salvar como Nova Versão (v{(duplicateConflict.existingSim.version || 1) + 1})
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleResolveOverwrite}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Sobrescrever Versão Atual
                  </button>
                  <button
                    onClick={() => {
                      const input = document.getElementById("changeSummaryInputModalGlobal") as HTMLInputElement;
                      handleResolveNewVersion(input?.value || "Nova versão carregada manualmente");
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                  >
                    Salvar como Nova Versão (v{(duplicateConflict.existingSim.version || 1) + 1})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
