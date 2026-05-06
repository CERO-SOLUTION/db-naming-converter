import { describe, expect, it } from "vitest";
import { convertAbbrToKorean, convertInput } from "./convert";
import { normalizeDictionary, type Dictionary } from "./dict-utils";

const rawDictionary: Dictionary = {
  meta: { source: "test.xlsx", sheet: "DB" },
  standard: {
    통계: {
      abbr: "stats",
      englishName: "statistics",
      description: "/ui stats",
      domainName: "common",
      isFormat: false,
      rowNo: 2,
      numberCol: "1",
    },
    일시: {
      abbr: "dt",
      englishName: "date time",
      description: "date time",
      domainName: "common",
      isFormat: true,
      rowNo: 3,
      numberCol: "2",
    },
    메시지: {
      abbr: "msg",
      englishName: "message",
      description: "message text",
      domainName: "common",
      isFormat: false,
      rowNo: 4,
      numberCol: "3",
    },
    IP: {
      abbr: "ip",
      englishName: "ip",
      description: "ip address",
      domainName: "network",
      isFormat: false,
      rowNo: 5,
      numberCol: "4",
    },
  },
  synonym: {
    아이피: { standard: "IP" },
  },
  forbidden: {
    메세지: { standard: "메시지" },
  },
};

const dict = normalizeDictionary(rawDictionary);

describe("convertInput", () => {
  it("converts standard tokens and keeps order", () => {
    const result = convertInput("통계_일시", dict);
    expect(result.output).toBe("stats_dt");
    expect(result.warnings.length).toBe(0);
    expect(result.tokens[0]?.kind).toBe("standard");
  });

  it("converts input with spaces (no underscores)", () => {
    const result = convertInput("통계 일시", dict);
    expect(result.output).toBe("stats_dt");
    expect(result.warnings.length).toBe(0);
  });

  it("splits compound input by known dictionary keys", () => {
    const result = convertInput("통계일시", dict);
    expect(result.output).toBe("stats_dt");
    expect(result.warnings.length).toBe(0);
  });

  it("warns on forbidden tokens and substitutes standard", () => {
    const result = convertInput("메세지", dict);
    expect(result.output).toBe("msg");
    expect(result.warnings[0]).toMatchObject({
      type: "forbidden",
      token: "메세지",
      suggest: "메시지",
    });
  });

  it("warns on synonyms and maps to standard", () => {
    const result = convertInput("아이피", dict);
    expect(result.output).toBe("ip");
    expect(result.warnings[0]).toMatchObject({
      type: "synonym",
      token: "아이피",
      suggest: "IP",
    });
  });

  it("flags format tokens not in the final position", () => {
    const result = convertInput("일시_통계", dict);
    const formatWarnings = result.warnings.filter(
      (warn) => warn.type === "format-position",
    );
    expect(formatWarnings.length).toBe(1);
    expect(formatWarnings[0]?.token).toBe("일시");
  });

  it("marks unknown tokens", () => {
    const result = convertInput("알수없음", dict);
    expect(result.output).toBe("unk");
    expect(result.warnings[0]?.type).toBe("unknown");
  });
});

describe("convertAbbrToKorean", () => {
  it("converts snake_case abbr into concatenated Korean standard words", () => {
    const result = convertAbbrToKorean("stats_dt", dict);
    expect(result.output).toBe("통계일시");
    expect(result.warnings.length).toBe(0);
  });
});
