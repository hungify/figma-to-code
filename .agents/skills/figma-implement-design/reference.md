# Prop-map + resolution + gate

**Read in Step 4 / Step 7.** Do not hand-edit `.figma/prop-map/*.json` — use `figma-props-sync`.

## Resolution artifact

```json
{
  "screen": "login",
  "source": {
    "fileKey": "...",
    "nodeId": "...",
    "desktopNodeId": "..."
  },
  "resolved": [
    {
      "figmaNode": "btn",
      "repoComponent": "Button",
      "importPath": "#/components/ui/button",
      "decision": "reuse",
      "source": "prop-map",
      "mappingSource": "explicit"
    }
  ],
  "unresolved": [],
  "customGenerated": []
}
```

- Dual intent: set `nodeId` (mobile) + `desktopNodeId` (or equivalent). Never omit a user-provided node.
- `custom` needs `customGenerated[]` (`componentName`, `filePath`, `customGeneratedReason`) only after prop-map + ui + `pnpm ui add` fail.
- Layout chrome without prop-map → `notes` + reuse layout components.

## `mappingKind`

| Kind          | Behavior                                                              |
| ------------- | --------------------------------------------------------------------- |
| `direct`      | Set `reactProp` (+ `valueMap` if needed). `null` in `valueMap` = omit |
| `override`    | Apply `valueOverrides[figmaValue]` (`{}` = no props)                  |
| `composition` | No prop; follow `note` (children/slots/icons)                         |
| `unmapped`    | No code prop; follow `note` — **do not invent**                       |

Treat `confidence: low` carefully (screenshot + code types).

## Legacy (no `mappingKind`)

Infer at read time; do not rewrite file:

| Condition                                                | Treat as      |
| -------------------------------------------------------- | ------------- |
| `reactProp` + optional `valueMap`                        | `direct`      |
| `reactProp` + `alternateReactProp` + multi-target `note` | follow note   |
| `reactProp: null` + children/icons note                  | `composition` |
| `reactProp: null` + missing-prop note                    | `unmapped`    |

## Icons (composition)

`INSTANCE_SWAP` / icon name → `lucide-react` `*Icon` when possible. Brands → `@icons-pack/react-simple-icons`. No new packages.

## Gate flags

| Flag                     | Behavior                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `--require-prop-map`     | Every `reuse`/`create` needs `.figma/prop-map/<repoComponent>.json` |
| `--check-prop-map-usage` | Fail Figma prop names / Figma literals on mapped React props        |
| `--require-usage`        | Every `reuse`/`create` must appear in scanned files                 |

Omit `--require-prop-map` / `--check-prop-map-usage` only after user force without maps.
