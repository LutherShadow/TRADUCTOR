import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import os from "os";
import { GoogleGenAI, Type } from "@google/genai";

// Standard Minecraft term glossary for high-quality out-of-the-box translations
export const DEFAULT_GLOSSARY: Record<string, string> = {
  "Overworld": "Mundo Superior",
  "Nether": "Nether",
  "The End": "El End",
  "Enderman": "Enderman",
  "Endermen": "Endermen",
  "Piglin": "Piglin",
  "Piglins": "Piglins",
  "Creeper": "Creeper",
  "Creepers": "Creepers",
  "Zombie": "Zombi",
  "Zombies": "Zombies",
  "Skeleton": "Esqueleto",
  "Skeletons": "Esqueletos",
  "Redstone": "Redstone",
  "Glowstone": "Piedra Luminosa",
  "Mana": "Maná",
  "Cooldown": "Tiempo de reutilización",
  "Spell": "Hechizo",
  "Spells": "Hechizos",
  "Spell Book": "Libro de Hechizos",
  "Staff": "Bastón",
  "Wand": "Varita",
  "Keybind": "Tecla",
  "Keybinding": "Asignación de tecla",
  "Forge": "Forge",
  "NeoForge": "NeoForge",
  "Fabric": "Fabric",
  "Modpack": "Modpack",
  "Creative Tab": "Pestaña de Creativo",
  "Advancement": "Progreso",
  "Advancements": "Progresos",
  "Quest": "Misión",
  "Quests": "Misiones",
  "Loot Table": "Tabla de botín",
  "Loot Tables": "Tablas de botín"
};

// Types for Translation Request
export interface TranslationOptions {
  translateLang: boolean;
  translateBooks: boolean;
  translateQuests: boolean;
  translateDatapacks: boolean;
  translateStructures: boolean;
  translateAll: boolean;
  targetLocale: "es_es" | "es_mx" | "both";
  customGlossary: Record<string, string>;
}

export interface TaskStats {
  wordsTranslated: number;
  charactersSavedByMemory: number;
  filesTranslated: number;
  filesIgnored: number;
  errorsCount: number;
  timeSpentMs: number;
}

