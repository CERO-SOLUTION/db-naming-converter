# DB Naming Converter

Next.js (App Router) + TypeScript app that converts underscore-separated terms into standard DB abbreviations using the provided Excel dictionary.

## Local development

1. Install dependencies:

```bash
pnpm install
```

2. Start the dev server (this regenerates the dictionary):

```bash
pnpm dev
```

## Dictionary regeneration

The build step parses the Excel file and writes `data/dictionary.json`.

```bash
pnpm run build:dict
```

- Source: `./BMS_테이블_정의_V1.1.xlsx`
- Sheet: `DB사전`
- Output: `data/dictionary.json`

Builds fail if:
- A synonym maps to multiple standards.
- A forbidden word maps to multiple standards.
- An override value does not match any abbreviation in the sheet.

Standard term conflicts can be resolved by adding `dictionary.overrides.json` at the repo root:

```json
{
  "standard": {
    "보훈": "pv",
    "중권역": "msirb"
  }
}
```

If no override is supplied, the first row wins and a warning is logged.

## Conversion policy

- Tokenization: split input by `_`, trim, remove internal whitespace, compare case-insensitively.
- Exact match only (no partial matching).
- Priority: forbidden → standard → synonym → unknown.
- Forbidden tokens are auto-corrected to their standard term and warned.
- Synonyms are mapped to their standard term and warned.
- Unknown tokens output `unk` and are warned.
- Format words (marked `Y`) trigger a warning if not in the last position.

## API

- `POST /api/convert`
  - Request: `{ "input": "통계_일시" }`
  - Response: `{ "output": "stats_dt", "warnings": [...], "tokens": [...] }`
- `GET /api/health`

## Vercel deploy

1. Commit the project, including the Excel file.
2. Deploy to Vercel as a Next.js project.
3. The `prebuild` script runs `build:dict`, generating `data/dictionary.json` before `next build`.

## Tests

```bash
pnpm test
```
# DB-naming-converter
