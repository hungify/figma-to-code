# Artifact Contract

Use this for every figma-to-code run. Do not finish if required artifacts or docs are missing.

## Required Artifact Tree

Every screen run must write artifacts under:

```txt
.figma/artifacts/<feature>/<screen>/
  page-plan.json
  scratchpad.json
  gate-design.json
  gate-quality.json
  gate-visual.json
  reference.png
  actual.png
  diff.png
  variables-raw.json
```

Flat `.figma/artifacts/*` files are compatibility outputs only. After each gate, copy or mirror final outputs into the scoped screen folder.

## Required Scratchpad Fields

`scratchpad.json` must include:

```json
{
  "fileKey": "<figma-file-key>",
  "nodeId": "<figma-node-id>",
  "feature": "<feature>",
  "screen": "<screen>",
  "route": "<route>",
  "frame": { "name": "...", "width": 1280, "height": 748 },
  "tokens": {
    "matched": [],
    "arbitrary": [],
    "codebaseNativeDeviations": []
  },
  "components": {
    "shadcnChecked": [],
    "shadcnReused": [],
    "shadcnInstalled": [],
    "customLookupUsed": [],
    "customGenerated": []
  },
  "codeConnect": {
    "available": false,
    "fallback": "custom-component-lookup"
  }
}
```

If exact values are unknown, write an empty array or explicit `null`. Do not omit keys.

## Required Page Plan Checks

`page-plan.json` section output paths must match files actually created.

Invalid:

```json
{ "name": "signup-authentication-section", "output": "src/features/auth/screens/signup/signup.tsx" }
```

Valid:

```json
{
  "name": "signup-authentication-section",
  "output": "src/features/auth/screens/signup/sections/signup-authentication-section.tsx"
}
```

If screen has only one component and no `sections/` folder is created, set section name to `<screen>` and output to the actual screen file.

## Required Screen AGENTS.md Sections

Screen `AGENTS.md` must include:

1. `Meta`: file key, node id, frame size, route.
2. `Visual Gate`: status, diff %, exact threshold, accept threshold, human accepted status.
3. `Artifacts`: reference, actual, diff, gate json paths.
4. `Sections`: section names, component paths, figma node ids.
5. `Component Dependencies`: shadcn reused/installed, custom lookup used, custom generated.
6. `Token Map`: matched tokens and arbitrary values.
7. `Known Deviations`: arbitrary values, font mismatch, codebase-native substitutions.
8. `Patch Boundaries`: route owns behavior/data; screen owns visual composition; do not edit shared components for one screen.
9. `Change History`.

If visual status is `NEEDS_HUMAN_ACCEPT`, screen docs must say `Human accepted: pending` until the user accepts.

## Required Shadcn Evidence

For each shadcn-like Figma component, record one of:

- `reused`: file already exists in `src/components/ui`.
- `installed`: command run, e.g. `pnpm ui add tabs`.
- `missing`: not shadcn; handled as custom/generated.

Do not just write `componentsInstalled: []`; also write what was checked.
