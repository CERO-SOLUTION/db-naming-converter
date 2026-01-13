export type DictionaryMeta = {
  source: string;
  sheet: string;
  generatedAt?: string;
  overrides?: {
    standard?: string[];
  };
};

export type StandardEntry = {
  abbr: string;
  isFormat: boolean;
  rowNo: number;
  numberCol: string;
};

export type Dictionary = {
  meta: DictionaryMeta;
  standard: Record<string, StandardEntry>;
  synonym: Record<string, { standard: string }>;
  forbidden: Record<string, { standard: string }>;
};

export type NormalizedDictionary = Dictionary & {
  normalized: {
    standard: Map<string, { standard: string; entry: StandardEntry }>;
    synonym: Map<string, { standard: string }>;
    forbidden: Map<string, { standard: string }>;
  };
};

export function normalizeTokenKey(token: string): string {
  return token.trim().replace(/\s+/g, "").toLowerCase();
}

export function normalizeDictionary(raw: Dictionary): NormalizedDictionary {
  const standard = new Map<string, { standard: string; entry: StandardEntry }>();
  const synonym = new Map<string, { standard: string }>();
  const forbidden = new Map<string, { standard: string }>();

  Object.entries(raw.standard ?? {}).forEach(([key, entry]) => {
    const normalizedKey = normalizeTokenKey(key);
    standard.set(normalizedKey, { standard: key, entry });
  });

  Object.entries(raw.synonym ?? {}).forEach(([key, entry]) => {
    const normalizedKey = normalizeTokenKey(key);
    synonym.set(normalizedKey, { standard: entry.standard });
  });

  Object.entries(raw.forbidden ?? {}).forEach(([key, entry]) => {
    const normalizedKey = normalizeTokenKey(key);
    forbidden.set(normalizedKey, { standard: entry.standard });
  });

  return {
    ...raw,
    normalized: {
      standard,
      synonym,
      forbidden
    }
  };
}
