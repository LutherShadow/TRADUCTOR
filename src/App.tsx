import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Settings, 
  Globe, 
  Languages, 
  BookOpen, 
  ShieldAlert, 
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
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, googleProvider, db } from "./firebase";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info";
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
  orderBy 
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./firestoreErrors";

interface TaskStats {
  wordsTranslated: number;
  charactersSavedByMemory: number;
  filesTranslated: number;
  filesIgnored: number;
  errorsCount: number;
  timeSpentMs: number;
}

interface TranslationTask {
  id: string;
  originalName: string;
  translatedName: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  totalFiles: number;
  processedFiles: number;
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

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // API Engine options
  const [apiEngine, setApiEngine] = useState<string>(() => {
    return localStorage.getItem("mc_api_engine") || "gemini";
  });
  
  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("mc_custom_api_keys");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem("mc_api_engine", apiEngine);
  }, [apiEngine]);

  useEffect(() => {
    localStorage.setItem("mc_custom_api_keys", JSON.stringify(customApiKeys));
  }, [customApiKeys]);

  // Glossary states
  const [defaultGlossary, setDefaultGlossary] = useState<Record<string, string>>({});
  const [customGlossary, setCustomGlossary] = useState<Record<string, string>>({});
  const [newEnTerm, setNewEnTerm] = useState("");
  const [newEsTerm, setNewEsTerm] = useState("");
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");

  // UI States
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [diffSearch, setDiffSearch] = useState<Record<string, string>>({});
  const [diffPages, setDiffPages] = useState<Record<string, number>>({});
  const [diffFileFilters, setDiffFileFilters] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New features: Toasts, System Notifications & Global Queue Filter
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [queueStatusFilter, setQueueStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const prevTasksRef = useRef<Record<string, "pending" | "processing" | "completed" | "failed">>({});

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
        setDoc(userDocRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || "",
          photoURL: currentUser.photoURL || "",
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(err => {
          console.error("Error syncing user profile:", err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync tasks from Firestore (realtime) if logged in, else poll server in-memory
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      fetchTasks();
      const interval = setInterval(fetchTasks, 1500);
      return () => clearInterval(interval);
    }

    const tasksRef = collection(db, "users", user.uid, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TranslationTask[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as TranslationTask);
      });
      setTasks(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/tasks`);
    });
    return () => unsubscribe();
  }, [user, authLoading]);

  // Track tasks transitions to trigger completion/failure notifications and toasts
  useEffect(() => {
    if (tasks.length === 0) {
      prevTasksRef.current = {};
      return;
    }

    const prev = prevTasksRef.current;
    
    tasks.forEach(task => {
      const prevStatus = prev[task.id];
      // Check for transition from pending/processing to completed or failed
      if (prevStatus && prevStatus !== task.status) {
        if (task.status === "completed") {
          triggerNotification(
            "¡Traducción Completada!",
            `El mod "${task.originalName}" ha finalizado su traducción correctamente.`
          );
          addToast(task.originalName, "completed");
        } else if (task.status === "failed") {
          triggerNotification(
            "Error de Traducción",
            `Hubo un problema procesando el mod "${task.originalName}".`
          );
          addToast(task.originalName, "failed");
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

  // Sync custom glossary from Firestore (realtime) if logged in, else load from server
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      fetchGlossary();
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

    // Also fetch default glossary from server once
    const fetchDefaultGlossaryOnly = async () => {
      try {
        const res = await fetch("/api/glossary");
        if (res.ok) {
          const data = await res.json();
          setDefaultGlossary(data.defaultGlossary || {});
        }
      } catch (err) {
        console.error("Error fetching default glossary:", err);
      }
    };
    fetchDefaultGlossaryOnly();

    return () => unsubscribe();
  }, [user, authLoading]);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Error al consultar tareas de traducción:", err);
    }
  };

  const fetchGlossary = async () => {
    try {
      const res = await fetch("/api/glossary");
      if (res.ok) {
        const data = await res.json();
        setDefaultGlossary(data.defaultGlossary || {});
        setCustomGlossary(data.customGlossary || {});
      }
    } catch (err) {
      console.error("Error al obtener glosario:", err);
    }
  };

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
        const res = await fetch("/api/glossary", {
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
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    filesToUpload.forEach(file => {
      formData.append("files", file);
    });

    if (user) {
      formData.append("userId", user.uid);
    }

    // Append our selection options as a JSON string
    const options = {
      translateLang,
      translateBooks,
      translateQuests,
      translateDatapacks,
      translateStructures,
      translateAll,
      targetLocale,
      customGlossary,
      apiEngine,
      customApiKeys
    };
    formData.append("options", JSON.stringify(options));

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al subir los archivos.");
      }

      // Refresh immediately
      fetchTasks();
    } catch (err: any) {
      setUploadError(err.message || "Error al procesar archivos.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const runPreAnalysis = async (file: File) => {
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
      customGlossary,
      apiEngine,
      customApiKeys
    };
    formData.append("options", JSON.stringify(options));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al analizar el archivo.");
      }

      const data = await res.json();
      setAnalysisResult(data);
    } catch (err: any) {
      setAnalysisError(err.message || "Error al realizar el pre-análisis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearFinishedTasks = async () => {
    try {
      await fetch("/api/tasks/clear", { method: "POST" });
    } catch (err) {
      console.error("Error al limpiar tareas en memoria:", err);
    }

    if (user) {
      try {
        const completedOrFailed = tasks.filter(t => t.status === "completed" || t.status === "failed");
        for (const t of completedOrFailed) {
          const taskDocRef = doc(db, "users", user.uid, "tasks", t.id);
          await deleteDoc(taskDocRef);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/tasks/*`);
      }
    } else {
      fetchTasks();
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
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        
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
                onClick={() => signInWithPopup(auth, googleProvider)}
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
          <div className="lg:col-span-4 space-y-6">
            
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
                    onChange={(e) => setApiEngine(e.target.value)}
                    className="w-full p-2.5 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="gemini" className="bg-[#0d0f11] text-white">Gemini 3.5 Flash (Predeterminado)</option>
                    <option value="google_free" className="bg-[#0d0f11] text-white">Google Translate (Gratuito / Ilimitado)</option>
                    <option value="google_cloud" className="bg-[#0d0f11] text-white">Google Cloud Translation API (Oficial)</option>
                    <option value="openai" className="bg-[#0d0f11] text-white">OpenAI GPT-4o-mini</option>
                    <option value="deepseek" className="bg-[#0d0f11] text-white">DeepSeek API (Rápido y Barato)</option>
                    <option value="groq" className="bg-[#0d0f11] text-white">Groq Cloud (Llama 3.1 8B)</option>
                    <option value="openrouter" className="bg-[#0d0f11] text-white">OpenRouter API</option>
                    <option value="anthropic" className="bg-[#0d0f11] text-white">Anthropic Claude (Alta Calidad)</option>
                  </select>
                </div>

                {/* Conditional API Keys Inputs */}
                {apiEngine !== "gemini" && apiEngine !== "google_free" && (
                  <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-lg space-y-2 mt-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-400">
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
                      value={customApiKeys[apiEngine] || ""}
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
              onClick={() => fileInputRef.current?.click()}
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
                  <div className="flex items-center gap-3">
                    {totalCompleted > 0 && (
                      <a
                        href={user ? `/api/download-all?userId=${user.uid}` : "/api/download-all"}
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
                              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
                                {task.status === "completed" && task.downloadUrl && (
                                  <a
                                    href={user ? `${task.downloadUrl}?userId=${user.uid}` : task.downloadUrl}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded font-bold text-[10px] transition-all shadow-md cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    DESCARGAR
                                  </a>
                                )}
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

                        {/* Progress Bar */}
                        {(task.status === "processing" || task.status === "queued" || task.progress < 100) && (
                          <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1 font-semibold">
                              <span>PROGRESO DE TRADUCCIÓN</span>
                              <span>{task.progress}%</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
                                style={{ width: `${task.progress}%` }}
                              />
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
                          <div className="mt-3 p-3 bg-[#08090a] rounded-lg border border-white/5 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                            <div className="text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-2 border-b border-white/5 pb-1">CONSOLA DE DEPURACIÓN</div>
                            {task.logs.length === 0 && <div className="text-slate-500 italic">No hay logs de ejecución aún.</div>}
                            {task.logs.map((logLine, idx) => (
                              <div key={idx} className="leading-relaxed hover:bg-white/5 p-0.5 rounded transition-all">
                                {logLine}
                              </div>
                            ))}
                            {task.errors.map((errLine, idx) => (
                              <div key={`err-${idx}`} className="text-red-400 font-semibold bg-red-950/20 px-1 py-0.5 rounded">
                                [ERROR] {errLine}
                              </div>
                            ))}
                          </div>
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
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> Motor: Gemini 3.5 Flash</span>
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

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
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
                  : "bg-[#18090a]/95 border-red-500/30 text-red-400"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                toast.type === "success" ? "bg-emerald-500/10" : "bg-red-500/10"
              }`}>
                {toast.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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

    </div>
  );
}
