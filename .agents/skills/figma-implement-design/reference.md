# Implementation contract

**Read in Step 3 / Step 4 / Step 7.** `component-resolution.json` is the machine-checked handoff between Figma fetch, prop mapping, generated code, and visual fidelity. Regenerate it for every implementation; unsupported schemas are rejected.

## Required shape

```json
{
  "schemaVersion": 2,
  "name": "login",
  "target": { "kind": "screen", "route": "/login" },
  "source": {
    "fileKey": "...",
    "nodes": [
      { "intent": "mobile", "nodeId": "1:2" },
      { "intent": "desktop", "nodeId": "3:4" }
    ]
  },
  "implementationFiles": [
    "src/features/auth/screens/login/login-screen.tsx",
    "src/features/auth/screens/login/components/login-form.tsx",
    "src/routes/_guest/login.tsx"
  ],
  "resolved": [
    {
      "kind": "design-system",
      "figmaNodes": ["text-field"],
      "codeComponent": "TextField",
      "importPath": "#/components/ui/input",
      "decision": "reuse"
    },
    {
      "kind": "layout",
      "figmaNodes": ["Header/SP", "Header/PC"],
      "codeComponent": "Header",
      "importPath": "#/components/layout/header",
      "decision": "reuse"
    }
  ],
  "unresolved": [],
  "screenCompositions": [
    {
      "componentName": "LoginForm",
      "filePath": "src/features/auth/screens/login/components/login-form.tsx",
      "reason": "Screen-only composition; no design-system primitive owns the form."
    }
  ],
  "assets": [],
  "visualContracts": [
    {
      "intent": "desktop",
      "sourceIntent": "desktop",
      "sourceNodeId": "3:4",
      "nodeId": "5:6",
      "purpose": "gate",
      "viewport": { "name": "desktop", "width": 1440, "height": 1024 },
      "outDir": ".figma/artifacts/auth/login/desktop",
      "profile": "component/strict",
      "selector": "[data-testid=\"auth.login\"]",
      "expectSize": { "width": 544, "height": 464 }
    }
  ]
}
```

## Invariants

- `target.kind`: `screen` requires `route` and visual contracts. `design-system` has neither screen compositions nor screen fidelity contracts.
- `source.nodes[]`: every user-provided node, normalized to `1:2`; unique `intent` and `nodeId`.
- `implementationFiles[]`: every created or changed implementation file. The gate owns its scan list from here; missing files fail.
- `resolved[]`: one code component per entry. `design-system` accepts `reuse|create`; `layout` accepts `reuse` only. There is no `custom` or `extend` decision.
- `design-system` resolution always requires a validated `.figma/prop-map/<codeComponent>.json`. Its `target.file` must agree with `importPath`.
- `unresolved[]`: `{ figmaNode, reason }`; any entry stops implementation.
- `screenCompositions[]`: feature-specific composed blocks only, never substitutes for a matching design-system component. Its file must appear in `implementationFiles`.
- `assets[]`: only downloaded photo/illustration/logo/decorative assets with `{ figmaNode, kind, filePath, source: "figma-mcp" }`. UI icons never appear here.
- `visualContracts[]`: exact inputs for `figma-fidelity`. Every requested source intent has exactly one `purpose: "gate"`; extra full-page chrome uses `purpose: "supplemental"` + `profile: "page"`.
- `outDir` is repo-relative in the artifact and ends with `intent`; resolve to an absolute path when calling MCP.
- Unknown keys, legacy fields, duplicate intents/components/files, omitted usage, missing prop maps, and weakening CLI flags fail.

## Prop-map consumption

Prop maps must pass validation, match `target.component`, and contain `groups[].mappings[]`. Any unsupported shape is invalid; run `figma-props-sync`. Never hand-edit `.figma/prop-map/*.json`.

| `mappingKind` | Behavior                                                     |
| ------------- | ------------------------------------------------------------ |
| `direct`      | Set `reactProp` (+ `valueMap` if needed). `null` means omit  |
| `override`    | Apply `valueOverrides[figmaValue]`; `{}` means no props      |
| `composition` | No mapped prop; follow `note` for children, slots, and icons |
| `unmapped`    | No code prop; follow `note` and do not invent                |

Treat `confidence: low` as review evidence, not permission to guess. Verify against screenshot and extracted code API.

## Gate

```bash
pnpm figma-gate:components -- \
  --artifact .figma/artifacts/<feature>/<screen>/component-resolution.json
```

All checks are mandatory: artifact schema, exact files, resolved usage/imports, prop-map validity, Figma-prop translation, raw primitive rejection, screen-composition approval, assets, and visual-contract coverage. No optional weakening flags exist.

## Icons

`INSTANCE_SWAP` / UI icon name → `lucide-react` `*Icon`. Brands → `@icons-pack/react-simple-icons`. No new icon packages and no downloaded standard UI SVGs.
