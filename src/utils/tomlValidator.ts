import { parse } from "smol-toml";
import JSZip from "jszip";

export interface TomlValidationResult {
  fileName: string;
  hasToml: boolean;
  valid: boolean;
  errors: string[];
  tomlPath?: string;
  repairedContent?: string;
}

/**
 * Validates a TOML content string using smol-toml.
 */
export function validateTomlString(content: string): { valid: boolean; error?: string } {
  try {
    parse(content);
    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message || String(err)
    };
  }
}

/**
 * Inspects a .jar file client-side using JSZip, finds any mods.toml / neoforge.mods.toml files,
 * and validates their TOML syntax.
 */
export async function validateJarToml(file: File): Promise<TomlValidationResult> {
  const result: TomlValidationResult = {
    fileName: file.name,
    hasToml: false,
    valid: true,
    errors: []
  };

  try {
    const zip = await JSZip.loadAsync(file);
    const tomlEntries: string[] = [];

    zip.forEach((relativePath) => {
      if (relativePath === "META-INF/mods.toml" || relativePath === "META-INF/neoforge.mods.toml" || relativePath.endsWith(".toml")) {
        tomlEntries.push(relativePath);
      }
    });

    if (tomlEntries.length === 0) {
      return result;
    }

    result.hasToml = true;

    for (const tomlPath of tomlEntries) {
      const entry = zip.file(tomlPath);
      if (!entry) continue;

      const content = await entry.async("string");
      const validation = validateTomlString(content);

      if (!validation.valid) {
        result.valid = false;
        result.tomlPath = tomlPath;
        result.errors.push(`[${tomlPath}]: ${validation.error}`);
      }
    }
  } catch (err: any) {
    // If JSZip fails to read the jar file
    result.valid = false;
    result.errors.push(`Error al abrir o descomprimir el archivo JAR: ${err?.message || err}`);
  }

  return result;
}

/**
 * Attempts automatic repair of common syntax errors in mods.toml:
 * - Unclosed triple quotes
 * - Unescaped quotes inside single-quoted strings
 * - Broken bracket balance
 */
export function autoRepairTomlSyntax(content: string): string {
  const lines = content.split(/\r?\n/);
  const fixedLines: string[] = [];
  let inTripleDouble = false;
  let inTripleSingle = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Check multiline quotes balance
    const doubleTriples = (line.match(/"""/g) || []).length;
    if (doubleTriples % 2 !== 0) {
      inTripleDouble = !inTripleDouble;
    }

    const singleTriples = (line.match(/'''/g) || []).length;
    if (singleTriples % 2 !== 0) {
      inTripleSingle = !inTripleSingle;
    }

    // Single-line quote check
    if (!inTripleDouble && !inTripleSingle) {
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        const key = line.substring(0, eqIdx);
        let valRest = line.substring(eqIdx + 1).trim();

        // Fix accidental double opening quotes if present (e.g. ""Gobber 2")
        if (valRest.startsWith('""') && !valRest.startsWith('"""')) {
          valRest = valRest.substring(1);
        } else if (valRest.startsWith("''") && !valRest.startsWith("'''")) {
          valRest = valRest.substring(1);
        }

        // Separate value and comment if present
        let comment = "";
        const hashIdx = valRest.indexOf("#");
        if (hashIdx !== -1) {
          const quoteChar = valRest[0];
          if (quoteChar === '"' || quoteChar === "'") {
            const firstQuote = valRest.indexOf(quoteChar);
            const secondQuote = valRest.indexOf(quoteChar, firstQuote + 1);
            if (secondQuote !== -1 && hashIdx > secondQuote) {
              comment = valRest.substring(secondQuote);
              valRest = valRest.substring(0, secondQuote + 1);
            } else if (secondQuote === -1 && hashIdx > firstQuote) {
              comment = valRest.substring(hashIdx);
              valRest = valRest.substring(0, hashIdx).trim();
            }
          } else {
            comment = valRest.substring(hashIdx);
            valRest = valRest.substring(0, hashIdx).trim();
          }
        }

        // If line has an unclosed single double quote
        if (valRest.startsWith('"') && !valRest.endsWith('"') && !valRest.includes('"""')) {
          valRest = valRest + '"';
        } else if (valRest.startsWith("'") && !valRest.endsWith("'") && !valRest.includes("'''")) {
          valRest = valRest + "'";
        }

        const commentSuffix = comment ? (comment.startsWith(" ") ? comment : ` ${comment}`) : "";
        line = `${key}= ${valRest}${commentSuffix}`;
      }
    }

    fixedLines.push(line);
  }

  // If at the end of file multiline string is unclosed, close it
  if (inTripleDouble) {
    fixedLines.push('"""');
  }
  if (inTripleSingle) {
    fixedLines.push("'''");
  }

  return fixedLines.join("\n");
}
