---
name: figma-props-sync
description: Use when building or updating `.figma/prop-map/*.json` from a Figma design-system section/component-set (not a screen), or when user says "build prop map", "sync design system props", "map figma props", or design-system variants/properties changed. Also when figma-implement-design stops because a prop-map file is missing.
---

# figma-props-sync

Build `.figma/prop-map/<CodeComponent>.json` (1 file / code component) for `figma-implement-design`. **Never hand-edit** prop-map — only this pipeline.

## Storage

| Path                                                                                      | Role                                              |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `.figma/cache/_figma-props-raw.json`, `_code-props-raw.json`, `_figma-props-matched.json` | Cycle temps; deleted after `finalize`; gitignored |
| `.figma/cache/code-props-cache.json`                                                      | Persistent extract cache; kept                    |
| `.figma/prop-map/*.json`                                                                  | Final — **commit**                                |

## Prerequisites

1. `FIGMA_ACCESS_TOKEN` or `FIGMA_TOKEN` in `.env` (REST PAT — **not** MCP). Script auto-loads `.env`.
2. Link to **DS section / COMPONENT_SET** (not a screen). Confirm if unsure.
3. Parse `fileKey` + `nodeId`(s) first.

## Commands

```bash
pnpm figma-props:fetch -- --file-key <key> --node-ids <id1,id2,...>
pnpm figma-props:extract -- --ui-dir src/components
# agent writes .figma/cache/_figma-props-matched.json
pnpm figma-props:finalize
pnpm figma-props:test
```

Optional: `--cache-dir <path>` on any subcommand.

## Phase 1 — Fetch

`pnpm figma-props:fetch -- --file-key … --node-ids …`

- REST nodes API → `COMPONENT` / `COMPONENT_SET` with `componentPropertyDefinitions`
- → `_figma-props-raw.json`
- 401/403 → stop

Offline shape: [references/fixture-example.json](references/fixture-example.json).

## Phase 2 — Extract (no match)

`pnpm figma-props:extract -- --ui-dir src/components`

- Walk `.tsx`; regex `*Props` + `cva` → `_code-props-raw.json` (+ hash cache)

## Phase 2.5 — Match (agent only)

Read raw + code raw → write `_figma-props-matched.json`.

- Nested Figma sets (`btn-size` / `btn`) often → **one** `codeComponent`
- Per prop: required fields + `mappingKind` rules → [references/schema.md](references/schema.md)
- Hard rules:
  - Inherited/Base UI props: no `high` without `verifiedVia: "external-type-check"` + `.d.ts` path in `note`
  - `composition` ≠ `unmapped`
  - Duplicate Figma names → keep both, lower confidence, `_devReviewNeeded`
  - Unused code props → note / `_devReviewNeeded`

## Phase 3 — Finalize

`pnpm figma-props:finalize`

Validate → group by `codeComponent` → `.figma/prop-map/<CodeComponent>.json` → delete cycle temps → print summary.

## Phase 4 — Fix

Wrong map → edit matched (re-fetch/extract if needed) → `finalize` again. Hot-patch committed JSON only if user asks (next sync overwrites).

## vs implement

Implement reads **only** `.figma/prop-map/X.json`. Missing → stop + this skill. Legacy maps (no `mappingKind`) still readable; next sync here should emit current schema. Never rename code to match Figma — report low-confidence instead.
