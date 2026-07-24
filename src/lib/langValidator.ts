export interface ValidationIssue {
  code: string;
  message: string;
  key?: string;
  type: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  schemaType: 'Forge/Fabric (Minecraft 1.13+ Flat JSON)';
  stats: {
    totalKeys: number;
    validKeys: number;
    emptyKeys: number;
    placeholderCount: number;
    sizeKb: number;
  };
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Validates language JSON objects against Minecraft Forge and Fabric specifications (Minecraft 1.13+).
 * Ensures flat key-value pairs, valid string types, proper formatting specifiers, and valid keys.
 */
export function validateMinecraftLangJson(data: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  let totalKeys = 0;
  let validKeys = 0;
  let emptyKeys = 0;
  let placeholderCount = 0;

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const sizeKb = parseFloat((new Blob([jsonString]).size / 1024).toFixed(2));

  // 1. Root Object Validation
  let parsedObj: Record<string, unknown> = {};

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        errors.push({
          code: 'INVALID_ROOT',
          message: 'El archivo JSON de idioma debe ser un objeto raíz {...} (no una lista ni valor primitivo).',
          type: 'error'
        });
        return {
          isValid: false,
          schemaType: 'Forge/Fabric (Minecraft 1.13+ Flat JSON)',
          stats: { totalKeys: 0, validKeys: 0, emptyKeys: 0, placeholderCount: 0, sizeKb },
          errors,
          warnings
        };
      }
      parsedObj = parsed as Record<string, unknown>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        code: 'JSON_SYNTAX_ERROR',
        message: `Error de sintaxis JSON: ${message}`,
        type: 'error'
      });
      return {
        isValid: false,
        schemaType: 'Forge/Fabric (Minecraft 1.13+ Flat JSON)',
        stats: { totalKeys: 0, validKeys: 0, emptyKeys: 0, placeholderCount: 0, sizeKb },
        errors,
        warnings
      };
    }
  } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    parsedObj = data as Record<string, unknown>;
  } else {
    errors.push({
      code: 'INVALID_DATA_TYPE',
      message: 'Los datos proporcionados no corresponden a un objeto JSON válido.',
      type: 'error'
    });
    return {
      isValid: false,
      schemaType: 'Forge/Fabric (Minecraft 1.13+ Flat JSON)',
      stats: { totalKeys: 0, validKeys: 0, emptyKeys: 0, placeholderCount: 0, sizeKb },
      errors,
      warnings
    };
  }

  // 2. Keys & Values Structure Validation for Minecraft Forge / Fabric
  const entries = Object.entries(parsedObj);
  totalKeys = entries.length;

  if (totalKeys === 0) {
    warnings.push({
      code: 'EMPTY_FILE',
      message: 'El archivo JSON está completamente vacío y no contiene claves de traducción.',
      type: 'warning'
    });
  }

  // Regex for standard placeholders in Minecraft (%s, %d, %1$s, %2$d, %f, etc.)
  const minecraftPlaceholderRegex = /%(?:\d+\$)?[-+0,#(]*\d*(?:\.\d+)?[a-zA-Z]/g;
  // Regex to check invalid stray percentage signs that could crash String.format()
  const strayPercentRegex = /%(?![sdefgxcbA-Za-z0-9]|\d+\$)/g;

  entries.forEach(([key, val]) => {
    // Check Key Name Rules
    if (!key || key.trim() === '') {
      errors.push({
        code: 'EMPTY_KEY',
        message: 'Existe una clave vacía en el objeto de idioma.',
        type: 'error'
      });
      return;
    }

    if (/\s/.test(key)) {
      warnings.push({
        code: 'KEY_WITH_SPACES',
        message: `La clave "${key}" contiene espacios. Minecraft prefiere claves con notación de punto (ej. item.mod.sword).`,
        key,
        type: 'warning'
      });
    }

    // Check Value Type
    if (typeof val !== 'string') {
      errors.push({
        code: 'NON_STRING_VALUE',
        message: `La clave "${key}" tiene un valor de tipo ${typeof val}. Forge y Fabric requieren estrictamente valores de tipo texto (string).`,
        key,
        type: 'error'
      });
      return;
    }

    // Value Content Checks
    if (val.trim() === '') {
      emptyKeys++;
      warnings.push({
        code: 'UNTRANSLATED_KEY',
        message: `La clave "${key}" tiene un valor de traducción vacío.`,
        key,
        type: 'warning'
      });
    } else {
      validKeys++;
    }

    // Check format specifiers / placeholders
    const matches = val.match(minecraftPlaceholderRegex);
    if (matches) {
      placeholderCount += matches.length;
    }

    // Check for stray % signs that are not double-escaped %% or valid specifiers
    if (strayPercentRegex.test(val)) {
      warnings.push({
        code: 'MALFORMED_PLACEHOLDER',
        message: `La traducción de "${key}" contiene un símbolo '%' no escapado. Usa '%%' si es texto literal para evitar cierres abruptos en Minecraft.`,
        key,
        type: 'warning'
      });
    }

    // Check formatting section signs (§)
    if (val.includes('§')) {
      warnings.push({
        code: 'LEGACY_COLOR_CODE',
        message: `La clave "${key}" usa códigos de color heredados (§). En versiones recientes se recomienda usar componentes de texto JSON.`,
        key,
        type: 'warning'
      });
    }
  });

  const isValid = errors.length === 0;

  return {
    isValid,
    schemaType: 'Forge/Fabric (Minecraft 1.13+ Flat JSON)',
    stats: {
      totalKeys,
      validKeys,
      emptyKeys,
      placeholderCount,
      sizeKb
    },
    errors,
    warnings
  };
}
