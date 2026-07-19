---
name: figma-implement-design
description: Classifies and routes generic or ambiguous Figma-to-code UI implementation requests in this repo. Use when the user provides a node-specific Figma URL and asks to implement or match Figma without clearly saying whether the target is an application screen or a design-system component. Human-in-loop workflow; developer review is always required.
---

# Route Figma UI Implementation

Router only. Do not implement UI or business logic before target classification.

## Human-in-loop contract

This workflow is not autonomous approval. Agent produces UI code and review evidence. Developer always reviews generated code, Figma match/diff, and running UI before accepting work. Gate success never means merge-ready.

## Boundary

These skills implement presentation from Figma. They do not invent or wire API, auth, database, mutation, redirect, analytics, or business-validation logic. Existing product logic may be preserved and connected through already-defined interfaces; missing logic becomes an explicit integration point for another task or the developer.

## Workflow

1. Require a node-specific Figma URL, parse `fileKey` and every user node ID, and require `FIGMA_ACCESS_TOKEN` in project `.env`.
2. Read [classification contract](references/classification.md).
3. Generate current metadata evidence:

```bash
pnpm figma-classify -- \
  --file-key <key> \
  --source <source-id=1:2> \
  --out .figma/artifacts/routing/<task>/target-classification.json
```

4. Route:
   - `screen` → `figma-implement-screen`.
   - `design-system-component` → `figma-implement-component`.
   - `ambiguous` → ask for containing screen frame or source component/component-set root.
5. Child generates evidence in its own canonical task directory. Do not copy or hand-edit routing evidence.

Explicit child invocation skips router flow, but child still runs classifier as mismatch guard.

## Developer-reviewed completion

Passing gates never means merge-ready. Final owner is developer, reviewing:

1. generated UI code;
2. Figma match percentages plus gold/actual/diff;
3. manual UI behavior in running app.

Machine checks remain high-signal guardrails: target classification, source availability, component reuse, prop freshness, artifact consistency, and visual evidence completeness.

File-level Figma revision drift is advisory because unrelated edits in same Figma file may change revision. Missing requested nodes remains a hard failure.
