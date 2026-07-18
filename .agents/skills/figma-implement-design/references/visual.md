# Visual parity (Figma gold vs app)

**Read this in Step 6** for feature screens only.

## Primary API: `figma-fidelity` MCP

Agent loop uses **MCP tools** from the `figma-fidelity` server (devDependency: `github:hungify/figma-fidelity`). Wire once:

```bash
pnpm exec figma-fidelity setup --project
# reload Cursor / Claude / Codex MCP
# FIGMA_ACCESS_TOKEN in project .env (never written into MCP configs)
```

| Tool                                    | Use                                                          |
| --------------------------------------- | ------------------------------------------------------------ |
| `fidelity_fetch_gold`                   | Figma Images API → `figma-gold.png` + `figma-gold.meta.json` |
| `fidelity_run`                          | Scope guards → capture → multi-signal compare → artifacts    |
| `fidelity_done_gate`                    | Exact contract check against fresh artifacts                 |
| `fidelity_capture` / `fidelity_compare` | Debug only — prefer `fidelity_run`                           |

**Do not** self-report visual PASS without `fidelity_done_gate` → `done: true` (or an explicit failure report).  
Fallback when MCP is down: `pnpm exec figma-fidelity …` only.

Only validated current-schema scores are accepted. `fidelity_fetch_gold` must return `ok:true, fetched:true`; otherwise stop. Every new run deletes prior verdict artifacts before validation, so a failed run cannot inherit old PASS.

**Paths:** pass **absolute** `goldPath` / `outPath` / `outDir` (MCP cwd may not be the repo root — relative paths break `done_gate`).

## Intent → contracts

| User intent                           | Required gate coverage                       |
| ------------------------------------- | -------------------------------------------- |
| 1 link / 1 node                       | Exactly **1** primary gate contract          |
| Explicit mobile **and** desktop nodes | Exactly **2** primary gates — both must pass |
| N labeled nodes                       | Exactly **N** primary gates                  |

A contained card may make the primary gate use a child `nodeId`; bind it back to the user node with `sourceIntent` + `sourceNodeId`. A full-page chrome run is an additional `purpose: "supplemental"` contract, never a replacement.

Do **not** invent a second breakpoint from one link. Do **not** stop after one score when dual nodes were given.

## Artifact layout (hard rules)

```txt
.figma/artifacts/<feature>/<screen>/
  component-resolution.json          ← local validated implementation contract
  desktop/                           ← GATE folder (content crop when card exists)
  mobile/
```

Optional second desktop folder when Figma PC frame includes chrome (header/footer) **and** a content card:

```txt
  desktop-page/                      ← chrome-only profile=page (never replaces GATE)
```

- Always use breakpoint **folders**. One node → one folder named by intent (`mobile/` or `desktop/`).
- Inside GATE folder: `figma-gold.png` = **gate node** (content card, not full 1440 frame).
- **Forbidden:** flat root hybrids; root `diff.png` while another viewport is nested; score paths outside the folder.
- Viewport size = Figma frame when known, else mobile `390x1024` / desktop `1440x1024` (viewport for browser; selector still crops GATE capture).
- Declare every loop in `component-resolution.json` `visualContracts[]`; do not encode node ids in prose notes or ad-hoc `source.desktop*` fields.

### Artifact glossary (local only — whole `.figma/artifacts/` is gitignored)

| File                        | Meaning                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `figma-gold.png`            | Figma Images API reference for this folder's gate                                          |
| `figma-gold.meta.json`      | Local sidecar (fileKey, nodeId, fetchedAt) — **not** committed; re-created by `fetch_gold` |
| `actual.png`                | Capture used for compare                                                                   |
| `diff.png`                  | Red = real mismatch (read even if `pass`)                                                  |
| `visual-score.json`         | Done-gate evidence                                                                         |
| `run-meta.json`             | Run knobs + warnings                                                                       |
| `punch-list.json`           | Ranked `topIssues` (empty ≠ clean if `diff` red)                                           |
| `component-resolution.json` | Implementation + visual contract (local; regenerate each implement)                        |

Stability flicker samples stay in **OS temp** and are deleted after the run — nothing named `stability-*` lands in the artifact folder.

Human triage: **`diff.png` → `visual-score.json` → `punch-list.json`**.

**Commit:** `.figma/prop-map/*` only (plus code). **Never commit** `.figma/artifacts/`.

## Why full-page `pass` can lie

Global pixel ratio dilutes chrome. Wrong primary CTA / card / icon can still clear `page` thresholds while `diff.png` is red on the control.

**Login postmortem (2026-07-18):** dual PC+SP used `profile=page` + `pageReason` that excused skipping Frame 27 (`153:5181`) content crop (“alpha/shadow”). Scores `pass:true` while `diff.png` still highlighted button / eye / footer. That is the bug class this engine exists to catch — **do not repeat**.

## Content crop (GATE — not optional)

After `get_metadata` on the user node: if a child frame is clearly the **primary content** with fixed `width`×`height` (card, modal, form panel — e.g. Frame 27 `544×464`):

1. **Required gate** for that breakpoint (usually desktop):
   - Gold = `fidelity_fetch_gold` for **that content nodeId** → write as that folder’s `figma-gold.png` (or keep full-page gold as `figma-gold-page.png` and gate on content file — but the **run that decides pass must use content gold**)
   - `fidelity_run` with:
     - `selector: '[data-testid=<feature>.<screen>]'` (unique)
     - `nodeId` = content node
     - `expectSize: { width, height }` from metadata
     - `profile: component/strict` (or `component/dev` while iterating — **never `page`**)
