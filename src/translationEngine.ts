import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import os from "os";
import { GoogleGenAI, Type } from "@google/genai";

// Standard Minecraft term glossary for high-quality out-of-the-box translations
export const DEFAULT_GLOSSARY: Record<string, string> = {
  // Dimensions & Worlds
  "Overworld": "Overworld",
  "The Overworld": "El Overworld",
  "Nether": "Nether",
  "The Nether": "El Nether",
  "End": "End",
  "The End": "El End",

  // Mod Materials & Proper Names (Never translate as literal dictionary words)
  "Gobber": "Gobber",
  "End Gobber": "Gobber del End",
  "Nether Gobber": "Gobber del Nether",
  "Overworld Gobber": "Gobber del Overworld",
  "Aether": "Aether",
  "Mithril": "Mithril",
  "Tinkers": "Tinkers",
  "Create": "Create",
  "Botania": "Botania",
  "Thaumcraft": "Thaumcraft",
  "Mekanism": "Mekanism",

  // Mobs, Bosses & Entities
  "Wither": "Wither",
  "The Wither": "El Wither",
  "Wither Skeleton": "Esqueleto Wither",
  "Wither Skeleton Skull": "Cabeza de esqueleto Wither",
  "Wither Skull": "Cabeza de Wither",
  "Ender Dragon": "Dragón del End",
  "Ender": "Ender",
  "Enderman": "Enderman",
  "Endermen": "Endermen",
  "Enderite": "Enderita",
  "Piglin": "Piglin",
  "Piglins": "Piglins",
  "Piglin Brute": "Piglin bruto",
  "Creeper": "Creeper",
  "Creepers": "Creepers",
  "Zombie": "Zombi",
  "Zombies": "Zombies",
  "Skeleton": "Esqueleto",
  "Skeletons": "Esqueletos",
  "Blaze": "Blaze",
  "Shulker": "Shulker",
  "Shulkers": "Shulkers",
  "Shulker Box": "Caja de Shulker",

  // Common Minecraft Items & Crafting Components
  "End Rod": "Varilla del End",
  "Blaze Rod": "Vara de Blaze",
  "Rod": "Varilla",
  "Staff": "Bastón",
  "Wand": "Varita",
  "Ingot": "Lingote",
  "Nugget": "Pepita",
  "Ore": "Mena",
  "Raw": "Bruto",
  "Dust": "Polvo",
  "Shard": "Fragmento",
  "Gem": "Gema",
  "Crystal": "Cristal",
  "Ender Pearl": "Perla de Ender",
  "Eye of Ender": "Ojo de Ender",
  "Ender Chest": "Cofre de Ender",
  "Nether Star": "Estrella del Nether",
  "Nether Brick": "Ladrillo del Nether",
  "Nether Bricks": "Ladrillos del Nether",
  "Nether Quartz": "Cuarzo del Nether",
  "Netherite": "Inframundita",

  // Equipment & Tools
  "Pickaxe": "Pico",
  "Axe": "Hacha",
  "Shovel": "Pala",
  "Hoe": "Azada",
  "Sword": "Espada",
  "Bow": "Arco",
  "Crossbow": "Ballesta",
  "Shield": "Escudo",
  "Helmet": "Casco",
  "Chestplate": "Peto",
  "Leggings": "Grebas",
  "Boots": "Botas",
  "Pike": "Pica",
  "Pikes": "Picas",
  "Spear": "Lanza",
  "Spears": "Lanzas",
  "Scythe": "Guadaña",
  "Scythes": "Guadañas",
  "Dagger": "Daga",
  "Daggers": "Dagas",
  "Mace": "Maza",
  "Maces": "Mazas",
  "Hammer": "Martillo",
  "Hammers": "Martillos",
  "Bleeding": "Sangrado",
  "Bleeding Effect": "Efecto de sangrado",
  "Bleeding Sound": "Sonido de sangrado",
  "Electric": "Eléctrico",

  // Blocks & Environment
  "Redstone": "Redstone",
  "Glowstone": "Piedra Luminosa",
  "Bedrock": "Piedra base",
  "Obsidian": "Obsidiana",
  "Lapis Lazuli": "Lapislázuli",
  "Spawner": "Generador",
  "Elytra": "Élitros",
  "Totem": "Tótem",

  // Magic & Mechanics
  "Mana": "Maná",
  "Cooldown": "Tiempo de reutilización",
  "Spell": "Hechizo",
  "Spells": "Hechizos",
  "Spell Book": "Libro de Hechizos",
  "Keybind": "Tecla",
  "Keybinding": "Asignación de tecla",
  "Creative Tab": "Pestaña de Creativo",
  "Advancement": "Progreso",
  "Advancements": "Progresos",
  "Quest": "Misión",
  "Quests": "Misiones",
  "Loot Table": "Tabla de botín",
  "Loot Tables": "Tablas de botín",
  "Forge": "Forge",
  "NeoForge": "NeoForge",
  "Fabric": "Fabric",
  "Modpack": "Modpack"
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
  translationStyle?: "natural" | "literal";
  customGlossary: Record<string, string>;
  apiEngine?: string;
  openrouterModel?: string;
  customApiKeys?: Record<string, string>;
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
  diff?: TranslationDiffEntry[];
}

export interface TranslationDiffEntry {
  path: string;
  key: string;
  original: string;
  translated: string;
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

// Helper to convert raw snake_case item/sound/effect keys into human readable Title Case
export function formatSnakeCaseIfNeeded(val: string): string {
  if (!val || typeof val !== "string") return val;
  const trimmed = val.trim();
  // Match pure snake_case identifiers like "diamond_pike", "bleeding_sound", "emerald_pike"
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(trimmed)) {
    return trimmed
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  // Single lower_case word if it's purely letters and not a reserved keyword
  if (/^[a-z]{3,}$/.test(trimmed) && !["true", "false", "null", "none", "default"].includes(trimmed)) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

// Helper to determine if a string is untranslated English text in a language file
export function isLikelyEnglish(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed) return false;

  // Check for common English stopwords
  if (/\b(the|of|and|in|on|with|for|to|a|an|from|by|at|is|are|this|that|these|those|of the|of a)\b/i.test(trimmed)) {
    return true;
  }
  
  // Check for specific untranslated English words in Minecraft item descriptions / names
  if (/\b(Pike|Pikes|Wrath|Sanctifier|Whisper|Flare|Schulk|Bleeding|Sound|Boots|Fork|Lamentations|Gale|Piercer|Scorchfang|World|Ultimate|Sword|Shield|Axe|Pickaxe|Armor|Effect|Description)\b/i.test(trimmed)) {
    return true;
  }

  // If it's formatted as snake_case
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(trimmed)) {
    return true;
  }

  return false;
}

export interface IndexedZipEntry {
  entryName: string;
  entryNameLower: string;
  entry: any;
}

export class FastZipIndex {
  private entries: IndexedZipEntry[] = [];
  private entryMap: Map<string, any> = new Map();
  private langMap: Map<string, IndexedZipEntry[]> = new Map(); // namespace -> lang entries

  constructor(zipEntries: any[]) {
    for (const entry of zipEntries) {
      if (entry.isDirectory || entry.entryName.endsWith(".class")) continue;
      const entryName = entry.entryName;
      const entryNameLower = entryName.toLowerCase();
      const indexed: IndexedZipEntry = {
        entryName,
        entryNameLower,
        entry
      };
      this.entries.push(indexed);
      this.entryMap.set(entryName, entry);
      this.entryMap.set(entryNameLower, entry);

      const assetsMatch = entryNameLower.match(/^assets\/([a-z0-9_-]+)\/lang\/(.+)$/);
      if (assetsMatch) {
        const ns = assetsMatch[1];
        if (!this.langMap.has(ns)) {
          this.langMap.set(ns, []);
        }
        this.langMap.get(ns)!.push(indexed);
      }
    }
  }

  getEntry(pathStr: string): any {
    return this.entryMap.get(pathStr) || this.entryMap.get(pathStr.toLowerCase()) || null;
  }

  getLangEntriesForNamespace(namespace: string): IndexedZipEntry[] {
    return this.langMap.get(namespace.toLowerCase()) || [];
  }

  getAllIndexedEntries(): IndexedZipEntry[] {
    return this.entries;
  }
}

// Safe utility to overwrite an entry in AdmZip without causing duplicates
function addOrReplaceFile(zip: AdmZip, entryPath: string, content: Buffer) {
  try {
    const existing = zip.getEntry(entryPath);
    if (existing) {
      zip.deleteFile(existing);
    }
  } catch (e) {
    // Ignore error if delete fails
  }
  zip.addFile(entryPath, content);
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

function cleanTranslationPunctuation(str: string): string {
  if (!str || typeof str !== "string") return str;
  return str
    .replace(/§\s+([a-fk-or0-9])/gi, "§$1") // Fix spaced section formatting, e.g., § a -> §a
    .replace(/%\s+([sdfbincx])(?![a-záéíóúñÁÉÍÓÚÑ])/gi, "%$1") // Fix spaced percent specifiers e.g. % s -> %s, but NOT % daño or % de
    .replace(/%\s*(\d+)\s*\$\s*([sdfbincx])(?![a-záéíóúñÁÉÍÓÚÑ])/gi, "%$1$$$2") // Fix spaced parameter variables, e.g., % 1 $ s -> %1$s
    .replace(/{\s*([^}]+)\s*}/g, "{$1}");   // Fix spaced braces, e.g., { player } -> {player}
}

