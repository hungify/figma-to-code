---
name: figma-implement-design
description: Implements UI from Figma into this repo with component-resolution, prop-map, and AST gate. Use when user provides a Figma URL/node, or says "implement design", "generate code from Figma", "implement component", or asks to match Figma specs. For canvas writes use figma-use; for design-system prop maps use figma-props-sync first.
---

# Implement Design

Figma MCP = design context, not final code. Prefer `src/components/ui` + tokens over raw Tailwind dumps.

**Prop maps:** owned by `figma-props-sync` — never hand-edit `.figma/prop-map/*.json`.

## Prerequisites

- Figma MCP connected
- URL `…/design/:fileKey/…?node-id=1-2` → `fileKey` + `nodeId` (`1-2` → `1:2`). Desktop MCP: `nodeId` only

## Workflow (order, no skip)

### 1. Fetch

```
get_design_context(fileKey, nodeId)
get_screenshot(fileKey, nodeId)
```

Truncated → `get_metadata` → child `get_design_context` only.

### 2. Assets

- Use MCP asset URLs (`localhost` OK); no placeholders when URL exists
- Icons: `lucide-react` (`*Icon`); brands: `@icons-pack/react-simple-icons`. No new icon packages without approval

### 3. Resolve components (before JSX)

1. `src/components/ui/`
2. Exact Figma name → `.figma/prop-map/*.json` (`figmaGroups[].name` → `codeComponent` / `codeFile`)
3. Missing shadcn → `pnpm ui add`; missing prop-map → `figma-props-sync` or **stop**
4. Write `.figma/artifacts/<feature>/<screen>/component-resolution.json`
5. **Stop** if `unresolved` non-empty

`decision` only: `reuse` | `create` | `custom` (never `extend`).

```json
{
  "screen": "signup",
  "source": { "fileKey": "...", "nodeId": "..." },
  "resolved": [
    {
      "figmaNode": "btn",
      "repoComponent": "Button",
      "importPath": "#/components/ui/button",
      "decision": "reuse",
      "source": "prop-map",
      "mappingSource": "explicit"
    }
  ],
  "unresolved": [],
  "customGenerated": []
}
```

`custom` requires `customGenerated[]` (`componentName`, `filePath`, `customGeneratedReason`) — only after prop-map + ui + `pnpm ui add` all fail.

### 4. Props from prop-map

For each `reuse` / `create`:

1. Load `.figma/prop-map/<repoComponent>.json`
2. Apply `mappingKind` per [reference.md](reference.md) (incl. legacy)
3. No className guessing for mapped props
4. **Missing file → STOP** (suggest `figma-props-sync`). Continue only if user forces → mark `// guessed, not verified via prop-map`, gate **without** `--require-prop-map`

Skip for `custom`.

### 5. Code

- Step 4 props first; Tailwind only for leftovers
- No raw `<button>`/`<input>` for resolved primitives
- Tokens: `src/styles.css`. Typography: Figma text style → `jp-*` / `en-*` (`AGENTS.md`); unknown → **stop and raise**
- Paths: feature `src/features/<feature>/screens/<screen>/…`; showcase `src/components/*-showcase.tsx` + `src/routes/showcase/*`
- Named exports + `className`; `cn` from `#/lib/utils`

### 6. Visual parity

Match Step 1 screenshot (layout, type, color, states, assets). Prefer tokens when values conflict.

### 7. Gate (before lint)

```bash
pnpm figma-gate:components -- \
  --artifact .figma/artifacts/<feature>/<screen>/component-resolution.json \
  --files src/features/<feature>/screens/<screen>/<file>.tsx \
  --require-prop-map \
  --check-prop-map-usage
```

Omit `--files` → git-diff `.tsx`. Flags: [reference.md](reference.md#gate-flags). Must `PASS`, then `pnpm lint`. Regression: `pnpm figma-gate:test`.

## Failures

| Symptom             | Fix                               |
| ------------------- | --------------------------------- |
| Truncated MCP       | `get_metadata` → child fetch      |
| Visual mismatch     | vs Step 1 screenshot              |
| Guessed props wrong | `figma-props-sync` → re-do Step 4 |
