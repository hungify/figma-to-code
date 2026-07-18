---
name: figma-props-sync
description: Use when building or updating `.figma/prop-map/*.json` from a Figma design-system section/component-set (not a screen), or when user says "build prop map", "sync design system props", "map figma props", or design-system variants/properties changed. Also when figma-implement-design stops because a prop-map file is missing.
---

# figma-props-sync

Build validated `.figma/prop-map/<CodeComponent>.json` files for `figma-implement-design`. Never hand-edit committed prop maps; regenerate through this pipeline.

## Storage

| Path                                                                                      | Role                                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `.figma/cache/_figma-props-raw.json`, `_code-props-raw.json`, `_figma-props-matched.json` | Cycle artifacts; deleted after `finalize`; gitignored |
| `.figma/cache/code-props-cache.json`                                                      | Persistent extraction cache                           |
| `.figma/prop-map/*.json`                                                                  | Final schema v2 files; commit                         |

## Prerequisites

1. `FIGMA_ACCESS_TOKEN` in `.env`.
2. A design-system section or `COMPONENT_SET`, not a screen.
3. Parse the Figma `fileKey` and all target `nodeId` values.

## Commands

```bash
pnpm figma-props:fetch -- --file-key <key> --node-ids <id1,id2,...>
pnpm figma-props:extract -- --ui-dir src/components
# agent writes validated .figma/cache/_figma-props-matched.json
pnpm figma-props:finalize
pnpm figma-props:check
pnpm figma-props:test
```

`--cache-dir <path>` is supported by each command.

## Phase 1 — Fetch

Fetch Figma REST nodes and preserve every `COMPONENT`/`COMPONENT_SET` group with its `componentPropertyDefinitions`. Stop on authentication failure. See [references/fixture-example.json](references/fixture-example.json) for the offline raw shape.

## Phase 2 — Extract code API

The hybrid TypeScript AST + react-docgen extractor walks `.tsx`, indexes every named exported component by `(codeComponent, codeFile)`, and resolves:

- local aliases, interfaces, intersections, `Pick`/`Omit`, and interface inheritance;
- component props inherited from installed packages;
- referenced CVA variants;
- destructured source props when their type cannot be resolved.

It emits API-only hashes so unrelated implementation edits do not stale prop maps. `pnpm figma-props:check` fails on any non-v2 map or actual API drift.

## Phase 2.5 — Match

Read both raw artifacts and write `_figma-props-matched.json` exactly as specified in [references/schema.md](references/schema.md).

Hard rules:

- Keep mappings nested under their owning Figma group; never flatten duplicate property names across groups.
- Use only `direct`, `override`, `composition`, or `unmapped`.
- Use structured evidence. External declarations and direct source reads require exact paths and hashes.
- `composition` is a real implementation decision; do not label it `unmapped`.
- Every Figma value must be covered exactly. Do not copy redundant `figmaValues` or `codeValues` into the match artifact.
- Never invent a React prop to mirror a Figma property. The guaranteed code component is authoritative; represent the difference as composition or unmapped.

## Phase 3 — Finalize

`pnpm figma-props:finalize` validates schema, Figma definitions, code API, values, and evidence. It then emits one prop-map file per code component, removes obsolete prop-map files, clears cycle artifacts, and prints confidence/mapping totals.

## Phase 4 — Fix drift

For a missing, invalid, or stale map: fetch, extract, rewrite the matched artifact, and finalize again. Do not hot-patch committed JSON.

## Contract with implement

`figma-implement-design` reads only validated prop maps. Missing, invalid, or stale maps are a hard stop: run this pipeline and finalize before resuming implementation. Code component names and APIs stay authoritative; this skill records Figma-to-code differences rather than renaming code.