2. Full-page `profile=page` run is **chrome check** — required when the user-linked PC frame includes header/footer/chrome around the card; write under `desktop-page/` (gold = full screen node e.g. `153:2364`). It must **not** replace the content gate in `desktop/`.
3. Record both runs as structured visual contracts: content = `purpose: "gate"`; full frame = `purpose: "supplemental"`. If only `desktop/` exists for a chrome+card screen, report is incomplete for layout — content gate alone is still the wipe-detector.

### Forbidden escapes

- **Forbidden:** `profile=page` + `pageReason` that uses “too hard”, alpha/shadow mismatch, or “reference only” to avoid a contained-content crop. A genuinely full-bleed screen is valid.
- **Forbidden:** storing content gold as `figma-gold-content.png` then gating only on full-page.
- If Figma PNG has transparency/shadow vs canvas:
  1. Prefer DOM `selector` crop (app already composites on canvas), gold = content node with `use_absolute_bounds`, **or**
  2. Composite gold onto the Figma canvas fill color before compare, **or**
  3. STOP and ask user — do **not** silently switch the gate to `page`.

Mobile full-bleed (no card) → full viewport / root testid crop is OK; `page` only with a real layout reason (not to dodge a card).

## Loop (per user node)

Max **3** fix rounds per node. Dev server up. Root `data-testid` present (real screen, not placeholder).

1. `get_metadata` — content frame sizes; decide crop vs full-page (see GATE above).
2. `fidelity_fetch_gold` → absolute `outPath` ending in `…/<viewport>/figma-gold.png`.
3. `fidelity_run` (absolute `goldPath` / `outDir`):

   | Field                              | Notes                                                       |
   | ---------------------------------- | ----------------------------------------------------------- |
   | `url`                              | e.g. `http://localhost:3000/login`                          |
   | `viewport`                         | `"desktop"` / `"mobile"`                                    |
   | `viewportWidth` / `viewportHeight` | capture viewport (full frame size even when selector crops) |
   | `goldPath` / `outDir`              | **absolute** paths                                          |
   | `nodeId`                           | always required; binds gold metadata                        |
   | `selector`                         | required for component profiles; forbidden for page         |
   | `runType`                          | `"final"` before claiming done                              |
   | `expectSize: { width, height }`    | required for `component/strict`; forbidden for page         |
   | `profile` / `pageReason`           | see GATE — `page` never replaces content contract           |

4. **Read `diff.png` even when `pass=true`.** Medium/high residual cluster blocks done-gate. Dispersed low residual often means text rasterization, but still inspect. Treat concentrated red as fail when on:
   - primary CTA / button fill
   - inputs / eye toggle
   - title / primary text
   - card bounds / shadow  
     Empty punch-list + red CTA in diff = **not done**.
5. Fix → re-run `fidelity_run` (never reuse stale actual/score). ≤3 / node else **STOP** + report.
6. `fidelity_done_gate`: each viewport must declare exact `fileKey`, `nodeId`, `profile`, `selector`, `expectSize`, and absolute `outDir`. Page omits selector/expectSize.
   Needs SHA-256-bound gold/meta/actual/diff + complete run-meta/punch-list + fresh `runType:final` + `stability:stable`. `component/dev` never completes done-gate.

**Done checklist:**

- [ ] Content contract ran when content frame exists (`component/strict` + selector)
- [ ] Each viewport folder has fresh gold/actual/diff/score
- [ ] `diff.png` reviewed; no red on primary controls (or explained + STOP)
- [ ] `fidelity_done_gate.done === true` (paste JSON in report)
- [ ] Report: `viewport | profile | nodeId | selector | matchRatio | pass | residualDiffNotes | absolute outDir`

## Profiles (engine)

Defined in `figma-fidelity` `src/profiles.ts` — human-review only; never edit thresholds to force a pass.

| Profile            | When                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `component/strict` | **Gate** for cards/forms/modals (content crop)                                                              |
| `component/dev`    | Looser iteration only; done-gate rejects it                                                                 |
| `page`             | Full-bleed screens with **no** content card — or optional chrome-only check **in addition to** content gate |

## CLI fallback (MCP down / human smoke)

```bash
pnpm exec figma-fidelity fetch-gold --file-key <k> --node-id <id> --out /abs/.../figma-gold.png
pnpm exec figma-fidelity run --url … --viewport desktop --viewport-size 1440x1024 \
  --gold /abs/.../figma-gold.png --out-dir /abs/.../desktop \
  --selector '[data-testid=…]' --node-id <contentId> \
  --expect-width 544 --expect-height 464 --run-type final
pnpm exec figma-fidelity done-gate --viewport desktop --out-dir /abs/.../desktop \
  --file-key <fileKey> --node-id <contentId> --profile component/strict \
  --selector '[data-testid=…]' --expect-width 544 --expect-height 464
```

## Related

- Package: [hungify/figma-fidelity](https://github.com/hungify/figma-fidelity)
- Eval score-only: `pnpm figma-eval` — **not** the agent Step 6 path
- App↔app Playwright (`pnpm test:visual`) — **not** this gate
- Cursor rule: `.cursor/rules/figma-fidelity-mcp.mdc`
