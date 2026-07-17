# Visual parity (Figma gold vs app)

**Read this in Step 6** for feature screens only.

## Intent → contracts

| User intent                           | Output                       |
| ------------------------------------- | ---------------------------- |
| 1 link / 1 node                       | **1** loop + 1 score         |
| Explicit mobile **and** desktop nodes | **2** loops — both must pass |
| N labeled nodes                       | **N** loops                  |

Do **not** invent a second breakpoint from one link. Do **not** stop after one score when dual nodes were given.

## Artifact layout (hard rules)

```txt
.figma/artifacts/<feature>/<screen>/
  component-resolution.json
  mobile/{figma-gold,actual,diff}.png + visual-score.json
  desktop/{figma-gold,actual,diff}.png + visual-score.json
```

- Always use breakpoint **folders**. One node → one folder named by intent (`mobile/` or `desktop/`).
- Inside folder filenames are always `figma-gold.png`, `actual.png`, `diff.png`, `visual-score.json`.
- **Forbidden:** flat root hybrids (`figma-gold.png` + `*-desktop.png`); root `diff.png` while another viewport is nested; score paths pointing outside the folder.
- Viewport = Figma frame size when known, else mobile `390x844` / desktop `1440x1024`.

## Why full-page `pass` can lie

`matchRatio` = 1 − (diffPixels / **all** pixels). Header/footer/bg dominate a 1440×1024 shot. A wrong primary card (e.g. Figma **Frame 27** ≈ 544×464) can still clear a loose global ratio because chrome matches.

Also: old `actual.png` + `visual-score.json` stay PASS after code wipe/revert — **score without fresh capture = invalid**.

## Env / CLI knobs

| Var / flag                                           | Default | Meaning                                          |
| ---------------------------------------------------- | ------- | ------------------------------------------------ |
| `FIGMA_VISUAL_MIN_MATCH` / `--min-match`             | `0.99`  | min global `matchRatio` (~1% budget)             |
| `FIGMA_VISUAL_THRESHOLD` / `--threshold`             | `0.2`   | per-pixel YIQ sensitivity (Playwright-like)      |
| `FIGMA_VISUAL_MAX_DIFF_PIXELS` / `--max-diff-pixels` | unset   | absolute pixel budget (use on **content** crops) |
| `FIGMA_VISUAL_CLUSTER_CHECK` / `--no-cluster-check`  | on      | fail if one 4×4 cell is much worse than page     |
| `FIGMA_VISUAL_MAX_FIX_ROUNDS`                        | `3`     | max fix loops **per node**                       |

`pass` requires: `matchRatio >= minMatch` **and** (no maxDiffPixels or `diffPixels <= max`) **and** not `clusterFail`.

## Content crop (mandatory when applicable)

After `get_metadata` on the user node: if a child frame is clearly the **primary content** with fixed `width`×`height` (card, modal, form panel — e.g. Frame 27 `544×464`):

1. **Required** content contract for that breakpoint (usually desktop):
   - Gold = MCP screenshot of **that content node** (not full page)
   - Actual = `figma-visual:capture … --selector '[data-testid=<feature>.<screen>]'`
   - Diff with `--max-diff-pixels 500` (tighten if card smaller)
2. Assert CSS size ≈ metadata w×h in code/report.
3. Full-page gold/actual optional for chrome; **content contract is the gate** when both exist.

Mobile full-bleed forms (no card) → full-page + cluster check is enough; still prefer root testid crop when layout is content-only.

## Loop (per user node)

1. MCP screenshot → gold (full page **and/or** content node per rules above)
2. `get_metadata` — record content frame sizes; decide crop vs full-page
3. Dev server. Confirm root `data-testid` present (current feature screen, not placeholder)
4. Capture (**must re-run after every visual fix**; never reuse prior `actual.png` / score):

   ```bash
   # Full page (chrome + content) — cluster check on by default
   pnpm figma-visual:capture -- \
     --url http://localhost:3000/<route> \
     --out .figma/artifacts/<feature>/<screen>/mobile/actual.png \
     --viewport 390x1024

   pnpm figma-visual:capture -- \
     --url http://localhost:3000/<route> \
     --out .figma/artifacts/<feature>/<screen>/desktop/actual.png \
     --viewport 1440x1024

   # Content crop (required when named content frame exists)
   pnpm figma-visual:capture -- \
     --url http://localhost:3000/<route> \
     --out .figma/artifacts/<feature>/<screen>/desktop/actual.png \
     --viewport 1440x1024 \
     --selector '[data-testid=<feature>.<screen>]'
   ```

5. Diff:

   ```bash
   pnpm figma-visual:diff -- \
     --figma .figma/artifacts/<feature>/<screen>/mobile/figma-gold.png \
     --actual .figma/artifacts/<feature>/<screen>/mobile/actual.png \
     --out-dir .figma/artifacts/<feature>/<screen>/mobile

   # Content / card: add pixel budget
   pnpm figma-visual:diff -- \
     --figma .figma/artifacts/<feature>/<screen>/desktop/figma-gold.png \
     --actual .figma/artifacts/<feature>/<screen>/desktop/actual.png \
     --out-dir .figma/artifacts/<feature>/<screen>/desktop \
     --max-diff-pixels 500
   ```

6. Read `visual-score.json` **and** `diff.png`. Treat as fail when:
   - `pass=false`, or
   - `clusterFail=true`, or
   - red concentrates on primary content while chrome is clean (even if tooling missed it) → switch to content crop
7. Fix → re-capture → re-diff (≤3 / node). Else **STOP** + report.

**Done checklist:** each requested folder has all 4 files freshly written; report `breakpoint | matchRatio | worstCell | pass | clusterFail | path`; note `--selector` / content-node gold when used.

## Related

- Eval score-only: `pnpm figma-eval` (`eval/figma-screens/`)
- App↔app Playwright regression (`pnpm test:visual`) — **not** this gate
