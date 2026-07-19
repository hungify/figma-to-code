# Target classification

Read only when routing a generic Figma implementation request or validating that an explicit child skill matches its node.

## Routing contract

Generate routing evidence with `pnpm figma-classify`. Require a node-specific Figma URL and `FIGMA_ACCESS_TOKEN` in project `.env`; selection-only input must stop and request the node URL. Never infer target kind from link text or screenshot alone. Once routed, rerun the classifier into the child skill's canonical artifact directory because each gate requires classification evidence beside its implementation contract.

| Selected node evidence                                                                   | Classification            | Route                       |
| ---------------------------------------------------------------------------------------- | ------------------------- | --------------------------- |
| `COMPONENT`/`COMPONENT_SET`, or subtree IDs present in REST `components`/`componentSets` | `design-system-component` | `figma-implement-component` |
| `FRAME` with no component definitions in its subtree                                     | `screen`                  | `figma-implement-screen`    |
| `SECTION` with only direct frames and no component definitions                           | `screen`                  | `figma-implement-screen`    |
| `INSTANCE`, `PAGE`/`CANVAS`, mixed section, or mixed selected nodes                      | `ambiguous`               | stop and ask user           |

Figma can serialize a component set as a `FRAME` wrapper containing component symbols. Therefore node `type` alone is insufficient. For a `SECTION`, classify each direct child subtree independently: component-bearing child plus plain application frame is mixed and must stop. For a selected non-section frame, component metadata IDs in its subtree take precedence over the frame rule.

Explicit skill invocation supplies intent, not permission to ignore contradictory node evidence. A screen skill receiving a component set, or component skill receiving an application frame, must stop and point to the matching skill.

## Commands

```bash
pnpm figma-classify -- \
  --file-key <key> \
  --source <source-id=1:2> \
  --out .figma/artifacts/routing/<task>/target-classification.json
```

Offline/pressure tests may pass `--input-response <file>`. Production use must fetch current Figma REST node metadata.

## Mixed work

If user explicitly requests both component library work and screens, split into two sequential contracts: component first, screen second. Never encode mixed work in one implementation artifact.
