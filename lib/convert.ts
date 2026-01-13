import type { DictionaryMeta, NormalizedDictionary } from "./dict";

export type WarningType = "forbidden" | "synonym" | "unknown" | "format-position";

export type Warning = {
  type: WarningType;
  token: string;
  suggest?: string;
};

export type TokenKind = "forbidden" | "standard" | "synonym" | "unknown";

export type TokenResult = {
  input: string;
  normalized: string;
  output: string;
  kind: TokenKind;
  standard?: string;
  abbr?: string;
  isFormat?: boolean;
};

export type ConvertResult = {
  output: string;
  warnings: Warning[];
  tokens: TokenResult[];
  meta?: DictionaryMeta;
};

export function normalizeInputToken(token: string): string {
  return token.trim().replace(/\s+/g, "").toLowerCase();
}

function unknownFallbackToken(): string {
  return "unk";
}

export function convertInput(input: string, dict: NormalizedDictionary): ConvertResult {
  const tokens: TokenResult[] = [];
  const warnings: Warning[] = [];
  const outputTokens: string[] = [];

  const rawTokens = input.split("_");

  rawTokens.forEach((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }

    const normalized = normalizeInputToken(trimmed);
    if (!normalized) {
      return;
    }

    const forbiddenMatch = dict.normalized.forbidden.get(normalized);
    if (forbiddenMatch) {
      const standardName = forbiddenMatch.standard;
      const standardEntry = dict.standard[standardName];
      const abbr = standardEntry?.abbr ?? unknownFallbackToken();

      warnings.push({ type: "forbidden", token: trimmed, suggest: standardName });
      tokens.push({
        input: trimmed,
        normalized,
        output: abbr,
        kind: "forbidden",
        standard: standardName,
        abbr,
        isFormat: standardEntry?.isFormat ?? false
      });
      outputTokens.push(abbr.toLowerCase());
      return;
    }

    const standardMatch = dict.normalized.standard.get(normalized);
    if (standardMatch) {
      const { standard, entry } = standardMatch;
      tokens.push({
        input: trimmed,
        normalized,
        output: entry.abbr,
        kind: "standard",
        standard,
        abbr: entry.abbr,
        isFormat: entry.isFormat
      });
      outputTokens.push(entry.abbr.toLowerCase());
      return;
    }

    const synonymMatch = dict.normalized.synonym.get(normalized);
    if (synonymMatch) {
      const standardName = synonymMatch.standard;
      const standardEntry = dict.standard[standardName];
      const abbr = standardEntry?.abbr ?? unknownFallbackToken();

      warnings.push({ type: "synonym", token: trimmed, suggest: standardName });
      tokens.push({
        input: trimmed,
        normalized,
        output: abbr,
        kind: "synonym",
        standard: standardName,
        abbr,
        isFormat: standardEntry?.isFormat ?? false
      });
      outputTokens.push(abbr.toLowerCase());
      return;
    }

    const fallback = unknownFallbackToken();
    warnings.push({ type: "unknown", token: trimmed });
    tokens.push({
      input: trimmed,
      normalized,
      output: fallback,
      kind: "unknown"
    });
    outputTokens.push(fallback);
  });

  const lastIndex = tokens.length - 1;
  if (lastIndex >= 0) {
    tokens.forEach((token, index) => {
      if (token.isFormat && index !== lastIndex) {
        warnings.push({ type: "format-position", token: token.input });
      }
    });
  }

  return {
    output: outputTokens.join("_").toLowerCase(),
    warnings,
    tokens,
    meta: dict.meta
  };
}
