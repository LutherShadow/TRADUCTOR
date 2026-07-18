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
  Database, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Info,
  X,
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
}

export default function App() {
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

  // Glossary states
  const [defaultGlossary, setDefaultGlossary] = useState<Record<string, string>>({});
  const [customGlossary, setCustomGlossary] = useState<Record<string, string>>({});
  const [newEnTerm, setNewEnTerm] = useState("");
  const [newEsTerm, setNewEsTerm] = useState("");
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState("");

  // UI States
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll for task status
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 1500);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial Glossary rules
  useEffect(() => {
    fetchGlossary();
  }, []);

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

    // Append our selection options as a JSON string
    const options = {
      translateLang,
      translateBooks,
      translateQuests,
      translateDatapacks,
      translateStructures,
      translateAll,
      targetLocale,
      customGlossary
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

  const clearFinishedTasks = async () => {
    try {
      const res = await fetch("/api/tasks/clear", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Error al limpiar tareas:", err);
    }
  };

  const toggleLogs = (id: string) => {
    setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
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
              Glosario y Reglas
            </button>
            <a
              href="https://ai.studio/build"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/20 text-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              AI Studio Build
            </a>
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

            {/* Active Queue & Tasks Processed list */}
            {tasks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 flex items-center gap-2">
                    <span className="w-1 h-3 bg-emerald-500"></span> COLA DE PROCESAMIENTO ({tasks.length})
                  </h3>
                  <div className="flex gap-3">
                    {totalCompleted > 0 && (
                      <a
                        href="/api/download-all"
                        className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded text-[10px] uppercase tracking-wider font-bold transition-all"
                      >
                        <Download className="w-3 h-3" />
                        Descargar ZIP
                      </a>
                    )}
                    <button
                      onClick={clearFinishedTasks}
                      className="text-[10px] text-emerald-500 hover:text-emerald-400 uppercase tracking-wider font-bold cursor-pointer"
                    >
                      Limpiar Cola
                    </button>
                  </div>
                </div>

                {/* Queue Cards */}
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {tasks.map((task) => (
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
                                    <span>Guardado como: <strong className="text-slate-300 font-medium">{task.translatedName}</strong></span>
                                  ) : (
                                    <span>{task.totalFiles} archivos identificados • {task.status === "processing" ? "Traduciendo..." : task.status === "failed" ? "Error" : "En cola"}</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
                                {task.status === "completed" && task.downloadUrl && (
                                  <a
                                    href={task.downloadUrl}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded font-bold text-[10px] transition-all shadow-md cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    DESCARGAR
                                  </a>
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
                      </motion.div>
                    ))}
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

    </div>
  );
}
