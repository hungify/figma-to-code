---
name: figma-implement-design
description: Implements or reviews Figma-derived UI in this repo using a validated implementation contract, design-system prop maps, visual fidelity checks, and an AST component gate. Use when user provides a Figma URL/node, asks to implement the current Figma Desktop selection, says "implement design", "generate code from Figma", "implement component", asks to match Figma specs, or asks to review code generated from Figma. For canvas writes use figma-use; for design-system prop maps use figma-props-sync first.
---

# Implement Design

Figma MCP = design context (`get_design_context` / screenshot), not final code.  
Visual Step 6 = **`figma-fidelity` MCP** (`fidelity_*`) — see [visual.md](references/visual.md).  
Prefer `src/components/ui` + tokens. **Never hand-edit** `.figma/prop-map/*.json` (`figma-props-sync` owns them).

**Read on demand (progressive disclosure):**

| When                             | File                                                 |
| -------------------------------- | ---------------------------------------------------- |
| Step 3–4 / contract and gate     | [reference.md](reference.md)                         |
| Step 5 screens — clean structure | [references/structure.md](references/structure.md)   |
| Step 5 screens — testids / e2e   | [references/automation.md](references/automation.md) |
| Step 5–7 behavior / a11y         | [references/validation.md](references/validation.md) |
| Step 6 visual gold loop          | [references/visual.md](references/visual.md)         |

## Boundaries

- Deliverable is application code → continue with this skill.
- Create/edit/delete Figma canvas nodes → use `figma-use`.
- Build a full screen in Figma from code or description → use `figma-generate-design`.
- Create Code Connect mappings only → use `figma-code-connect`.
- Create reusable `AGENTS.md`/design-system rules → use `figma-create-design-system-rules`.

## Prerequisites

- Figma MCP connected (design fetch)
- `figma-fidelity` MCP connected (visual gate) — `pnpm add -D github:hungify/figma-fidelity` + `pnpm exec figma-fidelity setup --project`; `FIGMA_ACCESS_TOKEN` in `.env`
- Remote Figma MCP: URL required. Parse `…/design/:fileKey/…?node-id=1-2` → `fileKey` + `nodeId` (`1-2` → `1:2`).
- Figma Desktop MCP: URL or current selected node. With selection-based input, use current file/selection and omit `fileKey` where the tool API expects it.

## Workflow (order, no skip)

### 1. Fetch

`get_design_context` + `get_screenshot` per user node or current Desktop selection. Truncated → `get_metadata` → child fetch only. Dual mobile+desktop → fetch **both** nodes.

### 2. Assets

- **UI icons:** `lucide-react` `*Icon` only (eye-off → `EyeOffIcon`, etc.). Do **not** save Figma icon SVGs under `public/`.
- **Brands:** `@icons-pack/react-simple-icons`.
- **Download MCP localhost/SVG** only for photos / illustrations / logos / decorative art with no lucide or simple-icons match — never for standard UI chrome icons.
- No new icon packages without approval.

### 3. Resolve (before JSX)

1. `src/components/ui/` → 2. prop-map by exact Figma name → 3. `pnpm ui add` / `figma-props-sync` or **stop**
2. Write validated `.figma/artifacts/<feature>/<screen>/component-resolution.json`: every requested node, implementation file, resolution, asset, screen composition, and visual contract
3. **Stop** if `unresolved` is non-empty; do not start JSX

Design-system `decision`: `reuse` | `create` only. Layout: `reuse` only. No `custom`, `extend`, inferred source fields, or prose-only chrome resolution. Feature-specific blocks belong in `screenCompositions[]`, not `resolved[]`.

Normative shape and invariants: [reference.md](reference.md).

### 4. Props

For each `kind: "design-system"`: load its validated prop map → apply `groups[].mappings[].mappingKind` ([reference.md](reference.md)). Missing/invalid/stale map → **STOP** and run `figma-props-sync`; there is no guessed-props or weakened-gate path. Skip prop maps only for `kind: "layout"` and screen compositions.

### 5. Code

- **Codebase-first + clean code:** mirror existing `src/features/*/screens/*` (and layout/ui) before inventing. Apply clean-code habits from [references/structure.md](references/structure.md) + [`.agents/architecture.md`](../../architecture.md) — e.g. thin screen, extract UI blocks / hooks when logic grows; form+hook split is **one** common pattern (login), not the only shape.
- Prop-map props first; Tailwind leftovers only; no raw `<button>`/`<input>` for resolved primitives
- Tokens + typography `jp-*`/`en-*` (`AGENTS.md`); unknown style → **stop**
- Feature: `src/features/<feature>/screens/<screen>/…`; thin route → screen component
- Screens: **read** [references/automation.md](references/automation.md) — `testids.ts` + root/primary `data-testid`
- Forms: required/optional match Figma; note placeholder `href="#"`
- Screens and interactive components: read [references/validation.md](references/validation.md); implement responsive constraints, component states, accessibility, and deviation reporting
- Keep `implementationFiles[]` complete; the gate derives its scan coverage from the artifact

### 6. Visual parity (screens only)

Skip DS/ui/showcase. **Read and follow** [references/visual.md](references/visual.md) (mandatory — includes login postmortem).

Finalize `visualContracts[]`, execute each contract through the MCP-first loop in `visual.md`, and stop unless every required source intent reaches `fidelity_done_gate.done === true`. Do not reconstruct contract inputs from memory or prose notes.

### 7. Gate → lint

```bash
pnpm figma-gate:components -- \
  --artifact .figma/artifacts/<feature>/<screen>/component-resolution.json
```

Must `PASS`. Complete behavioral/accessibility review from [references/validation.md](references/validation.md), then `pnpm lint`. All contract checks are mandatory; weakening flags are rejected. Pressure: `pnpm figma-gate:test`.

### 8. Optional E2E (screens)

After visual + gate: **ask confirm** → thin POM + `@smoke` from testids. Details: [references/automation.md](references/automation.md#optional-e2e-generate). Not a full explore/heal test-agent.

## Failures

| Symptom                          | Fix                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Truncated Figma context          | `get_metadata` → child fetch                                                        |
| Visual/contract failure          | follow [visual.md](references/visual.md); stop with exact artifacts after its limit |
| Bad props                        | `figma-props-sync` → Step 4                                                         |
| Invalid artifact / unknown field | regenerate the contract from [reference.md](reference.md)                           |
| Missing implementation usage     | fix `resolved[]` or `implementationFiles[]`; never pass a narrower manual file list |
| Messy / monolith screen          | clean up per [structure.md](references/structure.md) + siblings                     |
| Invented structure               | rematch sibling under `src/features/*/screens/*`                                    |

**Default: single agent** + this skill. Do not spawn parallel implement agents on the same files.
