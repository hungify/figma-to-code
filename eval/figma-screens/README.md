# Figma screen eval (mini design bench)

Score-only harness after agent implements a screen.

Per case: **component gate** + **Figma gold vs app capture** (`matchRatio`).

## Add a case

1. Copy `cases/_template` → `cases/<id>/`
2. Fill `case.json` (`fileKey`, `nodeId`, `route`, paths); set `"enabled": true`
3. After implement loop: `figma-gold.png` + `actual.png` under `artifactDir`
4. `pnpm figma-eval`

## Commands

```bash
pnpm figma-eval
```

Writes `eval/figma-screens/last-scorecard.json`.

## Agent loop (implement skill)

Not invoked here. Skill Step 6: capture → diff → fix ≤ `FIGMA_VISUAL_MAX_FIX_ROUNDS` (3) until `FIGMA_VISUAL_MIN_MATCH` (0.98).
