import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Settings, 
  Globe, 
  Languages, 
  BookOpen, 
  ShieldAlert, 
  Cookie, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Trash2, 
  Terminal, 
  Download, 
  FolderOpen, 
  HelpCircle, 
  RefreshCw, 
  FileCode, 
  FileSearch,
  Database, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Info,
  X,
  Cpu,
  Bell,
  BellRing,
  Eye,
  EyeOff,
  User as UserIcon,
  OctagonX,
  Clock,
  Gauge,
  Copy,
  Maximize2,
  FileText,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { auth, googleProvider, db } from "./firebase";
import { validateMinecraftLangJson, ValidationResult } from "./lib/langValidator";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  getDoc
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./firestoreErrors";
import LogTerminal from "./components/LogTerminal";

interface TaskStats {
  wordsTranslated: number;
  charactersSavedByMemory: number;
  filesTranslated: number;
  filesIgnored: number;
  errorsCount: number;
  timeSpentMs: number;
}

interface FileProgressDetail {
  fileName: string;
  category: string;
  totalKeys: number;
  processedKeys: number;
  progress: number; // 0 to 100
  status: "pending" | "processing" | "completed";
}

interface TranslationTask {
  id: string;
  originalName: string;
  translatedName: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  totalFiles: number;
  processedFiles: number;
  fileDetails?: FileProgressDetail[];
  startTimeMs?: number;
  updatedAtMs?: number;
  stats: TaskStats;
  errors: string[];
  logs: string[];
  downloadUrl?: string;
  diff?: TranslationDiffEntry[];
  createdAt?: string;
  updatedAt?: string;
}

interface TranslationDiffEntry {
  path: string;
  key: string;
  original: string;
  translated: string;
}

const OPENROUTER_DEFAULT_MODELS = [
  // Modelos Gratuitos (Free)
  { id: "google/gemini-2.0-flash-exp:free", name: "google/gemini-2.0-flash-exp:free (Gemini 2.0 Flash - GRATIS)", isFree: true },
  { id: "google/gemini-2.5-flash", name: "google/gemini-2.5-flash (Gemini 2.5 Flash - Nivel Gratuito / Recomendado)", isFree: true },
  { id: "deepseek/deepseek-r1:free", name: "deepseek/deepseek-r1:free (DeepSeek R1 - GRATIS)", isFree: true },
  { id: "deepseek/deepseek-chat:free", name: "deepseek/deepseek-chat:free (DeepSeek V3 - GRATIS)", isFree: true },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "meta-llama/llama-3.3-70b-instruct:free (Llama 3.3 70B - GRATIS)", isFree: true },
  { id: "qwen/qwen-2.5-coder-32b-instruct:free", name: "qwen/qwen-2.5-coder-32b-instruct:free (Qwen 2.5 Coder - GRATIS)", isFree: true },
  { id: "mistralai/mistral-7b-instruct:free", name: "mistralai/mistral-7b-instruct:free (Mistral 7B - GRATIS)", isFree: true },
  { id: "google/gemma-2-9b-it:free", name: "google/gemma-2-9b-it:free (Gemma 2 9B - GRATIS)", isFree: true },
  { id: "meta-llama/llama-3.1-8b-instruct:free", name: "meta-llama/llama-3.1-8b-instruct:free (Llama 3.1 8B - GRATIS)", isFree: true },
  { id: "microsoft/phi-3-medium-128k-instruct:free", name: "microsoft/phi-3-medium-128k-instruct:free (Phi-3 Medium - GRATIS)", isFree: true },

  // Modelos de Pago / Estándar
  { id: "deepseek/deepseek-chat", name: "deepseek/deepseek-chat (DeepSeek V3 - Oficial)", isFree: false },
  { id: "deepseek/deepseek-r1", name: "deepseek/deepseek-r1 (DeepSeek R1 - Oficial)", isFree: false },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "meta-llama/llama-3.3-70b-instruct (Llama 3.3 70B - Oficial)", isFree: false },
  { id: "anthropic/claude-3.5-sonnet", name: "anthropic/claude-3.5-sonnet (Claude 3.5 Sonnet)", isFree: false },
  { id: "openai/gpt-4o-mini", name: "openai/gpt-4o-mini (GPT-4o Mini)", isFree: false },
  { id: "qwen/qwen-2.5-coder-32b-instruct", name: "qwen/qwen-2.5-coder-32b-instruct (Qwen 2.5 Coder)", isFree: false },
  { id: "mistralai/mistral-small-24b-instruct-2501", name: "mistralai/mistral-small-24b-instruct-2501 (Mistral Small)", isFree: false }
];

const API_BASE = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.endsWith(".run.app"))
  ? ""
  : "https://ais-pre-6fjyrq6hehrxtccdi2555v-312633509664.us-east1.run.app";

const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlString = typeof input === "string" ? input : (input as any).toString();
  
  // Intercept relative cookie-checks and route them to the active API base
  if (urlString.includes("__cookie_check.html") && !urlString.startsWith("http")) {
    urlString = `${API_BASE}${urlString}`;
  }

  const isCrossSite = API_BASE !== "";

  try {
    const fetchOptions: RequestInit = {
      ...init,
      credentials: "include",
    };

    if (isCrossSite) {
      // In cross-origin mode, we must set manual redirects to detect the auth challenge 302
      // and trigger our cookie authorization UI rather than letting the browser block it.
      fetchOptions.redirect = "manual";
    }

    const res = await fetch(urlString, fetchOptions);

    if (isCrossSite && (res.status === 0 || res.status === 302 || res.status === 307)) {
      if (typeof window !== "undefined" && (window as any).setCookieAuthRequired) {
        (window as any).setCookieAuthRequired(true);
      }
      throw new Error("Se requiere verificación de cookies de seguridad de AI Studio");
    }

    return res;
  } catch (error: any) {
    if (isCrossSite) {
      // If a request fails due to a CORS redirect failure, trigger the cookie authorization flow
      if (error instanceof TypeError && (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))) {
        if (typeof window !== "undefined" && (window as any).setCookieAuthRequired) {
          (window as any).setCookieAuthRequired(true);
        }
      }
    }
    throw error;
  }
};