export interface TranslationTask {
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

// In-Memory Global Translation Memory Cache to speed up across runs
const globalTranslationMemory: Record<string, string> = {};

// Helper to determine if a string is likely translatable player-facing text
export function isTranslatableString(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  
  const trimmed = str.trim();
  if (trimmed.length === 0) return false;

  // Skip namespaced identifiers (e.g. "minecraft:iron_ingot", "irons_spellbooks:fire")
  if (/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(trimmed)) return false;

  // Skip absolute or relative URLs, images, models, layouts, or texture paths
  if (/\.(png|jpg|jpeg|gif|json|obj|bbmodel|fjson|ogg|wav|txt|class)$/i.test(trimmed)) return false;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return false;

  // Skip numeric-only strings, hashes, or very short punctuation-only tokens
  if (/^[0-9\s.,:;_\-+=*/\\|?!@#$%^&*()\[\]{}'"`~<>]+$/.test(trimmed)) return false;

  // Must contain at least one letter (alphabetical)
  if (!/[a-zA-Z\u00C0-\u017F]/.test(trimmed)) return false;

  // Skip typical Java package signatures or class strings
  if (trimmed.includes(".") && trimmed.split(".").every(part => /^[a-zA-Z0-9_]+$/.test(part)) && trimmed.length > 15) return false;

  return true;
}

// Lazy initialization of Gemini API
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("La clave API de Gemini (GEMINI_API_KEY) no está configurada en los Secretos de la aplicación.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiClient;
}

// Translates a batch of strings using Gemini 3.5 Flash
async function translateBatch(
  batch: Record<string, string>,
  glossary: Record<string, string>,
  targetLangName: string,
  logFn: (msg: string) => void
): Promise<Record<string, string>> {
  const keys = Object.keys(batch);
  if (keys.length === 0) return {};

  try {
    const ai = getAi();
    
    // Build the glossary text to instruct Gemini
    const glossaryText = Object.entries(glossary)
      .map(([en, es]) => `- "${en}" -> "${es}"`)
      .join("\n");

    const systemInstruction = `You are a professional Minecraft Mod Translator specializing in Spanish translations.
Your task is to translate values from English to ${targetLangName}.

STRICT RULES:
1. Preserve all variables, placeholders, formatting tags, and color codes EXACTLY in their correct positions. Examples:
   - Percent placeholders: "%s", "%d", "%1$s", "%2$d", etc.
   - Brace variables: "{player}", "{0}", "{1}", "{name}", etc.
   - Dollar symbols: "$(item)", "$(br)", "$(l)", etc.
   - Minecraft formatting/color characters: "§a", "§b", "§r", "§l", "§6", etc. or "&e", "&a", etc.
   - Custom bracket selectors: "<red>", "</red>", "<item>" etc.
2. Maintain namespaces and internal paths exactly as-is. Do NOT translate words prefixed with "minecraft:", "forge:", "neoforge:", "fabric:", or matching "modid:".
3. Apply this custom glossary strictly for term consistency:
${glossaryText}
4. Translate only the human-readable text visible to players. Keep the tone natural, engaging, and faithful to standard Minecraft terminology (e.g. use "Mesa de trabajo" for Crafting Table, "Mundo Superior" for Overworld, etc.).
5. You MUST return a JSON object with the exact same keys as the input. Do NOT omit any keys or alter their names. Output ONLY the valid JSON object.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: JSON.stringify(batch),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: "A dictionary with the translated values in Spanish, preserving the exact keys from the input.",
        }
      }
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error("La respuesta de Gemini está vacía.");
    }

    const result = JSON.parse(text) as Record<string, string>;
    
    // Verify all keys are present, fallback to original if missing
    const finalResult: Record<string, string> = {};
    for (const key of keys) {
      if (result[key] !== undefined) {
        finalResult[key] = result[key];
      } else {
        finalResult[key] = batch[key]; // Fallback to original
      }
    }
    return finalResult;
  } catch (error: any) {
    logFn(`Error en lote de traducción: ${error.message || error}`);
    // Return original strings as fallback
    return batch;
  }
}

// Main translation task executor
export async function runTranslationTask(
  task: TranslationTask,
  originalFilePath: string,
  outputDir: string,
  options: TranslationOptions,
  updateProgress: (progress: number, stats: Partial<TaskStats>) => void
): Promise<string> {
  const log = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    task.logs.push(`[${timestamp}] ${msg}`);
    console.log(`[Task ${task.id}] ${msg}`);
  };

  const startTime = Date.now();
  log(`Iniciando traducción para el mod: ${task.originalName}`);
  
  // Create combined glossary from default + user rules
  const glossary = { ...DEFAULT_GLOSSARY, ...options.customGlossary };

  // Set target language text
  const targetLangName = options.targetLocale === "es_es" ? "Castilian Spanish (es_es)" : 
                         options.targetLocale === "es_mx" ? "Mexican Spanish (es_mx)" : 
                         "Spanish (es_es and es_mx)";

  try {
    // 1. Load ZIP
    const zip = new AdmZip(originalFilePath);
    const entries = zip.getEntries();
    task.totalFiles = entries.length;
    log(`Se han encontrado ${entries.length} archivos dentro del mod.`);

    // 2. Identify and categorise files
    const translatableEntries: { entry: any; type: string; namespace: string }[] = [];
    
    for (const entry of entries) {
      const entryPath = entry.entryName;
      
      // Skip directories or compilation artifacts
      if (entry.isDirectory || entryPath.endsWith(".class")) continue;

      // Extract namespace if possible (e.g. assets/<namespace>/...)
      const assetsMatch = entryPath.match(/^assets\/([a-zA-Z0-9_-]+)\/(.+)$/);
      const dataMatch = entryPath.match(/^data\/([a-zA-Z0-9_-]+)\/(.+)$/);
      
      // Category 1: Lang files
      if (options.translateLang || options.translateAll) {
        if (assetsMatch && assetsMatch[2].startsWith("lang/") && assetsMatch[2].endsWith(".json")) {
          // English (or general template) file
          if (assetsMatch[2] === "lang/en_us.json" || assetsMatch[2].includes("en_")) {
            translatableEntries.push({ entry, type: "lang_json", namespace: assetsMatch[1] });
            continue;
          }
        }
        if (assetsMatch && assetsMatch[2].startsWith("lang/") && assetsMatch[2].endsWith(".lang")) {
          if (assetsMatch[2] === "lang/en_us.lang" || assetsMatch[2].includes("en_")) {
            translatableEntries.push({ entry, type: "lang_legacy", namespace: assetsMatch[1] });
            continue;
          }
        }
      }

      // Category 2: Patchouli Books (assets/<namespace>/patchouli_books/)
      if (options.translateBooks || options.translateAll) {
        if (assetsMatch && assetsMatch[2].startsWith("patchouli_books/") && assetsMatch[2].endsWith(".json")) {
          translatableEntries.push({ entry, type: "patchouli", namespace: assetsMatch[1] });
          continue;
        }
      }

      // Category 3: Advancements (data/<namespace>/advancements/)
      if (options.translateQuests || options.translateAll) {
        if (dataMatch && dataMatch[2].startsWith("advancements/") && dataMatch[2].endsWith(".json")) {
          translatableEntries.push({ entry, type: "advancement", namespace: dataMatch[1] });
          continue;
        }
      }

      // Category 4: Datapacks, Loot Tables, Recipes (data/<namespace>/...)
      if (options.translateDatapacks || options.translateAll) {
        if (dataMatch && (dataMatch[2].startsWith("loot_tables/") || dataMatch[2].startsWith("recipes/")) && dataMatch[2].endsWith(".json")) {
          translatableEntries.push({ entry, type: "datapack_json", namespace: dataMatch[1] });
          continue;
        }
      }

      // Category 5: Structures and dialogs (data/<namespace>/structures/ or dialogs/)
      if (options.translateStructures || options.translateAll) {
        if (dataMatch && (dataMatch[2].startsWith("structures/") || dataMatch[2].startsWith("dialogs/") || dataMatch[2].startsWith("quests/")) && (dataMatch[2].endsWith(".json") || dataMatch[2].endsWith(".snbt"))) {
          translatableEntries.push({ entry, type: "structure_json", namespace: dataMatch[1] });
          continue;
        }
      }

      // Category 6: Mod Metadata (mods.toml, fabric.mod.json, pack.mcmeta)
      if (entryPath === "META-INF/mods.toml" || entryPath === "fabric.mod.json" || entryPath === "pack.mcmeta") {
        translatableEntries.push({ entry, type: "metadata", namespace: "global" });
        continue;
      }
    }

    log(`Archivos detectados para traducción inteligente: ${translatableEntries.length}`);
    if (translatableEntries.length === 0) {
      log("No se encontraron archivos de texto translicibles con las opciones seleccionadas.");
      task.status = "completed";
      task.progress = 100;
      task.stats.timeSpentMs = Date.now() - startTime;
      
      // Save original jar as output in case of no translatable content
      const outPath = path.join(outputDir, task.translatedName);
      fs.copyFileSync(originalFilePath, outPath);
      task.downloadUrl = `/api/download/${task.id}`;
      return outPath;
    }

    // 3. Extract all plain-text values and map them to their files
    let textToTranslate: { fileIndex: number; path: string; key: string; originalText: string }[] = [];
    
    for (let i = 0; i < translatableEntries.length; i++) {
      const { entry, type, namespace } = translatableEntries[i];
      const entryPath = entry.entryName;
      const content = entry.getData().toString("utf-8");

      try {
        if (type === "lang_json") {
          const json = JSON.parse(content);
          for (const key of Object.keys(json)) {
            const val = json[key];
            if (typeof val === "string" && isTranslatableString(val)) {
              textToTranslate.push({ fileIndex: i, path: entryPath, key, originalText: val });
            }
          }
        } 
        else if (type === "lang_legacy") {
          // Flat key=value properties file
          const lines = content.split(/\r?\n/);
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx].trim();
            if (!line || line.startsWith("#") || !line.includes("=")) continue;
            
            const eqIdx = line.indexOf("=");
            const key = line.substring(0, eqIdx).trim();
            const val = line.substring(eqIdx + 1).trim();
            
            if (isTranslatableString(val)) {
              textToTranslate.push({ fileIndex: i, path: entryPath, key: `${lineIdx}::${key}`, originalText: val });
            }
          }
        } 
        else if (type === "metadata") {
          if (entryPath === "fabric.mod.json") {
            const json = JSON.parse(content);
            if (json.name && isTranslatableString(json.name)) {
              textToTranslate.push({ fileIndex: i, path: entryPath, key: "name", originalText: json.name });
            }
            if (json.description && isTranslatableString(json.description)) {
              textToTranslate.push({ fileIndex: i, path: entryPath, key: "description", originalText: json.description });
            }
          } 
          else if (entryPath === "pack.mcmeta") {
            const json = JSON.parse(content);
            if (json.pack?.description && isTranslatableString(json.pack.description)) {
              textToTranslate.push({ fileIndex: i, path: entryPath, key: "pack.description", originalText: json.pack.description });
            }
          } 
          else if (entryPath === "META-INF/mods.toml") {
            // Read lines and look for displayName / description
            const lines = content.split(/\r?\n/);
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx].trim();
              if (line.startsWith("displayName") || line.startsWith("description")) {
                const eqIdx = line.indexOf("=");
                if (eqIdx !== -1) {
                  let val = line.substring(eqIdx + 1).trim();
                  // Strip quotes
                  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                  }
                  if (isTranslatableString(val)) {
                    textToTranslate.push({ fileIndex: i, path: entryPath, key: `${lineIdx}::metadata`, originalText: val });
                  }
                }
              }
            }
          }
        } 
        else {
          // General JSON files (advancements, patchouli books, loot tables, etc.)
          // We recursively search for translatable strings in specific keys
          const json = JSON.parse(content);
          
          const scanJsonNode = (node: any, jsonPath: string) => {
            if (node === null || node === undefined) return;
            
            if (typeof node === "string") {
              const lastKey = jsonPath.split(".").pop() || "";
              // Be smart: translate if it's a known translatable key, or if it has generic translatable properties
              const translatableKeys = ["name", "text", "description", "title", "subtitle", "lore", "pages", "message", "tooltip", "header"];
              
              const isTargetKey = translatableKeys.some(tk => lastKey.toLowerCase().includes(tk));
              if (isTargetKey && isTranslatableString(node)) {
                textToTranslate.push({ fileIndex: i, path: entryPath, key: jsonPath, originalText: node });
              }
              return;
            }
            
            if (Array.isArray(node)) {
              for (let idx = 0; idx < node.length; idx++) {
                scanJsonNode(node[idx], `${jsonPath}[${idx}]`);
              }
              return;
            }
            
            if (typeof node === "object") {
              for (const k of Object.keys(node)) {
                scanJsonNode(node[k], jsonPath ? `${jsonPath}.${k}` : k);
              }
            }
          };

          scanJsonNode(json, "");
        }
      } catch (err: any) {
        log(`Advertencia: No se pudo analizar el archivo ${entryPath} (${err.message}). Ignorando.`);
        task.stats.errorsCount++;
      }
    }

    log(`Total de cadenas candidatas encontradas: ${textToTranslate.length}`);
    
    // 4. Filter with Translation Memory (TM) & Glossary exact matches
    const stringsToTranslateFromGemini: typeof textToTranslate = [];
    const localTranslationCache: Record<string, string> = {}; // Speed up within this mod
    
    let wordsCount = 0;
    let savedChars = 0;

    for (const item of textToTranslate) {
      const orig = item.originalText;
      const wordCountInString = orig.split(/\s+/).length;
      wordsCount += wordCountInString;

      // Glossary exact match
      if (glossary[orig]) {
        localTranslationCache[orig] = glossary[orig];
        savedChars += orig.length;
        continue;
      }

      // Global Translation Memory
      if (globalTranslationMemory[orig]) {
        localTranslationCache[orig] = globalTranslationMemory[orig];
        savedChars += orig.length;
        continue;
      }

      // Local run cache
      if (localTranslationCache[orig]) {
        savedChars += orig.length;
        continue;
      }

      stringsToTranslateFromGemini.push(item);
    }

    task.stats.wordsTranslated = wordsCount;
    task.stats.charactersSavedByMemory = savedChars;
    log(`Traducciones reutilizadas del glosario o memoria: ${textToTranslate.length - stringsToTranslateFromGemini.length}.`);
    log(`Cadenas que requieren traducción por IA: ${stringsToTranslateFromGemini.length}`);

    // 5. Batch and translate remaining via Gemini
    const batchSize = 35;
    let processedGeminiCount = 0;

    for (let offset = 0; offset < stringsToTranslateFromGemini.length; offset += batchSize) {
      const currentBatchItems = stringsToTranslateFromGemini.slice(offset, offset + batchSize);
      
      // Build unique index map for the batch to minimize payload
      const batchPayload: Record<string, string> = {};
      currentBatchItems.forEach((item, idx) => {
        batchPayload[`s${idx}`] = item.originalText;
      });

      log(`Traduciendo lote ${Math.floor(offset / batchSize) + 1} de ${Math.ceil(stringsToTranslateFromGemini.length / batchSize)} (Tamaño: ${currentBatchItems.length})...`);
      
      const batchResult = await translateBatch(batchPayload, glossary, targetLangName, log);
      
      // Save results to translation cache and memory
      currentBatchItems.forEach((item, idx) => {
        const translatedValue = batchResult[`s${idx}`];
        if (translatedValue) {
          localTranslationCache[item.originalText] = translatedValue;
          globalTranslationMemory[item.originalText] = translatedValue; // Save to global TM
        }
      });

      processedGeminiCount += currentBatchItems.length;
      const progressPercent = Math.min(
        90, // Save last 10% for packing
        Math.floor((processedGeminiCount / stringsToTranslateFromGemini.length) * 90)
      );
      updateProgress(progressPercent, {
        wordsTranslated: wordsCount,
        charactersSavedByMemory: savedChars
      });
    }

    // 6. Write translations back into the JAR
    log("Integrando las traducciones en el archivo de mod JAR...");
    
    // Group translated entries by file to edit them efficiently
    const translationsByFileIdx: Record<number, typeof textToTranslate> = {};
    textToTranslate.forEach(item => {
      if (!translationsByFileIdx[item.fileIndex]) {
        translationsByFileIdx[item.fileIndex] = [];
      }
      translationsByFileIdx[item.fileIndex].push(item);
    });

    for (const fileIdxStr of Object.keys(translationsByFileIdx)) {
      const fileIdx = parseInt(fileIdxStr);
      const { entry, type, namespace } = translatableEntries[fileIdx];
      const items = translationsByFileIdx[fileIdx];
      const entryPath = entry.entryName;
      const originalContent = entry.getData().toString("utf-8");

      let updatedContent = "";

      try {
        if (type === "lang_json") {
          // For lang json, we can merge with any existing Spanish translation, or create a brand new one
          const json = JSON.parse(originalContent);
          const translatedJson = { ...json };

          for (const item of items) {
            const translated = localTranslationCache[item.originalText];
            if (translated) {
              translatedJson[item.key] = translated;
            }
          }

          const finalJsonStr = JSON.stringify(translatedJson, null, 2);
          
          // Write Spanish variants as requested
          if (options.targetLocale === "es_es" || options.targetLocale === "both") {
            const esEsPath = `assets/${namespace}/lang/es_es.json`;
            zip.addFile(esEsPath, Buffer.from(finalJsonStr, "utf-8"));
            log(`Guardado: ${esEsPath}`);
          }
          if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
            const esMxPath = `assets/${namespace}/lang/es_mx.json`;
            zip.addFile(esMxPath, Buffer.from(finalJsonStr, "utf-8"));
            log(`Guardado: ${esMxPath}`);
          }
          task.stats.filesTranslated++;
          continue;
        } 
        
        if (type === "lang_legacy") {
          // For old flat files, translate lines and output
          const lines = originalContent.split(/\r?\n/);
          const translatedLines = [...lines];

          for (const item of items) {
            const translated = localTranslationCache[item.originalText];
            if (translated) {
              const lineIdx = parseInt(item.key.split("::")[0]);
              const keyName = item.key.substring(item.key.indexOf("::") + 2);
              translatedLines[lineIdx] = `${keyName}=${translated}`;
            }
          }

          const finalLangStr = translatedLines.join("\n");
          if (options.targetLocale === "es_es" || options.targetLocale === "both") {
            const esEsPath = `assets/${namespace}/lang/es_es.lang`;
            zip.addFile(esEsPath, Buffer.from(finalLangStr, "utf-8"));
          }
          if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
            const esMxPath = `assets/${namespace}/lang/es_mx.lang`;
            zip.addFile(esMxPath, Buffer.from(finalLangStr, "utf-8"));
          }
          task.stats.filesTranslated++;
          continue;
        }

        if (type === "metadata") {
          if (entryPath === "fabric.mod.json") {
            const json = JSON.parse(originalContent);
            for (const item of items) {
              const trans = localTranslationCache[item.originalText];
              if (trans) {
                if (item.key === "name") json.name = trans;
                if (item.key === "description") json.description = trans;
              }
            }
            zip.addFile(entryPath, Buffer.from(JSON.stringify(json, null, 2), "utf-8"));
          } 
          else if (entryPath === "pack.mcmeta") {
            const json = JSON.parse(originalContent);
            for (const item of items) {
              const trans = localTranslationCache[item.originalText];
              if (trans && item.key === "pack.description" && json.pack) {
                json.pack.description = trans;
              }
            }
            zip.addFile(entryPath, Buffer.from(JSON.stringify(json, null, 2), "utf-8"));
          } 
          else if (entryPath === "META-INF/mods.toml") {
            const lines = originalContent.split(/\r?\n/);
            for (const item of items) {
              const trans = localTranslationCache[item.originalText];
              if (trans) {
                const lineIdx = parseInt(item.key.split("::")[0]);
                const originalLine = lines[lineIdx];
                const eqIdx = originalLine.indexOf("=");
                const key = originalLine.substring(0, eqIdx).trim();
                lines[lineIdx] = `${key} = "${trans}"`;
              }
            }
            zip.addFile(entryPath, Buffer.from(lines.join("\n"), "utf-8"));
          }
          task.stats.filesTranslated++;
          continue;
        }

        // General books, advancements, or datapacks: edit JSON structure recursively
        const json = JSON.parse(originalContent);
        
        const applyJsonTranslations = (node: any, jsonPath: string): any => {
          if (node === null || node === undefined) return node;
          
          if (typeof node === "string") {
            const targetItem = items.find(it => it.key === jsonPath);
            if (targetItem) {
              const trans = localTranslationCache[node];
              if (trans) return trans;
            }
            return node;
          }
          
          if (Array.isArray(node)) {
            return node.map((el, idx) => applyJsonTranslations(el, `${jsonPath}[${idx}]`));
          }
          
          if (typeof node === "object") {
            const updatedNode: Record<string, any> = {};
            for (const k of Object.keys(node)) {
              updatedNode[k] = applyJsonTranslations(node[k], jsonPath ? `${jsonPath}.${k}` : k);
            }
            return updatedNode;
          }
          
          return node;
        };

        const translatedJsonStructure = applyJsonTranslations(json, "");
        zip.addFile(entryPath, Buffer.from(JSON.stringify(translatedJsonStructure, null, 2), "utf-8"));
        task.stats.filesTranslated++;

      } catch (err: any) {
        log(`Error al inyectar traducciones en ${entryPath}: ${err.message}`);
        task.stats.errorsCount++;
      }
    }

    // Save localized JAR to the final folder
    const outputFilePath = path.join(outputDir, task.translatedName);
    zip.writeZip(outputFilePath);
    
    task.stats.timeSpentMs = Date.now() - startTime;
    task.stats.filesIgnored = task.totalFiles - task.stats.filesTranslated;
    task.status = "completed";
    task.progress = 100;
    
    log(`¡Éxito! Mod traducido guardado en: ${outputFilePath}`);
    log(`Métricas: Archivos traducidos: ${task.stats.filesTranslated}, Palabras totales: ${task.stats.wordsTranslated}, Ahorro por TM: ${task.stats.charactersSavedByMemory} caracteres.`);
    
    task.downloadUrl = `/api/download/${task.id}`;
    return outputFilePath;

  } catch (err: any) {
    task.status = "failed";
    task.progress = 100;
    task.errors.push(err.message || String(err));
    log(`ERROR FATAL durante el proceso de traducción: ${err.message || err}`);
    throw err;
  }
}
