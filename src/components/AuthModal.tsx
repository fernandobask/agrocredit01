import React, { useState } from "react";
import { X, ShieldCheck, Mail, Lock, User, Zap, ExternalLink, CheckCircle2, AlertCircle, ArrowRight, KeyRound } from "lucide-react";
import { loginWithGoogle, loginAnonymouslyWithName, loginWithEmail, registerWithEmail } from "../firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

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

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"google" | "analista" | "email">("google");
  
  // Analista state
  const [analistaName, setAnalistaName] = useState("Dr. Fernando / Perito Agro");
  const [loadingAnalista, setLoadingAnalista] = useState(false);

  // Email state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Google state
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState("");

  if (!isOpen) return null;

  const handleAnalistaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAnalista(true);
    try {
      await loginAnonymouslyWithName(analistaName.trim() || "Analista Financeiro");
      onSuccess(`Acesso ativado com sucesso! Sessão iniciada como "${analistaName || 'Analista'}".`);
      onClose();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingAnalista(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setEmailError("Preencha e-mail e senha.");
      return;
    }
    setEmailError("");
    setLoadingEmail(true);

    try {
      if (isRegisterMode) {
        await registerWithEmail(email, password, fullName || email.split('@')[0]);
        onSuccess("Conta criada com sucesso! Você está autenticado no Firebase.");
      } else {
        await loginWithEmail(email, password);
        onSuccess("Login efetuado com sucesso!");
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setEmailError("Senha incorreta ou credenciais inválidas.");
      } else if (err.code === 'auth/weak-password') {
        setEmailError("A senha deve ter pelo menos 6 caracteres.");
      } else if (err.code === 'auth/email-already-in-use') {
        setEmailError("Este e-mail já possui conta. Faça login ou use outra senha.");
      } else {
        setEmailError("Erro no login: " + (err.message || err));
      }
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoadingGoogle(true);
    setGoogleError("");
    try {
      const res = await loginWithGoogle();
      if (res?.user) {
        onSuccess(`Login Google efetuado com sucesso! Bem-vindo(a), ${res.user.displayName || res.user.email}`);
        onClose();
      }
    } catch (err: any) {
      console.error("Erro no login Google:", err);
      const isDomainErr = err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain');
      const isPopupErr = err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup');

      if (isDomainErr || isPopupErr || window.self !== window.top) {
        setGoogleError("O Google OAuth foi retido devido a restrições de pop-up no iframe de pré-visualização. DICA: Use o 'Acesso Rápido de Analista' acima para autenticar com 1 clique instantaneamente!");
      } else {
        setGoogleError("Falha na autenticação Google: " + (err.message || err));
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Autenticação do Sistema</h3>
              <p className="text-xs text-slate-400">Banco de Dados Firestore / Criptografia SSL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 p-1.5 border-b border-slate-200 flex gap-1">
          <button
            onClick={() => setActiveTab("analista")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "analista"
                ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
            <span>1-Clique (Analista)</span>
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "email"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-slate-600" />
            <span>E-mail & Senha</span>
          </button>
          <button
            onClick={() => setActiveTab("google")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "google"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GoogleIcon className="w-3.5 h-3.5" />
            <span>Conta Google</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {activeTab === "analista" && (
            <form onSubmit={handleAnalistaLogin} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Acesso Instantâneo Garantido (Recomendado)</span>
                </div>
                <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                  Inicia uma sessão segura no Firebase sem necessidade de senhas ou aberturas de janelas externas. Ideal para o ambiente de simulação.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seu Nome ou Identificação no Laudo:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={analistaName}
                    onChange={(e) => setAnalistaName(e.target.value)}
                    placeholder="Ex: Dr. Fernando / Perito Judicial"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAnalista}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loadingAnalista ? (
                  <span>Conectando ao Firebase...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                    <span>Iniciar Sessão de Analista Agro</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === "email" && (
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {emailError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{emailError}</span>
                </div>
              )}

              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome Completo:</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nome do Profissional / Advogado"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">E-mail Profissional:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com.br"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingEmail}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {loadingEmail ? (
                  <span>Verificando credenciais...</span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <span>{isRegisterMode ? "Cadastrar e Entrar" : "Entrar com E-mail"}</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setEmailError("");
                  }}
                  className="text-xs text-emerald-700 hover:underline font-bold cursor-pointer"
                >
                  {isRegisterMode
                    ? "Já possui uma conta? Faça login"
                    : "Não possui conta? Clique para cadastrar-se rapidamente"}
                </button>
              </div>
            </form>
          )}

          {activeTab === "google" && (
            <div className="space-y-4">
              {googleError ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Restrição de Pop-up Detectada</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{googleError}</p>
                  <button
                    onClick={() => setActiveTab("analista")}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-300 fill-emerald-300" />
                    <span>Usar Acesso 1-Clique do Analista Agora</span>
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-3">
                  <p className="leading-relaxed">
                    A autenticação via Google conecta sua conta diretamente aos serviços do Firebase e autoriza o salvamento de relatórios e simulações na nuvem.
                  </p>
                  
                  <button
                    onClick={handleGoogleAuth}
                    disabled={loadingGoogle}
                    className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <GoogleIcon className="w-4 h-4" />
                    <span>{loadingGoogle ? "Aguardando confirmação do Google..." : "Entrar com Conta Google"}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 text-[11px] text-slate-500 text-center flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Ativo com Firestore Security Rules
          </span>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
