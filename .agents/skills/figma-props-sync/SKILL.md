---
name: figma-props-sync
description: Builds or updates `.figma/prop-map/*.json` from Figma design-system component definitions and current React component APIs. Human-in-loop workflow; developer review is required before accepting generated mappings.
---

# Sync Figma UI Props

Generate validated Figma-property → React-API mappings. Record differences; never invent feature logic or rename code APIs merely to mirror Figma.

## Human-in-loop contract

This skill does not autonomously approve prop maps. Agent generates mappings and validation evidence. Developer reviews exceptional mappings and API changes before accepting output. `finalize`/`check` success proves schema and source consistency only, never merge approval.

## Storage

| Path                                                                                                | Role                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------- |
| `.figma/cache/<task-id>/_figma-props-raw.json`, `_code-props-raw.json`, `_figma-props-matched.json` | Isolated cycle artifacts        |
| `.figma/cache/<task-id>/code-props-cache.json`                                                      | Isolated extraction cache       |
| `.figma/prop-map/*.json`                                                                            | Durable schema-v2 mapping files |

Derive one filesystem-safe `<task-id>` from `fileKey + sorted nodeIds + run-id` for each sync cycle, for example `k0CrXX6p-415-100512-run-01`. `nodeId` alone is not globally unique, and `run-id` prevents concurrent work on the same source from colliding. Never reuse `.figma/cache` root or another active task's directory. Pass same `--cache-dir` to fetch, extract, and finalize.

## Commands

```bash
pnpm figma-props:fetch -- --cache-dir .figma/cache/<task-id> --file-key <key> --node-ids <ids>
pnpm figma-props:extract -- --cache-dir .figma/cache/<task-id> --ui-dir src/components
# agent writes .figma/cache/<task-id>/_figma-props-matched.json
pnpm figma-props:finalize -- --cache-dir .figma/cache/<task-id>
pnpm figma-props:check
pnpm figma-props:check -- --components Button,Input
pnpm figma-props:verify-source -- --components Button,Input
pnpm figma-props:test
```

## Workflow

1. Fetch component/component-set definitions.
2. Extract current named React component APIs.
3. Match every Figma property exactly once inside its owning group:
   - `direct`: one React prop;
   - `override`: one Figma value assigns multiple React props;
   - `composition`: children/slots/icons/parent composition;
   - `unmapped`: no code representation.
4. Finalize validates group/property/value coverage, React props, evidence paths, definition hash, and API hash.
5. Verify source definitions when needed.

## Review policy

- Direct/override mappings remain strict and machine-validated.
- Exact normalized React-prop candidates cannot be hidden as composition/unmapped.
- `composition`/`unmapped` requires concise `note`.
- Unknown enumerable code domains require explicit `valueMap`.
- Figma `BOOLEAN` may map directly to extracted React `boolean`.
- Duplicate property names remain group-local; conflicting translations for one screen target are rejected by screen gate.

Developer normally reviews only medium/low-confidence, composition, unmapped, overrides, and API changes. High-confidence direct mappings remain available for inspection but need no separate ceremony.

Screen/component gates scope freshness to components used by current task. Run unscoped `figma-props:check` only for full-library maintenance or CI.

## Output

Report created/updated prop maps, confidence summary, exceptional mappings needing developer review, and commands run. Do not claim feature logic implemented.
