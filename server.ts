import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import multer from "multer";
import AdmZip from "adm-zip";
import { createServer as createViteServer } from "vite";
import { 
  runTranslationTask, 
  TranslationTask, 
  TranslationOptions, 
  DEFAULT_GLOSSARY 
} from "./src/translationEngine";

const app = express();
const PORT = 3000;

// Enable JSON and URL-encoded parsing with higher limits
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Setup working folders in temporary OS directory
const TMP_DIR = path.join(os.tmpdir(), "minecraft-translator");
const UPLOADS_DIR = path.join(TMP_DIR, "uploads");
const OUTPUTS_DIR = path.join(TMP_DIR, "outputs");

fs.mkdirSync(TMP_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

// Setup multer for JAR file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Keep it clean and avoid collision
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only accept .jar files
    if (file.originalname.endsWith(".jar") || file.mimetype === "application/java-archive") {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos mod .jar de Minecraft."));
    }
  }
});

// In-memory Task state map
const tasks: Record<string, TranslationTask> = {};
// User's custom glossary rules (persistent in-memory for the server session)
let customGlossary: Record<string, string> = {};

// Simple Task Queue Manager to throttle Gemini API calls (max 2 parallel mods)
const taskQueue: string[] = [];
let activeWorkersCount = 0;
const MAX_CONCURRENT_WORKERS = 2;

async function processQueue() {
  if (activeWorkersCount >= MAX_CONCURRENT_WORKERS) return;
  if (taskQueue.length === 0) return;

  const nextTaskId = taskQueue.shift();
  if (!nextTaskId) return;

  const task = tasks[nextTaskId];
  if (!task) return;

  activeWorkersCount++;
  task.status = "processing";
  task.progress = 5;

  // Retrieve temporary upload file path
  const originalFilePath = (task as any)._originalFilePath;
  const options = (task as any)._options;

  try {
    await runTranslationTask(
      task,
      originalFilePath,
      OUTPUTS_DIR,
      options,
      (progress, stats) => {
        task.progress = progress;
        task.stats = { ...task.stats, ...stats };
      }
    );
  } catch (err: any) {
    task.status = "failed";
    task.errors.push(err.message || String(err));
  } finally {
    // Clean up uploaded original file to save space
    try {
      if (fs.existsSync(originalFilePath)) {
        fs.unlinkSync(originalFilePath);
      }
    } catch (e) {
      console.error("Error al limpiar archivo original:", e);
    }
    
    activeWorkersCount--;
    // Continue processing
    processQueue();
  }
}

// REST API ENDPOINTS

// 1. Get task list & overall statistics
app.get("/api/tasks", (req, res) => {
  res.json({
    tasks: Object.values(tasks).map(t => {
      // Omit heavy internal parameters from response
      const { _originalFilePath, _options, ...clientTask } = t as any;
      return clientTask;
    })
  });
});

// 2. Submit new translation tasks
app.post("/api/translate", upload.array("files"), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No se proporcionaron archivos para traducir." });
      return;
    }

    // Parse options from multipart field
    let options: TranslationOptions = {
      translateLang: true,
      translateBooks: true,
      translateQuests: true,
      translateDatapacks: true,
      translateStructures: true,
      translateAll: false,
      targetLocale: "es_es",
      customGlossary: {}
    };

    if (req.body.options) {
      try {
        options = JSON.parse(req.body.options);
      } catch (err) {
        console.error("No se pudieron parsear las opciones, usando valores predeterminados.");
      }
    }

    const createdTaskIds: string[] = [];

    // Create a translation task for each uploaded JAR file
    for (const file of files) {
      const taskId = "task-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
      const originalName = file.originalname;
      const baseName = path.basename(originalName, ".jar");
      
      const localeSuffix = options.targetLocale === "es_es" ? "_es" : 
                           options.targetLocale === "es_mx" ? "_es_mx" : "_es_completo";
      const translatedName = `${baseName}${localeSuffix}.jar`;

      const task: TranslationTask = {
        id: taskId,
        originalName,
        translatedName,
        status: "queued",
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        stats: {
          wordsTranslated: 0,
          charactersSavedByMemory: 0,
          filesTranslated: 0,
          filesIgnored: 0,
          errorsCount: 0,
          timeSpentMs: 0
        },
        errors: [],
        logs: [`[INFO] Mod cargado y en cola para traducción: ${originalName}`]
      };

      // Store file path and options internally inside the task (not exposed to API)
      (task as any)._originalFilePath = file.path;
      (task as any)._options = options;

      tasks[taskId] = task;
      createdTaskIds.push(taskId);
      taskQueue.push(taskId);
    }

    // Trigger queue processing
    for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
      processQueue();
    }

    res.json({ success: true, taskIds: createdTaskIds });
  } catch (error: any) {
    console.error("Error en endpoint /api/translate:", error);
    res.status(500).json({ error: error.message || "Error al iniciar la traducción." });
  }
});

// 3. Clear logs or tasks list
app.post("/api/tasks/clear", (req, res) => {
  // Clear completed and failed tasks
  for (const id of Object.keys(tasks)) {
    if (tasks[id].status === "completed" || tasks[id].status === "failed") {
      // Remove physical output file if any
      const outPath = path.join(OUTPUTS_DIR, tasks[id].translatedName);
      try {
        if (fs.existsSync(outPath)) {
          fs.unlinkSync(outPath);
        }
      } catch (e) {}
      delete tasks[id];
    }
  }
  res.json({ success: true, tasks: Object.values(tasks) });
});

// 4. Download a single translated mod JAR
app.get("/api/download/:taskId", (req, res) => {
  const { taskId } = req.params;
  const task = tasks[taskId];
  if (!task || task.status !== "completed") {
    res.status(404).send("Archivo no encontrado o traducción aún en curso.");
    return;
  }

  const filePath = path.join(OUTPUTS_DIR, task.translatedName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send("El archivo traducido no se encuentra en el servidor.");
    return;
  }

  res.download(filePath, task.translatedName);
});

// 5. Download ALL translated mods packaged as a single ZIP file
app.get("/api/download-all", (req, res) => {
  const completedTasks = Object.values(tasks).filter(t => t.status === "completed");
  if (completedTasks.length === 0) {
    res.status(400).send("No hay traducciones completadas disponibles para descargar.");
    return;
  }

  try {
    const zip = new AdmZip();
    let filesAdded = 0;

    for (const task of completedTasks) {
      const filePath = path.join(OUTPUTS_DIR, task.translatedName);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
        filesAdded++;
      }
    }

    if (filesAdded === 0) {
      res.status(404).send("Los archivos traducidos no se encontraron en el disco.");
      return;
    }

    const zipBuffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=minecraft_mods_espanol.zip`);
    res.send(zipBuffer);
  } catch (error: any) {
    console.error("Error al empaquetar descargas:", error);
    res.status(500).send("Error interno al empaquetar los mods.");
  }
});

// 6. Glossary CRUD
app.get("/api/glossary", (req, res) => {
  res.json({
    defaultGlossary: DEFAULT_GLOSSARY,
    customGlossary
  });
});

app.post("/api/glossary", (req, res) => {
  try {
    const { glossary } = req.body;
    if (glossary && typeof glossary === "object") {
      customGlossary = glossary;
      res.json({ success: true, customGlossary });
    } else {
      res.status(400).json({ error: "Glosario inválido." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. General system health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", activeWorkers: activeWorkersCount, queueSize: taskQueue.length });
});

// Integrating Vite for full-stack build/dev lifecycle
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Mount Vite's HMR and dev server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve built static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Minecraft Mod Translator server running at http://localhost:${PORT}`);
  });
}

startServer();