async function translateFreeGoogle(text: string, targetLangCode: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Free HTTP Error ${res.status}`);
  const json = await res.json();
  if (json && json[0]) {
    return json[0].map((x: any) => x[0]).join("");
  }
  throw new Error("Invalid format from Google Translate Free.");
}

async function translateWithOpenAICompatible(
  endpoint: string,
  modelName: string,
  apiKey: string,
  systemInstruction: string,
  batchPayload: Record<string, string>,
  useJsonFormat: boolean,
  headersExtra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    ...headersExtra
  };

  const body: any = {
    model: modelName,
    max_tokens: 4000,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: JSON.stringify(batchPayload) }
    ]
  };

  if (useJsonFormat) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${modelName} returned status ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("La respuesta de la API está vacía.");
  }

  let cleanContent = content;
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.substring(7);
  } else if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.substring(3);
  }
  if (cleanContent.endsWith("```")) {
    cleanContent = cleanContent.substring(0, cleanContent.length - 3);
  }
  cleanContent = cleanContent.trim();

  return JSON.parse(cleanContent);
}

async function translateWithAnthropic(
  apiKey: string,
  systemInstruction: string,
  batchPayload: Record<string, string>
): Promise<Record<string, string>> {
  const url = "https://api.anthropic.com/v1/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      system: systemInstruction + "\nOutput ONLY valid raw JSON without any markdown fences or explanations.",
      messages: [
        { role: "user", content: JSON.stringify(batchPayload) }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API returned status ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text?.trim();
  if (!content) {
    throw new Error("La respuesta de Anthropic está vacía.");
  }

  let cleanContent = content;
  if (cleanContent.startsWith("```json")) {
    cleanContent = cleanContent.substring(7);
  } else if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.substring(3);
  }
  if (cleanContent.endsWith("```")) {
    cleanContent = cleanContent.substring(0, cleanContent.length - 3);
  }
  cleanContent = cleanContent.trim();

  return JSON.parse(cleanContent);
}

/**
 * Advanced post-processor that enforces Minecraft naming conventions and rules:
 * - Proper Nouns / Material Names (e.g. "Gobber" must NOT be translated as "bocón", "boco", "boca", or "engullidor").
 * - Dimension naming rules (e.g. "End Gobber Rod" -> "Varilla de Gobber del End", "Nether Gobber" -> "Gobber del Nether", "End Rod" -> "Varilla del End").
 * - Minecraft mob & boss names (e.g. "Wither", "Ender Dragon", "Piglin", "Shulker").
 * - Item types ("Rod" -> "Varilla"/"Vara", "Ingot" -> "Lingote", "Nugget" -> "Pepita", "Ore" -> "Mena").
 */
export function postProcessMinecraftTranslation(
  originalEn: string,
  translatedEs: string,
  glossary: Record<string, string>
): string {
  if (!translatedEs || typeof translatedEs !== "string") return translatedEs;

  let result = translatedEs;

  // 1. Preserve "Gobber" material name if original contains Gobber
  if (/\bgobber\b/i.test(originalEn)) {
    // Replace Spanish dictionary mistranslations of "Gobber" (like boco, bocón, boca, engullidor)
    result = result.replace(/\b(bocón|boco|bocón abisal|boca)\b/gi, "Gobber");
    
    // Fix "Gobber final" or "Gobber de extremo" or "final Gobber" -> "Gobber del End"
    if (/\bend\b/i.test(originalEn)) {
      result = result.replace(/\bGobber\s+(final|del final|extremo|de extremo)\b/gi, "Gobber del End");
      result = result.replace(/\b(final|del final|extremo|de extremo)\s+Gobber\b/gi, "Gobber del End");
    }

    // Fix "Nether Gobber" -> "Gobber del Nether"
    if (/\bnether\b/i.test(originalEn)) {
      result = result.replace(/\bNether\s+Gobber\b/gi, "Gobber del Nether");
      result = result.replace(/\bGobber\s+Nether\b/gi, "Gobber del Nether");
      result = result.replace(/\bGobber\s+abisal\b/gi, "Gobber del Nether");
    }

    // Fix "Overworld Gobber" -> "Gobber del Overworld"
    if (/\boverworld\b/i.test(originalEn)) {
      result = result.replace(/\bOverworld\s+Gobber\b/gi, "Gobber del Overworld");
      result = result.replace(/\bGobber\s+Overworld\b/gi, "Gobber del Overworld");
    }
  }

  // 2. Fix general "final" / "extremo" -> "del End" if original contains "End" as a distinct word in Minecraft item context
  if (/\bEnd\b/i.test(originalEn) && !/\b(Ending|Ended|Ends)\b/i.test(originalEn)) {
    result = result.replace(/\b(Varilla|Vara|Barra|Pico|Espada|Casco|Peto|Grebas|Botas|Lingote|Mena|Bloque|Anillo|Amuleto|Herramienta|Cristal|Cofre|Dragón|Barco|Piedra|Polvo|Gema|Fragmento)\s+final\b/gi, "$1 del End");
    result = result.replace(/\b(Varilla|Vara|Barra|Pico|Espada|Casco|Peto|Grebas|Botas|Lingote|Mena|Bloque|Anillo|Amuleto|Herramienta|Cristal|Cofre|Dragón|Barco|Piedra|Polvo|Gema|Fragmento)\s+(de\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]+\s+)final\b/gi, "$1 $2del End");
    result = result.replace(/\bdel\s+final\b/gi, "del End");
    result = result.replace(/\bde\s+extremo\b/gi, "del End");
  }

  // 3. Fix "Nether" mistranslations as "abisal" or "infierno" in Minecraft context
  if (/\bNether\b/i.test(originalEn)) {
    result = result.replace(/\b(de\s+la\s+|del\s+)?(inframundo|infierno)\b/gi, "del Nether");
    result = result.replace(/\babisal\b/gi, "del Nether");
    result = result.replace(/\bNether\s+Nether\b/gi, "Nether");
  }

  // 4. Fix Wither / Ender mob names if mistranslated
  if (/\bWither\b/i.test(originalEn)) {
    result = result.replace(/\b(El\s+)?Marchitador\b/gi, "Wither");
    result = result.replace(/\bmarchitador\b/gi, "Wither");
  }

  // 5. Fix weapon Pikes if mistranslated as fish ("Lucio" -> "Pica")
  if (/\bpike(s)?\b/i.test(originalEn)) {
    result = result.replace(/\bLucio\s+de\s+(diamante|esmeralda|oro|hierro|piedra|netherita|inframundita)\b/gi, "Pica de $1");
    result = result.replace(/\bLucio\s+dorado\b/gi, "Pica dorada");
    result = result.replace(/\bLucio\b/gi, "Pica");
    result = result.replace(/\bLucios\b/gi, "Picas");
  }

  // 6. Fix percentage spacing, typos (e.g. "laño" -> "daño"), and concatenated stats
  // Fix "laño" or "laños" mistranslation/typo for "daño" / "daños"
  result = result.replace(/\b(l|L)año(s)?\b/g, (m, p1, p2) => (p1 === "L" ? "D" : "d") + "año" + (p2 || ""));
  
  // Fix missing spaces after % before letters (e.g., "160%daño" -> "160% daño", "100%de" -> "100% de")
  result = result.replace(/(\d+%|%)([a-záéíóúñÁÉÍÓÚÑ])/gi, "$1 $2");

  // Fix missing space after colon in stat lines (e.g., "Daño:160%" -> "Daño: 160%")
  result = result.replace(/([a-záéíóúñÁÉÍÓÚÑ]):([a-záéíóúñÁÉÍÓÚÑ0-9\+]+)/gi, "$1: $2");

  // Fix missing space after + or - signs when followed by a number/percent and word
  result = result.replace(/(\+|\-)\s*(\d+%?)\s*([a-záéíóúñÁÉÍÓÚÑ])/gi, "$1$2 $3");

  // Fix common Apotheosis / RPG attribute typos and accents
  result = result.replace(/\bgolpe\s+critico\b/gi, "golpe crítico");
  result = result.replace(/\bdaño\s+critico\b/gi, "daño crítico");
  result = result.replace(/\balcanse\b/gi, "alcance");
  result = result.replace(/\broba\s+de\s+vida\b/gi, "robo de vida");

  // 7. Apply glossary entries sorted by key length descending
  const sortedGlossary = Object.entries(glossary || {}).sort((a, b) => b[0].length - a[0].length);
  for (const [enTerm, esTerm] of sortedGlossary) {
    if (!enTerm) continue;
    const origRegex = new RegExp(`\\b${enTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (origRegex.test(originalEn)) {
      const targetRegex = new RegExp(`\\b${enTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "gi");
      if (targetRegex.test(result)) {
        result = result.replace(targetRegex, esTerm);
      }
    }
  }

  return result;
}

function finalizeTranslations(
  batch: Record<string, string>,
  rawDict: Record<string, string>,
  glossary: Record<string, string>
): Record<string, string> {
  const finalDict: Record<string, string> = {};
  for (const key of Object.keys(batch)) {
    const orig = batch[key] || "";
    const rawVal = rawDict[key] !== undefined ? rawDict[key] : orig;
    const cleaned = cleanTranslationPunctuation(rawVal);
    finalDict[key] = postProcessMinecraftTranslation(orig, cleaned, glossary);
  }
  return finalDict;
}

