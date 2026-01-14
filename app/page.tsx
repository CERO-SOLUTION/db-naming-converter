"use client";

import type { ConvertResult, WarningType } from "@/lib/convert";
import { useEffect, useMemo, useState } from "react";

const WARNING_LABELS: Record<WarningType, string> = {
  forbidden: "금칙어",
  synonym: "동의어",
  unknown: "미등록",
  "format-position": "형식단어 위치"
};

const WARNING_DESCRIPTIONS: Record<WarningType, string> = {
  forbidden: "금칙어 목록에 있는 단어가 입력에 포함된 경우. 표준단어로 자동 교정되어 변환됨.",
  synonym: "표준단어의 동의어가 입력된 경우. 표준단어로 매핑되어 변환됨.",
  unknown: "사전에 없는 단어가 입력된 경우. 결과는 unk로 치환됨.",
  "format-position":
    "형식단어(형식단어여부=Y)가 마지막 토큰이 아닌 위치에 있을 때 경고."
};

function uniqueTokens(tokens: string[]): string[] {
  return Array.from(new Set(tokens.filter(Boolean)));
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!input.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
          signal: controller.signal
        });

        const data = (await response.json()) as ConvertResult & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Failed to convert");
        }

        setResult(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "Unexpected error";
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [input]);

  const warnings = result?.warnings ?? [];
  const tokens = result?.tokens ?? [];
  const showWarnings = warnings.length > 0;

  const warningGroups = useMemo(() => {
    const groups: Record<WarningType, string[]> = {
      forbidden: [],
      synonym: [],
      unknown: [],
      "format-position": []
    };

    warnings.forEach((warning) => {
      groups[warning.type].push(warning.token);
    });

    return {
      forbidden: uniqueTokens(groups.forbidden),
      synonym: uniqueTokens(groups.synonym),
      unknown: uniqueTokens(groups.unknown),
      "format-position": uniqueTokens(groups["format-position"])
    };
  }, [warnings]);

  const outputValue = result?.output ?? "";
  const descriptionValue = result?.description ?? "";

  const handleCopyOutput = async () => {
    if (!outputValue) {
      return;
    }
    await navigator.clipboard.writeText(outputValue);
    setCopyNotice("결과가 복사되었습니다");
    setTimeout(() => setCopyNotice(null), 1500);
  };

  const handleCopyDescription = async () => {
    if (!descriptionValue) {
      return;
    }
    await navigator.clipboard.writeText(descriptionValue);
    setCopyNotice("설명이 복사되었습니다");
    setTimeout(() => setCopyNotice(null), 1500);
  };

  return (
    <main>
      <div className="page">
        <header className="hero">
          <div className="badge">DB 네이밍 변환기</div>
          {/* <h1>DB 네이밍 변환기</h1>
          <p>
            밑줄로 구분된 입력을 표준 약어로 변환합니다. 정확히 일치하는 단어만 변환하며
            금칙어, 동의어, 미등록 단어는 경고로 안내합니다.
          </p> */}
        </header>

        <section className="panel">
          <div className="field">
            <div className="field-header">
              <label htmlFor="input">입력</label>
              <button
                className="ghost-button"
                type="button"
                onClick={() => setInput("")}
                disabled={!input}
              >
                지우기
              </button>
            </div>
            <input
              id="input"
              type="text"
              value={input}
              placeholder="통계_일시"
              onChange={(event) => setInput(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="result">
            <div className="result-header">
              <label>출력</label>
              <div className="actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={handleCopyOutput}
                  disabled={!outputValue}
                >
                  결과 복사
                </button>
              </div>
            </div>
          <div className="result-body">
            <span className="result-text">{outputValue || "변환할 단어를 입력하세요."}</span>
            {loading ? <span className="loading">변환 중...</span> : null}
          </div>
          <div className="result-header">
            <label>설명</label>
            <div className="actions">
              <button
                className="ghost-button"
                type="button"
                onClick={handleCopyDescription}
                disabled={!descriptionValue}
              >
                설명 복사
              </button>
            </div>
          </div>
          <div className="result-body result-body--description">
            <span className="result-text">
              {descriptionValue || "설명이 없습니다."}
            </span>
          </div>
          {copyNotice ? <span className="pill dark">{copyNotice}</span> : null}
          {error ? <span className="pill warm">{error}</span> : null}
        </div>
      </section>

        <section className="stack">
          {showWarnings ? (
            <div className="card">
              <h2>경고</h2>
              <div className="warning-list">
                {(
                  [
                    { type: "forbidden", tokens: warningGroups.forbidden },
                    { type: "synonym", tokens: warningGroups.synonym },
                    { type: "unknown", tokens: warningGroups.unknown },
                    { type: "format-position", tokens: warningGroups["format-position"] }
                  ] as const
                ).map((group) => (
                  <div className="warning-item" key={group.type}>
                    <span
                      className={`pill ${group.type === "forbidden" ? "warm" : ""} tooltip`}
                      data-tooltip={WARNING_DESCRIPTIONS[group.type]}
                    >
                      {WARNING_LABELS[group.type]}
                      <span className="tooltip-indicator" aria-hidden="true" />
                    </span>
                    <span>
                      {group.tokens.length ? group.tokens.join(", ") : "없음"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card">
            <h2>토큰 상세</h2>
            {tokens.length === 0 ? (
              <p className="empty-state">변환 후 토큰이 표시됩니다.</p>
            ) : (
              <table className="tokens-table">
                <thead>
                  <tr>
                    <th>
                      <span className="tooltip" data-tooltip="번호">
                        번호
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="공통표준단어명">
                        단어
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="공통표준단어영문약어명">
                        약어
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="공통표준단어영문명">
                        영문명
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="공통표준단어설명">
                        설명
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="형식단어여부">
                        형식
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="공통표준도메인분류명">
                        도메인
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="이음동의어목록">
                        동의어
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                    <th>
                      <span className="tooltip" data-tooltip="금칙어목록">
                        금칙어
                        <span className="tooltip-indicator" aria-hidden="true" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token, index) => (
                    <tr key={`${token.input}-${index}`}>
                      <td>{token.numberCol || "-"}</td>
                      <td>{token.standard || token.input || "-"}</td>
                      <td>{token.abbr || "-"}</td>
                      <td>{token.englishName || "-"}</td>
                      <td>
                        {token.description?.trim() ? (
                          <span className="tooltip ellipsis" data-tooltip={token.description}>
                            <span className="ellipsis-text">{token.description}</span>
                            <span className="tooltip-indicator" aria-hidden="true" />
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{token.isFormat === undefined ? "-" : token.isFormat ? "Y" : "N"}</td>
                      <td>{token.domainName || "-"}</td>
                      <td>{token.synonymList?.length ? token.synonymList.join(", ") : "-"}</td>
                      <td>{token.forbiddenList?.length ? token.forbiddenList.join(", ") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
