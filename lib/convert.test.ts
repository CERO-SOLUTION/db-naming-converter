import { describe, expect, it } from "vitest";
import { convertInput } from "./convert";
import { normalizeDictionary, type Dictionary } from "./dict-utils";

const rawDictionary: Dictionary = {
  meta: { source: "test.xlsx", sheet: "DB" },
  standard: {
    통계: { abbr: "stats", isFormat: false, rowNo: 2, numberCol: "1" },
    일시: { abbr: "dt", isFormat: true, rowNo: 3, numberCol: "2" },
    메시지: { abbr: "msg", isFormat: false, rowNo: 4, numberCol: "3" },
    IP: { abbr: "ip", isFormat: false, rowNo: 5, numberCol: "4" }
  },
  synonym: {
    아이피: { standard: "IP" }
  },
  forbidden: {
    메세지: { standard: "메시지" }
  }
};

const dict = normalizeDictionary(rawDictionary);

describe("convertInput", () => {
  it("converts standard tokens and keeps order", () => {
    const result = convertInput("통계_일시", dict);
    expect(result.output).toBe("stats_dt");
    expect(result.warnings.length).toBe(0);
    expect(result.tokens[0]?.kind).toBe("standard");
  });

  it("warns on forbidden tokens and substitutes standard", () => {
    const result = convertInput("메세지", dict);
    expect(result.output).toBe("msg");
    expect(result.warnings[0]).toMatchObject({
      type: "forbidden",
      token: "메세지",
      suggest: "메시지"
    });
  });

  it("warns on synonyms and maps to standard", () => {
    const result = convertInput("아이피", dict);
    expect(result.output).toBe("ip");
    expect(result.warnings[0]).toMatchObject({
      type: "synonym",
      token: "아이피",
      suggest: "IP"
    });
  });

  it("flags format tokens not in the final position", () => {
    const result = convertInput("일시_통계", dict);
    const formatWarnings = result.warnings.filter((warn) => warn.type === "format-position");
    expect(formatWarnings.length).toBe(1);
    expect(formatWarnings[0]?.token).toBe("일시");
  });

  it("marks unknown tokens", () => {
    const result = convertInput("알수없음", dict);
    expect(result.output).toBe("unk");
    expect(result.warnings[0]?.type).toBe("unknown");
  });
});
