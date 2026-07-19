# Component fidelity

Read during component coverage and final verification.

## Harness

- Reuse/create `src/components/<name>-showcase.tsx` and mount it under the repo's `/showcase/*` surface (a shared `/showcase/` route or a component-specific child route are both valid).
- Give every case unique stable `data-testid="figma.<component>.<case>"`.
- Render real component API; no copied markup, screenshots, transforms, or test-only styling that hides mismatch.
- Harness background/padding may aid capture but selector must crop exact component root.

## Coverage matrix

Use prop-map groups as axes. Select minimal cases covering every mapped Figma value at least once. BOOLEAN mappings require every value present in generated variant evidence; never self-declare a missing gold state. Record an unrepresented boolean state as a visual gap for developer review. Do not generate a full Cartesian product unless visual interaction between axes demands it.

## Fidelity contract

For each case:

1. Fetch gold for exact variant/component node.
2. Run `fidelity_run` with absolute paths, unique selector, `component/strict`, exact expected size, final run, and stability sampling.
3. Inspect diff even on pass.
4. Fix and rerun, maximum three rounds per case.
5. Require complete, fresh, hash-bound evidence and report engine score/residuals for developer review.

Local component gate delegates score, gold, metadata, freshness, profile, selector, expected-size, and evidence-hash validation to pinned `figma-fidelity` `checkDoneGate`. Do not duplicate those checks in repo scripts; retain only repo-specific viewport and variant/gold bindings.

Artifact path:

```text
.figma/artifacts/design-system/<Component>/variants/<case-id>/
  figma-gold.png
  figma-gold.meta.json
  actual.png
  diff.png
  visual-score.json
  run-meta.json
  punch-list.json
```

Page profile, full-page dilution, and pageReason escapes are forbidden for component cases.

Local gate fails missing, stale, tampered, or contract-mismatched evidence. Engine `pass=false` and residual clusters emit `VISUAL_REVIEW_REQUIRED`; developer reviews component API/code, match ratio and diff, then manually exercises supplied states. Business behavior remains outside this skill.
