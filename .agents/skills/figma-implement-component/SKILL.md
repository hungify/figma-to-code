---
name: figma-implement-component
description: Implements reusable design-system UI components and primitives from Figma COMPONENT, COMPONENT_SET, variants, or design-system sections in this repo. Human-in-loop workflow; developer always reviews code, Figma diff, and manual UI states. Does not own feature business logic.
---

# Implement Figma UI Component

Build reusable `src/components/ui` APIs from Figma definitions and produce reviewable variant fidelity evidence.

## Human-in-loop contract

This skill does not autonomously approve components. Developer always reviews generated API/code, Figma match percentage plus gold/actual/diff, and manually tests supplied UI states. Gate success means evidence consistency only, never merge approval.

## Load on demand

| Need                           | Read                                                                     |
| ------------------------------ | ------------------------------------------------------------------------ |
| Target mismatch                | [classification](../figma-implement-design/references/classification.md) |
| Artifact/API/coverage contract | [component contract](references/contract.md)                             |
| Fidelity harness               | [component fidelity](references/visual.md)                               |
| Prop map missing/stale         | [figma-props-sync](../figma-props-sync/SKILL.md)                         |
| UI accessibility               | [validation](../figma-implement-design/references/validation.md)         |

## Boundary

Implement component presentation API, accessible primitive behavior, UI-local state, and supplied visual variants. Do not add feature mutations, auth, data fetching, redirects, analytics, or product logic to `src/components/ui`.

## Workflow

1. Run current classification into `.figma/artifacts/design-system/<Component>/target-classification.json`; require `design-system-component`.
2. Fetch metadata/design context/screenshots. Preserve component property definitions, variant axes, values, sizes, and supplied visual states.
3. Inspect exact code target and existing prop map:
   - compatible map/API → `reuse`;
   - missing or stale → `figma-props-sync`;
   - new component → implement repo-native API, then finalize map.
4. Implement using existing Base UI/shadcn conventions, `cva`, named exports, `className`, repo tokens, typography, and accessible semantics.
5. Create/reuse showcase harness under `src/components/*-showcase.tsx` and `/showcase/*`.
6. Generate variant inventory and choose minimal representative cases covering enumerable values and supplied visual states.
7. For missing BOOLEAN gold, record `visualGaps[]` with reason. Do not create business-logic tests solely to satisfy artifact bookkeeping; render/mock reviewable UI state when possible.
8. Run strict component fidelity for declared cases and inspect every diff. Missing/tampered evidence fails; score and residual quality remain developer judgment.

## Gate and handoff

```bash
pnpm figma-gate:component -- \
  --artifact .figma/artifacts/design-system/<Component>/component-implementation.json
```

Passing means evidence is internally consistent, not approved. Final report:

```text
Code API and changed UI files
Prop-map/API changes
Variant/state coverage
Match % + gold/actual/diff
Visual gaps
Feature-logic integration points, if any
Manual QA required
```

## Boundaries

- Screen/page/route → `figma-implement-screen`.
- Prop-map-only → `figma-props-sync`.
- Feature business logic stays outside `src/components/ui`.
- Developer owns final code review, visual approval, and manual UI test.
