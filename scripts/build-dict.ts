import fs from "fs";
import path from "path";
import xlsx from "xlsx";

type StandardEntry = {
  abbr: string;
  englishName: string;
  description: string;
  domainName: string;
  isFormat: boolean;
  rowNo: number;
  numberCol: string;
};

type StandardRowEntry = StandardEntry & {
  standard: string;
};

type SourceInfo = {
  standard: string;
  rowNo: number;
  numberCol: string;
};

type Conflict = {
  token: string;
  existing: SourceInfo;
  incoming: SourceInfo;
};

type Overrides = {
  standard?: Record<string, string>;
};

const SOURCE_FILE = path.join(process.cwd(), "BMS_테이블_정의_V1.1.xlsx");
const SHEET_NAME = "DB사전";
const OUTPUT_FILE = path.join(process.cwd(), "data", "dictionary.json");
const OVERRIDE_FILE =
  process.env.DICT_OVERRIDE_PATH ?? path.join(process.cwd(), "dictionary.overrides.json");

const REQUIRED_HEADERS = [
  "번호",
  "공통표준단어명",
  "공통표준단어영문약어명",
  "공통표준단어영문명",
  "공통표준단어설명",
  "형식단어여부",
  "공통표준도메인분류명",
  "이음동의어목록",
  "금칙어목록"
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "").replace(/[\s\t\r\n]+/g, "");
}

function toTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

function isEmptyOrDash(value: string): boolean {
  return value.length === 0 || value === "-";
}

function readSheetRows(): unknown[][] {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Source Excel file not found: ${SOURCE_FILE}`);
  }

  const workbook = xlsx.readFile(SOURCE_FILE, { cellText: false, cellDates: false });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEET_NAME}`);
  }

  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
}

