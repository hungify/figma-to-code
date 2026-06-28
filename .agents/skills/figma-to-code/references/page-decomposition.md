# Page Decomposition

Use this when Figma scope is a full page.

## Inputs

- Figma file key.
- Page/root node id.
- Target feature name.
- Target screen name.
- Target route.

If route is missing, ask user before implementation.

## Section Plan

Build `.figma/artifacts/<feature>/<screen>/page-plan.json` with:

```json
{
  "feature": "<feature>",
  "screen": "<screen>",
  "route": "<route>",
  "rootNodeId": "<node-id>",
  "sections": [
    {
      "name": "hero-section",
      "nodeId": "1:2",
      "order": 1,
      "bbox": { "x": 0, "y": 0, "w": 1440, "h": 720 },
      "output": "src/features/<feature>/screens/<screen>/sections/hero-section.tsx"
    }
  ]
}
```

## How To Split

1. Prefer direct children of selected page frame.
2. Sort by `absoluteBoundingBox.y`, then `x`.
3. Preserve meaningful Figma names; normalize to kebab-case.
4. If names are generic (`Frame 123`, `Group 7`), infer from visual role: `hero-section`, `stats-section`, `feature-grid-section`, `pricing-section`, `faq-section`, `footer-section`.
5. Keep navigation/header/footer as sections unless repo has shared layout components.
6. Do not assign decorative/background-only nodes as sections unless they affect layout or image fidelity.

## Sub-Agent Scheduling

- Run max 4 section sub-agents in parallel.
- If screen has more than 4 sections, dispatch next section when one finishes.
- Each sub-agent receives only one section node id plus shared route/feature/screen context.
- Sub-agent output must not edit route/page shell.
- Main agent integrates sections into `<screen>.tsx`.

## Visual Verification

Run both:

1. Section diff for each section node.
2. Full-page diff after integration.

Pixel tiers:

- `<=1%`: exact pass.
- `>1% && <=3%`: ask human accept in chat.
- `>3%`: fail; attempt fix pass before asking for override.

## Designer Feedback

If design gate finds raw hex, missing auto layout, unsupported token, or codebase-native deviation, write it to:

```txt
.figma/artifacts/<feature>/<screen>/designer-feedback.md
```

Still generate feedback when design gate fails. Do not continue codegen until user decides.
