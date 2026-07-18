# Prop-map schema v2

Only schema v2 is accepted. The agent writes `_figma-props-matched.json`; `finalize` validates it and emits `.figma/prop-map/<CodeComponent>.json`.

## Matched artifact

```json
{
  "schemaVersion": 2,
  "fileKey": "abc123",
  "components": [
    {
      "codeComponent": "Button",
      "codeFile": "src/components/ui/button.tsx",
      "groups": [
        {
          "figmaNodeId": "28:518",
          "name": "btn",
          "mappings": [
            {
              "figmaProp": "Size",
              "figmaType": "VARIANT",
              "mappingKind": "direct",
              "reactProp": "size",
              "valueMap": { "Small": "sm", "Large": "lg" },
              "confidence": "high",
              "evidence": [{ "kind": "code-api", "reactProp": "size" }]
            }
          ]
        }
      ]
    }
  ]
}
```

Mappings belong to a Figma group. The same property name in two component sets therefore remains two independently reviewable mappings.

## Mapping contract

| `mappingKind` | Required                                        | Meaning                                                         |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `direct`      | `reactProp`; full `valueMap` when labels differ | One Figma property maps to one React prop                       |
| `override`    | full `valueOverrides`                           | One Figma value assigns several React props                     |
| `composition` | `note`; no `reactProp`                          | Implement through children, slots, icons, or parent composition |
| `unmapped`    | `note`; no `reactProp`                          | Verified absence of a code representation                       |

`null` values in `valueMap` or `valueOverrides` mean omit that React prop.

Allowed confidence values are `high`, `medium`, and `low`. Confidence describes certainty of the conclusion, not whether a mapping exists. A verified `composition` or `unmapped` conclusion may be high confidence.

## Evidence

Every referenced React prop requires one evidence item:

- `{ "kind": "code-api", "reactProp": "size" }` — present in extracted local/resolved API.
- `{ "kind": "external-type", "reactProp": "checked", "path": "node_modules/...d.ts", "hash": "sha256:..." }` — verified against an installed external declaration.
- `{ "kind": "source-read", "reactProp": "children", "path": "src/...tsx", "hash": "sha256:..." }` — verified directly in source when static extraction cannot establish its type.

Paths and hashes are validated during `finalize`. Do not encode evidence in prose.

## Final file

```json
{
  "schemaVersion": 2,
  "syncedAt": "2026-07-18T00:00:00.000Z",
  "source": { "fileKey": "abc123", "definitionHash": "sha256:..." },
  "target": {
    "component": "Button",
    "file": "src/components/ui/button.tsx",
    "apiHash": "sha256:..."
  },
  "groups": []
}
```

`definitionHash` binds the map to the fetched Figma group definitions. `apiHash` binds it to the extracted public component API; unrelated source edits do not invalidate the map.

## Finalize rejects

- any schema version other than 2;
- missing/unknown fields, mapping kinds, confidence, React props, or Figma properties;
- Figma property type drift;
- incomplete or extra Figma value coverage;
- values outside an extracted union/CVA API;
- missing, mismatched, or stale evidence paths/hashes;
- duplicate `figmaProp` inside one group.
