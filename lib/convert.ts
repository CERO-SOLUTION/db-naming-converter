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
  numberCol?: string;
  standard?: string;
  abbr?: string;
  englishName?: string;
  description?: string;
  domainName?: string;
  synonymList?: string[];
  forbiddenList?: string[];
  isFormat?: boolean;
};

export type ConvertResult = {
  output: string;
  description: string;
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
  const descriptionTokens: string[] = [];
  const synonymListMap = new Map<string, string[]>();
  const forbiddenListMap = new Map<string, string[]>();

  Object.entries(dict.synonym ?? {}).forEach(([token, entry]) => {
    const list = synonymListMap.get(entry.standard) ?? [];
    list.push(token);
    synonymListMap.set(entry.standard, list);
  });

  Object.entries(dict.forbidden ?? {}).forEach(([token, entry]) => {
    const list = forbiddenListMap.get(entry.standard) ?? [];
    list.push(token);
    forbiddenListMap.set(entry.standard, list);
  });

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
        numberCol: standardEntry?.numberCol,
        standard: standardName,
        abbr,
        englishName: standardEntry?.englishName,
        description: standardEntry?.description,
        domainName: standardEntry?.domainName,
        synonymList: synonymListMap.get(standardName),
        forbiddenList: forbiddenListMap.get(standardName),
        isFormat: standardEntry?.isFormat ?? false
      });
      descriptionTokens.push(standardEntry?.englishName ?? standardName ?? trimmed);
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
        numberCol: entry.numberCol,
        standard,
        abbr: entry.abbr,
        englishName: entry.englishName,
        description: entry.description,
        domainName: entry.domainName,
        synonymList: synonymListMap.get(standard),
        forbiddenList: forbiddenListMap.get(standard),
        isFormat: entry.isFormat
      });
      descriptionTokens.push(entry.englishName ?? standard);
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
        numberCol: standardEntry?.numberCol,
        standard: standardName,
        abbr,
        englishName: standardEntry?.englishName,
        description: standardEntry?.description,
        domainName: standardEntry?.domainName,
        synonymList: synonymListMap.get(standardName),
        forbiddenList: forbiddenListMap.get(standardName),
        isFormat: standardEntry?.isFormat ?? false
      });
      descriptionTokens.push(standardEntry?.englishName ?? standardName ?? trimmed);
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
    descriptionTokens.push(trimmed);
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
    description: descriptionTokens.join(" "),
    warnings,
    tokens,
    meta: dict.meta
  };
}
