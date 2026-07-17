# Prop-map matched schema (Phase 2.5)

Agent writes `_figma-props-matched.json` → `finalize` → `.figma/prop-map/<CodeComponent>.json`.

## `mappingKind`

| Kind          | Required                                           | Meaning                             |
| ------------- | -------------------------------------------------- | ----------------------------------- |
| `direct`      | `reactProp`; `valueMap` when VARIANT labels differ | 1 Figma value → 1 React prop        |
| `override`    | `valueOverrides`                                   | 1 Figma value → several React props |
| `composition` | `reactProp: null`, `note`                          | children/slots/icons only           |
| `unmapped`    | `reactProp: null`, `note`                          | no code match                       |

`null` / `{}` = omit props for that Figma value.

## `confidence`

- `high` — clear match; if not in `_code-props-raw` → need `verifiedVia: "external-type-check"`
- `medium` — fuzzy / unverified inherit
- `low` — no match or colliding Figma props

## `verifiedVia`

- `raw-code-match` — in extract
- `external-type-check` — confirmed in `node_modules/**/*.d.ts` (path in `note`)

## Matched entry

```json
{
  "btn": {
    "figmaNodeId": "28:518",
    "codeComponent": "Button",
    "codeFile": "src/components/ui/button.tsx",
    "props": {
      "Size": {
        "mappingKind": "direct",
        "reactProp": "size",
        "type": "VARIANT",
        "confidence": "high",
        "verifiedVia": "raw-code-match"
      }
    }
  }
}
```

## Finalize file shape

`generatedAt`, `fileKey`, `codeComponent`, `codeFile`, `figmaGroups[]`, `props`.

Legacy committed maps may omit `mappingKind` — implement can read; **do not hand-migrate** (re-run this skill).