function loadOverrides(): Overrides {
  if (!fs.existsSync(OVERRIDE_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(OVERRIDE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Overrides;
    return parsed ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to read overrides at ${OVERRIDE_FILE}: ${message}`);
  }
}

function getHeaderIndex(headerRow: unknown[]): Map<string, number> {
  const headerIndex = new Map<string, number>();
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) {
      headerIndex.set(key, index);
    }
  });
  return headerIndex;
}

function main(): void {
  const rows = readSheetRows();
  const headerRow = rows[0] ?? [];
  const headerIndex = getHeaderIndex(headerRow);

  const missingHeaders = REQUIRED_HEADERS.filter((key) => !headerIndex.has(key));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(", ")}`);
  }

  const idxNumber = headerIndex.get("번호") as number;
  const idxStandard = headerIndex.get("공통표준단어명") as number;
  const idxAbbr = headerIndex.get("공통표준단어영문약어명") as number;
  const idxEnglish = headerIndex.get("공통표준단어영문명") as number;
  const idxDescription = headerIndex.get("공통표준단어설명") as number;
  const idxFormat = headerIndex.get("형식단어여부") as number;
  const idxDomain = headerIndex.get("공통표준도메인분류명") as number;
  const idxSynonym = headerIndex.get("이음동의어목록") as number;
  const idxForbidden = headerIndex.get("금칙어목록") as number;

  const overrides = loadOverrides();

  const standardEntries = new Map<string, StandardRowEntry[]>();
  const synonymMap: Record<string, { standard: string }> = {};
  const forbiddenMap: Record<string, { standard: string }> = {};
  const synonymSource = new Map<string, SourceInfo>();
  const forbiddenSource = new Map<string, SourceInfo>();
  const synonymConflicts: Conflict[] = [];
  const forbiddenConflicts: Conflict[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const rowNo = i + 1;

    const numberCol = toTrimmedString(row[idxNumber]);
    const standard = toTrimmedString(row[idxStandard]);
    const abbr = toTrimmedString(row[idxAbbr]).toLowerCase();
    const englishName = toTrimmedString(row[idxEnglish]);
    const description = toTrimmedString(row[idxDescription]);
    const isFormat = toTrimmedString(row[idxFormat]).toUpperCase() === "Y";
    const domainName = toTrimmedString(row[idxDomain]);

    if (!standard) {
      continue;
    }

    const entry: StandardRowEntry = {
      standard,
      abbr,
      englishName,
      description,
      domainName,
      isFormat,
      rowNo,
      numberCol
    };

    const existingEntries = standardEntries.get(standard) ?? [];
    existingEntries.push(entry);
    standardEntries.set(standard, existingEntries);

    const synonymRaw = toTrimmedString(row[idxSynonym]);
    if (!isEmptyOrDash(synonymRaw)) {
      synonymRaw.split(",").forEach((token) => {
        const synonym = token.trim();
        if (isEmptyOrDash(synonym)) {
          return;
        }

        const sourceInfo: SourceInfo = { standard, rowNo, numberCol };
        const existing = synonymSource.get(synonym);
        if (existing && existing.standard !== standard) {
          synonymConflicts.push({ token: synonym, existing, incoming: sourceInfo });
          return;
        }

        synonymSource.set(synonym, sourceInfo);
        synonymMap[synonym] = { standard };
      });
    }

    const forbiddenRaw = toTrimmedString(row[idxForbidden]);
    if (!isEmptyOrDash(forbiddenRaw)) {
      forbiddenRaw.split(",").forEach((token) => {
        const forbidden = token.trim();
        if (isEmptyOrDash(forbidden)) {
          return;
        }

        const sourceInfo: SourceInfo = { standard, rowNo, numberCol };
        const existing = forbiddenSource.get(forbidden);
        if (existing && existing.standard !== standard) {
          forbiddenConflicts.push({ token: forbidden, existing, incoming: sourceInfo });
          return;
        }

        forbiddenSource.set(forbidden, sourceInfo);
        forbiddenMap[forbidden] = { standard };
      });
    }
  }

  const standardMap: Record<string, StandardEntry> = {};
  const resolvedStandardConflicts: Array<{
    standard: string;
    chosen: string;
    entries: StandardRowEntry[];
    usedOverride: boolean;
  }> = [];
  const overrideErrors: Array<{
    standard: string;
    override: string;
    available: string[];
  }> = [];

  for (const [standard, entries] of standardEntries.entries()) {
    const abbrGroups = new Map<string, StandardRowEntry[]>();
    entries.forEach((entry) => {
      const key = entry.abbr || "";
      const group = abbrGroups.get(key) ?? [];
      group.push(entry);
      abbrGroups.set(key, group);
    });

    if (abbrGroups.size > 1) {
      const overrideAbbrRaw = overrides.standard?.[standard];
      const overrideAbbr = overrideAbbrRaw?.trim().toLowerCase();
      if (overrideAbbr) {
        const overrideEntries = abbrGroups.get(overrideAbbr);
        if (!overrideEntries) {
          overrideErrors.push({
            standard,
            override: overrideAbbrRaw ?? "",
            available: Array.from(abbrGroups.keys())
          });
          continue;
        }

        const chosenEntry = overrideEntries[0];
        standardMap[standard] = {
          abbr: chosenEntry.abbr,
          englishName: chosenEntry.englishName,
          description: chosenEntry.description,
          domainName: chosenEntry.domainName,
          isFormat: chosenEntry.isFormat,
          rowNo: chosenEntry.rowNo,
          numberCol: chosenEntry.numberCol
        };
        resolvedStandardConflicts.push({
          standard,
          chosen: chosenEntry.abbr,
          entries,
          usedOverride: true
        });
        continue;
      }

      const fallbackEntry = entries[0];
      standardMap[standard] = {
        abbr: fallbackEntry.abbr,
        englishName: fallbackEntry.englishName,
        description: fallbackEntry.description,
        domainName: fallbackEntry.domainName,
        isFormat: fallbackEntry.isFormat,
        rowNo: fallbackEntry.rowNo,
        numberCol: fallbackEntry.numberCol
      };
      resolvedStandardConflicts.push({
        standard,
        chosen: fallbackEntry.abbr,
        entries,
        usedOverride: false
      });
      continue;
    }

    const primary = entries[0];
    standardMap[standard] = {
      abbr: primary.abbr,
      englishName: primary.englishName,
      description: primary.description,
      domainName: primary.domainName,
      isFormat: primary.isFormat,
      rowNo: primary.rowNo,
      numberCol: primary.numberCol
    };
  }

  if (resolvedStandardConflicts.length) {
    console.warn("Standard word conflicts resolved:");
    resolvedStandardConflicts.forEach((conflict) => {
      console.warn(
        `- ${conflict.standard} -> "${conflict.chosen}" (${conflict.usedOverride ? "override" : "first-row"})`
      );
      const grouped = new Map<string, StandardRowEntry[]>();
      conflict.entries.forEach((entry) => {
        const key = entry.abbr || "";
        const group = grouped.get(key) ?? [];
        group.push(entry);
        grouped.set(key, group);
      });
      grouped.forEach((groupEntries, abbr) => {
        const locations = groupEntries
          .map((entry) => `row ${entry.rowNo} (번호 ${entry.numberCol || "-"})`)
          .join(", ");
        console.warn(`  - abbr: "${abbr}" @ ${locations}`);
      });
    });
  }

  if (overrideErrors.length || synonymConflicts.length || forbiddenConflicts.length) {
    if (overrideErrors.length) {
      console.error("Override mismatches detected:");
      overrideErrors.forEach((error) => {
        console.error(
          `- ${error.standard}: override "${error.override}" not found. Available: ${error.available
            .map((abbr) => `"${abbr}"`)
            .join(", ")}`
        );
      });
    }

    if (synonymConflicts.length) {
      console.error("Synonym conflicts detected:");
      synonymConflicts.forEach((conflict) => {
        console.error(
          `- "${conflict.token}": ${conflict.existing.standard} (row ${conflict.existing.rowNo}, 번호 ${conflict.existing.numberCol || "-"}) vs ${conflict.incoming.standard} (row ${conflict.incoming.rowNo}, 번호 ${conflict.incoming.numberCol || "-"})`
        );
      });
    }

    if (forbiddenConflicts.length) {
      console.error("Forbidden word conflicts detected:");
      forbiddenConflicts.forEach((conflict) => {
        console.error(
          `- "${conflict.token}": ${conflict.existing.standard} (row ${conflict.existing.rowNo}, 번호 ${conflict.existing.numberCol || "-"}) vs ${conflict.incoming.standard} (row ${conflict.incoming.rowNo}, 번호 ${conflict.incoming.numberCol || "-"})`
        );
      });
    }

    process.exit(1);
  }

  const output = {
    meta: {
      source: path.basename(SOURCE_FILE),
      sheet: SHEET_NAME,
      generatedAt: new Date().toISOString(),
      overrides: {
        standard: Object.keys(overrides.standard ?? {})
      }
    },
    standard: standardMap,
    synonym: synonymMap,
    forbidden: forbiddenMap
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Dictionary written to ${OUTPUT_FILE}`);
}

main();
