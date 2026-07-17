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
- Capture: prefer `[data-testid="{feature}.{screen}"]`; else full page. Viewport = Figma frame size when known, else mobile `390x844` / desktop `1280x720`.

## Env

| Var                           | Default | Meaning                    |
| ----------------------------- | ------- | -------------------------- |
| `FIGMA_VISUAL_MIN_MATCH`      | `0.98`  | min `matchRatio`           |
| `FIGMA_VISUAL_MAX_FIX_ROUNDS` | `3`     | max fix loops **per node** |

## Loop (per user node)

1. MCP screenshot → `<breakpoint>/figma-gold.png`
2. Dev server if needed
3. Capture:

   ```bash
   pnpm figma-visual:capture -- \
     --url http://127.0.0.1:3000/<route> \
     --out .figma/artifacts/<feature>/<screen>/mobile/actual.png \
     --viewport 390x844

   pnpm figma-visual:capture -- \
     --url http://127.0.0.1:3000/<route> \
     --out .figma/artifacts/<feature>/<screen>/desktop/actual.png \
     --viewport 1280x720
   ```

4. Diff:

   ```bash
   pnpm figma-visual:diff -- \
     --figma .figma/artifacts/<feature>/<screen>/mobile/figma-gold.png \
     --actual .figma/artifacts/<feature>/<screen>/mobile/actual.png \
     --out-dir .figma/artifacts/<feature>/<screen>/mobile

   pnpm figma-visual:diff -- \
     --figma .figma/artifacts/<feature>/<screen>/desktop/figma-gold.png \
     --actual .figma/artifacts/<feature>/<screen>/desktop/actual.png \
     --out-dir .figma/artifacts/<feature>/<screen>/desktop
   ```

   (Use only the folders that match requested nodes.)

5. Read `visual-score.json`; on fail inspect that folder’s `diff.png`.
6. All requested nodes `pass` → continue. Else fix UI from diff → re-capture → re-diff (≤3 / node). Else **STOP** + report.

**Done checklist:** each requested folder has all 4 files; artifact root only has `component-resolution.json` (+ folders); report `breakpoint | matchRatio | pass | path`.

## Related

- Eval score-only: `pnpm figma-eval` (`eval/figma-screens/`)
- App↔app Playwright regression (`pnpm test:visual`) — **not** this gate