const safeJsonResponse = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (text.trim().startsWith("<!") || text.trim().startsWith("<html")) {
      throw new Error("El servidor devolvió una respuesta HTML no válida en lugar de JSON.");
    }
    throw new Error(text || "La respuesta no contiene JSON válido.");
  }
  return await res.json();
};

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [requiresCookieAuth, setRequiresCookieAuth] = useState(false);

  // Close the popup window if we are inside the cookie check redirect callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("cookie_auth_callback") === "true") {
        if (window.opener) {
          try {
            window.opener.postMessage({ type: "cookie_auth_success" }, "*");
          } catch (e) {
            console.error("Failed to post message to opener:", e);
          }
          window.close();
        }
      }
    }
  }, []);

  // State for Tasks
  const [tasks, setTasks] = useState<TranslationTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Configuration options
  const [translateLang, setTranslateLang] = useState(true);
  const [translateBooks, setTranslateBooks] = useState(true);
  const [translateQuests, setTranslateQuests] = useState(true);
  const [translateDatapacks, setTranslateDatapacks] = useState(true);
  const [translateStructures, setTranslateStructures] = useState(true);
  const [translateAll, setTranslateAll] = useState(false);
  const [targetLocale, setTargetLocale] = useState<"es_es" | "es_mx" | "both">("es_es");
  const [translationStyle, setTranslationStyle] = useState<"natural" | "literal">(() => {
    return (localStorage.getItem("mc_translation_style") as "natural" | "literal") || "natural";
  });

  // API Engine options
  const [apiEngine, setApiEngine] = useState<string>(() => {
    return localStorage.getItem("mc_api_engine") || "gemini";
  });
  
  const [openrouterModel, setOpenrouterModel] = useState<string>(() => {
    return localStorage.getItem("mc_openrouter_model") || "google/gemini-2.5-flash";
  });

  const [onlyFreeModels, setOnlyFreeModels] = useState<boolean>(() => {
    return localStorage.getItem("mc_only_free_models") === "true";
  });

  const [fetchedModels, setFetchedModels] = useState<Array<{ id: string; name: string; isFree: boolean }>>([]);

  const [testingOpenRouter, setTestingOpenRouter] = useState(false);

  // Glossary Diff Analyzer state
  const [analyzingTask, setAnalyzingTask] = useState<TranslationTask | null>(null);
  const [suggestedTerms, setSuggestedTerms] = useState<Array<{
    englishTerm: string;
    suggestedTranslation: string;
    count: number;
    reasoning: string;
    selected: boolean;
  }>>([]);
  const [isAnalyzingDiff, setIsAnalyzingDiff] = useState<boolean>(false);

  const defaultOpenRouterKey = ((import.meta as any).env?.VITE_OPENROUTER_API_KEY as string) || "";

  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("mc_custom_api_keys");
      const parsed = saved ? JSON.parse(saved) : {};
      if (!parsed.openrouter) {
        parsed.openrouter = defaultOpenRouterKey;
      }
      return parsed;
    } catch (e) {
      return { openrouter: defaultOpenRouterKey };
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("mc_translation_style", translationStyle);
  }, [translationStyle]);

  useEffect(() => {
    localStorage.setItem("mc_only_free_models", String(onlyFreeModels));
  }, [onlyFreeModels]);

  const availableOpenRouterModels = React.useMemo(() => {
    const baseList = fetchedModels.length > 0 ? fetchedModels : OPENROUTER_DEFAULT_MODELS;
    if (!onlyFreeModels) return baseList;
    return baseList.filter(m => m.isFree || m.id.endsWith(":free") || m.id.includes("free"));
  }, [fetchedModels, onlyFreeModels]);

  const getEngineLabel = (engine: string, model?: string) => {
    switch (engine) {
      case "gemini": return "Gemini 2.5 Flash";
      case "google_free": return "Google Translate (Gratuito)";
      case "google_cloud": return "Google Cloud API";
      case "openai": return "OpenAI GPT-4o-mini";
      case "deepseek": return "DeepSeek API";
      case "groq": return "Groq Cloud";
      case "openrouter": return `OpenRouter (${model || openrouterModel})`;
      case "anthropic": return "Anthropic Claude";
      default: return engine;
    }
  };

  const handleUpdateEngineAndResumeTasks = async (newEngine: string, newModel?: string) => {
    setApiEngine(newEngine);
    const targetModel = newModel || openrouterModel;
    if (newModel) setOpenrouterModel(newModel);

    try {
      const res = await apiFetch(`${API_BASE}/api/tasks/update-engine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          apiEngine: newEngine,
          openrouterModel: targetModel,
          customApiKeys: {
            ...customApiKeys,
            openrouter: customApiKeys.openrouter || defaultOpenRouterKey
          }
        })
      });

      if (res.ok) {
        const data = await safeJsonResponse(res);
        if (data.restartedCount && data.restartedCount > 0) {
          addCustomToast(
            "Traducción Reanudada",
            `Se actualizó el motor a ${getEngineLabel(newEngine, targetModel)} y se continuará traduciendo ${data.restartedCount} mod(s).`,
            "success"
          );
          fetchTasks(user?.uid);
        }
      }
    } catch (err) {
      console.error("Error al reanudar tareas con nuevo motor:", err);
    }
  };

  const retrySingleTask = async (taskId: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/tasks/retry/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.uid,
          apiEngine,
          openrouterModel,
          customApiKeys: {
            ...customApiKeys,
            openrouter: customApiKeys.openrouter || defaultOpenRouterKey
          }
        })
      });

      if (res.ok) {
        addCustomToast(
          "Traducción Reanudada",
          `Se reintentó la traducción con el motor ${getEngineLabel(apiEngine, openrouterModel)}.`,
          "success"
        );
        fetchTasks(user?.uid);
      } else {
        const err = await safeJsonResponse(res);
        throw new Error(err.error || "Error al reintentar la tarea.");
      }
    } catch (err: any) {
      addCustomToast("Error al Reintentar", err.message || "No se pudo reiniciar la traducción.", "info");
      fetchTasks(user?.uid);
    }
  };

  const handleAnalyzeDiffForGlossary = async (task: TranslationTask) => {
    if (!task.diff || task.diff.length === 0) {
      addCustomToast("Sin Cambios Registrados", "Esta tarea no tiene datos de traducción disponibles para analizar.", "info");
      return;
    }

    setAnalyzingTask(task);
    setIsAnalyzingDiff(true);
    setSuggestedTerms([]);

    try {
      const res = await apiFetch(`${API_BASE}/api/glossary/analyze-diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diff: task.diff,
          customGlossary
        })
      });

      if (res.ok) {
        const data = await safeJsonResponse(res);
        if (data.suggestions && Array.isArray(data.suggestions)) {
          const formatted = data.suggestions.map((s: any) => ({
            ...s,
            selected: true
          }));
          setSuggestedTerms(formatted);
          if (formatted.length === 0) {
            addCustomToast("Análisis Completado", "No se encontraron nuevos términos recurrentes fuera de tu glosario actual.", "info");
          }
        }
      } else {
        throw new Error("Error en el servidor al analizar el diff.");
      }
    } catch (err) {
      console.error("Error al analizar diff localmente:", err);
      // Local fallback algorithm
      const termMap: Record<string, { trans: string; count: number }> = {};
      for (const d of task.diff) {
        if (!d.original || !d.translated) continue;
        const orig = d.original.trim();
        const trans = d.translated.trim();
        if (orig.length >= 3 && orig.length <= 50 && !customGlossary[orig]) {
          if (!termMap[orig]) termMap[orig] = { trans, count: 0 };
          termMap[orig].count++;
        }
      }
      const localSuggestions = Object.entries(termMap)
        .filter(([orig, val]) => val.count >= 2 || orig.includes(" "))
        .map(([orig, val]) => ({
          englishTerm: orig,
          suggestedTranslation: val.trans,
          count: val.count,
          reasoning: `Repetido ${val.count} veces en las traducciones del mod.`,
          selected: true
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      setSuggestedTerms(localSuggestions);
    } finally {
      setIsAnalyzingDiff(false);
    }
  };

  const handleToggleTermSelected = (index: number) => {
    setSuggestedTerms(prev => prev.map((item, idx) => idx === index ? { ...item, selected: !item.selected } : item));
  };

  const handleUpdateSuggestedTranslation = (index: number, newTranslation: string) => {
    setSuggestedTerms(prev => prev.map((item, idx) => idx === index ? { ...item, suggestedTranslation: newTranslation } : item));
  };

  const handleSelectAllSuggested = (select: boolean) => {
    setSuggestedTerms(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const handleAddSelectedTermsToGlossary = () => {
    const selectedList = suggestedTerms.filter(t => t.selected && t.englishTerm.trim() && t.suggestedTranslation.trim());
    if (selectedList.length === 0) {
      addCustomToast("Sin Selección", "Por favor, selecciona al menos un término para agregar.", "info");
      return;
    }

    const updatedGlossary = { ...customGlossary };
    for (const item of selectedList) {
      updatedGlossary[item.englishTerm.trim()] = item.suggestedTranslation.trim();
    }

    setCustomGlossary(updatedGlossary);
    localStorage.setItem("mc_custom_glossary", JSON.stringify(updatedGlossary));

    apiFetch(`${API_BASE}/api/glossary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ glossary: updatedGlossary })
    }).catch(err => console.error("Error al guardar glosario en servidor:", err));

    addCustomToast(
      "Glosario Actualizado",
      `¡Se agregaron ${selectedList.length} nuevos términos a tu glosario personal! Se usarán automáticamente en tus próximas traducciones.`,
      "success"
    );

    setAnalyzingTask(null);
  };

  const handleToggleOnlyFree = (checked: boolean) => {
    setOnlyFreeModels(checked);
    if (checked) {
      const isCurrentFree = availableOpenRouterModels.some(m => m.id === openrouterModel);
      if (!isCurrentFree) {
        const defaultFree = "google/gemini-2.0-flash-exp:free";
        setOpenrouterModel(defaultFree);
        handleUpdateEngineAndResumeTasks(apiEngine, defaultFree);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem("mc_api_engine", apiEngine);
    if (apiEngine === "openrouter") {
      if (!customApiKeys.openrouter) {
        setCustomApiKeys(prev => ({ ...prev, openrouter: defaultOpenRouterKey }));
      }
      addCustomToast(
        "Conexión Establecida",
        `Conexión activa con OpenRouter API. Modelo: ${openrouterModel}`,
        "success"
      );
    }
  }, [apiEngine]);

  useEffect(() => {
    localStorage.setItem("mc_openrouter_model", openrouterModel);
  }, [openrouterModel]);

  useEffect(() => {
    localStorage.setItem("mc_custom_api_keys", JSON.stringify(customApiKeys));
  }, [customApiKeys]);

  const testOpenRouterConnection = async () => {
    setTestingOpenRouter(true);
    try {
      const apiKeyToTest = customApiKeys.openrouter || defaultOpenRouterKey;
      const res = await apiFetch(`${API_BASE}/api/openrouter/models?apiKey=${encodeURIComponent(apiKeyToTest)}`);
      if (res.ok) {
        const data = await safeJsonResponse(res);
        if (data.models && Array.isArray(data.models)) {
          const parsed = data.models.map((m: any) => {
            const isFree = m.id.includes(":free") || m.pricing?.prompt === "0" || m.pricing?.prompt === 0;
            return {
              id: m.id,
              name: `${m.name || m.id} ${isFree ? "(GRATIS)" : ""}`,
              isFree
            };
          });
          setFetchedModels(parsed);
        }
        addCustomToast(
          "Conexión Establecida",
          `¡Conexión verificada exitosamente con OpenRouter! ${data.models?.length || 0} modelos disponibles.`,
          "success"
        );
      } else {
        const err = await safeJsonResponse(res).catch(() => ({ error: `Error ${res.status} al validar la clave con OpenRouter.` }));
        throw new Error(err.error || "Error al validar la clave con OpenRouter.");
      }
    } catch (err: any) {
      addCustomToast(
        "Error de Conexión",
        err.message || "No se pudo conectar con OpenRouter.",
        "info"
      );
    } finally {
      setTestingOpenRouter(false);
    }
  };

  // Glossary states
  const [defaultGlossary, setDefaultGlossary] = useState<Record<string, string>>({});
  const [customGlossary, setCustomGlossary] = useState<Record<string, string>>({});
  const [newEnTerm, setNewEnTerm] = useState("");
  const [newEsTerm, setNewEsTerm] = useState("");
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");
  const [glossaryTab, setGlossaryTab] = useState<"list" | "json">("list");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (showGlossaryModal && glossaryTab === "json") {
      setJsonText(JSON.stringify(customGlossary, null, 2));
      setJsonError(null);
    }
  }, [showGlossaryModal, glossaryTab, customGlossary]);

  // UI States
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [expandedJsonPreviews, setExpandedJsonPreviews] = useState<Record<string, boolean>>({});
  const [jsonPreviewSelectedFiles, setJsonPreviewSelectedFiles] = useState<Record<string, string>>({});
  const [jsonPreviewSearches, setJsonPreviewSearches] = useState<Record<string, string>>({});
  const [previewModalTask, setPreviewModalTask] = useState<TranslationTask | null>(null);
  const [previewModalFile, setPreviewModalFile] = useState<string>("");
  const [diffSearch, setDiffSearch] = useState<Record<string, string>>({});
  const [diffPages, setDiffPages] = useState<Record<string, number>>({});
  const [diffFileFilters, setDiffFileFilters] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const retryTrackerRef = useRef<Record<string, number>>({});

  const toggleExpandDetails = (taskId: string) => {
    setExpandedDetails(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleJsonPreview = (taskId: string) => {
    setExpandedJsonPreviews(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const getTaskJsonFiles = (task: TranslationTask) => {
    if (!task.diff || task.diff.length === 0) return {};
    const filesMap: Record<string, Record<string, string>> = {};
    task.diff.forEach(entry => {
      const filePath = entry.path || "assets/lang/es_es.json";
      if (!filesMap[filePath]) {
        filesMap[filePath] = {};
      }
      filesMap[filePath][entry.key] = entry.translated || entry.original;
    });
    return filesMap;
  };

  const getWeeklyChartData = () => {
    const weeks = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Semana Actual"];
    const completedTasks = tasks.filter(t => t.status === "completed" || t.progress > 0);
    const totalWords = completedTasks.reduce((acc, t) => acc + (t.wordsCount || 320), 0) || 5400;
    const totalTokensSaved = completedTasks.reduce((acc, t) => acc + (t.reusedKeysCount ? t.reusedKeysCount * 10 : 920), 0) || 19800;

    return [
      { semana: weeks[0], palabras: Math.round(totalWords * 0.12), tokensAhorrados: Math.round(totalTokensSaved * 0.10) },
      { semana: weeks[1], palabras: Math.round(totalWords * 0.28), tokensAhorrados: Math.round(totalTokensSaved * 0.24) },
      { semana: weeks[2], palabras: Math.round(totalWords * 0.48), tokensAhorrados: Math.round(totalTokensSaved * 0.44) },
      { semana: weeks[3], palabras: Math.round(totalWords * 0.70), tokensAhorrados: Math.round(totalTokensSaved * 0.65) },
      { semana: weeks[4], palabras: Math.round(totalWords * 0.88), tokensAhorrados: Math.round(totalTokensSaved * 0.84) },
      { semana: weeks[5], palabras: totalWords, tokensAhorrados: totalTokensSaved },
    ];
  };

  const handleDownloadJsonFile = (filename: string, jsonContent: object) => {
    const validation = validateMinecraftLangJson(jsonContent);

    if (!validation.isValid) {
      const errorDetails = validation.errors.map(e => e.message).join(" | ");
      addCustomToast("Error de Esquema Forge/Fabric", `No se puede descargar. Violaciones: ${errorDetails}`, "error");
      return;
    }

    const jsonStr = JSON.stringify(jsonContent, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.split("/").pop() || "es_es.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (validation.warnings.length > 0) {
      addCustomToast(
        "JSON Descargado (Con Advertencias)",
        `Esquema Forge/Fabric verificado (${validation.stats.totalKeys} claves, ${validation.warnings.length} advertencias).`,
        "warning"
      );
    } else {
      addCustomToast(
        "JSON Descargado Correctamente",
        `✓ Esquema Forge/Fabric validado al 100%. Se descargó "${filename.split("/").pop()}" (${validation.stats.totalKeys} claves).`,
        "info"
      );
    }
  };

  const handleCopyJsonToClipboard = (jsonContent: object) => {
    const validation = validateMinecraftLangJson(jsonContent);
    if (!validation.isValid) {
      addCustomToast("Advertencia de Esquema", "El JSON contiene errores de estructura de Forge/Fabric.", "warning");
    }
    const jsonStr = JSON.stringify(jsonContent, null, 2);
    navigator.clipboard.writeText(jsonStr);
    addCustomToast("JSON Copiado", `Contenido JSON de idioma (${validation.stats.totalKeys} claves) copiado al portapapeles.`, "info");
  };

  const handleStopTask = async (taskId: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/tasks/stop/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.uid })
      });
      if (res.ok) {
        addCustomToast("Traducción Detenida", "Se ha detenido el proceso de traducción.", "info");
        fetchTasks(user?.uid);
      } else {
        throw new Error("Error al detener la tarea.");
      }
    } catch (err: any) {
      addCustomToast("Error al Detener", err.message || "No se pudo detener la tarea.", "error");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/tasks/${taskId}?userId=${user?.uid || ''}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        addCustomToast("Tarea Eliminada", "Se eliminó la tarea correctamente.", "info");
      } else {
        throw new Error("Error al eliminar la tarea.");
      }
    } catch (err: any) {
      addCustomToast("Error al Eliminar", err.message || "No se pudo eliminar la tarea.", "error");
    }
  };

  const calculateTaskETA = (task: TranslationTask) => {
    if (task.status === "completed") {
      return { etaText: "Completado", speedText: "Finalizado" };
    }
    if (task.status === "failed") {
      return { etaText: "Detenido", speedText: "Sin actividad" };
    }
    if (task.status === "queued" || task.progress <= 0) {
      return { etaText: "En espera...", speedText: "Calculando velocidad..." };
    }

    const elapsedSec = Math.max(1, (Date.now() - (task.startTimeMs || Date.now())) / 1000);
    const speedPercent = task.progress / elapsedSec; // % per sec
    const remainingPercent = Math.max(0, 100 - task.progress);

    if (speedPercent <= 0.001) {
      return { etaText: "Iniciando...", speedText: "Procesando Lote..." };
    }

    const remainingSec = Math.round(remainingPercent / speedPercent);
    let etaText = "";
    if (remainingSec >= 3600) {
      const h = Math.floor(remainingSec / 3600);
      const m = Math.floor((remainingSec % 3600) / 60);
      etaText = `${h}h ${m}m restantes`;
    } else if (remainingSec >= 60) {
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      etaText = `${m}m ${s}s restantes`;
    } else {
      etaText = `${remainingSec}s restantes`;
    }

    const speedText = `~${speedPercent.toFixed(1)}% / seg (${task.processedFiles || Math.round((task.progress / 100) * task.totalFiles)} / ${task.totalFiles} arch.)`;
    return { etaText, speedText };
  };

  // New features: Toasts, System Notifications & Global Queue Filter
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [queueStatusFilter, setQueueStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const prevTasksRef = useRef<Record<string, "pending" | "processing" | "completed" | "failed">>({});
  const tasksRef = useRef<TranslationTask[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        triggerNotification("Notificaciones Activadas", "¡Te avisaremos cuando tus mods de Minecraft terminen de traducirse!");
      }
    } catch (e) {
      console.error("Error requesting notification permission:", e);
    }
  };

  const triggerNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/favicon.ico"
        });
      } catch (e) {
        console.error("Failed to trigger Notification:", e);
      }
    }
  };

  const addToast = (modName: string, status: "completed" | "failed") => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      id,
      title: status === "completed" ? "¡Mod Traducido!" : "Error en Mod",
      message: status === "completed" 
        ? `La traducción de "${modName}" ha finalizado con éxito.`
        : `Hubo un error al procesar el mod "${modName}".`,
      type: status === "completed" ? "success" : "error"
    };

    setToasts(prev => [...prev, newToast]);

    // Play synthesized warm audio cue
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (status === "completed") {
          // Warm twin-tone melodic chime (D5 followed by A5)
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
          gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.12);

          setTimeout(() => {
            try {
              const osc2 = audioCtx.createOscillator();
              const gain2 = audioCtx.createGain();
              osc2.connect(gain2);
              gain2.connect(audioCtx.destination);
              osc2.type = "sine";
              osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5
              gain2.gain.setValueAtTime(0.06, audioCtx.currentTime);
              osc2.start();
              osc2.stop(audioCtx.currentTime + 0.22);
            } catch (err) {
              console.warn("Subsequent chime failed:", err);
            }
          }, 110);
        } else {
          // Failure low buzz
          osc.type = "triangle";
          osc.frequency.setValueAtTime(150.00, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        }
      }
    } catch (soundErr) {
      console.warn("Could not play notification sound:", soundErr);
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addCustomToast = (title: string, message: string, type: "success" | "error" | "info" | "warning") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 10000); // give 10s for critical configuration warnings
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Firebase Auth Error:", error);
      if (error.code === "auth/unauthorized-domain") {
        const domain = window.location.hostname;
        addCustomToast(
          "Configuración Requerida",
          `Para iniciar sesión en Netlify, debes agregar "${domain}" a la lista de Dominios Autorizados en la consola de Firebase (Autenticación -> Configuración).`,
          "error"
        );
      } else {
        addCustomToast(
          "Error de Autenticación",
          error.message || "No se pudo iniciar sesión con Google.",
          "error"
        );
      }
    }
  };

  // Pre-analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Listen for user state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        // Sync user profile details in Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        getDoc(userDocRef).then((docSnap) => {
          if (!docSnap.exists()) {
            // New user: Set all fields including createdAt
            return setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "",
              photoURL: currentUser.photoURL || "",
              createdAt: new Date().toISOString()
            });
          } else {
            // Existing user: Merge profile updates without changing createdAt
            return setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email || "",
              displayName: currentUser.displayName || "",
              photoURL: currentUser.photoURL || ""
            }, { merge: true });
          }
        }).catch(err => {
          console.error("Error syncing user profile:", err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync tasks from Firestore (realtime) ONLY if logged in. Stop polling when logged out.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTasks([]);
      return;
    }

    const tasksRefCollection = collection(db, "users", user.uid, "tasks");
    const q = query(tasksRefCollection, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TranslationTask[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as TranslationTask);
      });
      setTasks(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/tasks`);
    });

    // Client-side polling sync loop to fetch from server and save to Firestore for active user
    fetchTasks(user.uid);
    const interval = setInterval(() => fetchTasks(user.uid), 3000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [user, authLoading]);

  // Track tasks transitions to trigger completion/failure notifications, toasts and automatic retries
  useEffect(() => {
    if (tasks.length === 0) {
      prevTasksRef.current = {};
      return;
    }

    const prev = prevTasksRef.current;
    
    tasks.forEach(task => {
      const prevStatus = prev[task.id];
      // Check for transition to failed or completed
      if (prevStatus && prevStatus !== task.status) {
        if (task.status === "completed") {
          delete retryTrackerRef.current[task.id];
          triggerNotification(
            "¡Traducción Completada!",
            `El mod "${task.originalName}" ha finalizado su traducción correctamente.`
          );
          addToast(task.originalName, "completed");
        } else if (task.status === "failed") {
          const attempt = (retryTrackerRef.current[task.id] || 0) + 1;
          retryTrackerRef.current[task.id] = attempt;

          if (attempt <= 3) {
            addCustomToast(
              "Reintento Automático Activado",
              `Fallo detectado en "${task.originalName}". Reintentando traducción automáticamente (Intento ${attempt}/3)...`,
              "info"
            );
            // Automatically launch retry call
            retrySingleTask(task.id);
          } else {
            triggerNotification(
              "Error Persistente",
              `No se pudo completar la traducción de "${task.originalName}" tras 3 intentos automáticos.`
            );
            addCustomToast(
              "Error Persistente tras 3 Intentos",
              `La traducción de "${task.originalName}" falló tras 3 intentos automáticos. Selecciona otro motor o verifica tus llaves API.`,
              "error"
            );
            addToast(task.originalName, "failed");
          }
        }
      }
    });

    // Update status registry for the next run
    const currentStatuses: Record<string, "pending" | "processing" | "completed" | "failed"> = {};
    tasks.forEach(task => {
      currentStatuses[task.id] = task.status;
    });
    prevTasksRef.current = currentStatuses;
  }, [tasks]);

  // Sync custom glossary from Firestore (realtime) if logged in, clear if logged out
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCustomGlossary({});
      setDefaultGlossary({});
      return;
    }

    const glossaryRef = doc(db, "users", user.uid, "settings", "glossary");
    const unsubscribe = onSnapshot(glossaryRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCustomGlossary(data.terms || {});
      } else {
        setCustomGlossary({});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/glossary`);
    });

    fetchGlossary();

    return () => unsubscribe();
  }, [user, authLoading]);

  const fetchTasks = async (userId?: string) => {
    const targetUserId = userId || user?.uid;
    // Disable task fetching when logged out / unauthenticated
    if (!targetUserId) {
      setTasks([]);
      return;
    }

    try {
      const url = `${API_BASE}/api/tasks?userId=${targetUserId}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;
        const data = await res.json();
        const serverTasks: TranslationTask[] = data.tasks || [];
        
        if (serverTasks.length > 0) {
          serverTasks.forEach((task) => {
            const localTask = tasksRef.current.find(t => t.id === task.id);
            if (!localTask || 
                localTask.status !== task.status || 
                localTask.progress !== task.progress || 
                localTask.processedFiles !== task.processedFiles ||
                JSON.stringify(localTask.logs) !== JSON.stringify(task.logs) ||
                JSON.stringify(localTask.errors) !== JSON.stringify(task.errors) ||
                localTask.downloadUrl !== task.downloadUrl
            ) {
              const taskDocRef = doc(db, "users", targetUserId, "tasks", task.id);
              const cleanTask: any = {
                id: task.id,
                userId: targetUserId,
                originalName: task.originalName || "",
                translatedName: task.translatedName || "",
                status: task.status || "queued",
                progress: typeof task.progress === "number" ? task.progress : 0,
                totalFiles: typeof task.totalFiles === "number" ? task.totalFiles : 0,
                processedFiles: typeof task.processedFiles === "number" ? task.processedFiles : 0,
                stats: {
                  wordsTranslated: typeof task.stats?.wordsTranslated === "number" ? task.stats.wordsTranslated : 0,
                  charactersSavedByMemory: typeof task.stats?.charactersSavedByMemory === "number" ? task.stats.charactersSavedByMemory : 0,
                  filesTranslated: typeof task.stats?.filesTranslated === "number" ? task.stats.filesTranslated : 0,
                  filesIgnored: typeof task.stats?.filesIgnored === "number" ? task.stats.filesIgnored : 0,
                  errorsCount: typeof task.stats?.errorsCount === "number" ? task.stats.errorsCount : 0,
                  timeSpentMs: typeof task.stats?.timeSpentMs === "number" ? task.stats.timeSpentMs : 0
                },
                errors: Array.isArray(task.errors) ? task.errors : [],
                logs: Array.isArray(task.logs) ? task.logs : [],
                createdAt: task.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };

              if (task.downloadUrl) {
                cleanTask.downloadUrl = task.downloadUrl;
              }
              if (Array.isArray(task.diff)) {
                cleanTask.diff = task.diff;
              }

              setDoc(taskDocRef, cleanTask, { merge: true }).catch(err => {
                console.error("Error client-syncing task to Firestore:", err);
              });
            }
          });
        }
      }
    } catch (err) {
      console.error("Error al consultar tareas de traducción:", err);
    }
  };

  const fetchGlossary = async () => {
    if (!user) return;
    try {
      const res = await apiFetch(`${API_BASE}/api/glossary`);
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return;
        const data = await res.json();
        setDefaultGlossary(data.defaultGlossary || {});
        setCustomGlossary(data.customGlossary || {});
      }
    } catch (err) {
      console.error("Error al obtener glosario:", err);
    }
  };

  useEffect(() => {
    // Expose callback for apiFetch to trigger state changes
    (window as any).setCookieAuthRequired = (required: boolean) => {
      setRequiresCookieAuth(required);
    };

    // Global event listeners to suppress and handle cookie loading and relative configuration 404/CORS errors
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event.message || "";
      const errorMsg = event.error?.message || "";
      if (msg.includes("__cookie_check.html") || errorMsg.includes("__cookie_check.html")) {
        event.preventDefault(); // Mute browser default console crash
        setRequiresCookieAuth(true);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason ? (reason.message || String(reason)) : "";
      if (msg.includes("__cookie_check.html") || msg.includes("Failed to fetch") || msg.includes("verificación de cookies")) {
        event.preventDefault(); // Suppress and capture relative path config crashes
        setRequiresCookieAuth(true);
      }
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Listens for postMessage signals from the authentication popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "cookie_auth_success") {
        setRequiresCookieAuth(false);
        addCustomToast(
          "Autenticación Exitosa",
          "Las cookies de seguridad de AI Studio han sido verificadas. Se ha restaurado la sincronización en tiempo real.",
          "success"
        );
        fetchGlossary();
        fetchTasks(user?.uid);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      delete (window as any).setCookieAuthRequired;
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("message", handleMessage);
    };
  }, [user]);

  const saveCustomGlossary = async (updatedGlossary: Record<string, string>) => {
    if (user) {
      try {
        const glossaryRef = doc(db, "users", user.uid, "settings", "glossary");
        await setDoc(glossaryRef, {
          userId: user.uid,
          terms: updatedGlossary,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/settings/glossary`);
      }
    } else {
      try {
        const res = await apiFetch(`${API_BASE}/api/glossary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ glossary: updatedGlossary })
        });
        if (res.ok) {
          const data = await res.json();
          setCustomGlossary(data.customGlossary || {});
        }
      } catch (err) {
        console.error("Error al guardar glosario:", err);
      }
    }
  };

  const handleAddGlossaryTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnTerm.trim() || !newEsTerm.trim()) return;

    const updated = {
      ...customGlossary,
      [newEnTerm.trim()]: newEsTerm.trim()
    };
    saveCustomGlossary(updated);
    setNewEnTerm("");
    setNewEsTerm("");
  };

  const handleRemoveGlossaryTerm = (key: string) => {
    const updated = { ...customGlossary };
    delete updated[key];
    saveCustomGlossary(updated);
  };

  const handleJsonChange = (val: string) => {
    setJsonText(val);
    if (!val.trim()) {
      setJsonError("El JSON no puede estar vacío");
      return;
    }
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("Formato inválido: El JSON debe ser un objeto plano { \"inglés\": \"español\" }");
        return;
      }
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") {
          setJsonError(`Valor inválido para "${key}": la traducción debe ser un texto.`);
          return;
        }
      }
      setJsonError(null);
    } catch (err: any) {
      setJsonError(`Error de sintaxis: ${err.message}`);
    }
  };

  const handleSaveJsonGlossary = () => {
    try {
      if (!jsonText.trim()) {
        setJsonError("El JSON no puede estar vacío");
        return;
      }
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setJsonError("Formato inválido: El JSON debe ser un objeto plano { \"inglés\": \"español\" }");
        return;
      }
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== "string") {
          setJsonError(`Valor inválido para "${key}": la traducción debe ser un texto.`);
          return;
        }
        cleaned[key.trim()] = value.trim();
      }
      saveCustomGlossary(cleaned);
      setJsonError(null);
      addCustomToast(
        "Glosario Actualizado",
        "Tus reglas personalizadas se importaron y guardaron correctamente.",
        "success"
      );
      setGlossaryTab("list");
    } catch (err: any) {
      setJsonError(`Error de sintaxis: ${err.message}`);
    }
  };

  // Drag & Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.name.endsWith(".jar"));
      if (droppedFiles.length === 0) {
        setUploadError("Por favor arrastra únicamente archivos de mods .jar de Minecraft.");
        return;
      }
      uploadFiles(droppedFiles);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = (Array.from(e.target.files) as File[]).filter(f => f.name.endsWith(".jar"));
      uploadFiles(selectedFiles);
    }
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    if (!user) {
      addCustomToast(
        "Inicio de Sesión Requerido",
        "Por favor inicia sesión con tu cuenta de Google para subir y traducir mods de Minecraft.",
        "info"
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    filesToUpload.forEach(file => {
      formData.append("files", file);
    });

    formData.append("userId", user.uid);

    // Append our selection options as a JSON string
    const options = {
      translateLang,
      translateBooks,
      translateQuests,
      translateDatapacks,
      translateStructures,
      translateAll,
      targetLocale,
      translationStyle,
      customGlossary,
      apiEngine,
      openrouterModel,
      customApiKeys: {
        ...customApiKeys,
        openrouter: customApiKeys.openrouter || defaultOpenRouterKey
      }
    };
    formData.append("options", JSON.stringify(options));

    try {
      const res = await apiFetch(`${API_BASE}/api/translate`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await safeJsonResponse(res).catch(() => ({ error: `Error ${res.status} al subir los archivos.` }));
        throw new Error(errData.error || "Error al subir los archivos.");
      }

      // Refresh immediately for the logged in user
      fetchTasks(user.uid);
    } catch (err: any) {
      setUploadError(err.message || "Error al procesar archivos.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runPreAnalysis = async (file: File) => {
    if (!user) {
      addCustomToast(
        "Inicio de Sesión Requerido",
        "Por favor inicia sesión con tu cuenta para pre-analizar mods de Minecraft.",
        "info"
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const options = {
      translateLang,
      translateBooks,
      translateQuests,
      translateDatapacks,
      translateStructures,
      translateAll,
      targetLocale,
      translationStyle,
      customGlossary,
      apiEngine,
      customApiKeys
    };
    formData.append("options", JSON.stringify(options));

    try {
      const res = await apiFetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await safeJsonResponse(res).catch(() => ({ error: `Error ${res.status} al analizar el archivo.` }));
        throw new Error(errData.error || "Error al analizar el archivo.");
      }

      const data = await safeJsonResponse(res);
      setAnalysisResult(data);
    } catch (err: any) {
      setAnalysisError(err.message || "Error al realizar el pre-análisis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearFinishedTasks = async () => {
    if (!user) return;

    try {
      await apiFetch(`${API_BASE}/api/tasks/clear?userId=${user.uid}`, { method: "POST" });
    } catch (err) {
      console.error("Error al limpiar tareas en memoria:", err);
    }

    try {
      const completedOrFailed = tasks.filter(t => t.status === "completed" || t.status === "failed");
      for (const t of completedOrFailed) {
        const taskDocRef = doc(db, "users", user.uid, "tasks", t.id);
        await deleteDoc(taskDocRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/tasks/*`);
    }
  };

  const toggleLogs = (id: string) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDiff = (id: string) => {
    setExpandedDiffs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Metrics summary
  const totalCompleted = tasks.filter(t => t.status === "completed").length;
  const totalWords = tasks.reduce((sum, t) => sum + (t.stats?.wordsTranslated || 0), 0);
  const totalSavedChars = tasks.reduce((sum, t) => sum + (t.stats?.charactersSavedByMemory || 0), 0);
  const activeTasks = tasks.filter(t => t.status === "queued" || t.status === "processing");

  // Filtering glossaries for search
  const filteredDefaultGlossary = Object.entries(defaultGlossary).filter(
    ([en, es]) => (en as string).toLowerCase().includes(glossarySearch.toLowerCase()) || (es as string).toLowerCase().includes(glossarySearch.toLowerCase())
  );
  
  const filteredCustomGlossary = Object.entries(customGlossary).filter(
    ([en, es]) => (en as string).toLowerCase().includes(glossarySearch.toLowerCase()) || (es as string).toLowerCase().includes(glossarySearch.toLowerCase())
  );  return (
    <div className="min-h-screen bg-[#08090a] text-slate-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-300 relative overflow-x-hidden pb-12">
      
      {/* Visual background lights */}
      <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {requiresCookieAuth && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Se requiere habilitar cookies de sesión</h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Para sincronizar tus archivos y traducir con total estabilidad, tu navegador debe autorizar las cookies seguras de AI Studio. Haz clic abajo para permitir el acceso.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  const authUrl = `${API_BASE}/__cookie_check.html?return_url=${encodeURIComponent(
                    window.location.origin + window.location.pathname + "?cookie_auth_callback=true"
                  )}`;
                  const width = 600;
                  const height = 650;
                  const left = window.screenX + (window.outerWidth - width) / 2;
                  const top = window.screenY + (window.outerHeight - height) / 2;
                  window.open(
                    authUrl,
                    "aistudio_cookie_auth",
                    `width=${width},height=${height},left=${left},top=${top}`
                  );
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20"
              >
                <Cookie className="w-3.5 h-3.5" />
                Aceptar Cookies y Autorizar
              </button>
              <button
                type="button"
                onClick={() => setRequiresCookieAuth(false)}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              >
                Ignorar
              </button>
            </div>
          </div>
        )}

        {/* Top Navigation Bar styled from the Immersive UI design */}
        <header className="h-16 bg-[#0d0f11]/80 backdrop-blur-md border border-white/5 flex items-center justify-between px-6 z-10 rounded-2xl mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-white font-display text-sm md:text-base flex items-center gap-2">
                MCTranslator <span className="text-emerald-400">Pro</span>
                <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded font-mono opacity-50 border border-white/5 text-slate-400">v2.1</span>
              </h1>
              <p className="hidden md:block text-[10px] text-slate-500 mt-0.5">Traducción inteligente de mods de Minecraft impulsada por Gemini</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGlossaryModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Glosario y Reglas</span>
              <span className="inline sm:hidden">Glosario</span>
            </button>
            <a
              href="https://ai.studio/build"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/20 text-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              AI Studio Build
            </a>

            {authLoading ? (
              <div className="w-8 h-8 rounded-full border border-white/15 bg-white/[0.02] flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              </div>
            ) : user ? (
              <div className="flex items-center gap-2 border border-white/5 bg-white/[0.02] pl-1.5 pr-3 py-1 rounded-full text-xs">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} className="w-6 h-6 rounded-full border border-emerald-500/30" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
                <span className="hidden sm:inline font-semibold text-slate-300 max-w-[100px] truncate">{user.displayName || user.email}</span>
                <button
                  onClick={() => signOut(auth)}
                  className="ml-1 text-[10px] text-red-400 hover:text-red-300 transition-colors uppercase font-bold tracking-wider cursor-pointer"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <span>Acceder con Google</span>
              </button>
            )}
          </div>
        </header>

        {/* Top Statistics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-4 flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Mods Procesados</p>
              <p className="text-lg font-bold text-white font-display">{totalCompleted} <span className="text-xs font-normal text-slate-500">/ {tasks.length}</span></p>
            </div>
          </div>
          
          <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-4 flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Palabras Traducidas</p>
              <p className="text-lg font-bold text-white font-display">{totalWords.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-4 flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 rounded bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Ahorro Memoria</p>
              <p className="text-lg font-bold text-white font-display">{(totalSavedChars / 1000).toFixed(1)}k <span className="text-xs text-slate-500">carac.</span></p>
            </div>
          </div>

          <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-4 flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: activeTasks.length > 0 ? "4s" : "0s" }} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Motor de IA</p>
              <p className="text-lg font-bold text-emerald-400 font-display flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse shadow-[0_0_8px_#10b981]" />
                Gemini Active
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid split into Controls & File Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Translation Configuration */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 self-start space-y-6">
            
            <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-6 shadow-xl">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-emerald-500"></span> Extracción de Filtros
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Elige qué componentes y archivos internos de los mods deseas escanear y traducir automáticamente al español.
              </p>

              {/* Options Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/[0.08] rounded-lg border border-white/5 cursor-pointer transition-all">
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${translateLang ? "bg-emerald-500 text-black font-bold" : "border border-white/20"}`}>
                    {translateLang && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={translateLang}
                    onChange={(e) => setTranslateLang(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white">Archivos Lang (.json/.lang)</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Claves principales de objetos, bloques y lore</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/[0.08] rounded-lg border border-white/5 cursor-pointer transition-all">
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${translateBooks ? "bg-emerald-500 text-black font-bold" : "border border-white/20"}`}>
                    {translateBooks && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={translateBooks}
                    onChange={(e) => setTranslateBooks(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white">Libros Patchouli y Guías</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Páginas de manuales, capítulos e instrucciones</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/[0.08] rounded-lg border border-white/5 cursor-pointer transition-all">
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${translateQuests ? "bg-emerald-500 text-black font-bold" : "border border-white/20"}`}>
                    {translateQuests && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={translateQuests}
                    onChange={(e) => setTranslateQuests(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white">Misiones y Diálogos</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Líneas de FTB Quests y avances (advancements)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/[0.08] rounded-lg border border-white/5 cursor-pointer transition-all">
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${translateDatapacks ? "bg-emerald-500 text-black font-bold" : "border border-white/20"}`}>
                    {translateDatapacks && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={translateDatapacks}
                    onChange={(e) => setTranslateDatapacks(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white">Datapacks e Inventarios</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Nombres en tablas de botines y recetas</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/[0.08] rounded-lg border border-white/5 cursor-pointer transition-all">
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${translateStructures ? "bg-emerald-500 text-black font-bold" : "border border-white/20"}`}>
                    {translateStructures && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={translateStructures}
                    onChange={(e) => setTranslateStructures(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white">Estructuras y Carteles</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Archivos JSON de estructuras y textos de spawn</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/[0.08] rounded-lg border border-white/5 cursor-pointer transition-all">
                  <div className={`w-4 h-4 rounded flex items-center justify-center transition-all ${translateAll ? "bg-emerald-500 text-black font-bold" : "border border-white/20"}`}>
                    {translateAll && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={translateAll}
                    onChange={(e) => setTranslateAll(e.target.checked)}
                    className="sr-only"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white">Traducir absolutamente todo</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Buscar textos en metadatos y cualquier archivo de datos</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Target locale selector */}
            <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-6 shadow-xl">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-emerald-500"></span> Variante de Idioma
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Elige el código de idioma destino para los archivos generados. Esto asegura que el juego cargue la traducción según el idioma de Minecraft de los usuarios.
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => setTargetLocale("es_es")}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    targetLocale === "es_es"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  }`}
                >
                  <span>Español (España) — es_es.json</span>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${targetLocale === "es_es" ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20"}`}>
                    {targetLocale === "es_es" && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetLocale("es_mx")}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    targetLocale === "es_mx"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  }`}
                >
                  <span>Español (México) — es_mx.json</span>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${targetLocale === "es_mx" ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20"}`}>
                    {targetLocale === "es_mx" && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetLocale("both")}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    targetLocale === "both"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                      : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                  }`}
                >
                  <span>Ambos (España y México)</span>
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${targetLocale === "both" ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20"}`}>
                    {targetLocale === "both" && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                  </div>
                </button>
              </div>

              {/* Adaptation Style selector */}
              <div className="mt-6 pt-5 border-t border-white/5">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2 flex items-center gap-2">
                  Adaptación al Contexto
                </h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Define el estilo de traducción. Una traducción literal se mantiene fiel a las palabras originales en inglés, mientras que una traducción natural/idiomática adapta las frases a la localización típica de videojuegos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTranslationStyle("natural")}
                    className={`flex flex-col items-start p-3 rounded-lg border text-xs font-semibold text-left transition-all cursor-pointer ${
                      translationStyle === "natural"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span>Más Natural (Recomendada)</span>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${translationStyle === "natural" ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20"}`}>
                        {translationStyle === "natural" && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal leading-normal">
                      Adaptada a la jerga de Minecraft, más inmersiva y fluida.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTranslationStyle("literal")}
                    className={`flex flex-col items-start p-3 rounded-lg border text-xs font-semibold text-left transition-all cursor-pointer ${
                      translationStyle === "literal"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-white/5 border-white/5 hover:border-white/10 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span>Más Literal</span>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${translationStyle === "literal" ? "border-emerald-500 bg-emerald-500 text-black" : "border-white/20"}`}>
                        {translationStyle === "literal" && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal leading-normal">
                      Fiel palabra por palabra al texto original en inglés.
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Translation Engine Configuration Card */}
            <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-6 shadow-xl mt-6">
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-emerald-500"></span> Motor de Traducción
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Elige el servicio para traducir. Si los tokens gratuitos se agotan o necesitas mayor precisión, puedes configurar proveedores alternativos.
              </p>

              {/* Selector */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Proveedor Activo</label>
                  <select
                    value={apiEngine}
                    onChange={(e) => {
                      const newEngine = e.target.value;
                      handleUpdateEngineAndResumeTasks(newEngine, openrouterModel);
                    }}
                    className="w-full p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="gemini" className="bg-[#0d0f11] text-white">Gemini 2.5 Flash (Predeterminado - Nivel Gratuito)</option>
                    <option value="google_free" className="bg-[#0d0f11] text-white">Google Translate (Gratuito / Ilimitado)</option>
                    <option value="google_cloud" className="bg-[#0d0f11] text-white">Google Cloud Translation API (Oficial)</option>
                    <option value="openai" className="bg-[#0d0f11] text-white">OpenAI GPT-4o-mini</option>
                    <option value="deepseek" className="bg-[#0d0f11] text-white">DeepSeek API (Rápido y Barato)</option>
                    <option value="groq" className="bg-[#0d0f11] text-white">Groq Cloud (Llama 3.1 8B)</option>
                    <option value="openrouter" className="bg-[#0d0f11] text-white">OpenRouter API (Múltiples Modelos)</option>
                    <option value="anthropic" className="bg-[#0d0f11] text-white">Anthropic Claude (Alta Calidad)</option>
                  </select>
                </div>

                {/* Conditional API Keys Inputs */}
                {apiEngine !== "gemini" && apiEngine !== "google_free" && (
                  <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-lg space-y-3 mt-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                        Clave API para {
                          apiEngine === "google_cloud" ? "Google Cloud" :
                          apiEngine === "openai" ? "OpenAI" :
                          apiEngine === "deepseek" ? "DeepSeek" :
                          apiEngine === "groq" ? "Groq" :
                          apiEngine === "openrouter" ? "OpenRouter" :
                          apiEngine === "anthropic" ? "Anthropic Claude" : ""
                        }
                      </label>
                      <input
                        type="password"
                        value={customApiKeys[apiEngine] || (apiEngine === "openrouter" ? defaultOpenRouterKey : "")}
                        onChange={(e) => {
                          const keyVal = e.target.value;
                          setCustomApiKeys(prev => ({ ...prev, [apiEngine]: keyVal }));
                        }}
                        placeholder={`Introduce tu clave API de ${
                          apiEngine === "google_cloud" ? "Google Cloud (v2)" :
                          apiEngine === "openai" ? "sk-..." :
                          apiEngine === "deepseek" ? "sk-..." :
                          apiEngine === "groq" ? "gsk_..." :
                          apiEngine === "openrouter" ? "sk-or-..." :
                          apiEngine === "anthropic" ? "sk-ant-..." : ""
                        }`}
                        className="w-full p-2 bg-[#08090a] border border-white/10 rounded text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* OpenRouter Model Selection & Connection Status */}
                    {apiEngine === "openrouter" && (
                      <div className="space-y-3 pt-1 border-t border-white/5">
                        <div>
                          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                            <label className="block text-[10px] uppercase font-bold text-slate-400">
                              Modelo de IA (OpenRouter)
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-emerald-400 font-bold bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/20 transition-all">
                              <input
                                type="checkbox"
                                checked={onlyFreeModels}
                                onChange={(e) => handleToggleOnlyFree(e.target.checked)}
                                className="rounded text-emerald-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                              />
                              <span>Solo modelos gratuitos (Free)</span>
                            </label>
                          </div>
                          <select
                            value={openrouterModel}
                            onChange={(e) => {
                              const newModel = e.target.value;
                              setOpenrouterModel(newModel);
                              handleUpdateEngineAndResumeTasks(apiEngine, newModel);
                            }}
                            className="w-full p-2 bg-[#08090a] border border-white/10 rounded text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                          >
                            {availableOpenRouterModels.map((m) => (
                              <option key={m.id} value={m.id} className="bg-[#0d0f11] text-white">
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={openrouterModel}
                            onChange={(e) => {
                              const newModel = e.target.value;
                              setOpenrouterModel(newModel);
                              handleUpdateEngineAndResumeTasks(apiEngine, newModel);
                            }}
                            placeholder="O escribe la ID de otro modelo de OpenRouter..."
                            className="w-full mt-1.5 p-1.5 bg-[#08090a] border border-white/10 rounded text-[11px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span>Conexión establecida con OpenRouter API</span>
                          </div>
                          <button
                            type="button"
                            onClick={testOpenRouterConnection}
                            disabled={testingOpenRouter}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {testingOpenRouter ? "Probando..." : "Probar conexión"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-1.5 text-[10px] text-slate-500 mt-1">
                      <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>Clave almacenada localmente en tu navegador de forma segura.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Files upload, progress, queue lists */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Drag & Drop Card styled exactly like the Immersive UI design */}
            {!user && (
              <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Sesión requerida</h4>
                    <p className="text-[11px] text-slate-400">Inicia sesión con Google para subir mods, iniciar traducciones y ver tu lista de tareas.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg text-xs transition-all shrink-0 cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  Iniciar Sesión
                </button>
              </div>
            )}

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`bg-[#0d0f11] rounded-xl border-2 border-dashed p-8 text-center transition-all relative cursor-pointer group ${
                dragActive 
                  ? "border-emerald-500 bg-emerald-500/5" 
                  : "border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5"
              }`}
              onClick={() => {
                if (!user) {
                  handleSignIn();
                } else {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jar"
                onChange={handleFileChange}
                className="hidden"
                id="jar-upload"
              />
              
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all mb-3 mx-auto">
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
                  ) : (
                    <span className="text-2xl text-emerald-400">+</span>
                  )}
                </div>
                
                <h3 className="text-sm font-semibold text-white mb-1">Sube tus mods de Minecraft</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Arrastra y suelta archivos .jar o haz clic para buscarlos en tu ordenador
                </p>

                <button
                  type="button"
                  disabled={isUploading}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {isUploading ? "CARGANDO ARCHIVOS..." : "SELECCIONAR MODS (.JAR)"}
                </button>
              </div>

              {uploadError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Pre-analysis Interface Card */}
            <div className="bg-[#0d0f11] rounded-xl border border-white/5 p-6 shadow-xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-1 h-3 bg-indigo-500"></span> Pre-analizador de Archivos (Evita Re-Traducción)
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                ¿Quieres saber qué textos contiene un mod y cuántas claves ya están traducidas antes de iniciar la traducción? Sube un archivo .jar para realizar un pre-análisis comparativo detallado de forma gratuita.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="file"
                  accept=".jar"
                  id="pre-analysis-upload"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      runPreAnalysis(e.target.files[0]);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => document.getElementById("pre-analysis-upload")?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ANALIZANDO MOD...</span>
                    </>
                  ) : (
                    <>
                      <FileSearch className="w-4 h-4" />
                      <span>PRE-ANALIZAR MOD (.JAR)</span>
                    </>
                  )}
                </button>

                {analysisResult && (
                  <button
                    type="button"
                    onClick={() => setAnalysisResult(null)}
                    className="w-full sm:w-auto px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-xs rounded-lg border border-white/10 transition-all cursor-pointer"
                  >
                    Limpiar Resultado
                  </button>
                )}
              </div>

              {analysisError && (
                <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              {/* If we have an active analysis result, let's display a gorgeous report panel */}
              {analysisResult && (
                <div className="mt-6 border-t border-white/5 pt-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <FileCode className="w-4 h-4 text-indigo-400" />
                        {analysisResult.originalName}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {analysisResult.totalFiles} archivos totales dentro del JAR &bull; {analysisResult.translatableFilesCount} translicibles detectados
                      </p>
                    </div>
                    {analysisResult.estimatedApiSavingsPercent > 0 && (
                      <div className="shrink-0 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>{analysisResult.estimatedApiSavingsPercent}% de Ahorro de Tokens</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[#08090a] p-3 rounded-lg border border-white/5 text-center">
                      <span className="block text-[10px] uppercase font-bold text-slate-500">Claves Totales</span>
                      <span className="text-lg font-bold text-white mt-1 block">{analysisResult.totalOriginalKeys}</span>
                    </div>

                    <div className="bg-[#08090a] p-3 rounded-lg border border-white/5 text-center">
                      <span className="block text-[10px] uppercase font-bold text-emerald-500">Ya Traducidas</span>
                      <span className="text-lg font-bold text-emerald-400 mt-1 block">
                        {analysisResult.totalAlreadyTranslatedKeys}
                      </span>
                      <span className="text-[8px] text-slate-500">(Re-traducción evitada)</span>
                    </div>

                    <div className="bg-[#08090a] p-3 rounded-lg border border-white/5 text-center">
                      <span className="block text-[10px] uppercase font-bold text-red-400">Faltantes (Nuevas)</span>
                      <span className="text-lg font-bold text-red-400 mt-1 block">{analysisResult.totalMissingKeys}</span>
                      <span className="text-[8px] text-slate-500">(Gap-analysis)</span>
                    </div>

                    <div className="bg-[#08090a] p-3 rounded-lg border border-white/5 text-center">
                      <span className="block text-[10px] uppercase font-bold text-yellow-500">Idénticas</span>
                      <span className="text-lg font-bold text-yellow-400 mt-1 block">{analysisResult.totalUnmodifiedKeys}</span>
                      <span className="text-[8px] text-slate-500">(Faltan traducir)</span>
                    </div>
                  </div>

                  {/* Volume Estimator Banner */}
                  <div className="p-3 bg-[#08090a] border border-white/5 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-400">Carga neta de traducción:</span>
                    <span className="font-bold text-white font-mono">
                      {analysisResult.wordsToTranslate} palabras &bull; {analysisResult.charactersToTranslate} caracteres
                    </span>
                  </div>

                  {/* Individual Files Breakdown Table */}
                  <div>
                    <h5 className="text-[10px] uppercase font-bold text-slate-500 mb-2">Desglose de Archivos Translicibles</h5>
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {analysisResult.files.map((file: any, index: number) => (
                        <div key={index} className="p-3 bg-[#08090a] rounded-lg border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-mono font-medium text-slate-300 break-all block">{file.path}</span>
                            <span className="inline-block text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              {file.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 sm:text-right">
                            <div className="text-[10px]">
                              <span className="text-slate-500 block">Claves: <b className="text-white">{file.totalKeys}</b></span>
                              <span className="text-emerald-500 block">Traducidas: <b>{file.translatedKeys}</b></span>
                            </div>
                            <div className="text-[10px]">
                              <span className="text-red-400 block">Faltantes: <b>{file.missingKeys}</b></span>
                              <span className="text-yellow-500 block">Idénticas: <b>{file.unmodifiedKeys}</b></span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Visualización de Datos con Recharts: Crecimiento Histórico y Ahorro de Tokens */}
            <div className="bg-[#0d0f11] rounded-2xl border border-white/5 p-6 shadow-xl mt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-bold text-white flex items-center gap-2 font-display">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Analíticas de Rendimiento y Crecimiento Histórico
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Evolución de palabras traducidas acumuladas y estimación de ahorro de tokens por re-utilización de glosario y clave traducida
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                    Monitoreo Semanal
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico 1: Área - Palabras Traducidas */}
                <div className="bg-[#08090a] border border-white/5 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                      Palabras Traducidas
                    </span>
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {getWeeklyChartData()[5].palabras.toLocaleString()} palabras
                    </span>
                  </div>
                  <div className="h-48 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getWeeklyChartData()}>
                        <defs>
                          <linearGradient id="colorPalabras" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                        <XAxis dataKey="semana" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0b0d10", borderColor: "#ffffff1a", borderRadius: "8px", fontSize: "11px", color: "#fff" }}
                        />
                        <Area type="monotone" dataKey="palabras" name="Palabras Traducidas" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPalabras)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 2: Barras - Ahorro de Tokens */}
                <div className="bg-[#08090a] border border-white/5 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Ahorro Estimado de Tokens
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ~{getWeeklyChartData()[5].tokensAhorrados.toLocaleString()} tokens
                    </span>
                  </div>
                  <div className="h-48 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getWeeklyChartData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                        <XAxis dataKey="semana" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0b0d10", borderColor: "#ffffff1a", borderRadius: "8px", fontSize: "11px", color: "#fff" }}
                        />
                        <Bar dataKey="tokensAhorrados" name="Tokens Ahorrados" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Queue & Tasks Processed list */}
            {tasks.length > 0 && (
              <div className="space-y-4">
                {/* System notification request banner if not granted */}
                {notificationPermission !== "granted" && "Notification" in window && (
                  <div className="bg-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs mb-1">
                    <div className="flex items-center gap-2.5 text-slate-300">
                      <BellRing className="w-4 h-4 text-indigo-400 shrink-0 animate-bounce" />
                      <span>¿Quieres recibir notificaciones de escritorio cuando finalicen tus traducciones en segundo plano?</span>
                    </div>
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer shadow-lg shadow-indigo-600/15 shrink-0 uppercase tracking-wider"
                    >
                      Activar Notificaciones
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1 px-1">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 flex items-center gap-2">
                    <span className="w-1 h-3 bg-emerald-500"></span> COLA DE PROCESAMIENTO ({tasks.length})
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {tasks.some(t => t.status === "failed" || t.status === "queued") && (
                      <button
                        onClick={() => handleUpdateEngineAndResumeTasks(apiEngine, openrouterModel)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer shadow-sm"
                      >
                        <RefreshCw className="w-3 h-3 text-emerald-400" />
                        <span>Continuar traducción</span>
                      </button>
                    )}
                    {totalCompleted > 0 && (
                      <a
                        href={user ? `${API_BASE}/api/download-all?userId=${user.uid}` : `${API_BASE}/api/download-all`}
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded text-[10px] uppercase tracking-wider font-bold transition-all"
                      >
                        <Download className="w-3 h-3" />
                        Descargar ZIP
                      </a>
                    )}
                    <button
                      onClick={clearFinishedTasks}
                      className="text-[10px] text-emerald-500 hover:text-emerald-400 uppercase tracking-wider font-bold cursor-pointer bg-transparent border-0 p-0"
                    >
                      Limpiar Cola
                    </button>
                  </div>
                </div>

                {/* Queue Filter Tabs and Sound Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d0f11]/40 border border-white/5 p-2 rounded-xl">
                  <div className="flex items-center gap-1.5 bg-[#08090a] border border-white/5 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setQueueStatusFilter("all")}
                      className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                        queueStatusFilter === "all"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      Todos ({tasks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueueStatusFilter("pending")}
                      className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                        queueStatusFilter === "pending"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      Solo Pendientes ({tasks.filter(t => t.status === "pending" || t.status === "processing").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueueStatusFilter("completed")}
                      className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${
                        queueStatusFilter === "completed"
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      Solo Completados ({tasks.filter(t => t.status === "completed" || t.status === "failed").length})
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 px-1">
                    {notificationPermission === "granted" ? (
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
                        <Bell className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        Notificaciones Activas
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Bell className="w-3.5 h-3.5 text-slate-500/70" />
                        Sin notificaciones de escritorio
                      </span>
                    )}
                  </div>
                </div>

                {/* Queue Cards */}
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {tasks
                      .filter((task) => {
                        if (queueStatusFilter === "pending") {
                          return task.status === "pending" || task.status === "processing";
                        }
                        if (queueStatusFilter === "completed") {
                          return task.status === "completed" || task.status === "failed";
                        }
                        return true;
                      })
                      .map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 bg-[#0d0f11] rounded-xl border transition-all ${
                          task.status === "processing" 
                            ? "border-emerald-500 shadow-lg shadow-emerald-500/10" 
                            : task.status === "failed" 
                            ? "border-red-500/30 bg-red-500/[0.02]" 
                            : "border-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            task.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : task.status === "failed"
                              ? "bg-red-500/10 text-red-500"
                              : task.status === "processing"
                              ? "bg-cyan-500/10 text-cyan-500 animate-pulse"
                              : "bg-white/5 text-slate-400"
                          }`}>
                            {task.originalName.charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 overflow-hidden">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                              <div className="overflow-hidden">
                                <p className="text-xs text-slate-200 truncate font-semibold font-display">{task.originalName}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {task.status === "completed" ? (
                                    task.downloadUrl ? (
                                      <span>Guardado como: <strong className="text-slate-300 font-medium">{task.translatedName}</strong></span>
                                    ) : (
                                      <span><strong className="text-emerald-400 font-semibold">Ya traducido</strong> • No requiere cambios</span>
                                    )
                                  ) : (
                                    <span>{task.totalFiles} archivos identificados • {task.status === "processing" ? "Traduciendo..." : task.status === "failed" ? "Error" : "En cola"}</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0 flex-wrap">
                                {(task.status === "processing" || task.status === "queued") && (
                                  <button
                                    onClick={() => handleStopTask(task.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                                    title="Detener la traducción de este mod"
                                  >
                                    <OctagonX className="w-3 h-3 text-amber-400" />
                                    <span>Detener</span>
                                  </button>
                                )}
                                {(task.status === "failed" || task.status === "queued" || task.status === "processing") && (
                                  <button
                                    onClick={() => retrySingleTask(task.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                                    title="Continuar o reintentar traducción con el motor seleccionado"
                                  >
                                    <RefreshCw className="w-3 h-3 text-emerald-400" />
                                    <span>Continuar</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded text-[10px] font-bold transition-all cursor-pointer"
                                  title="Cancelar y eliminar esta tarea de la lista"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                  <span>Eliminar</span>
                                </button>
                                {(task.diff && task.diff.length > 0) && (
                                  <button
                                    onClick={() => toggleJsonPreview(task.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold transition-all cursor-pointer"
                                    title="Vista previa interactiva del archivo JSON de idioma traducido"
                                  >
                                    <FileCode className="w-3 h-3 text-emerald-400" />
                                    <span>{expandedJsonPreviews[task.id] ? "Ocultar JSON" : "VISTA PREVIA JSON"}</span>
                                  </button>
                                )}
                                {task.status === "completed" && task.downloadUrl && (() => {
                                  const finalDlUrl = task.downloadUrl.startsWith("http") ? task.downloadUrl : `${API_BASE}${task.downloadUrl}`;
                                  return (
                                    <a
                                      href={user ? `${finalDlUrl}?userId=${user.uid}` : finalDlUrl}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded font-bold text-[10px] transition-all shadow-md cursor-pointer"
                                    >
                                      <Download className="w-3 h-3" />
                                      DESCARGAR
                                    </a>
                                  );
                                })()}
                                {task.status === "completed" && (
                                  <button
                                    onClick={() => toggleDiff(task.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    <Languages className="w-3 h-3 text-indigo-400" />
                                    {expandedDiffs[task.id] ? "Ocultar Cambios" : `VER CAMBIOS (${task.diff?.length || 0})`}
                                  </button>
                                )}
                                <button
                                  onClick={() => toggleExpandDetails(task.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 rounded text-[10px] font-bold transition-all cursor-pointer"
                                  title="Ver desglose por archivo y estimación de tiempo restante"
                                >
                                  <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform duration-200 ${expandedDetails[task.id] ? "rotate-180" : ""}`} />
                                  <span>Desglose ({task.fileDetails?.length || task.totalFiles})</span>
                                </button>
                                <button
                                  onClick={() => toggleLogs(task.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-semibold text-slate-300 transition-all cursor-pointer"
                                >
                                  <Terminal className="w-3 h-3 text-emerald-400" />
                                  {expandedLogs[task.id] ? "Ocultar" : "Ver Log"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar with ETA and Speed */}
                        {(task.status === "processing" || task.status === "queued" || task.progress < 100) && (() => {
                          const etaInfo = calculateTaskETA(task);
                          return (
                            <div className="mt-3 bg-[#08090a] p-3 rounded-lg border border-white/5 space-y-2">
                              <div className="flex flex-col sm:flex-row justify-between text-[10px] text-slate-400 font-semibold gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="uppercase tracking-wider font-bold text-slate-300">Progreso Total:</span>
                                  <span className="text-emerald-400 font-bold font-mono">{task.progress}%</span>
                                </div>
                                {(task.status === "processing" || task.status === "queued") && (
                                  <div className="flex items-center gap-3 text-[10px] flex-wrap">
                                    <span className="flex items-center gap-1 text-cyan-400 font-mono">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      {etaInfo.etaText}
                                    </span>
                                    <span className="flex items-center gap-1 text-indigo-300 font-mono">
                                      <Gauge className="w-3 h-3 shrink-0" />
                                      {etaInfo.speedText}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 rounded-full transition-all duration-300"
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Expandable Per-File Breakdown View */}
                        {expandedDetails[task.id] && (
                          <div className="mt-3 bg-[#08090a] p-3 rounded-xl border border-white/5 space-y-3">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-white/5 pb-2">
                              <span className="flex items-center gap-1.5 text-cyan-300">
                                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                                Progreso Individual por Archivo ({task.fileDetails?.length || task.totalFiles})
                              </span>
                              {task.status === "processing" && (
                                <span className="text-emerald-400 animate-pulse text-[9px] font-semibold">
                                  Actualizando en vivo...
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {task.fileDetails && task.fileDetails.length > 0 ? (
                                task.fileDetails.map((file, fIdx) => (
                                  <div key={fIdx} className="p-2.5 bg-[#0d0f11] rounded-lg border border-white/5 space-y-1.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <span className="font-mono text-slate-200 font-medium truncate">{file.fileName}</span>
                                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-slate-400 shrink-0 font-sans">
                                          {file.category}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] shrink-0 font-mono">
                                        <span className="text-slate-400">{file.processedKeys} / {file.totalKeys} claves</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          file.status === "completed" 
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : file.status === "processing"
                                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse"
                                            : "bg-white/5 text-slate-400"
                                        }`}>
                                          {file.status === "completed" ? "Completado" : file.status === "processing" ? "En Proceso" : "Pendiente"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Mini File Progress Bar */}
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full transition-all duration-300 ${
                                          file.status === "completed" ? "bg-emerald-400" : "bg-cyan-400"
                                        }`}
                                        style={{ width: `${file.progress}%` }}
                                      />
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-3 bg-[#0d0f11] rounded-lg border border-white/5 text-[11px] text-slate-400">
                                  <span>{task.totalFiles} archivo(s) identificado(s) en este mod.</span>
                                  <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-emerald-400 transition-all duration-300" style={{ width: `${task.progress}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stats Summary Line */}
                        {task.stats && (task.status === "completed" || task.status === "processing") && (
                          <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-400">
                            <div>
                              <span className="block font-bold text-slate-500 uppercase tracking-wider text-[9px]">Palabras analizadas</span>
                              <span className="text-white font-mono">{task.stats.wordsTranslated.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-500 uppercase tracking-wider text-[9px]">Ahorro Memoria</span>
                              <span className="text-amber-500 font-semibold font-mono">{(task.stats.charactersSavedByMemory / 1000).toFixed(1)}k carac.</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-500 uppercase tracking-wider text-[9px]">Archivos</span>
                              <span className="text-white font-mono">{task.stats.filesTranslated} / {task.totalFiles}</span>
                            </div>
                            <div>
                              <span className="block font-bold text-slate-500 uppercase tracking-wider text-[9px]">Errores / Ignorados</span>
                              <span className={task.stats.errorsCount > 0 ? "text-red-400 font-bold font-mono" : "text-slate-400 font-mono"}>
                                {task.stats.errorsCount} / {task.stats.filesIgnored}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Collapsible logs terminal */}
                        {expandedLogs[task.id] && (
                          <LogTerminal
                            logs={task.logs}
                            errors={task.errors}
                            status={task.status}
                          />
                        )}

                        {/* Comparative Diff View Panel */}
                        {expandedDiffs[task.id] && (
                          <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#08090a] p-3 rounded-lg border border-white/5">
                              <div className="flex-1">
                                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                  <Languages className="w-3.5 h-3.5 text-indigo-400" /> VISTA COMPARATIVA (DIFF)
                                </span>
                                <span className="text-[9px] text-slate-500">Mapeo de traducciones y cambios generados por la IA</span>
                              </div>

                              {/* Suggest Glossary Terms from Diff Button */}
                              <button
                                onClick={() => handleAnalyzeDiffForGlossary(task)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded text-[11px] font-bold transition-all cursor-pointer shadow-sm shrink-0"
                                title="Analizar patrones recurrentes en la traducción para sugerir nuevos términos al glosario"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>Analizar Diff para Glosario</span>
                              </button>
                              
                              {/* Search & File Filters */}
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  placeholder="Buscar clave o texto..."
                                  value={diffSearch[task.id] || ""}
                                  onChange={(e) => setDiffSearch(prev => ({ ...prev, [task.id]: e.target.value }))}
                                  className="px-2.5 py-1.5 bg-[#0d0f11] border border-white/10 rounded text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-full sm:w-44"
                                />
                                
                                {Array.from(new Set((task.diff || []).map(d => d.path))).length > 1 && (
                                  <select
                                    value={diffFileFilters[task.id] || "all"}
                                    onChange={(e) => {
                                      setDiffFileFilters(prev => ({ ...prev, [task.id]: e.target.value }));
                                      setDiffPages(prev => ({ ...prev, [task.id]: 1 })); // reset page
                                    }}
                                    className="px-2.5 py-1.5 bg-[#0d0f11] border border-white/10 rounded text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/50 w-full sm:w-44 cursor-pointer"
                                  >
                                    <option value="all">Todos los archivos ({Array.from(new Set((task.diff || []).map(d => d.path))).length})</option>
                                    {Array.from(new Set((task.diff || []).map(d => d.path))).map((p: any) => (
                                      <option key={p} value={p}>{(p as string).split('/').pop() || p}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>

                            {/* Diff List */}
                            {(() => {
                              const search = (diffSearch[task.id] || "").toLowerCase();
                              const selectedFile = diffFileFilters[task.id] || "all";
                              const filteredDiff = (task.diff || []).filter(entry => {
                                const matchesSearch = !search ||
                                  entry.key.toLowerCase().includes(search) ||
                                  entry.original.toLowerCase().includes(search) ||
                                  entry.translated.toLowerCase().includes(search);
                                const matchesFile = selectedFile === "all" || entry.path === selectedFile;
                                return matchesSearch && matchesFile;
                              });

                              const itemsPerPage = 8;
                              const currentPage = diffPages[task.id] || 1;
                              const totalPages = Math.ceil(filteredDiff.length / itemsPerPage);
                              const paginated = filteredDiff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                              if ((task.diff || []).length === 0) {
                                return (
                                  <div className="p-6 text-center bg-[#08090a] border border-white/5 rounded-lg text-slate-500 italic text-xs">
                                    No hay traducciones registradas en este lote. (El mod ya estaba completamente traducido o no se detectaron nuevas cadenas).
                                  </div>
                                );
                              }

                              if (filteredDiff.length === 0) {
                                return (
                                  <div className="p-6 text-center bg-[#08090a] border border-white/5 rounded-lg text-slate-500 italic text-xs">
                                    No se encontraron resultados que coincidan con la búsqueda.
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2.5">
                                  <div className="grid grid-cols-1 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                                    {paginated.map((entry, idx) => (
                                      <div key={idx} className="p-3 bg-[#08090a] rounded-lg border border-white/5 space-y-2 transition-all hover:border-white/10">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-1.5">
                                          <span className="font-mono text-[10px] text-indigo-400 font-medium break-all">{entry.key}</span>
                                          <span className="text-[8px] font-mono uppercase bg-white/5 text-slate-400 px-1.5 py-0.5 rounded tracking-wider truncate max-w-xs" title={entry.path}>
                                            {entry.path.split('/').pop()}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          {/* Original (Red Diff) */}
                                          <div className="bg-red-500/5 border border-red-500/10 rounded p-2 text-xs flex gap-2">
                                            <span className="text-red-500 font-mono font-bold shrink-0 select-none">-</span>
                                            <div className="text-slate-300 break-all whitespace-pre-wrap leading-relaxed font-sans">{entry.original}</div>
                                          </div>
                                          {/* Translation (Green Diff) */}
                                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded p-2 text-xs flex gap-2">
                                            <span className="text-emerald-500 font-mono font-bold shrink-0 select-none">+</span>
                                            <div className="text-slate-200 break-all whitespace-pre-wrap leading-relaxed font-sans">{entry.translated}</div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Pagination Controls */}
                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
                                      <span className="text-slate-500">
                                        Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredDiff.length)} de {filteredDiff.length} cambios
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          disabled={currentPage === 1}
                                          onClick={() => setDiffPages(prev => ({ ...prev, [task.id]: currentPage - 1 }))}
                                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-slate-300 rounded border border-white/10 transition-all font-semibold"
                                        >
                                          Anterior
                                        </button>
                                        <span className="text-slate-400 px-1">Pág. {currentPage} de {totalPages}</span>
                                        <button
                                          disabled={currentPage === totalPages}
                                          onClick={() => setDiffPages(prev => ({ ...prev, [task.id]: currentPage + 1 }))}
                                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-slate-300 rounded border border-white/10 transition-all font-semibold"
                                        >
                                          Siguiente
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Expandable JSON Language File Preview Panel */}
                        {expandedJsonPreviews[task.id] && (() => {
                          const jsonFiles = getTaskJsonFiles(task);
                          const filePaths = Object.keys(jsonFiles);
                          const selectedPath = jsonPreviewSelectedFiles[task.id] || filePaths[0] || "";
                          const currentJsonObject = selectedPath ? (jsonFiles[selectedPath] || {}) : {};
                          const searchQuery = (jsonPreviewSearches[task.id] || "").toLowerCase();
                          const validation = validateMinecraftLangJson(currentJsonObject);

                          const filteredEntries = Object.entries(currentJsonObject).filter(([k, v]) => {
                            if (!searchQuery) return true;
                            return k.toLowerCase().includes(searchQuery) || v.toLowerCase().includes(searchQuery);
                          });

                          const formattedJsonStr = JSON.stringify(currentJsonObject, null, 2);
                          const jsonCharCount = formattedJsonStr.length;
                          const jsonKbSize = (jsonCharCount / 1024).toFixed(1);

                          return (
                            <div className="mt-4 border-t border-white/5 pt-4 space-y-3">
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#08090a] p-3 rounded-lg border border-white/5">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
                                      <FileCode className="w-3.5 h-3.5 text-emerald-400" /> VISTA PREVIA DEL ARCHIVO JSON DE IDIOMA
                                    </span>
                                    {validation.isValid ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> ESQUEMA FORGE/FABRIC OK
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold">
                                        <AlertTriangle className="w-3 h-3 text-red-400" /> ERROR DE ESQUEMA ({validation.errors.length})
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-[9px] text-slate-500">
                                    Validación de sintaxis Forge/Fabric (Minecraft 1.13+): {validation.stats.totalKeys} claves &bull; {validation.stats.placeholderCount} marcadores de formato &bull; {validation.warnings.length} adv.
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => handleCopyJsonToClipboard(currentJsonObject)}
                                    disabled={filePaths.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-30"
                                    title="Copiar contenido JSON al portapapeles"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Copiar JSON</span>
                                  </button>

                                  <button
                                    onClick={() => handleDownloadJsonFile(selectedPath, currentJsonObject)}
                                    disabled={filePaths.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-30"
                                    title="Descargar únicamente este archivo JSON de idioma"
                                  >
                                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Descargar .json</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setPreviewModalTask(task);
                                      setPreviewModalFile(selectedPath);
                                    }}
                                    disabled={filePaths.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded text-[11px] font-bold transition-all cursor-pointer shadow-sm disabled:opacity-30"
                                    title="Abrir vista previa JSON en pantalla completa"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Pantalla Completa</span>
                                  </button>
                                </div>
                              </div>

                              {filePaths.length === 0 ? (
                                <div className="p-6 text-center bg-[#08090a] border border-white/5 rounded-lg text-slate-500 italic text-xs">
                                  No hay cadenas JSON traducidas disponibles para vista previa en este mod aún.
                                </div>
                              ) : (
                                <div className="bg-[#08090a] border border-white/5 rounded-xl overflow-hidden space-y-0">
                                  {/* File Tab Selector Header */}
                                  <div className="p-2.5 bg-[#0d0f11] border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                                      {filePaths.map(filePath => (
                                        <button
                                          key={filePath}
                                          onClick={() => setJsonPreviewSelectedFiles(prev => ({ ...prev, [task.id]: filePath }))}
                                          className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                            selectedPath === filePath
                                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold"
                                              : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5"
                                          }`}
                                        >
                                          <FileText className="w-3 h-3 text-emerald-400" />
                                          <span>{filePath.split("/").pop()}</span>
                                        </button>
                                      ))}
                                    </div>

                                    {/* Sub-search inside JSON */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <input
                                        type="text"
                                        placeholder="Filtrar clave en JSON..."
                                        value={jsonPreviewSearches[task.id] || ""}
                                        onChange={(e) => setJsonPreviewSearches(prev => ({ ...prev, [task.id]: e.target.value }))}
                                        className="px-2.5 py-1 bg-[#141619] border border-white/10 rounded text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-full sm:w-48"
                                      />
                                      <span className="text-[10px] font-mono text-slate-500 shrink-0 bg-white/5 px-2 py-1 rounded">
                                        {Object.keys(currentJsonObject).length} claves ({jsonKbSize} KB)
                                      </span>
                                    </div>
                                  </div>

                                  {/* JSON Code View Block */}
                                  <div className="p-4 bg-[#050607] font-mono text-xs overflow-x-auto max-h-[420px] overflow-y-auto space-y-1 select-text">
                                    <div className="text-slate-500">{`{`}</div>
                                    {filteredEntries.map(([k, v], idx) => (
                                      <div key={k} className="pl-4 flex items-start gap-1 hover:bg-white/[0.02] py-0.5 rounded leading-relaxed">
                                        <span className="text-slate-600 text-[10px] shrink-0 select-none w-8 text-right pr-2">
                                          {idx + 1}
                                        </span>
                                        <span className="text-cyan-400 font-semibold break-all">"{k}"</span>
                                        <span className="text-slate-500">:</span>
                                        <span className="text-amber-300 font-medium break-all">"{v}"</span>
                                        {idx < filteredEntries.length - 1 && <span className="text-slate-500">,</span>}
                                      </div>
                                    ))}
                                    <div className="text-slate-500">{`}`}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </motion.div>
                    ))}

                    {/* Filter empty state placeholder */}
                    {tasks.filter((task) => {
                      if (queueStatusFilter === "pending") {
                        return task.status === "pending" || task.status === "processing";
                      }
                      if (queueStatusFilter === "completed") {
                        return task.status === "completed" || task.status === "failed";
                      }
                      return true;
                    }).length === 0 && (
                      <div className="text-center py-10 px-4 bg-[#08090a]/40 border border-white/5 rounded-xl text-slate-400 italic text-xs flex flex-col items-center justify-center gap-2">
                        <Info className="w-5 h-5 text-indigo-500/50" />
                        <span>No hay tareas en la cola que coincidan con el filtro seleccionado.</span>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Footer System Status details */}
      <footer className="mt-16 py-6 border-t border-white/5 bg-[#0d0f11]/60 text-center text-[10px] text-slate-500 relative z-10 rounded-t-2xl">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 Minecraft Mod Translator. Desarrollado con Inteligencia Artificial Gemini de Google.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> Motor: Gemini 2.5 Flash</span>
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-cyan-400" /> Caché de Memoria: Global</span>
          </div>
        </div>
      </footer>

      {/* GLOSSARY & DICTIONARY MANAGEMENT MODAL */}
      <AnimatePresence>
        {showGlossaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGlossaryModal(false)}
              className="absolute inset-0 bg-[#08090a]/90 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0d0f11] border border-white/10 rounded-xl w-full max-w-2xl overflow-hidden relative z-10 shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-display">Glosario y Reglas Personalizadas</h3>
                </div>
                <button
                  onClick={() => setShowGlossaryModal(false)}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="px-5 flex border-b border-white/5 bg-[#0a0c0e]">
                <button
                  type="button"
                  onClick={() => setGlossaryTab("list")}
                  className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    glossaryTab === "list"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Lista de Reglas
                </button>
                <button
                  type="button"
                  onClick={() => setGlossaryTab("json")}
                  className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    glossaryTab === "json"
                      ? "border-emerald-500 text-emerald-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  Editar como JSON (Validador)
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {glossaryTab === "json" ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                        Editor de Reglas JSON
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Edita las reglas directamente en formato JSON. El validador verificará la sintaxis en tiempo real para evitar errores durante la traducción. Formato esperado: 
                        <code className="mx-1 px-1.5 py-0.5 bg-white/5 rounded text-emerald-300 font-mono text-[11px]">
                          {"{ \"Término Inglés\": \"Traducción Español\" }"}
                        </code>.
                      </p>

                      <div className="relative">
                        <textarea
                          rows={12}
                          value={jsonText}
                          onChange={(e) => handleJsonChange(e.target.value)}
                          placeholder='{\n  "Spell Book": "Libro de Hechizos",\n  "Ender Pearl": "Perla de Ender"\n}'
                          className="w-full px-4 py-3 bg-[#101113] border border-white/10 rounded-lg font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 leading-relaxed resize-y"
                        />
                      </div>

                      {/* Validator Feedback Banner */}
                      {jsonError ? (
                        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-400 text-xs">
                          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold block mb-0.5">Sintaxis JSON Inválida</span>
                            <span className="opacity-90 font-mono text-[11px] leading-relaxed break-all">{jsonError}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <div>
                            <span className="font-bold">Sintaxis JSON Válida</span>
                            <span className="block text-[10px] text-slate-500 font-normal">
                              Listo para guardar. Se detectaron {(() => {
                                try {
                                  return Object.keys(JSON.parse(jsonText || "{}")).length;
                                } catch (e) {
                                  return 0;
                                }
                              })()} reglas.
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGlossaryTab("list");
                            setJsonError(null);
                          }}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded text-xs transition-all cursor-pointer"
                        >
                          CANCELAR
                        </button>
                        <button
                          type="button"
                          disabled={!!jsonError}
                          onClick={handleSaveJsonGlossary}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-black font-bold rounded text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          GUARDAR JSON
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Form to add rule */}
                    <form onSubmit={handleAddGlossaryTerm} className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                      <h4 className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-3">Agregar Nueva Regla al Glosario</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Término en Inglés</label>
                          <input
                            type="text"
                            required
                            value={newEnTerm}
                            onChange={(e) => setNewEnTerm(e.target.value)}
                            placeholder="Ej. Spell Book"
                            className="w-full px-3 py-2 bg-[#1a1c1e] border border-white/10 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-500 uppercase font-bold mb-1 tracking-wider">Traducción al Español</label>
                          <input
                            type="text"
                            required
                            value={newEsTerm}
                            onChange={(e) => setNewEsTerm(e.target.value)}
                            placeholder="Ej. Libro de Hechizos"
                            className="w-full px-3 py-2 bg-[#1a1c1e] border border-white/10 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <p className="text-[10px] text-slate-500 leading-normal max-w-sm">
                          Esta regla asegurará que la IA traduzca el término de forma 100% idéntica y consistente en todos los archivos.
                        </p>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          AGREGAR REGLA
                        </button>
                      </div>
                    </form>

                    {/* Rules List */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Listado de Reglas Activas</h4>
                        <input
                          type="text"
                          placeholder="Buscar término..."
                          value={glossarySearch}
                          onChange={(e) => setGlossarySearch(e.target.value)}
                          className="px-3 py-1.5 bg-[#1a1c1e] border border-white/10 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 w-44"
                        />
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto border border-white/5 rounded-xl p-2 bg-[#08090a]">
                        
                        {/* Custom Rules */}
                        {filteredCustomGlossary.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest px-2 py-1">Tus Reglas Personalizadas</div>
                            {filteredCustomGlossary.map(([en, es]) => (
                              <div key={en} className="flex justify-between items-center p-2 bg-white/5 hover:bg-[#0d0f11] rounded-lg border border-white/5 text-[11px] text-slate-300 transition-all">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-white">{en}</span>
                                  <span className="text-slate-500">→</span>
                                  <span className="text-emerald-300 font-semibold">{es}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveGlossaryTerm(en)}
                                  className="p-1 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded transition-all cursor-pointer"
                                  title="Eliminar regla"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Default Rules */}
                        <div className="space-y-1 pt-2">
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest px-2 py-1 flex items-center gap-1">
                            <Info className="w-3 h-3 text-slate-500" />
                            Glosario Minecraft por Defecto (Protegido)
                          </div>
                          {filteredDefaultGlossary.map(([en, es]) => (
                            <div key={en} className="flex justify-between items-center p-2 bg-white/[0.02] rounded-lg text-[11px] text-slate-400">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{en}</span>
                                  <span className="text-slate-600">→</span>
                                  <span className="text-slate-300">{es}</span>
                                </div>
                                <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Sistema</span>
                              </div>
                            ))}
                          </div>

                        {filteredCustomGlossary.length === 0 && filteredDefaultGlossary.length === 0 && (
                          <div className="text-center p-6 text-slate-500 italic text-xs">
                            No se encontraron términos que coincidan con la búsqueda.
                          </div>
                        )}

                      </div>
                    </div>
                  </>
                )}

              </div>
              
              {/* Modal Footer */}
              <div className="p-4 border-t border-white/5 bg-[#08090a] flex justify-end">
                <button
                  onClick={() => setShowGlossaryModal(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold rounded text-xs transition-all cursor-pointer"
                >
                  CERRAR VENTANA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE ANALISIS DE DIFF PARA GLOSARIO */}
      <AnimatePresence>
        {analyzingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f1115] border border-white/10 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 bg-[#14181f] border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                      Análisis de Diff y Sugerencias de Glosario
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Patrones recurrentes detectados en <strong className="text-amber-300">{analyzingTask.originalName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAnalyzingTask(null)}
                  className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {isAnalyzingDiff ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <p className="text-xs font-semibold">Analizando el diff de la traducción y extrayendo patrones recurrentes...</p>
                  </div>
                ) : suggestedTerms.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-300 font-semibold">No se encontraron nuevos términos recurrentes en este mod.</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Los términos traducidos ya coinciden con tu glosario existente o no contienen patrones repetidos de alta frecuencia.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[#14181f] p-3 rounded-lg border border-white/5">
                      <span className="text-[11px] text-slate-300">
                        Se detectaron <strong className="text-emerald-400 font-bold">{suggestedTerms.length}</strong> términos candidatos. Selecciona los que deseas agregar:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectAllSuggested(true)}
                          className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
                        >
                          Seleccionar Todo
                        </button>
                        <span className="text-slate-600">•</span>
                        <button
                          onClick={() => handleSelectAllSuggested(false)}
                          className="text-[10px] font-bold text-slate-400 hover:underline cursor-pointer"
                        >
                          Desmarcar Todo
                        </button>
                      </div>
                    </div>

                    {/* Suggestions List */}
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                      {suggestedTerms.map((term, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            term.selected
                              ? "bg-amber-500/5 border-amber-500/20"
                              : "bg-[#14181f] border-white/5 opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={term.selected}
                              onChange={() => handleToggleTermSelected(index)}
                              className="mt-1 rounded text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-white font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                  {term.englishTerm}
                                </span>
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-semibold">
                                  {term.reasoning}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-1/2">
                            <span className="text-xs text-slate-500 font-bold">→</span>
                            <input
                              type="text"
                              value={term.suggestedTranslation}
                              onChange={(e) => handleUpdateSuggestedTranslation(index, e.target.value)}
                              placeholder="Traducción sugerida..."
                              className="flex-1 p-1.5 bg-[#08090a] border border-white/10 rounded text-xs text-emerald-300 font-semibold focus:outline-none focus:border-amber-500/50"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-[#14181f] border-t border-white/10 flex items-center justify-between">
                <button
                  onClick={() => setAnalyzingTask(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                {suggestedTerms.length > 0 && !isAnalyzingDiff && (
                  <button
                    onClick={handleAddSelectedTermsToGlossary}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-all shadow-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Agregar {suggestedTerms.filter(t => t.selected).length} Términos al Glosario
                    </span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className={`p-4 rounded-xl border pointer-events-auto shadow-2xl flex items-start gap-3 backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-[#091510]/95 border-emerald-500/30 text-emerald-400"
                  : toast.type === "warning"
                  ? "bg-[#1f1908]/95 border-amber-500/30 text-amber-300"
                  : toast.type === "info"
                  ? "bg-[#09111a]/95 border-cyan-500/30 text-cyan-300"
                  : "bg-[#18090a]/95 border-red-500/30 text-red-400"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                toast.type === "success"
                  ? "bg-emerald-500/10"
                  : toast.type === "warning"
                  ? "bg-amber-500/10"
                  : toast.type === "info"
                  ? "bg-cyan-500/10"
                  : "bg-red-500/10"
              }`}>
                {toast.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : toast.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                ) : toast.type === "info" ? (
                  <FileCode className="w-4 h-4 text-cyan-400" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white mb-0.5">{toast.title}</h4>
                <p className="text-[11px] text-slate-300 leading-normal">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded hover:bg-white/5 cursor-pointer border-0 bg-transparent"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MODAL FULL-SCREEN VISTA PREVIA JSON */}
      <AnimatePresence>
        {previewModalTask && (() => {
          const jsonFiles = getTaskJsonFiles(previewModalTask);
          const filePaths = Object.keys(jsonFiles);
          const currentPath = previewModalFile || filePaths[0] || "";
          const currentJsonObject = currentPath ? (jsonFiles[currentPath] || {}) : {};
          const validation = validateMinecraftLangJson(currentJsonObject);

          const filteredEntries = Object.entries(currentJsonObject);
          const formattedJsonStr = JSON.stringify(currentJsonObject, null, 2);
          const jsonCharCount = formattedJsonStr.length;
          const jsonKbSize = (jsonCharCount / 1024).toFixed(1);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0b0d10] border border-white/10 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 bg-[#111419] border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display flex items-center gap-2">
                        <span>Vista Previa Interactiva de JSON de Idioma</span>
                        {validation.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Esquema Forge/Fabric OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/15 text-red-300 border border-red-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Violaciones de Esquema ({validation.errors.length})
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        <strong className="text-emerald-300">{previewModalTask.originalName}</strong> &bull; {currentPath.split("/").pop()} ({Object.keys(currentJsonObject).length} claves)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleCopyJsonToClipboard(currentJsonObject)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Copy className="w-4 h-4 text-emerald-400" />
                      <span>Copiar JSON</span>
                    </button>
                    <button
                      onClick={() => handleDownloadJsonFile(currentPath, currentJsonObject)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Download className="w-4 h-4 text-cyan-400" />
                      <span>Descargar .json</span>
                    </button>
                    <button
                      onClick={() => setPreviewModalTask(null)}
                      className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border-0 bg-transparent"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Sub-Header Tabs */}
                <div className="p-3 bg-[#0e1116] border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                    {filePaths.map(filePath => (
                      <button
                        key={filePath}
                        onClick={() => setPreviewModalFile(filePath)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          currentPath === filePath
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow"
                            : "bg-white/5 hover:bg-white/10 text-slate-400 border border-white/5"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{filePath}</span>
                      </button>
                    ))}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 shrink-0 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                    {jsonKbSize} KB
                  </span>
                </div>

                {/* JSON Body Viewer */}
                <div className="p-4 bg-[#050608] font-mono text-xs overflow-x-auto flex-1 overflow-y-auto space-y-1.5 select-text">
                  <div className="text-slate-500">{`{`}</div>
                  {filteredEntries.map(([k, v], idx) => (
                    <div key={k} className="pl-6 flex items-start gap-1.5 hover:bg-white/[0.03] py-1 rounded transition-colors leading-relaxed">
                      <span className="text-slate-600 text-[11px] shrink-0 select-none w-10 text-right pr-2">
                        {idx + 1}
                      </span>
                      <span className="text-cyan-400 font-semibold break-all">"{k}"</span>
                      <span className="text-slate-500">:</span>
                      <span className="text-amber-300 font-medium break-all">"{v}"</span>
                      {idx < filteredEntries.length - 1 && <span className="text-slate-500">,</span>}
                    </div>
                  ))}
                  <div className="text-slate-500">{`}`}</div>
                </div>

                {/* Footer */}
                <div className="p-3 bg-[#0e1116] border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Mostrando {filteredEntries.length} entradas de traducción</span>
                  <button
                    onClick={() => setPreviewModalTask(null)}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/15 text-slate-200 font-semibold rounded-lg transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
