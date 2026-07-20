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
  Cloud,
  Database,
  MessageSquare,
  Paperclip,
  X,
  Menu,
  ChevronLeft
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
  Laudo
} from "./types";
import {
  formatCurrency,
  formatPercentage,
  formatDate,
  calcularProjecao,
  processarCenario,
  exportToCSV
} from "./utils/math";
import { auth, loginWithGoogle, logout, db, handleFirestoreError, OperationType, getAccessToken } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";

import ReactMarkdown from "react-markdown";

function sanitizeFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreData(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = sanitizeFirestoreData(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

// Default preloaded contract data matching the user's provided CPR PDF
const DEFAULT_CONTRATO: Contrato = {
  numero: "CPR-12345",
  emitente: "NOME DO PRODUTOR",
  credor: "BANCO EXEMPLO",
  dataEmissao: "2023-01-15",
  dataVencimento: "2028-01-15",
  valorPrincipal: 1000000.00,
  taxaJurosAnual: 3.5, // 3.5% a.a. spread
  indexadorOriginal: Indexador.CDI,
  produto: "SOJA A GRANEL",
  quantidade: "10000 SACAS",
  valorEmissao: 1000000.00,
  cronogramaParcelas: [
    { data: "2024-01-15", percentualAmortizacao: 20.00, paga: true },
    { data: "2025-01-15", percentualAmortizacao: 20.00, paga: true },
    { data: "2026-01-15", percentualAmortizacao: 20.00, paga: false },
    { data: "2027-01-15", percentualAmortizacao: 20.00, paga: false },
    { data: "2028-01-15", percentualAmortizacao: 20.00, paga: false }
  ]
};

// Standard initial scenarios to compare
const DEFAULT_CENARIOS: SimuloCenario[] = [
  { id: "cen-1", nome: "Portabilidade Selic + Spread Baixo", indexador: Indexador.SELIC, taxaJurosAnual: 1.50 },
  { id: "cen-2", nome: "Renegociação IPCA + Juros Fixos", indexador: Indexador.IPCA, taxaJurosAnual: 5.50 },
  { id: "cen-3", nome: "Transição para Taxa Pré-Fixada", indexador: Indexador.PRE, taxaJurosAnual: 11.25 },
  { id: "cen-4", nome: "Renegociação TR + Spread Moderado", indexador: Indexador.TR, taxaJurosAnual: 7.90 }
];

export default function App() {
  // Application State
  const [contrato, setContrato] = useState<Contrato>(DEFAULT_CONTRATO);
  const [cenarios, setCenarios] = useState<SimuloCenario[]>(DEFAULT_CENARIOS);
  const [dataHoje, setDataHoje] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  
  const [indexadores, setIndexadores] = useState<IndexadorRates>({
    CDI: 10.65,
    SELIC: 10.75,
    IPCA: 4.50,
    TR: 1.25,
    PRE: 0.00
  });

  const [loadingIndexadores, setLoadingIndexadores] = useState(false);
  const [indexadoresStatus, setIndexadoresStatus] = useState<"success" | "warning" | "idle">("idle");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // AI Extraction State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scenario UI states
  const [newCenarioNome, setNewCenarioNome] = useState("");
  const [newCenarioIndexador, setNewCenarioIndexador] = useState<Indexador>(Indexador.SELIC);
  const [newCenarioTaxa, setNewCenarioTaxa] = useState(2.0);
  const [activeTab, setActiveTab] = useState<"comparativo" | "fluxo">("comparativo");
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
        alert("Erro ao ler os arquivos selecionados.");
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          contrato,
          cenarios
        })
      });
      
      if (!res.ok) throw new Error("Falha na resposta do assistente");
      
      const data = await res.json();
      setChatMessages([...updatedMessages, { role: 'model', content: data.reply }]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // Saved Simulations State
  const [savedSimulations, setSavedSimulations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingSimulations, setLoadingSimulations] = useState(false);

  const fetchSavedSimulations = async () => {
    if (!user) return;
    setLoadingSimulations(true);
    try {
      const q = collection(db, "simulations");
      const snapshot = await getDocs(q);
      const sims = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((sim: any) => sim.userId === user.uid)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSavedSimulations(sims);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSimulations(false);
    }
  };

  useEffect(() => {
    if (activeNav === "contratos") {
      fetchSavedSimulations();
    }
  }, [activeNav, user]);

  // Contract Verification (Laudo)
  const [verifyingContract, setVerifyingContract] = useState(false);
  const [laudo, setLaudo] = useState<Laudo | null>(null);

  const handleVerifyIrregularities = async () => {
    setVerifyingContract(true);
    setLaudo(null);
    try {
      const res = await fetch("/api/verify-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrato })
      });
      if (!res.ok) {
        throw new Error("Erro na requisição para análise.");
      }
      const data = await res.json();
      setLaudo(data);
      // Change tab or show modal? We can just set a modal state, but let's assume we render it below.
    } catch (err: any) {
      alert("Falha ao gerar laudo: " + err.message);
    } finally {
      setVerifyingContract(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load official indexers on start
  useEffect(() => {
    fetchIndexadores();
  }, []);

  const fetchIndexadores = async () => {
    setLoadingIndexadores(true);
    try {
      const res = await fetch("/api/indexadores");
      if (res.ok) {
        const data = await res.json();
        setIndexadores({
          CDI: data.CDI,
          SELIC: data.SELIC,
          IPCA: data.IPCA,
          TR: data.TR,
          PRE: 0.00
        });
        setIndexadoresStatus("success");
        setLastUpdated(new Date().toLocaleTimeString("pt-BR") + " (BACEN/SGS)");
      } else {
        throw new Error("Resposta da API com erro");
      }
    } catch (err) {
      console.error("Failed to fetch BCB indexers:", err);
      setIndexadoresStatus("warning");
      setLastUpdated("Uso de valores referenciais de mercado");
    } finally {
      setLoadingIndexadores(false);
    }
  };

  const handleSaveSimulation = async () => {
    if (!user) {
      alert("Por favor, faça login para salvar sua simulação.");
      return;
    }
    
    setSaving(true);
    try {
      const simulationId = `${user.uid}_${Date.now()}`;
      const simData = {
        userId: user.uid,
        name: `Simulação - ${contrato.numero || "Sem Nome"}`,
        contractData: contrato,
        scenariosData: cenarios,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, "simulations", simulationId), sanitizeFirestoreData(simData));
      alert("Simulação salva com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `simulations`);
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
                : Indexador.CDI,
              cronogramaParcelas: cronograma,
              produto: data.produto || "",
              quantidade: data.quantidade || "",
              valorEmissao: Number(data.valorEmissao) || Number(data.valorPrincipal)
            };

            setContrato(novoContrato);

            setSelectedFluxoCenario("original");
            setAnalyzing(false);
            setActiveNav("dashboard"); // Return to simulation dashboard on success

            if (user) {
              const simulationId = `${user.uid}_${Date.now()}`;
              const simData = {
                userId: user.uid,
                name: `Upload Auto - ${novoContrato.numero || "Sem Nome"}`,
                contractData: novoContrato,
                scenariosData: cenarios,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              setDoc(doc(db, "simulations", simulationId), sanitizeFirestoreData(simData))
                .then(() => fetchSavedSimulations())
                .catch((err) => console.error("Auto save failed", err));
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
          field === "valorOutrosManual"
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
          valorOutrosManual: undefined
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

  // Export CSV
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
  };

  // Trigger Print layout to Save PDF cleanly
  const triggerPDFExport = () => {
    window.print();
  };

  const [exportingDrive, setExportingDrive] = useState(false);
  const handleExportToDrive = async () => {
    const token = getAccessToken();
    if (!token) {
      alert("Faça login com o Google primeiro para exportar para o Drive.");
      return;
    }

    setExportingDrive(true);
    try {
      const csvData = exportToCSV(resultadosCenarios, contrato);
      
      const metadata = {
        name: `Relatorio_Renegociacao_${contrato.numero}.csv`,
        mimeType: 'text/csv'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([csvData], { type: 'text/csv' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });

      if (!res.ok) throw new Error("Falha ao enviar arquivo para o Google Drive");
      
      alert("Relatório exportado para o Google Drive com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao exportar para o Drive: " + err.message);
    } finally {
      setExportingDrive(false);
    }
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

    let daysOverdue = 0;
    let jurosAdicionais = 0;
    let correcaoAdicional = 0;

    let jurosMora = 0;
    let multa = 0;

    if (isVencida) {
      const d1 = pDate;
      const d2 = today;
      const diffTime = d2.getTime() - d1.getTime();
      daysOverdue = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      
      const rIndexador = indexadores[contrato.indexadorOriginal] / 100;
      const rSpread = contrato.taxaJurosAnual / 100;
      
      // Calculate additional update factor from due date to today unconditionally
      // assuming manual values represent the value AT THE DUE DATE.
      const valorBaseVencimento = principal + juros + correcao + outros;
      
      // Juros remuneratórios e correção pelo período de atraso
      const updateFactorSpread = Math.pow(1 + rSpread, daysOverdue / 365) - 1;
      const updateFactorIndexador = Math.pow(1 + rIndexador, daysOverdue / 365) - 1;
      
      jurosAdicionais = valorBaseVencimento * updateFactorSpread;
      correcaoAdicional = valorBaseVencimento * updateFactorIndexador;

      // Cálculo de Multa (2%) e Juros de Mora (1% a.m.) sobre o valor atualizado
      const valorAtualizado = valorBaseVencimento + jurosAdicionais + correcaoAdicional;
      multa = valorAtualizado * 0.02; // 2% de multa padrão
      jurosMora = valorAtualizado * (0.01 * (daysOverdue / 30)); // 1% ao mês pro-rata

      // Adiciona mora aos juros e multa aos outros
      jurosAdicionais += jurosMora;
    }

    // Grand total calculated for this installment
    const totalComponentes = principal + juros + jurosAdicionais + correcao + correcaoAdicional + outros + multa;
    const valorCalculado = isPaga 
      ? (p.valorAmortizadoPago ?? totalComponentes)
      : totalComponentes;

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
      multa,
      totalComponentes,
      valorCalculado
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

        <div className="space-y-8 w-full">
          
          {/* Logo Brand Header */}
          <div className={`flex items-center gap-3 ${!isSidebarOpen && "justify-center"}`}>
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 font-bold text-xl text-slate-900 shadow-lg shadow-emerald-500/20">
              R
            </div>
            {isSidebarOpen && (
              <div className="whitespace-nowrap overflow-hidden">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  AgroCredit
                </h1>
                <span className="text-emerald-400 text-xs font-semibold block uppercase tracking-wider">
                  Simulador Pro
                </span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 w-full">
            <button
              onClick={() => setActiveNav("dashboard")}
              title={!isSidebarOpen ? "Painel de Simulação" : undefined}
              className={`w-full p-3 rounded-lg flex items-center ${isSidebarOpen ? "gap-3" : "justify-center"} transition font-medium text-sm text-left cursor-pointer ${
                activeNav === "dashboard"
                  ? "bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Layers className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Painel de Simulação</span>}
            </button>

            <button
              onClick={() => setActiveNav("contratos")}
              title={!isSidebarOpen ? "Contratos" : undefined}
              className={`w-full p-3 rounded-lg flex items-center ${isSidebarOpen ? "gap-3" : "justify-center"} transition font-medium text-sm text-left cursor-pointer ${
                activeNav === "contratos"
                  ? "bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Database className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Contratos</span>}
            </button>

            <button
              onClick={() => setActiveNav("indexadores")}
              title={!isSidebarOpen ? "Configurar Taxas" : undefined}
              className={`w-full p-3 rounded-lg flex items-center ${isSidebarOpen ? "gap-3" : "justify-center"} transition font-medium text-sm text-left cursor-pointer ${
                activeNav === "indexadores"
                  ? "bg-emerald-600/20 text-emerald-400 border-l-4 border-emerald-500"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="whitespace-nowrap overflow-hidden">Configurar Taxas</span>}
            </button>
          </nav>
        </div>

        {/* Indexers Official Status Card in Sidebar */}
        <div className={`border-t border-slate-800 pt-6 mt-6 space-y-4 w-full ${!isSidebarOpen && 'hidden'}`}>
          <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">
            Status dos Indexadores
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
              <span className="text-slate-400">TR Referencial</span>
              <span className="text-emerald-400 font-bold">{indexadores.TR.toFixed(2)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium pt-1">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
            Conexão Oficial Banco Central
          </div>
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
              <button
                onClick={loginWithGoogle}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-emerald-600" />
                Fazer Login
              </button>
            ) : (
              <>
                <button
                  onClick={handleSaveSimulation}
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className={`w-4 h-4 ${saving ? "animate-spin" : "text-emerald-600"}`} />
                  {saving ? "Salvando..." : "Salvar Simulação"}
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-slate-500" />
                  Sair
                </button>
              </>
            )}
            
            <button
              onClick={handleExportToDrive}
              disabled={exportingDrive}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <Cloud className={`w-4 h-4 ${exportingDrive ? "animate-pulse" : "text-emerald-500"}`} />
              {exportingDrive ? "Enviando..." : "Drive"}
            </button>
            <button
              onClick={triggerCSVExport}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Exportar XLS
            </button>
            <button
              onClick={triggerPDFExport}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Gerar Relatório (PDF)
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
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Novo Contrato: Extração Automática com IA</h3>
                    <p className="text-xs text-slate-500">Envie o contrato ou cédula de produto rural original (PDF ou imagem) para mapear os dados em segundos.</p>
                  </div>
                </div>

                {/* Upload Drag & Drop Area */}
                <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl p-10 text-center transition cursor-pointer" onClick={handleUploadClick}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".pdf, .png, .jpg, .jpeg, .txt"
                    className="hidden"
                  />
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center border border-slate-150 mx-auto text-emerald-600">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Arraste ou selecione o arquivo do contrato</p>
                      <p className="text-xs text-slate-400 mt-1">Suporta arquivos PDF, Imagens (PNG/JPG) de Cédulas de Produto Rural (CPR) ou Cédulas de Crédito Rural</p>
                    </div>
                    <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition">
                      Escolher Arquivo
                    </button>
                  </div>
                </div>

                {/* Extraction Progress Banner */}
                <AnimatePresence>
                  {analyzing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 overflow-hidden"
                    >
                      <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin flex-shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-emerald-900">IA do Gemini está analisando o documento contratual</h4>
                        <p className="text-[11px] text-emerald-700 mt-0.5">{analysisProgress}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {analysisError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <div>
                      <span className="font-bold">Aviso de Extração por IA:</span> {analysisError}
                      <p className="text-slate-500 mt-1">Você pode alternar para a guia "Painel de Simulação" para inserir e ajustar manualmente as taxas e datas.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">Contratos e Simulações Salvas</h2>
                      <p className="text-sm text-slate-500">Consulte o histórico de renegociações armazenadas no Firebase</p>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="p-6 bg-slate-50 rounded-xl text-center">
                    <p className="text-slate-600 mb-4">Você precisa fazer login para visualizar seus contratos salvos.</p>
                    <button onClick={loginWithGoogle} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">Fazer Login</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Pesquisar por número do contrato, emitente ou nome da simulação..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                    />
                    
                    {loadingSimulations ? (
                      <div className="flex justify-center p-8"><Activity className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedSimulations.filter(s => {
                          const cData = s.contractData || s.contrato;
                          return (cData?.numero || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (cData?.emitente || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.name || "").toLowerCase().includes(searchQuery.toLowerCase());
                        }).map(sim => {
                          const cData = sim.contractData || sim.contrato;
                          const sData = sim.scenariosData || sim.cenarios;
                          return (
                          <div key={sim.id} className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition cursor-pointer flex flex-col gap-2">
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-800 truncate">{sim.name}</span>
                              <span className="text-xs text-slate-500">{new Date(sim.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="text-sm text-slate-600">
                              <strong>Contrato:</strong> {cData?.numero} <br/>
                              <strong>Emitente:</strong> {cData?.emitente}
                            </div>
                            <button 
                              onClick={() => {
                                setContrato(cData);
                                if (sData) setCenarios(sData);
                                setActiveNav("dashboard");
                              }}
                              className="mt-2 text-emerald-600 font-bold text-xs uppercase self-start hover:text-emerald-700 flex items-center gap-1"
                            >
                              <FileText className="w-3 h-3"/> Carregar
                            </button>
                          </div>
                        )})}
                        {savedSimulations.length === 0 && (
                          <div className="col-span-2 text-center p-8 text-slate-500">
                            Nenhum contrato ou simulação salvo encontrado.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeNav === "indexadores" && (
            <motion.section 
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
                <button
                  onClick={fetchIndexadores}
                  disabled={loadingIndexadores}
                  className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingIndexadores ? "animate-spin" : ""}`} />
                  Recarregar Índices Oficiais
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border shadow-sm text-red-500">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{contrato.numero || "Cedula_Rural.pdf"}</p>
                        <p className="text-[10px] text-slate-500">Emitente: {contrato.emitente || "Carregado"}</p>
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
                      <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data Base de Cálculo</span>
                        <input
                          type="date"
                          value={dataHoje}
                          onChange={(e) => setDataHoje(e.target.value)}
                          className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition"
                        />
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
                  </div>
                </div>

                {/* LAUDO MODAL/INLINE IF EXISTS */}
                {laudo && (
                  <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-amber-500" />
                          <h2 className="text-xl font-bold text-slate-800">Laudo de Irregularidades</h2>
                        </div>
                        <button onClick={() => setLaudo(null)} className="text-slate-400 hover:text-slate-600">
                          <Check className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="space-y-4 text-sm">
                        <div className={`p-3 rounded-lg border ${laudo.irregularidadesEncontradas ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                          <span className="font-bold">{laudo.irregularidadesEncontradas ? "⚠️ Irregularidades Detectadas" : "✅ Parecer Preliminar Normal"}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-700 mb-1">Resumo da Análise</h4>
                          <p className="text-slate-600">{laudo.resumo}</p>
                        </div>
                        {laudo.pontosDeAtencao.length > 0 && (
                          <div>
                            <h4 className="font-bold text-slate-700 mb-1">Pontos de Atenção</h4>
                            <ul className="list-disc pl-5 space-y-1 text-slate-600">
                              {laudo.pontosDeAtencao.map((ponto, i) => <li key={i}>{ponto}</li>)}
                            </ul>
                          </div>
                        )}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                          <h4 className="font-bold text-slate-700 mb-1">Recomendação</h4>
                          <p className="text-slate-600">{laudo.recomendacao}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* RIGHT CARD: CONTRACT PRINCIPAL DETAILS (Col-Span-8) */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Settings className="w-4.5 h-4.5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Dados Principais do Contrato Original</h3>
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

                {/* FULL WIDTH: AMORTIZATION PAYMENT SCHEDULE (Col-Span-12) */}
                <div className="lg:col-span-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4.5 h-4.5 text-emerald-600" />
                      <h3 className="font-bold text-slate-800 text-sm">Cronograma de Pagamento do Principal</h3>
                    </div>
                    <button
                      onClick={addInstallment}
                      className="text-emerald-700 hover:text-emerald-900 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" /> Adicionar Parcela
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto pr-1 flex flex-col gap-2">
                    <div className="grid grid-cols-12 gap-2 text-[9px] font-bold text-slate-400 uppercase px-2 tracking-wider sticky top-0 bg-white pb-1 z-10">
                      <span className="col-span-1">Nº</span>
                      <span className="col-span-2">Vencimento</span>
                      <span className="col-span-1 text-right">Amort. %</span>
                      <span className="col-span-2 text-center">Situação</span>
                      <span className="col-span-2 text-right">Esperado (Princ.)</span>
                      <span className="col-span-3 text-right">Valor Pago / Corrigido</span>
                      <span className="col-span-1 text-center">Ação</span>
                    </div>

                    {cronogramaComStatus.map((p, idx) => {
                      const isPaga = p.isPaga;
                      const isVencida = p.isVencida;
                      const valorCalculado = p.valorCalculado;
                      const daysOverdue = p.daysOverdue;
                      const isExpanded = expandedIndex === idx;

                      return (
                        <React.Fragment key={idx}>
                          <div className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border text-xs transition-all ${
                            isPaga ? "bg-emerald-50/40 border-emerald-100" : (isVencida ? "bg-rose-50/40 border-rose-150" : "bg-slate-50 border-slate-150")
                          }`}>
                            {/* Nº & Toggle */}
                            <div className="col-span-1 flex flex-col sm:flex-row items-center gap-1.5">
                              <span className="font-bold text-slate-400">#{idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-0.5 ${
                                  isExpanded ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                }`}
                                title="Ver detalhamento dos juros e encargos"
                              >
                                {isExpanded ? 'Ocultar' : 'Detalhes'}
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            </div>
                            
                            {/* Vencimento */}
                            <div className="col-span-2">
                              <input
                                type="date"
                                value={p.data}
                                onChange={e => handleInstallmentChange(idx, "data", e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>

                            {/* Amortização % */}
                            <div className="col-span-1 relative">
                              <input
                                type="number"
                                step="0.01"
                                value={p.percentualAmortizacao}
                                onChange={e => handleInstallmentChange(idx, "percentualAmortizacao", e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-right focus:outline-none font-semibold text-slate-700 pr-3.5 text-[11px]"
                              />
                              <span className="absolute right-1 top-1.5 text-[9px] font-bold text-slate-400">%</span>
                            </div>

                            {/* Situação */}
                            <div className="col-span-2">
                              <select
                                value={p.paga ? "true" : "false"}
                                onChange={e => handleInstallmentChange(idx, "paga", e.target.value === "true")}
                                className={`w-full border rounded px-1.5 py-1 focus:outline-none text-[11px] font-bold cursor-pointer transition ${
                                  isPaga 
                                    ? "bg-emerald-100 border-emerald-300 text-emerald-800" 
                                    : (isVencida 
                                        ? "bg-rose-100 border-rose-300 text-rose-800" 
                                        : "bg-blue-50 border-blue-250 text-blue-800")
                                }`}
                              >
                                <option value="false">Em aberto</option>
                                <option value="true">Paga</option>
                              </select>
                            </div>

                            {/* Amortização Esperada (Principal) */}
                            <div className="col-span-2 text-right font-medium text-slate-600">
                              {formatCurrency(p.principal)}
                            </div>

                            {/* Valor Pago / Corrigido */}
                            <div className="col-span-3 text-right">
                              {isPaga ? (
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder={p.totalComponentes.toFixed(2)}
                                    value={p.valorAmortizadoPago ?? ""}
                                    onChange={e => handleInstallmentChange(idx, "valorAmortizadoPago", e.target.value)}
                                    className="w-full bg-white border border-emerald-200 text-emerald-800 rounded px-1.5 py-1 text-right font-bold text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                  />
                                  <span className="absolute right-1 top-1.5 text-[9px] font-extrabold text-emerald-400">R$</span>
                                </div>
                              ) : isVencida ? (
                                <div>
                                  <div className="font-extrabold text-rose-600 text-[11px]">
                                    {formatCurrency(valorCalculado)}
                                  </div>
                                  <div className="text-[9px] text-rose-500 font-bold">
                                    {daysOverdue} dias atraso
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-semibold text-slate-700 text-[11px]">
                                    {formatCurrency(valorCalculado)}
                                  </div>
                                  <div className="text-[9px] text-slate-400 font-semibold">
                                    Projetado c/ {contrato.indexadorOriginal}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Ações */}
                            <div className="col-span-1 text-center">
                              <button
                                onClick={() => removeInstallment(idx)}
                                className="p-1 hover:bg-red-50 text-red-500 rounded transition cursor-pointer inline-flex items-center"
                                title="Remover Parcela"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* COLLAPSIBLE DETAILED BREAKDOWN ROW */}
                          {isExpanded && (
                            <div className="col-span-12 mt-1 mb-2 bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
                              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                                    <Activity className="w-4 h-4 text-emerald-600" />
                                    Detalhamento da Parcela #{idx + 1}
                                  </span>
                                  <span className="text-[9px] text-slate-500 mt-0.5">
                                    Valores base na data de vencimento. O sistema calculará multa/juros de atraso automaticamente até a data de hoje.
                                  </span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => clearManualInstallmentDetails(idx)} 
                                  className="text-[10px] text-slate-500 hover:text-red-600 font-bold flex items-center gap-1 cursor-pointer transition shrink-0"
                                >
                                  <RefreshCw className="w-3 h-3" /> Limpar campos manuais
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Principal */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Principal (R$)</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={p.principal.toFixed(2)}
                                      value={p.valorPrincipalManual ?? ""}
                                      onChange={e => handleInstallmentChange(idx, "valorPrincipalManual", e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                    />
                                    <span className="absolute right-1 top-2 text-[9px] text-slate-400">R$</span>
                                  </div>
                                </div>

                                {/* Juros */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Juros (R$)</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={p.jurosBase.toFixed(2)}
                                      value={p.valorJurosManual ?? ""}
                                      onChange={e => handleInstallmentChange(idx, "valorJurosManual", e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                    />
                                    <span className="absolute right-1 top-2 text-[9px] text-slate-400">R$</span>
                                  </div>
                                </div>

                                {/* Correção Monetária */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correção Monetária (R$)</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={p.correcaoBase.toFixed(2)}
                                      value={p.valorCorrecaoManual ?? ""}
                                      onChange={e => handleInstallmentChange(idx, "valorCorrecaoManual", e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                    />
                                    <span className="absolute right-1 top-2 text-[9px] text-slate-400">R$</span>
                                  </div>
                                </div>

                                {/* Outros */}
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Outros/Seguro (R$)</label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={p.valorOutrosManual ?? ""}
                                      onChange={e => handleInstallmentChange(idx, "valorOutrosManual", e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded p-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                    />
                                    <span className="absolute right-1 top-2 text-[9px] text-slate-400">R$</span>
                                  </div>
                                </div>
                              </div>

                              {/* Resumo visual */}
                              <div className="bg-slate-200/50 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="text-xs space-y-1">
                                  <div className="font-bold text-slate-700">Resumo dos Componentes de Dívida:</div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-medium text-slate-600 text-[11px]">
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
                                    {p.outros > 0 && (
                                      <>
                                        <span>Outros encargos:</span>
                                        <span className="text-right font-semibold">{formatCurrency(p.outros)}</span>
                                      </>
                                    )}
                                    <span className="border-t border-slate-300 pt-0.5 font-bold text-slate-800">Soma Total Calculada:</span>
                                    <span className="border-t border-slate-300 pt-0.5 text-right font-black text-slate-900">{formatCurrency(p.totalComponentes)}</span>
                                  </div>
                                </div>
                                
                                {p.paga && (
                                  <div className="w-full sm:w-auto bg-white border border-emerald-150 p-2.5 rounded-lg space-y-2 shrink-0">
                                    <label className="block text-[10px] font-extrabold text-emerald-700 uppercase">Valor Efetivamente Pago (R$)</label>
                                    <div className="flex gap-2 items-center">
                                      <div className="relative w-36">
                                        <input
                                          type="number"
                                          step="0.01"
                                          placeholder={p.totalComponentes.toFixed(2)}
                                          value={p.valorAmortizadoPago ?? ""}
                                          onChange={e => handleInstallmentChange(idx, "valorAmortizadoPago", e.target.value)}
                                          className="w-full bg-emerald-50/50 border border-emerald-200 rounded p-1 text-right font-bold text-emerald-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-5"
                                        />
                                        <span className="absolute right-1 top-1.5 text-[9px] font-extrabold text-emerald-400">R$</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleInstallmentChange(idx, "valorAmortizadoPago", p.totalComponentes.toFixed(2))}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-1.5 rounded transition cursor-pointer"
                                        title="Copiar soma total para o valor pago"
                                      >
                                        Usar Soma
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
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

              {/* SECTION 2: COMPARATIVO DE CUSTOS & GERADOR DE CENÁRIOS (SIDE-BY-SIDE IN MIDDLE) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                
                {/* LEFT BLOCK: SCENARIOS COST ANALYSIS BOX (Col-Span-7) */}
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
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
                  </div>

                  <div className="pt-3 flex items-center justify-between text-xs text-slate-400 font-medium border-t border-slate-100 mt-3">
                    <span>* Projeções baseadas no comportamento histórico composto dos indexadores</span>
                    <span className="text-emerald-600 font-bold">BACEN SGS API</span>
                  </div>
                </div>

                {/* RIGHT BLOCK: COMPACT SCENARIO BUILDER (Col-Span-5) */}
                <div className="lg:col-span-5 bg-gradient-to-b from-white to-slate-50/50 border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-0 pointer-events-none"></div>
                  
                  <div className="space-y-4 relative z-10">
                    <div className="pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <Calculator className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-800 text-base tracking-tight">Novo Cenário</h3>
                      </div>
                      <p className="text-xs text-slate-500">Crie uma nova hipótese de renegociação para comparar custos</p>
                    </div>

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

                  {/* List of active simulation scenarios */}
                  <div className="pt-4 mt-6 border-t border-slate-100 flex-1 flex flex-col relative z-10 min-h-[140px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cenários em Análise</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{cenarios.length} ativos</span>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
                      {cenarios.map(c => (
                        <div key={c.id} className="group flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="font-bold text-slate-800 text-sm truncate group-hover:text-emerald-700 transition-colors">{c.nome}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase">{c.indexador}</span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {c.indexador === Indexador.PRE ? 'Taxa:' : 'Spread:'} <span className="font-bold text-slate-700">{c.taxaJurosAnual.toFixed(2)}%</span>
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
                      ))}
                      {cenarios.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                          <Calculator className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-xs font-medium text-slate-500">Nenhum cenário comparativo.<br/>Crie um acima para começar.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* SECTION 3: INTERACTIVE COMPARISON CHARTS & DETAILED CASH FLOW TABLES (FULL WIDTH AT BOTTOM) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
                
                {/* SECTION TABS HEADER */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-sm">Projeções Gráficas e Fluxos de Caixa Detalhados</h3>
                  </div>

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
                </div>

                <div className="p-6">
                  {activeTab === "comparativo" ? (
                    
                    /* CHART TAB: SIDE-BY-SIDE GRAPH BAR COMPARISONS */
                    <div className="space-y-6">
                      <div className="h-80 w-full">
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
    </div>
  );
}
