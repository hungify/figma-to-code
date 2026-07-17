---
name: figma-implement-design
description: Implements UI from Figma into this repo with component-resolution, prop-map, visual gold diff, and AST gate. Use when user provides a Figma URL/node, or says "implement design", "generate code from Figma", "implement component", or asks to match Figma specs. For canvas writes use figma-use; for design-system prop maps use figma-props-sync first.
---

# Implement Design

Figma MCP = design context, not final code. Prefer `src/components/ui` + tokens. **Never hand-edit** `.figma/prop-map/*.json` (`figma-props-sync` owns them).

**Read on demand (progressive disclosure):**

| When                           | File                                                 |
| ------------------------------ | ---------------------------------------------------- |
| Step 4 / gate flags            | [reference.md](reference.md)                         |
| Step 5 screens — testids / e2e | [references/automation.md](references/automation.md) |
| Step 6 visual gold loop        | [references/visual.md](references/visual.md)         |

## Prerequisites

- Figma MCP connected
- URL `…/design/:fileKey/…?node-id=1-2` → `fileKey` + `nodeId` (`1-2` → `1:2`)

## Workflow (order, no skip)

### 1. Fetch

`get_design_context` + `get_screenshot` per user node. Truncated → `get_metadata` → child fetch only. Dual mobile+desktop → fetch **both** nodes.

### 2. Assets

MCP asset URLs (`localhost` OK). Icons: `lucide-react` `*Icon`; brands: `@icons-pack/react-simple-icons`. No new icon packages without approval.

### 3. Resolve (before JSX)

1. `src/components/ui/` → 2. prop-map by exact Figma name → 3. `pnpm ui add` / `figma-props-sync` or **stop**
2. Write `.figma/artifacts/<feature>/<screen>/component-resolution.json`
3. **Stop** if `unresolved` non-empty

`decision`: `reuse` | `create` | `custom` only (never `extend`). Dual nodes: `source.nodeId` + `source.desktopNodeId`. Layout chrome (Header/Footer) may be `notes` + reuse layout components.

Minimal shape: see [reference.md](reference.md#resolution-artifact).

### 4. Props

For each `reuse`/`create`: load prop-map → apply `mappingKind` ([reference.md](reference.md)). No className guessing for mapped props. Missing map → **STOP** (or user-force + guessed comment, gate without `--require-prop-map`). Skip for `custom`.

### 5. Code

- Prop-map props first; Tailwind leftovers only; no raw `<button>`/`<input>` for resolved primitives
- Tokens + typography `jp-*`/`en-*` (`AGENTS.md`); unknown style → **stop**
- Feature: `src/features/<feature>/screens/<screen>/…`; thin route → screen component
- Screens: **read** [references/automation.md](references/automation.md) — `testids.ts` + root/primary `data-testid`
- Forms: required/optional match Figma; note placeholder `href="#"`

### 6. Visual parity (screens only)

Skip DS/ui/showcase. **Read and follow** [references/visual.md](references/visual.md).

Core rule: **1 user Figma node → 1 gold/actual/diff contract** (folder `mobile/` and/or `desktop/`). Do not invent a second breakpoint; do not skip a requested node. `FIGMA_VISUAL_MIN_MATCH` (default `0.98`), max **3** fix rounds **per node**.

### 7. Gate → lint

```bash
pnpm figma-gate:components -- \
  --artifact .figma/artifacts/<feature>/<screen>/component-resolution.json \
  --files src/features/<feature>/screens/<screen>/<file>.tsx \
  --require-prop-map --check-prop-map-usage
```

Must `PASS`, then `pnpm lint`. Flags: [reference.md](reference.md#gate-flags). Pressure: `pnpm figma-gate:test`.

### 8. Optional E2E (screens)

After visual + gate: **ask confirm** → thin POM + `@smoke` from testids. Details: [references/automation.md](references/automation.md#optional-e2e-generate). Not a full explore/heal test-agent.

## Failures

| Symptom          | Fix                                                                 |
| ---------------- | ------------------------------------------------------------------- |
| Truncated MCP    | `get_metadata` → child fetch                                        |
| Visual fail      | that node’s `diff.png` + fix ≤3 ([visual.md](references/visual.md)) |
| Hybrid artifacts | normalize folders per visual.md                                     |
| Bad props        | `figma-props-sync` → Step 4                                         |

**Default: single agent** + this skill. Do not spawn parallel implement agents on the same files.
