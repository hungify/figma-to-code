---
name: custom-component-lookup
description: Look up custom React component documentation (props, variants, import paths, Figma node mappings) before implementing any custom UI component or translating a Figma design to code. Use this skill whenever you see a Figma node name (format "Category/Component/Variant"), whenever the user references a custom component by name, or whenever you're about to write JSX for a component that isn't a standard Shadcn/ui primitive. Always consult this skill BEFORE guessing props or import paths for custom components — never assume you already know them, even for components with familiar names like Card or Button, since custom components in this project may share names with but differ from Shadcn equivalents. Trigger this skill for tasks like "implement this Figma design", "build the FacilityCard component instance", "what props does X take", or "find the component for this Figma node".
---

# Custom UI Component Registry

This skill provides a CLI for looking up custom React component documentation — props, variants, import paths, and Figma node mappings — without guessing. It exists because custom components are not in Claude's training data, unlike Shadcn/ui primitives, and guessing their props/import paths causes broken builds.

## When to use this skill

Use the `component-lookup` CLI whenever you:

- See a Figma node name (format: `"Category/Component/Variant"`) from a Figma MCP tool call
- Are about to write JSX for a component you have not looked up yet in this session
- Are unsure whether a component is a custom project component or a Shadcn/ui primitive
- Need to confirm a component's exact import path, required props, or variant values

**Rule: never implement a custom component without running `component-lookup docs <Name>` first — even if the name looks familiar.** Shadcn/ui components (Button, Card, Input, Dialog, etc.) do NOT need lookup — those are safe to use from memory. Only components that show up in this registry need lookup.

If you're unsure whether something is custom or Shadcn, run `component-lookup search <name>` — no result means it's Shadcn.

## Setup (run once per project)

This skill expects `scripts/gen-registry.ts` and `scripts/component-lookup.ts` to exist at the project root, and a `component-registry.json` generated from them.

**First, check dependencies are installed.** Run:

```bash
node -e "require.resolve('react-docgen-typescript'); require.resolve('glob'); require.resolve('tsx')" 2>&1
```

If this errors, install them first (see `references/required-deps.json` for exact package list):

```bash
npm install --save-dev react-docgen-typescript glob tsx typescript
```

Optionally add the shortcuts from `references/required-deps.json` → `packageScripts` to your `package.json` `scripts` field, so you can run `npm run component-lookup docs <Name>` instead of the full `npx tsx` path.

If `component-registry.json` is missing, generate it:

```bash
npx tsx scripts/gen-registry.ts --dir ./src/components --figma-map ./figma-map.json --out ./component-registry.json
```

This scans `.tsx` files under `--dir` using `react-docgen-typescript` (TypeScript Compiler API under the hood), so it works without any JSDoc comments — just TypeScript interfaces/types on the component props.

## Commands

```bash
# Registry overview — run once at the start of a session to confirm registry is current
npx tsx scripts/component-lookup.ts info

# List all registered custom components
npx tsx scripts/component-lookup.ts list

# Full docs for one component: import path, props table, variants, usage example
npx tsx scripts/component-lookup.ts docs FacilityCard

# Find component by Figma node name (partial match works)
npx tsx scripts/component-lookup.ts figma "Facility/Card/Default"

# Search by component name, prop name, or Figma node keyword
npx tsx scripts/component-lookup.ts search "filter"
```

## Workflow: Figma MCP → Code

```
1. Figma MCP returns a node name, e.g. "Facility/Card/Default"
2. Run: npx tsx scripts/component-lookup.ts figma "Facility/Card/Default"
3. Read the output:
   - Copy the import path EXACTLY as shown
   - Note which props are required vs optional
   - Note variant values for union-type props
4. Implement using ONLY the documented props
   - Never invent undocumented props
   - Never alter the import path or add aliases
```

## Figma node naming convention

Component names are auto-mapped to Figma node paths by splitting PascalCase:

```
FacilityCard    → Facility/Card/Default
SearchFilterBar → Search/Filter/Bar/Default
```

When a component's real Figma node doesn't follow this pattern, the project's `figma-map.json` (at repo root) holds the explicit override — the CLI checks this file first before falling back to the naming convention.

## Regenerating the registry

Run this after adding a new custom component, renaming props, changing types, or moving a component file:

```bash
npx tsx scripts/gen-registry.ts --dir ./src/components --figma-map ./figma-map.json --out ./component-registry.json
```

Commit the resulting `component-registry.json` to the repo so the registry is available without a build step.

## Troubleshooting

| Problem                                        | Fix                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `component-registry.json not found`            | Run the gen-registry command above                                                                           |
| Component missing from `component-lookup list` | Confirm it's a named export with props defined via `interface` or `type` (default exports aren't picked up)  |
| Figma node not found                           | Check exact spelling/casing in Figma — node paths are case-sensitive; check `figma-map.json` for an override |
| Props look outdated                            | Regenerate the registry — it does not auto-update                                                            |
