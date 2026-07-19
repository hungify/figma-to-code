# Component UI implementation contract

`component-implementation.json` connects target classification, component API, prop map, variant inventory, showcase harness, coverage, and visual evidence. It does not prove feature business logic.

## Core shape

```json
{
  "schemaVersion": 2,
  "name": "Button",
  "target": {
    "kind": "design-system-component",
    "componentName": "Button",
    "codeFile": "src/components/ui/button.tsx"
  },
  "source": {
    "fileKey": "...",
    "nodes": [{ "id": "button", "nodeId": "18:3145" }]
  },
  "classificationEvidence": {
    "filePath": ".figma/artifacts/design-system/Button/target-classification.json",
    "contentHash": "sha256:..."
  },
  "propMapEvidence": {
    "filePath": ".figma/prop-map/Button.json",
    "contentHash": "sha256:..."
  },
  "variantEvidence": {
    "filePath": ".figma/artifacts/design-system/Button/figma-variant-inventory.json",
    "contentHash": "sha256:..."
  },
  "harness": {
    "filePath": "src/components/button-showcase.tsx",
    "route": "/showcase/",
    "componentName": "ButtonShowcase"
  },
  "requiredInteractionStates": ["default", "disabled"],
  "visualGaps": [
    {
      "groupNodeId": "18:3773",
      "figmaProp": "Show prepend#101:10",
      "value": false,
      "reason": "No false-state gold node exists; render this state for developer manual review."
    }
  ],
  "fidelityCases": [
    {
      "id": "large-filled-default",
      "sourceId": "button",
      "groupNodeId": "28:518",
      "goldNodeId": "28:600",
      "selector": "[data-testid=\"figma.button.large-filled-default\"]",
      "expectSize": { "width": 160, "height": 48 },
      "viewport": { "name": "desktop", "width": 1024, "height": 768 },
      "outDir": ".figma/artifacts/design-system/Button/variants/large-filled-default",
      "profile": "component/strict",
      "interactionState": "default",
      "figmaValues": [{ "figmaProp": "Size", "value": "Large" }]
    }
  ],
  "assets": []
}
```

## Machine-enforced invariants

- Classification routes exact source nodes to component skill.
- Target lives under `src/components/ui/` and exports named component.
- Prop-map path, target, code file, API hash, and Figma definition hash match.
- Variant inventory binds source nodes, prop map, groups, enumerable domains, and gold-node values.
- Harness exports named showcase component and route mounts it.
- Every declared Figma VARIANT value has representative fidelity coverage.
- BOOLEAN values represented by Figma evidence have fidelity coverage. Missing gold values use one `visualGaps[]` entry and remain explicit manual-review gaps.
- Every fidelity case uses unique selector/gold/outDir, `component/strict`, expected size, and complete hash-bound evidence. Engine score/residual verdict is review output, not hard approval.
- Page profile and full-page dilution are forbidden for component cases.

## Developer review

Developer reviews:

1. generated component API/code;
2. match percentage plus gold/actual/diff;
3. visual gaps and manual component interaction.

Automated tests support regressions but do not replace manual UI review or imply feature logic.

## Gate

```bash
pnpm figma-gate:component -- \
  --artifact .figma/artifacts/design-system/<Component>/component-implementation.json
```
