# Prop-map reference (figma-implement-design)

**Read** `.figma/prop-map/<CodeComponent>.json` in Step 4. Do not hand-edit — use `figma-props-sync`.

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

Prefer explicit `mappingKind` when present.

## Icons (composition)

`INSTANCE_SWAP` / icon name → `lucide-react` `*Icon` child when possible. Brands → `@icons-pack/react-simple-icons`. No new packages.

## Gate flags

| Flag                     | Behavior                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `--require-prop-map`     | Every `reuse`/`create` needs `.figma/prop-map/<repoComponent>.json` |
| `--check-prop-map-usage` | Fail Figma prop names / Figma literals on mapped React props        |
| `--require-usage`        | Every `reuse`/`create` must appear in scanned files                 |

Omit `--require-prop-map` / `--check-prop-map-usage` only after user force without maps.
