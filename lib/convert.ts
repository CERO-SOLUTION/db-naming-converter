import type { DictionaryMeta, NormalizedDictionary } from "./dict";

export type WarningType =
  | "forbidden"
  | "synonym"
  | "unknown"
  | "format-position";

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

function tokenizeInput(input: string): string[] {
  // underscores/공백/구두점 등을 구분자로 보고, 한글/영문/숫자만 토큰으로 남깁니다.
  return input
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function segmentIntoKnownTokens(
  normalizedRaw: string,
  knownKeySet: Set<string>,
  knownKeyLengthsDesc: number[],
): string[] | null {
  // 예: "오프셋카메라" => ["오프셋", "카메라"]
  const memo = new Map<number, string[] | null>();

  const dfs = (pos: number): string[] | null => {
    if (pos === normalizedRaw.length) {
      return [];
    }
    if (memo.has(pos)) {
      return memo.get(pos) ?? null;
    }

    for (const len of knownKeyLengthsDesc) {
      if (pos + len > normalizedRaw.length) continue;
      const slice = normalizedRaw.slice(pos, pos + len);
      if (!knownKeySet.has(slice)) continue;

      const rest = dfs(pos + len);
      if (rest) {
        const result = [slice, ...rest];
        memo.set(pos, result);
        return result;
      }
    }

    memo.set(pos, null);
    return null;
  };

  return dfs(0);
}

export function convertInput(
  input: string,
  dict: NormalizedDictionary,
): ConvertResult {
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

  const knownKeySet = new Set<string>([
    ...dict.normalized.standard.keys(),
    ...dict.normalized.synonym.keys(),
    ...dict.normalized.forbidden.keys()
  ]);
  const knownKeyLengthsDesc = Array.from(new Set(Array.from(knownKeySet).map((k) => k.length))).sort(
    (a, b) => b - a,
  );

  const rawTokens = tokenizeInput(input);

  const pushUnknownToken = (tokenInput: string, normalized: string) => {
    const fallback = unknownFallbackToken();
    warnings.push({ type: "unknown", token: tokenInput });
    tokens.push({
      input: tokenInput,
      normalized,
      output: fallback,
      kind: "unknown",
    });
    descriptionTokens.push(tokenInput);
    outputTokens.push(fallback);
  };

  const tryMatchToken = (tokenInput: string, normalized: string): boolean => {
    const forbiddenMatch = dict.normalized.forbidden.get(normalized);
    if (forbiddenMatch) {
      const standardName = forbiddenMatch.standard;
      const standardEntry = dict.standard[standardName];
      const abbr = standardEntry?.abbr ?? unknownFallbackToken();

      warnings.push({ type: "forbidden", token: tokenInput, suggest: standardName });
      tokens.push({
        input: tokenInput,
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
        isFormat: standardEntry?.isFormat ?? false,
      });
      descriptionTokens.push(standardEntry?.englishName ?? standardName ?? tokenInput);
      outputTokens.push(abbr.toLowerCase());
      return true;
    }

    const standardMatch = dict.normalized.standard.get(normalized);
    if (standardMatch) {
      const { standard, entry } = standardMatch;
      tokens.push({
        input: tokenInput,
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
        isFormat: entry.isFormat,
      });
      descriptionTokens.push(entry.englishName ?? standard);
      outputTokens.push(entry.abbr.toLowerCase());
      return true;
    }

    const synonymMatch = dict.normalized.synonym.get(normalized);
    if (synonymMatch) {
      const standardName = synonymMatch.standard;
      const standardEntry = dict.standard[standardName];
      const abbr = standardEntry?.abbr ?? unknownFallbackToken();

      warnings.push({ type: "synonym", token: tokenInput, suggest: standardName });
      tokens.push({
        input: tokenInput,
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
        isFormat: standardEntry?.isFormat ?? false,
      });
      descriptionTokens.push(standardEntry?.englishName ?? standardName ?? tokenInput);
      outputTokens.push(abbr.toLowerCase());
      return true;
    }

    return false;
  };

  rawTokens.forEach((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const normalized = normalizeInputToken(trimmed);
    if (!normalized) return;

    if (tryMatchToken(trimmed, normalized)) return;

    // 예: "오프셋카메라" 같이 입력 덩어리가 하나로 들어오면,
    // 사전 키 조합으로 다시 쪼개서 매칭합니다.
    const segments = segmentIntoKnownTokens(normalized, knownKeySet, knownKeyLengthsDesc);
    if (segments) {
      let pos = 0;
      for (const segNormalized of segments) {
        const segInput = trimmed.slice(pos, pos + segNormalized.length);
        if (!tryMatchToken(segInput, segNormalized)) {
          pushUnknownToken(segInput, segNormalized);
        }
        pos += segNormalized.length;
      }
      return;
    }

    pushUnknownToken(trimmed, normalized);
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
    // 토큰이 여러 개인 경우(abbr 기반) `_`로 구분해 DB 네이밍처럼 보이게 합니다.
    output: outputTokens.join("_").toLowerCase(),
    description: descriptionTokens.join(" "),
    warnings,
    tokens,
    meta: dict.meta,
  };
}