// Translates a batch of strings using the configured API Engine
async function translateBatch(
  batch: Record<string, string>,
  glossary: Record<string, string>,
  targetLangName: string,
  options: TranslationOptions,
  logFn: (msg: string) => void
): Promise<Record<string, string>> {
  const keys = Object.keys(batch);
  if (keys.length === 0) return {};

  const engine = options.apiEngine || "gemini";
  const customKeys = options.customApiKeys || {};

  // Build the glossary text to instruct models
  const glossaryText = Object.entries(glossary)
    .map(([en, es]) => `- "${en}" -> "${es}"`)
    .join("\n");

  const isLiteral = options.translationStyle === "literal";
  const styleDescription = isLiteral
    ? "5. Translation Style: Provide a more LITERAL translation. Stay as close as possible to the original English wording, word order, and phrasing, ensuring it remains grammatically correct in Spanish."
    : "5. Translation Style: Provide a more NATURAL and IDIOMATIC translation. Focus on localizing the phrasing, idioms, and expression flow so it sounds like an organic, professional game localization, rather than a word-for-word translation.";

  const systemInstruction = `You are a master Minecraft Mod Translator specializing in authentic Spanish game localization.
Your task is to translate values from English to ${targetLangName}.

MINECRAFT LOCALIZATION & PROPER NOUN LOGIC:
- Material Names & Proper Nouns: NEVER translate mod material names or brand names into dictionary words. (e.g. "Gobber" is a custom mod material and MUST remain "Gobber"; never translate it to "bocón", "boco", "boca", or "engullidor").
- Dimensions: Keep "End", "Nether", and "Overworld" as standard Minecraft dimension terms in item/mob names:
  * "End Gobber Rod" -> "Varilla de Gobber del End" (or "Vara de Gobber del End")
  * "Gobber Rod" -> "Varilla de Gobber" (or "Vara de Gobber")
  * "Nether Gobber" -> "Gobber del Nether"
  * "Overworld Gobber" -> "Gobber del Overworld"
- Iconic Mobs & Bosses: Keep "Wither", "Ender Dragon", "Enderman", "Piglin", "Shulker", "Creeper", "Blaze" in recognized forms:
  * "Wither Skeleton Skull" -> "Cabeza de esqueleto Wither"
  * "Wither Skull" -> "Cabeza de Wither"
  * "Ender Chest" -> "Cofre de Ender"
  * "Ender Pearl" -> "Perla de Ender"
  * "End Rod" -> "Varilla del End"
- Standard Crafting Terms & RPG Stats:
  * "Rod" -> "Varilla" / "Vara"
  * "Ingot" -> "Lingote"
  * "Nugget" -> "Pepita"
  * "Ore" -> "Mena"
  * "Raw" -> "Bruto"
  * Equipment: "Pico", "Hacha", "Pala", "Azada", "Espada", "Casco", "Peto", "Grebas", "Botas"
  * Percentages & Stats (e.g. Apotheosis, RPG mods): ALWAYS keep a clear space between '%' and words (e.g., "+160% de daño adicional" or "160% daño adicional", NEVER "160%daño" or "160%laño").
  * Use "daño" for damage (NEVER "laño"). Keep proper spacing after colons and symbols (e.g., "Daño de ataque: +5", "Probabilidad de golpe crítico").

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
4. Translate only human-readable text visible to players. Keep the tone natural, engaging, and faithful to standard Minecraft Spanish community conventions.
${styleDescription}
6. You MUST return a JSON object with the exact same keys as the input. Do NOT omit any keys or alter their names. Output ONLY the valid JSON object.`;

  try {
    if (engine === "google_free" || options.apiEngine === "google_free") {
      const rawResult: Record<string, string> = {};
      const targetCode = targetLangName.toLowerCase().includes("mx") ? "es" : "es";
      
      // Process in small controlled sequential slices of 5 keys to prevent rate limits
      const sliceSize = 5;
      for (let i = 0; i < keys.length; i += sliceSize) {
        const sliceKeys = keys.slice(i, i + sliceSize);
        await Promise.all(
          sliceKeys.map(async (key) => {
            const originalText = batch[key];
            try {
              let translated = await translateFreeGoogle(originalText, targetCode);
              rawResult[key] = translated;
            } catch (e: any) {
              logFn(`Advertencia: Falló Google gratis para "${originalText}". Usando original.`);
              rawResult[key] = originalText;
            }
          })
        );
      }
      return finalizeTranslations(batch, rawResult, glossary);
    }

    if (engine === "google_cloud") {
      const apiKey = customKeys.google_cloud;
      if (!apiKey) {
        throw new Error("Clave API de Google Cloud Translation no configurada.");
      }
      
      const batchArray = keys.map(k => batch[k]);
      const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: batchArray,
          target: "es",
          source: "en",
          format: "text"
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Cloud API error (${response.status}): ${errText}`);
      }
      
      const data = await response.json();
      const translations = data?.data?.translations;
      if (!translations || translations.length !== batchArray.length) {
        throw new Error("La respuesta de Google Cloud está incompleta.");
      }
      
      const rawResult: Record<string, string> = {};
      keys.forEach((key, idx) => {
        rawResult[key] = translations[idx].translatedText;
      });
      return finalizeTranslations(batch, rawResult, glossary);
    }

    if (engine === "openai") {
      const apiKey = customKeys.openai;
      if (!apiKey) throw new Error("Clave API de OpenAI no configurada.");
      const res = await translateWithOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        "gpt-4o-mini",
        apiKey,
        systemInstruction,
        batch,
        true
      );
      return finalizeTranslations(batch, res, glossary);
    }

    if (engine === "deepseek") {
      const apiKey = customKeys.deepseek;
      if (!apiKey) throw new Error("Clave API de DeepSeek no configurada.");
      const res = await translateWithOpenAICompatible(
        "https://api.deepseek.com/chat/completions",
        "deepseek-chat",
        apiKey,
        systemInstruction,
        batch,
        true
      );
      return finalizeTranslations(batch, res, glossary);
    }

    if (engine === "groq") {
      const apiKey = customKeys.groq;
      if (!apiKey) throw new Error("Clave API de Groq no configurada.");
      const res = await translateWithOpenAICompatible(
        "https://api.groq.com/openapi/v1/chat/completions",
        "llama-3.1-8b-instant",
        apiKey,
        systemInstruction,
        batch,
        true
      );
      return finalizeTranslations(batch, res, glossary);
    }

    if (engine === "openrouter") {
      const apiKey = customKeys.openrouter;
      if (!apiKey) throw new Error("Clave API de OpenRouter no configurada.");
      const openModel = options.openrouterModel || "google/gemini-2.5-flash";
      const res = await translateWithOpenAICompatible(
        "https://openrouter.ai/api/v1/chat/completions",
        openModel,
        apiKey,
        systemInstruction,
        batch,
        false,
        { "HTTP-Referer": "https://ai.studio/build" }
      );
      return finalizeTranslations(batch, res, glossary);
    }

    if (engine === "anthropic") {
      const apiKey = customKeys.anthropic;
      if (!apiKey) throw new Error("Clave API de Anthropic Claude no configurada.");
      const res = await translateWithAnthropic(apiKey, systemInstruction, batch);
      return finalizeTranslations(batch, res, glossary);
    }

    // Default to Gemini API
    const ai = getAi();
    let response;
    let attempts = 0;
    const maxAttempts = 3; // Fast failover to Google Translate if quota reached
    const initialDelayMs = 2000;

    while (attempts < maxAttempts) {
      try {
        response = await ai.models.generateContent({
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
        break; // Success, exit retry loop
      } catch (err: any) {
        attempts++;
        const errMsg = err.message || JSON.stringify(err);
        const isQuota = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("402");
        
        if (attempts >= maxAttempts || isQuota) {
          throw err; // Re-throw to trigger sub-batching or google_free fallback
        }
        
        const waitMs = initialDelayMs * Math.pow(2, attempts - 1) + Math.random() * 1000;
        logFn(`[Intento ${attempts}/${maxAttempts}] Error con Gemini API: ${errMsg.substring(0, 150)}. Esperando ${Math.round(waitMs / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

    const text = response?.text?.trim();
    if (!text) {
      throw new Error("La respuesta de Gemini está vacía o no es válida.");
    }

    const result = JSON.parse(text) as Record<string, string>;
    return finalizeTranslations(batch, result, glossary);
  } catch (error: any) {
    const errorStr = error?.message || String(error);
    const isTokenOrQuota = errorStr.includes("402") || errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("credits") || errorStr.includes("tokens");

    // 1. If batch is large (>5), try fragmenting into smaller sub-batches first
    if (keys.length > 5 && !isTokenOrQuota) {
      logFn(`[Aviso] Error en lote con motor ${engine} (${errorStr.substring(0, 100)}). Fragmentando lote de ${keys.length} elementos en sub-lotes de 5...`);
      const subResult: Record<string, string> = {};
      const subKeys = keys;
      for (let i = 0; i < subKeys.length; i += 5) {
        const chunkKeys = subKeys.slice(i, i + 5);
        const chunkBatch: Record<string, string> = {};
        chunkKeys.forEach(k => { chunkBatch[k] = batch[k]; });
        const res = await translateBatch(chunkBatch, glossary, targetLangName, options, logFn);
        Object.assign(subResult, res);
      }
      return subResult;
    }

    // 2. If token/quota exhausted or sub-batch failed, automatically fall back to Google Translate Free!
    logFn(`[Aviso Automático] Límite de tokens o cuota excedida en motor "${engine}" (${errorStr.substring(0, 120)}). Conmutando automáticamente a Google Translate (Motor Gratis) para completar todas las traducciones.`);
    
    // Mutate engine in options so subsequent batches in this task also use google_free
    options.apiEngine = "google_free";

    // Recursively execute with google_free
    return await translateBatch(batch, glossary, targetLangName, options, logFn);
  }
}

// TOML Metadata Parsing & Safe Rebuilding Helpers
export interface TomlExtractedItem {
  startLine: number;
  endLine: number;
  keyName: string;
  quoteType: '"""' | "'''" | '"' | "'";
  value: string;
  comment?: string;
}

export function extractTomlStrings(content: string): TomlExtractedItem[] {
  const lines = content.split(/\r?\n/);
  const results: TomlExtractedItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith("#")) continue;

    if (line.startsWith("displayName") || line.startsWith("description") || line.startsWith("display_name")) {
      const eqIdx = rawLine.indexOf("=");
      if (eqIdx === -1) continue;

      const keyName = rawLine.substring(0, eqIdx).trim();
      let valRest = rawLine.substring(eqIdx + 1).trim();

      // Fix accidental double opening quotes if present in source (e.g. ""Gobber 2")
      if (valRest.startsWith('""') && !valRest.startsWith('"""')) {
        valRest = valRest.substring(1);
      } else if (valRest.startsWith("''") && !valRest.startsWith("'''")) {
        valRest = valRest.substring(1);
      }

      // Check for triple quote (multiline)
      if (valRest.startsWith('"""') || valRest.startsWith("'''")) {
        const triple = valRest.substring(0, 3) as '"""' | "'''";
        const afterTriple = valRest.substring(3);

        const closingIdx = afterTriple.indexOf(triple);
        if (closingIdx !== -1) {
          const valText = afterTriple.substring(0, closingIdx);
          const comment = afterTriple.substring(closingIdx + 3);
          results.push({ startLine: i, endLine: i, keyName, quoteType: triple, value: valText, comment });
        } else {
          const multilineParts: string[] = [];
          if (afterTriple.length > 0) multilineParts.push(afterTriple);

          let endLine = i;
          let comment = "";
          for (let j = i + 1; j < lines.length; j++) {
            const nextLineRaw = lines[j];
            const closePos = nextLineRaw.indexOf(triple);
            if (closePos !== -1) {
              endLine = j;
              const beforeClose = nextLineRaw.substring(0, closePos);
              if (beforeClose.length > 0) multilineParts.push(beforeClose);
              comment = nextLineRaw.substring(closePos + 3);
              break;
            } else {
              multilineParts.push(nextLineRaw);
            }
          }
          results.push({ startLine: i, endLine, keyName, quoteType: triple, value: multilineParts.join("\n"), comment });
          i = endLine;
        }
      }
      // Single line quote
      else if (valRest.startsWith('"') || valRest.startsWith("'")) {
        const quote = valRest[0] as '"' | "'";
        // Search for closing quote matching `quote`
        let closeIdx = -1;
        let escaped = false;
        for (let k = 1; k < valRest.length; k++) {
          const ch = valRest[k];
          if (escaped) {
            escaped = false;
          } else if (ch === '\\') {
            escaped = true;
          } else if (ch === quote) {
            closeIdx = k;
            break;
          }
        }

        if (closeIdx > 0) {
          const valText = valRest.substring(1, closeIdx);
          const comment = valRest.substring(closeIdx + 1);
          results.push({ startLine: i, endLine: i, keyName, quoteType: quote, value: valText, comment });
        }
      }
    }
  }

  return results;
}

import { parse as parseToml } from "smol-toml";
import { autoRepairTomlSyntax } from "./utils/tomlValidator";

function sanitizeTomlValue(text: string, quoteType: string): string {
  if (!text) return "";
  let clean = text.trim();

  // If the string is enclosed in matching quotes, strip them
  if ((clean.startsWith('"') && clean.endsWith('"') && clean.length >= 2) ||
      (clean.startsWith("'") && clean.endsWith("'") && clean.length >= 2)) {
    clean = clean.substring(1, clean.length - 1).trim();
  }

  // Remove leading/trailing duplicate quotes matching quoteType
  if (quoteType === '"' || quoteType === "'") {
    while (clean.startsWith(quoteType)) {
      clean = clean.substring(1).trim();
    }
    while (clean.endsWith(quoteType) && !clean.endsWith("\\" + quoteType)) {
      clean = clean.substring(0, clean.length - 1).trim();
    }
  }

  return clean;
}

export function applyTomlTranslations(content: string, itemsToReplace: { item: TomlExtractedItem; newText: string }[]): string {
  const lines = content.split(/\r?\n/);

  itemsToReplace.sort((a, b) => b.item.startLine - a.item.startLine);

  for (const { item, newText } of itemsToReplace) {
    const { startLine, endLine, keyName, quoteType, comment } = item;
    const cleanText = sanitizeTomlValue(newText, quoteType);

    let replacementLines: string[] = [];
    const commentSuffix = comment && comment.trim().length > 0 ? (comment.startsWith(" ") ? comment : ` ${comment}`) : "";

    if (quoteType === '"""' || quoteType === "'''") {
      replacementLines = [
        `${keyName} = ${quoteType}`,
        cleanText,
        `${quoteType}${commentSuffix}`
      ];
    } else {
      const escaped = cleanText.replace(/\\/g, "\\\\").replace(new RegExp(quoteType === '"' ? '"' : "'", "g"), "\\" + quoteType);
      replacementLines = [`${keyName} = ${quoteType}${escaped}${quoteType}${commentSuffix}`];
    }

    const deleteCount = endLine - startLine + 1;
    lines.splice(startLine, deleteCount, ...replacementLines);
  }

  const result = lines.join("\n");

  // Validate resulting TOML syntax using smol-toml
  try {
    parseToml(result);
    return result;
  } catch (err: any) {
    console.warn(`[TOML Auto-Fix] Sintaxis TOML modificada defectuosa (${err?.message}). Intentando reparación automática...`);
    const repaired = autoRepairTomlSyntax(result);
    try {
      parseToml(repaired);
      return repaired;
    } catch (err2) {
      console.error(`[TOML Safety Fallback] No se pudo reparar automáticamente el TOML. Conservando versión original intacta para evitar fallos en Minecraft.`);
      return content;
    }
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
    const rawEntries = zip.getEntries();
    const fastIndex = new FastZipIndex(rawEntries);
    const entries = fastIndex.getAllIndexedEntries();
    task.totalFiles = rawEntries.length;
    log(`Se han encontrado ${rawEntries.length} archivos dentro del mod.`);

    // 2. Identify and categorise files
    const translatableEntries: { entry: any; type: string; namespace: string }[] = [];
    
    for (const indexed of entries) {
      const entry = indexed.entry;
      const entryPath = indexed.entryName;
      
      // Extract namespace if possible (e.g. assets/<namespace>/...)
      const assetsMatch = entryPath.match(/^assets\/([a-zA-Z0-9_-]+)\/(.+)$/);
      const dataMatch = entryPath.match(/^data\/([a-zA-Z0-9_-]+)\/(.+)$/);
      
      // Category 1: Lang files (Include ALL .json or .lang files in assets/<namespace>/lang/)
      if (options.translateLang || options.translateAll) {
        if (assetsMatch && assetsMatch[2].startsWith("lang/")) {
          if (assetsMatch[2].endsWith(".json")) {
            translatableEntries.push({ entry, type: "lang_json", namespace: assetsMatch[1] });
            continue;
          }
          if (assetsMatch[2].endsWith(".lang")) {
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

      // Category 6: Mod Metadata (mods.toml, neoforge.mods.toml, fabric.mod.json, pack.mcmeta)
      if (entryPath === "META-INF/mods.toml" || entryPath === "META-INF/neoforge.mods.toml" || entryPath === "fabric.mod.json" || entryPath === "pack.mcmeta") {
        translatableEntries.push({ entry, type: "metadata", namespace: "global" });
        continue;
      }

      // Category 7: Fallback general JSONs if translateAll is enabled
      if (options.translateAll) {
        if (entryPath.endsWith(".json") && !translatableEntries.some(e => e.entry.entryName === entryPath)) {
          translatableEntries.push({ entry, type: "general_json", namespace: assetsMatch ? assetsMatch[1] : (dataMatch ? dataMatch[1] : "global") });
          continue;
        }
      }
    }

    log(`Archivos detectados para traducción inteligente: ${translatableEntries.length}`);
    if (translatableEntries.length === 0) {
      log("No se encontraron archivos de texto translicibles con las opciones seleccionadas. No es necesario realizar cambios.");
      task.status = "completed";
      task.progress = 100;
      task.stats.timeSpentMs = Date.now() - startTime;
      task.stats.filesTranslated = 0;
      task.stats.filesIgnored = task.totalFiles;
      return "";
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
          
          // Check for existing target lang JSON files to perform gap-analysis & correction
          const esEsPath = `assets/${namespace}/lang/es_es.json`;
          const esMxPath = `assets/${namespace}/lang/es_mx.json`;
          
          let existingEsEs: Record<string, string> = {};
          let existingEsMx: Record<string, string> = {};
          
          const esEsPathsFound = new Set<string>([esEsPath]);
          const esMxPathsFound = new Set<string>([esMxPath]);
          
          const langEntries = fastIndex.getLangEntriesForNamespace(namespace);
          for (const langEnt of langEntries) {
            const baseName = path.basename(langEnt.entryNameLower);
            try {
              const parsed = JSON.parse(langEnt.entry.getData().toString("utf-8"));
              if (baseName.includes("es__es") || baseName.includes("es-es") || baseName.includes("es_es") || baseName === "es.json") {
                esEsPathsFound.add(langEnt.entryName);
                existingEsEs = { ...existingEsEs, ...parsed };
              }
              if (baseName.includes("es__mx") || baseName.includes("es-mx") || baseName.includes("es_mx")) {
                esMxPathsFound.add(langEnt.entryName);
                existingEsMx = { ...existingEsMx, ...parsed };
              }
            } catch (e) {}
          }
          
          for (const key of Object.keys(json)) {
            const rawVal = json[key];
            if (typeof rawVal === "string") {
              const formattedVal = formatSnakeCaseIfNeeded(rawVal);
              let needsTranslateForEsEs = false;
              let needsTranslateForEsMx = false;
              
              if (options.targetLocale === "es_es" || options.targetLocale === "both") {
                const existingVal = existingEsEs[key];
                if (!existingVal || (existingVal === rawVal && isTranslatableString(rawVal)) || isLikelyEnglish(existingVal)) {
                  needsTranslateForEsEs = true;
                }
              }
              
              if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
                const existingVal = existingEsMx[key];
                if (!existingVal || (existingVal === rawVal && isTranslatableString(rawVal)) || isLikelyEnglish(existingVal)) {
                  needsTranslateForEsMx = true;
                }
              }
              
              if ((needsTranslateForEsEs || needsTranslateForEsMx) && isTranslatableString(formattedVal)) {
                textToTranslate.push({ fileIndex: i, path: entryPath, key, originalText: formattedVal });
              }
            }
          }
        } 
        else if (type === "lang_legacy") {
          // Flat key=value properties file
          const lines = content.split(/\r?\n/);
          
          const esEsPath = `assets/${namespace}/lang/es_es.lang`;
          const esMxPath = `assets/${namespace}/lang/es_mx.lang`;
          
          let existingEsEsMap: Record<string, string> = {};
          let existingEsMxMap: Record<string, string> = {};
          
          const parseLegacyLang = (fileContent: string) => {
            const map: Record<string, string> = {};
            const lines = fileContent.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
              const eqIdx = trimmed.indexOf("=");
              const key = trimmed.substring(0, eqIdx).trim();
              const val = trimmed.substring(eqIdx + 1).trim();
              map[key] = val;
            }
            return map;
          };

          const esEsLangPathsFound = new Set<string>([esEsPath]);
          const esMxLangPathsFound = new Set<string>([esMxPath]);
          
          const langEntries = fastIndex.getLangEntriesForNamespace(namespace);
          for (const langEnt of langEntries) {
            const baseName = path.basename(langEnt.entryNameLower);
            try {
              if (baseName.includes("es__es") || baseName.includes("es-es") || baseName.includes("es_es") || baseName === "es.lang") {
                esEsLangPathsFound.add(langEnt.entryName);
                const parsed = parseLegacyLang(langEnt.entry.getData().toString("utf-8"));
                existingEsEsMap = { ...existingEsEsMap, ...parsed };
              }
              if (baseName.includes("es__mx") || baseName.includes("es-mx") || baseName.includes("es_mx")) {
                esMxLangPathsFound.add(langEnt.entryName);
                const parsed = parseLegacyLang(langEnt.entry.getData().toString("utf-8"));
                existingEsMxMap = { ...existingEsMxMap, ...parsed };
              }
            } catch (e) {}
          }
          
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx].trim();
            if (!line || line.startsWith("#") || !line.includes("=")) continue;
            
            const eqIdx = line.indexOf("=");
            const key = line.substring(0, eqIdx).trim();
            const rawVal = line.substring(eqIdx + 1).trim();
            const formattedVal = formatSnakeCaseIfNeeded(rawVal);
            
            if (isTranslatableString(formattedVal)) {
              let needsTranslateForEsEs = false;
              let needsTranslateForEsMx = false;
              
              if (options.targetLocale === "es_es" || options.targetLocale === "both") {
                const existingVal = existingEsEsMap[key];
                if (!existingVal || (existingVal === rawVal && isTranslatableString(rawVal)) || isLikelyEnglish(existingVal)) {
                  needsTranslateForEsEs = true;
                }
              }
              
              if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
                const existingVal = existingEsMxMap[key];
                if (!existingVal || (existingVal === rawVal && isTranslatableString(rawVal)) || isLikelyEnglish(existingVal)) {
                  needsTranslateForEsMx = true;
                }
              }
              
              if ((needsTranslateForEsEs || needsTranslateForEsMx) && isTranslatableString(formattedVal)) {
                textToTranslate.push({ fileIndex: i, path: entryPath, key: `${lineIdx}::${key}`, originalText: formattedVal });
              }
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
          else if (entryPath === "META-INF/mods.toml" || entryPath === "META-INF/neoforge.mods.toml" || entryPath.endsWith(".toml")) {
            const tomlItems = extractTomlStrings(content);
            for (let idx = 0; idx < tomlItems.length; idx++) {
              const item = tomlItems[idx];
              if (isTranslatableString(item.value)) {
                textToTranslate.push({ fileIndex: i, path: entryPath, key: `${idx}::toml_index`, originalText: item.value });
              }
            }
          }
        } 
        else {
          // General JSON files (advancements, patchouli books, loot tables, recipes, JEI, dialogs, etc.)
          const json = JSON.parse(content);
          
          const scanJsonNode = (node: any, jsonPath: string) => {
            if (node === null || node === undefined) return;
            
            if (typeof node === "string") {
              const lastKey = jsonPath.split(".").pop() || "";
              const translatableKeys = [
                "name", "text", "description", "title", "subtitle", "lore", "pages", "message",
                "tooltip", "header", "info", "information", "details", "comment", "label", "effect",
                "subtitles", "summary", "prompt", "dialog", "pikes", "weapon", "ability", "guide",
                "entry", "content", "body", "bio", "flavor", "desc", "jei", "sound"
              ];
              
              const isTargetKey = translatableKeys.some(tk => lastKey.toLowerCase().includes(tk));
              const formattedNode = formatSnakeCaseIfNeeded(node);
              if ((isTargetKey || (formattedNode.includes(" ") && isTranslatableString(formattedNode))) && isTranslatableString(formattedNode)) {
                textToTranslate.push({ fileIndex: i, path: entryPath, key: jsonPath, originalText: formattedNode });
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
    if (textToTranslate.length === 0) {
      log("¡El mod ya se encuentra completamente traducido al idioma deseado! No es necesario realizar cambios.");
      task.status = "completed";
      task.progress = 100;
      task.stats.timeSpentMs = Date.now() - startTime;
      task.stats.filesTranslated = 0;
      task.stats.filesIgnored = task.totalFiles;
      return "";
    }
    
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
      
      const batchResult = await translateBatch(batchPayload, glossary, targetLangName, options, log);
      
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

      try {
        if (type === "lang_json") {
          // For lang json, we merge with any existing Spanish translation or create a brand new one
          const json = JSON.parse(originalContent);
          
          const esEsPath = `assets/${namespace}/lang/es_es.json`;
          const esMxPath = `assets/${namespace}/lang/es_mx.json`;
          
          let existingEsEs: Record<string, string> = {};
          let existingEsMx: Record<string, string> = {};
          
          const esEsPathsFound = new Set<string>([esEsPath]);
          const esMxPathsFound = new Set<string>([esMxPath]);
          
          const langEntries = fastIndex.getLangEntriesForNamespace(namespace);
          for (const langEnt of langEntries) {
            const baseName = path.basename(langEnt.entryNameLower);
            try {
              const parsed = JSON.parse(langEnt.entry.getData().toString("utf-8"));
              if (baseName.includes("es__es") || baseName.includes("es-es") || baseName.includes("es_es") || baseName === "es.json") {
                esEsPathsFound.add(langEnt.entryName);
                existingEsEs = { ...existingEsEs, ...parsed };
              }
              if (baseName.includes("es__mx") || baseName.includes("es-mx") || baseName.includes("es_mx")) {
                esMxPathsFound.add(langEnt.entryName);
                existingEsMx = { ...existingEsMx, ...parsed };
              }
            } catch (e) {}
          }

          const finalEsEs = { ...existingEsEs };
          const finalEsMx = { ...existingEsMx };
          
          let esEsChanged = false;
          let esMxChanged = false;
          
          // For every key in the json, merge translation
          for (const key of Object.keys(json)) {
            const rawVal = json[key];
            if (typeof rawVal !== "string") continue;
            const formattedVal = formatSnakeCaseIfNeeded(rawVal);
            const translated = localTranslationCache[formattedVal] || localTranslationCache[rawVal];
            
            if (options.targetLocale === "es_es" || options.targetLocale === "both") {
              const currentEsEs = finalEsEs[key];
              if (!currentEsEs || (currentEsEs === rawVal && isTranslatableString(rawVal)) || isLikelyEnglish(currentEsEs)) {
                const newVal = translated || formattedVal || rawVal;
                if (currentEsEs !== newVal) {
                  finalEsEs[key] = newVal;
                  esEsChanged = true;
                }
              }
            }
            
            if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
              const currentEsMx = finalEsMx[key];
              if (!currentEsMx || (currentEsMx === rawVal && isTranslatableString(rawVal)) || isLikelyEnglish(currentEsMx)) {
                const newVal = translated || formattedVal || rawVal;
                if (currentEsMx !== newVal) {
                  finalEsMx[key] = newVal;
                  esMxChanged = true;
                }
              }
            }
          }
          
          if (options.targetLocale === "es_es" || options.targetLocale === "both") {
            for (const pathFound of esEsPathsFound) {
              const exists = fastIndex.getEntry(pathFound) !== null;
              if (!exists || esEsChanged) {
                const finalJsonStr = JSON.stringify(finalEsEs, null, 2);
                addOrReplaceFile(zip, pathFound, Buffer.from(finalJsonStr, "utf-8"));
                log(`Guardado (fusionado): ${pathFound}`);
                task.stats.filesTranslated++;
              }
            }
          }
          
          if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
            for (const pathFound of esMxPathsFound) {
              const exists = fastIndex.getEntry(pathFound) !== null;
              if (!exists || esMxChanged) {
                const finalJsonStr = JSON.stringify(finalEsMx, null, 2);
                addOrReplaceFile(zip, pathFound, Buffer.from(finalJsonStr, "utf-8"));
                log(`Guardado (fusionado): ${pathFound}`);
                task.stats.filesTranslated++;
              }
            }
          }

          // If entryPath is a custom lang file (e.g., indomita_furia.json), write translated keys directly into it as well
          if (entryPath && !esEsPathsFound.has(entryPath) && !esMxPathsFound.has(entryPath)) {
            try {
              const customObj = JSON.parse(originalContent);
              let customChanged = false;
              for (const key of Object.keys(customObj)) {
                const origVal = customObj[key];
                if (typeof origVal !== "string") continue;
                const formattedOrig = formatSnakeCaseIfNeeded(origVal);
                const translated = localTranslationCache[formattedOrig] || localTranslationCache[origVal];
                if (translated && customObj[key] !== translated) {
                  customObj[key] = translated;
                  customChanged = true;
                }
              }
              if (customChanged) {
                addOrReplaceFile(zip, entryPath, Buffer.from(JSON.stringify(customObj, null, 2), "utf-8"));
                log(`Guardado (archivo de idioma personalizado): ${entryPath}`);
                task.stats.filesTranslated++;
              }
            } catch (e) {}
          }
          continue;
        } 
        
        if (type === "lang_legacy") {
          // Flat key=value properties file
          const lines = originalContent.split(/\r?\n/);
          
          const esEsPath = `assets/${namespace}/lang/es_es.lang`;
          const esMxPath = `assets/${namespace}/lang/es_mx.lang`;
          
          let existingEsEsMap: Record<string, string> = {};
          let existingEsMxMap: Record<string, string> = {};
          
          const parseLegacyLang = (fileContent: string) => {
            const map: Record<string, string> = {};
            const lines = fileContent.split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
              const eqIdx = trimmed.indexOf("=");
              const key = trimmed.substring(0, eqIdx).trim();
              const val = trimmed.substring(eqIdx + 1).trim();
              map[key] = val;
            }
            return map;
          };

          const esEsLangPathsFound = new Set<string>([esEsPath]);
          const esMxLangPathsFound = new Set<string>([esMxPath]);
          
          const langEntries = fastIndex.getLangEntriesForNamespace(namespace);
          for (const langEnt of langEntries) {
            const baseName = path.basename(langEnt.entryNameLower);
            try {
              if (baseName.includes("es__es") || baseName.includes("es-es") || baseName.includes("es_es") || baseName === "es.lang") {
                esEsLangPathsFound.add(langEnt.entryName);
                const parsed = parseLegacyLang(langEnt.entry.getData().toString("utf-8"));
                existingEsEsMap = { ...existingEsEsMap, ...parsed };
              }
              if (baseName.includes("es__mx") || baseName.includes("es-mx") || baseName.includes("es_mx")) {
                esMxLangPathsFound.add(langEnt.entryName);
                const parsed = parseLegacyLang(langEnt.entry.getData().toString("utf-8"));
                existingEsMxMap = { ...existingEsMxMap, ...parsed };
              }
            } catch (e) {}
          }

          for (const pathFound of esEsLangPathsFound) {
            try {
              const entry = zip.getEntry(pathFound);
              if (entry) {
                const parsed = parseLegacyLang(entry.getData().toString("utf-8"));
                existingEsEsMap = { ...existingEsEsMap, ...parsed };
              }
            } catch (e) {}
          }
          
          for (const pathFound of esMxLangPathsFound) {
            try {
              const entry = zip.getEntry(pathFound);
              if (entry) {
                const parsed = parseLegacyLang(entry.getData().toString("utf-8"));
                existingEsMxMap = { ...existingEsMxMap, ...parsed };
              }
            } catch (e) {}
          }
          
          const buildMergedLegacyLines = (existingMap: Record<string, string>, targetLocale: string, changedRef: { changed: boolean }) => {
            const outputLines: string[] = [];
            for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
              const line = lines[lineIdx];
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
                outputLines.push(line);
                continue;
              }
              const eqIdx = line.indexOf("=");
              const key = line.substring(0, eqIdx).trim();
              const val = line.substring(eqIdx + 1).trim();
              
              const currentExisting = existingMap[key];
              if (currentExisting && !(currentExisting === val && isTranslatableString(val))) {
                outputLines.push(`${key}=${currentExisting}`);
              } else {
                const translated = localTranslationCache[val];
                if (translated && translated !== val) {
                  outputLines.push(`${key}=${translated}`);
                  changedRef.changed = true;
                } else {
                  outputLines.push(`${key}=${val}`);
                }
              }
            }
            return outputLines.join("\n");
          };
          
          if (options.targetLocale === "es_es" || options.targetLocale === "both") {
            const changedObj = { changed: false };
            const finalLangStr = buildMergedLegacyLines(existingEsEsMap, "es_es", changedObj);
            for (const pathFound of esEsLangPathsFound) {
              const exists = zip.getEntry(pathFound) !== null;
              if (!exists || changedObj.changed) {
                addOrReplaceFile(zip, pathFound, Buffer.from(finalLangStr, "utf-8"));
                log(`Guardado (fusionado): ${pathFound}`);
                task.stats.filesTranslated++;
              }
            }
          }
          
          if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
            const changedObj = { changed: false };
            const finalLangStr = buildMergedLegacyLines(existingEsMxMap, "es_mx", changedObj);
            for (const pathFound of esMxLangPathsFound) {
              const exists = zip.getEntry(pathFound) !== null;
              if (!exists || changedObj.changed) {
                addOrReplaceFile(zip, pathFound, Buffer.from(finalLangStr, "utf-8"));
                log(`Guardado (fusionado): ${pathFound}`);
                task.stats.filesTranslated++;
              }
            }
          }
          continue;
        }

        if (type === "metadata") {
          let hasChanged = false;
          if (entryPath === "fabric.mod.json") {
            const json = JSON.parse(originalContent);
            for (const item of items) {
              const trans = localTranslationCache[item.originalText];
              if (trans && trans !== item.originalText) {
                if (item.key === "name" && json.name !== trans) {
                  json.name = trans;
                  hasChanged = true;
                }
                if (item.key === "description" && json.description !== trans) {
                  json.description = trans;
                  hasChanged = true;
                }
              }
            }
            if (hasChanged) {
              addOrReplaceFile(zip, entryPath, Buffer.from(JSON.stringify(json, null, 2), "utf-8"));
              task.stats.filesTranslated++;
              log(`Guardado: ${entryPath}`);
            }
          } 
          else if (entryPath === "pack.mcmeta") {
            const json = JSON.parse(originalContent);
            for (const item of items) {
              const trans = localTranslationCache[item.originalText];
              if (trans && item.key === "pack.description" && json.pack && json.pack.description !== trans) {
                json.pack.description = trans;
                hasChanged = true;
              }
            }
            if (hasChanged) {
              addOrReplaceFile(zip, entryPath, Buffer.from(JSON.stringify(json, null, 2), "utf-8"));
              task.stats.filesTranslated++;
              log(`Guardado: ${entryPath}`);
            }
          } 
          else if (entryPath === "META-INF/mods.toml" || entryPath === "META-INF/neoforge.mods.toml" || entryPath.endsWith(".toml")) {
            const tomlItems = extractTomlStrings(originalContent);
            const itemsToReplace: { item: TomlExtractedItem; newText: string }[] = [];
            
            for (let idx = 0; idx < tomlItems.length; idx++) {
              const item = tomlItems[idx];
              const trans = localTranslationCache[item.value];
              if (trans && trans !== item.value) {
                itemsToReplace.push({ item, newText: trans });
              }
            }

            if (itemsToReplace.length > 0) {
              const newContent = applyTomlTranslations(originalContent, itemsToReplace);
              addOrReplaceFile(zip, entryPath, Buffer.from(newContent, "utf-8"));
              task.stats.filesTranslated++;
              log(`Guardado: ${entryPath}`);
            }
          }
          continue;
        }

        // General books, advancements, or datapacks: edit JSON structure recursively
        const json = JSON.parse(originalContent);
        let hasChanged = false;
        
        const applyJsonTranslations = (node: any, jsonPath: string): any => {
          if (node === null || node === undefined) return node;
          
          if (typeof node === "string") {
            const targetItem = items.find(it => it.key === jsonPath);
            if (targetItem) {
              const trans = localTranslationCache[node];
              if (trans && trans !== node) {
                hasChanged = true;
                return trans;
              }
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
        if (hasChanged) {
          addOrReplaceFile(zip, entryPath, Buffer.from(JSON.stringify(translatedJsonStructure, null, 2), "utf-8"));
          task.stats.filesTranslated++;
          log(`Guardado: ${entryPath}`);
        } else {
          log(`Sin cambios reales para: ${entryPath}`);
        }

      } catch (err: any) {
        log(`Error al inyectar traducciones en ${entryPath}: ${err.message}`);
        task.stats.errorsCount++;
      }
    }

    // Build the translation diff array of modified fields
    const taskDiff: TranslationDiffEntry[] = [];
    for (const item of textToTranslate) {
      const orig = item.originalText;
      const trans = localTranslationCache[orig];
      if (trans && trans !== orig) {
        taskDiff.push({
          path: item.path,
          key: item.key,
          original: orig,
          translated: trans
        });
      }
    }
    task.diff = taskDiff;

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

export interface AnalysisFileReport {
  path: string;
  type: string;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  unmodifiedKeys: number;
  totalWords: number;
  totalCharacters: number;
  wordsToTranslate: number;
  charactersToTranslate: number;
}

export interface AnalysisResult {
  originalName: string;
  totalFiles: number;
  translatableFilesCount: number;
  totalOriginalKeys: number;
  totalAlreadyTranslatedKeys: number;
  totalMissingKeys: number;
  totalUnmodifiedKeys: number;
  totalWords: number;
  totalCharacters: number;
  wordsToTranslate: number;
  charactersToTranslate: number;
  estimatedApiSavingsPercent: number;
  files: AnalysisFileReport[];
}

export async function analyzeModFile(
  originalFilePath: string,
  options: TranslationOptions
): Promise<AnalysisResult> {
  const zip = new AdmZip(originalFilePath);
  const rawEntries = zip.getEntries();
  const fastIndex = new FastZipIndex(rawEntries);
  const entries = fastIndex.getAllIndexedEntries();
  const originalName = path.basename(originalFilePath);
  const glossary = { ...DEFAULT_GLOSSARY, ...options.customGlossary };

  // 1. Identify translatable files
  const translatableEntries: { entry: any; type: string; namespace: string }[] = [];
  for (const indexed of entries) {
    const entry = indexed.entry;
    const entryPath = indexed.entryName;

    const assetsMatch = entryPath.match(/^assets\/([a-zA-Z0-9_-]+)\/(.+)$/);
    const dataMatch = entryPath.match(/^data\/([a-zA-Z0-9_-]+)\/(.+)$/);

    if (options.translateLang || options.translateAll) {
      if (assetsMatch && assetsMatch[2].startsWith("lang/")) {
        if (assetsMatch[2].endsWith(".json")) {
          translatableEntries.push({ entry, type: "lang_json", namespace: assetsMatch[1] });
          continue;
        }
        if (assetsMatch[2].endsWith(".lang")) {
          translatableEntries.push({ entry, type: "lang_legacy", namespace: assetsMatch[1] });
          continue;
        }
      }
    }

    if (options.translateBooks || options.translateAll) {
      if (assetsMatch && assetsMatch[2].startsWith("patchouli_books/") && assetsMatch[2].endsWith(".json")) {
        translatableEntries.push({ entry, type: "patchouli", namespace: assetsMatch[1] });
        continue;
      }
    }

    if (options.translateQuests || options.translateAll) {
      if (dataMatch && dataMatch[2].startsWith("advancements/") && dataMatch[2].endsWith(".json")) {
        translatableEntries.push({ entry, type: "advancement", namespace: dataMatch[1] });
        continue;
      }
    }

    if (options.translateDatapacks || options.translateAll) {
      if (dataMatch && (dataMatch[2].startsWith("loot_tables/") || dataMatch[2].startsWith("recipes/")) && dataMatch[2].endsWith(".json")) {
        translatableEntries.push({ entry, type: "datapack_json", namespace: dataMatch[1] });
        continue;
      }
    }

    if (options.translateStructures || options.translateAll) {
      if (dataMatch && (dataMatch[2].startsWith("structures/") || dataMatch[2].startsWith("dialogs/") || dataMatch[2].startsWith("quests/")) && (dataMatch[2].endsWith(".json") || dataMatch[2].endsWith(".snbt"))) {
        translatableEntries.push({ entry, type: "structure_json", namespace: dataMatch[1] });
        continue;
      }
    }

    if (entryPath === "META-INF/mods.toml" || entryPath === "fabric.mod.json" || entryPath === "pack.mcmeta") {
      translatableEntries.push({ entry, type: "metadata", namespace: "global" });
      continue;
    }

    if (options.translateAll) {
      if (entryPath.endsWith(".json") && !translatableEntries.some(e => e.entry.entryName === entryPath)) {
        translatableEntries.push({ entry, type: "general_json", namespace: assetsMatch ? assetsMatch[1] : (dataMatch ? dataMatch[1] : "global") });
        continue;
      }
    }
  }

  const fileReports: AnalysisFileReport[] = [];

  for (const { entry, type, namespace } of translatableEntries) {
    const entryPath = entry.entryName;
    const content = entry.getData().toString("utf-8");

    let totalKeys = 0;
    let translatedKeys = 0;
    let missingKeys = 0;
    let unmodifiedKeys = 0;
    let totalWords = 0;
    let totalCharacters = 0;
    let wordsToTranslate = 0;
    let charactersToTranslate = 0;

    try {
      if (type === "lang_json") {
        const json = JSON.parse(content);
        const esEsPath = `assets/${namespace}/lang/es_es.json`;
        const esMxPath = `assets/${namespace}/lang/es_mx.json`;

        let existingEsEs: Record<string, string> = {};
        let existingEsMx: Record<string, string> = {};

        const esEsPathsFound = new Set<string>([esEsPath]);
        const esMxPathsFound = new Set<string>([esMxPath]);

        const langEntries = fastIndex.getLangEntriesForNamespace(namespace);
        for (const langEnt of langEntries) {
          const baseName = path.basename(langEnt.entryNameLower);
          try {
            const parsed = JSON.parse(langEnt.entry.getData().toString("utf-8"));
            if (baseName.includes("es__es") || baseName.includes("es-es") || baseName.includes("es_es") || baseName === "es.json") {
              esEsPathsFound.add(langEnt.entryName);
              existingEsEs = { ...existingEsEs, ...parsed };
            }
            if (baseName.includes("es__mx") || baseName.includes("es-mx") || baseName.includes("es_mx")) {
              esMxPathsFound.add(langEnt.entryName);
              existingEsMx = { ...existingEsMx, ...parsed };
            }
          } catch (e) {}
        }

        for (const pathFound of esEsPathsFound) {
          try {
            const esEsEntry = fastIndex.getEntry(pathFound);
            if (esEsEntry) {
              const parsed = JSON.parse(esEsEntry.getData().toString("utf-8"));
              existingEsEs = { ...existingEsEs, ...parsed };
            }
          } catch (e) {}
        }

        for (const pathFound of esMxPathsFound) {
          try {
            const esMxEntry = fastIndex.getEntry(pathFound);
            if (esMxEntry) {
              const parsed = JSON.parse(esMxEntry.getData().toString("utf-8"));
              existingEsMx = { ...existingEsMx, ...parsed };
            }
          } catch (e) {}
        }

        for (const key of Object.keys(json)) {
          const val = json[key];
          if (typeof val === "string") {
            totalKeys++;
            const charCount = val.length;
            const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
            totalCharacters += charCount;
            totalWords += wordCount;

            let needsTranslateForEsEs = false;
            let needsTranslateForEsMx = false;

            let hasEsEs = false;
            let isEsEsIdentical = false;
            if (options.targetLocale === "es_es" || options.targetLocale === "both") {
              const existingVal = existingEsEs[key];
              if (existingVal) {
                hasEsEs = true;
                if (existingVal === val && isTranslatableString(val)) {
                  isEsEsIdentical = true;
                  needsTranslateForEsEs = true;
                }
              } else {
                needsTranslateForEsEs = true;
              }
            }

            let hasEsMx = false;
            let isEsMxIdentical = false;
            if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
              const existingVal = existingEsMx[key];
              if (existingVal) {
                hasEsMx = true;
                if (existingVal === val && isTranslatableString(val)) {
                  isEsMxIdentical = true;
                  needsTranslateForEsMx = true;
                }
              } else {
                needsTranslateForEsMx = true;
              }
            }

            // Categorize
            if (options.targetLocale === "both") {
              if (hasEsEs && hasEsMx) {
                if (isEsEsIdentical || isEsMxIdentical) unmodifiedKeys++;
                else translatedKeys++;
              } else if (!hasEsEs && !hasEsMx) {
                missingKeys++;
              } else {
                if (isEsEsIdentical || isEsMxIdentical) unmodifiedKeys++;
                else translatedKeys++;
              }
            } else if (options.targetLocale === "es_es") {
              if (hasEsEs) {
                if (isEsEsIdentical) unmodifiedKeys++;
                else translatedKeys++;
              } else {
                missingKeys++;
              }
            } else { // es_mx
              if (hasEsMx) {
                if (isEsMxIdentical) unmodifiedKeys++;
                else translatedKeys++;
              } else {
                missingKeys++;
              }
            }

            if ((needsTranslateForEsEs || needsTranslateForEsMx) && isTranslatableString(val)) {
              if (glossary[val] || globalTranslationMemory[val]) {
                translatedKeys++;
                if (missingKeys > 0) missingKeys--;
                else if (unmodifiedKeys > 0) unmodifiedKeys--;
              } else {
                wordsToTranslate += wordCount;
                charactersToTranslate += charCount;
              }
            }
          }
        }
      } else if (type === "lang_legacy") {
        const lines = content.split(/\r?\n/);
        const esEsPath = `assets/${namespace}/lang/es_es.lang`;
        const esMxPath = `assets/${namespace}/lang/es_mx.lang`;

        let existingEsEsMap: Record<string, string> = {};
        let existingEsMxMap: Record<string, string> = {};

        const esEsLangPathsFound = new Set<string>([esEsPath]);
        const esMxLangPathsFound = new Set<string>([esMxPath]);

        const parseLegacyLang = (fileContent: string) => {
          const map: Record<string, string> = {};
          const lines = fileContent.split(/\r?\n/);
          for (const l of lines) {
            const trimmed = l.trim();
            if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
            const eqIdx = trimmed.indexOf("=");
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            map[key] = val;
          }
          return map;
        };

        const langEntries = fastIndex.getLangEntriesForNamespace(namespace);
        for (const langEnt of langEntries) {
          const baseName = path.basename(langEnt.entryNameLower);
          try {
            if (baseName.includes("es__es") || baseName.includes("es-es") || baseName.includes("es_es") || baseName === "es.lang") {
              esEsLangPathsFound.add(langEnt.entryName);
              const parsed = parseLegacyLang(langEnt.entry.getData().toString("utf-8"));
              existingEsEsMap = { ...existingEsEsMap, ...parsed };
            }
            if (baseName.includes("es__mx") || baseName.includes("es-mx") || baseName.includes("es_mx")) {
              esMxLangPathsFound.add(langEnt.entryName);
              const parsed = parseLegacyLang(langEnt.entry.getData().toString("utf-8"));
              existingEsMxMap = { ...existingEsMxMap, ...parsed };
            }
          } catch (e) {}
        }

        for (const pathFound of esEsLangPathsFound) {
          try {
            const entryFile = zip.getEntry(pathFound);
            if (entryFile) {
              const parsed = parseLegacyLang(entryFile.getData().toString("utf-8"));
              existingEsEsMap = { ...existingEsEsMap, ...parsed };
            }
          } catch (e) {}
        }

        for (const pathFound of esMxLangPathsFound) {
          try {
            const entryFile = zip.getEntry(pathFound);
            if (entryFile) {
              const parsed = parseLegacyLang(entryFile.getData().toString("utf-8"));
              existingEsMxMap = { ...existingEsMxMap, ...parsed };
            }
          } catch (e) {}
        }

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx].trim();
          if (!line || line.startsWith("#") || !line.includes("=")) continue;

          const eqIdx = line.indexOf("=");
          const key = line.substring(0, eqIdx).trim();
          const val = line.substring(eqIdx + 1).trim();

          totalKeys++;
          const charCount = val.length;
          const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
          totalCharacters += charCount;
          totalWords += wordCount;

          let needsTranslateForEsEs = false;
          let needsTranslateForEsMx = false;

          let hasEsEs = false;
          let isEsEsIdentical = false;
          if (options.targetLocale === "es_es" || options.targetLocale === "both") {
            const existingVal = existingEsEsMap[key];
            if (existingVal) {
              hasEsEs = true;
              if (existingVal === val && isTranslatableString(val)) {
                isEsEsIdentical = true;
                needsTranslateForEsEs = true;
              }
            } else {
              needsTranslateForEsEs = true;
            }
          }

          let hasEsMx = false;
          let isEsMxIdentical = false;
          if (options.targetLocale === "es_mx" || options.targetLocale === "both") {
            const existingVal = existingEsMxMap[key];
            if (existingVal) {
              hasEsMx = true;
              if (existingVal === val && isTranslatableString(val)) {
                isEsMxIdentical = true;
                needsTranslateForEsMx = true;
              }
            } else {
              needsTranslateForEsMx = true;
            }
          }

          if (options.targetLocale === "both") {
            if (hasEsEs && hasEsMx) {
              if (isEsEsIdentical || isEsMxIdentical) unmodifiedKeys++;
              else translatedKeys++;
            } else if (!hasEsEs && !hasEsMx) {
              missingKeys++;
            } else {
              if (isEsEsIdentical || isEsMxIdentical) unmodifiedKeys++;
              else translatedKeys++;
            }
          } else if (options.targetLocale === "es_es") {
            if (hasEsEs) {
              if (isEsEsIdentical) unmodifiedKeys++;
              else translatedKeys++;
            } else {
              missingKeys++;
            }
          } else {
            if (hasEsMx) {
              if (isEsMxIdentical) unmodifiedKeys++;
              else translatedKeys++;
            } else {
              missingKeys++;
            }
          }

          if ((needsTranslateForEsEs || needsTranslateForEsMx) && isTranslatableString(val)) {
            if (glossary[val] || globalTranslationMemory[val]) {
              translatedKeys++;
              if (missingKeys > 0) missingKeys--;
              else if (unmodifiedKeys > 0) unmodifiedKeys--;
            } else {
              wordsToTranslate += wordCount;
              charactersToTranslate += charCount;
            }
          }
        }
      } else if (type === "metadata") {
        if (entryPath === "fabric.mod.json") {
          const json = JSON.parse(content);
          const candidateKeys = ["name", "description"];
          for (const k of candidateKeys) {
            const val = json[k];
            if (val && isTranslatableString(val)) {
              totalKeys++;
              const charCount = val.length;
              const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
              totalCharacters += charCount;
              totalWords += wordCount;

              if (glossary[val] || globalTranslationMemory[val]) {
                translatedKeys++;
              } else {
                missingKeys++;
                wordsToTranslate += wordCount;
                charactersToTranslate += charCount;
              }
            }
          }
        } else if (entryPath === "pack.mcmeta") {
          const json = JSON.parse(content);
          const val = json.pack?.description;
          if (val && isTranslatableString(val)) {
            totalKeys++;
            const charCount = val.length;
            const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
            totalCharacters += charCount;
            totalWords += wordCount;

            if (glossary[val] || globalTranslationMemory[val]) {
              translatedKeys++;
            } else {
              missingKeys++;
              wordsToTranslate += wordCount;
              charactersToTranslate += charCount;
            }
          }
        } else if (entryPath === "META-INF/mods.toml" || entryPath === "META-INF/neoforge.mods.toml" || entryPath.endsWith(".toml")) {
          const tomlItems = extractTomlStrings(content);
          for (const item of tomlItems) {
            const val = item.value;
            if (isTranslatableString(val)) {
              totalKeys++;
              const charCount = val.length;
              const wordCount = val.trim().split(/\s+/).filter(Boolean).length;
              totalCharacters += charCount;
              totalWords += wordCount;

              if (glossary[val] || globalTranslationMemory[val]) {
                translatedKeys++;
              } else {
                missingKeys++;
                wordsToTranslate += wordCount;
                charactersToTranslate += charCount;
              }
            }
          }
        }
      } else {
        // General json, patchouli books, loot tables, advancements etc.
        const json = JSON.parse(content);

        const scanJsonNode = (node: any) => {
          if (node === null || node === undefined) return;
          if (typeof node === "string") {
            if (isTranslatableString(node)) {
              totalKeys++;
              const charCount = node.length;
              const wordCount = node.trim().split(/\s+/).filter(Boolean).length;
              totalCharacters += charCount;
              totalWords += wordCount;

              if (glossary[node] || globalTranslationMemory[node]) {
                translatedKeys++;
              } else {
                missingKeys++;
                wordsToTranslate += wordCount;
                charactersToTranslate += charCount;
              }
            }
            return;
          }
          if (Array.isArray(node)) {
            for (const el of node) scanJsonNode(el);
            return;
          }
          if (typeof node === "object") {
            const translatableKeys = ["name", "text", "description", "title", "subtitle", "lore", "pages", "message", "tooltip", "header"];
            for (const k of Object.keys(node)) {
              if (translatableKeys.some(tk => k.toLowerCase().includes(tk))) {
                scanJsonNode(node[k]);
              }
            }
          }
        };

        scanJsonNode(json);
      }
    } catch (e) {
      // ignore parsing errors
    }

    fileReports.push({
      path: entryPath,
      type,
      totalKeys,
      translatedKeys,
      missingKeys,
      unmodifiedKeys,
      totalWords,
      totalCharacters,
      wordsToTranslate,
      charactersToTranslate,
    });
  }

  // Aggregate stats
  let totalOriginalKeys = 0;
  let totalAlreadyTranslatedKeys = 0;
  let totalMissingKeys = 0;
  let totalUnmodifiedKeys = 0;
  let totalWords = 0;
  let totalCharacters = 0;
  let wordsToTranslate = 0;
  let charactersToTranslate = 0;

  for (const report of fileReports) {
    totalOriginalKeys += report.totalKeys;
    totalAlreadyTranslatedKeys += report.translatedKeys;
    totalMissingKeys += report.missingKeys;
    totalUnmodifiedKeys += report.unmodifiedKeys;
    totalWords += report.totalWords;
    totalCharacters += report.totalCharacters;
    wordsToTranslate += report.wordsToTranslate;
    charactersToTranslate += report.charactersToTranslate;
  }

  // Calculate savings percent
  let estimatedApiSavingsPercent = 0;
  if (totalOriginalKeys > 0) {
    estimatedApiSavingsPercent = Math.round(
      ((totalOriginalKeys - (totalMissingKeys + totalUnmodifiedKeys)) / totalOriginalKeys) * 100
    );
  }

  return {
    originalName,
    totalFiles: entries.length,
    translatableFilesCount: translatableEntries.length,
    totalOriginalKeys,
    totalAlreadyTranslatedKeys,
    totalMissingKeys,
    totalUnmodifiedKeys,
    totalWords,
    totalCharacters,
    wordsToTranslate,
    charactersToTranslate,
    estimatedApiSavingsPercent: Math.max(0, Math.min(100, estimatedApiSavingsPercent)),
    files: fileReports,
  };
}
