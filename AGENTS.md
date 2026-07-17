# Agent Guidelines

## Essentials

- Stack: TypeScript + React (TanStack Start), with Drizzle ORM, shadcn/ui, and Better Auth.
- Use shadcn CLI (`pnpm ui add <component>`) for adding new UI components & primitives.
- Use `lucide-react` for UI icons (use `Icon` suffix, e.g. `import { Loader2Icon } from "lucide-react"`); for brand icons use `@icons-pack/react-simple-icons` (e.g. `SiGithub`).
- Don't build after every little change. If `pnpm lint` passes; assume changes work.

## Topic-specific Guidelines

- **Before creating any new file** (component, hook, util, constant, schema, type, context) — read `.agents/architecture.md` first for placement tier (screen-only vs feature-shared vs app-wide). Don't guess the folder.
- [TanStack patterns](.agents/tanstack-patterns.md) - Routing, data fetching, loaders, server functions, environment shaking
- [Auth patterns](.agents/auth.md) - Route guards, middleware, auth utilities
- [TypeScript conventions](.agents/typescript.md) - Casting rules, prefer type inference
- [Workflow](.agents/workflow.md) - Workflow commands, validation approach

<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `pnpm intent list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm intent load <package>#<skill>` and follow the returned `SKILL.md`.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
- **Local project skills** live under `.agents/skills/` (e.g. `figma-implement-design`, `figma-props-sync`). `pnpm intent` lists package skills only — for local Figma skills, read `.agents/skills/<name>/SKILL.md` directly (or load via Cursor skill attachment).
<!-- intent-skills:end -->

## TanStack Docs

Use `pnpm tanstack` (aliased to `pnpm dlx @tanstack/cli@latest`) to look up TanStack documentation. Always pass `--json` for machine-readable output.

```bash
# List TanStack libraries (optionally filter by --group state|headlessUI|performance|tooling)
pnpm tanstack libraries --json

# Fetch a specific doc page
pnpm tanstack doc router framework/react/guide/data-loading --json
pnpm tanstack doc query framework/react/overview --docs-version v5 --json

# Search docs (optionally filter by --library, --framework, --limit)
pnpm tanstack search-docs "server functions" --library start --json
pnpm tanstack search-docs "loaders" --library router --framework react --json
```

## Figma Design System Rules

Figma → code: follow `.agents/skills/figma-implement-design/SKILL.md`. Prop maps: `.agents/skills/figma-props-sync/SKILL.md` (owns `.figma/prop-map/*.json` — do not hand-edit).

Quick pointers:

1. Parse `fileKey`/`nodeId` → `get_design_context` + `get_screenshot` before code.
2. Resolve components → write `component-resolution.json` → stop if `unresolved` non-empty.
3. Props from `.figma/prop-map/<Component>.json` (via `figma-props-sync` only — do not hand-edit; fix via match+`finalize`). Missing map → stop unless user forces. `Label` has no Figma COMPONENT_SET — use `FieldLabel` / `Label` composition (see `Field` / `TextField` maps).
4. Gate before lint: `pnpm figma-gate:components -- --artifact … --files … --require-prop-map` (add `--check-prop-map-usage` when verifying mapped props). Must `PASS`. Pressure: `pnpm figma-gate:test`.
5. Screens: Figma gold vs app — 1 node → 1 contract (`mobile/` / `desktop/` per intent); see skill `references/visual.md`. Eval: `pnpm figma-eval`. Testids: `references/automation.md`.
6. App UT: `pnpm test` (Vitest, `src/**`).

### Component Organization

- Reuse primitives from `src/components/ui/` before creating new UI components.
- Use `pnpm ui add <component>` for missing shadcn/ui primitives instead of hand-building standard primitives.
- Do not hand-build raw repeated markup for common primitives already resolved in `component-resolution.json` (`Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Field`, `SignInSocialButton`).
- Put project UI primitives in `src/components/ui/` and export named React components.
- Put route-level examples/showcases in `src/components/*-showcase.tsx` plus `src/routes/showcase/*` only when building showcase surfaces.
- For feature implementation from Figma, prefer feature-sliced output from the `figma-implement-design` skill: `src/features/<feature>/screens/<screen>/…` (placement tiers: `.agents/architecture.md`).
- Do not edit generated `src/routeTree.gen.ts` by hand; let TanStack Router generation update it.

### Component APIs

- Components must accept `className` for composition when they render DOM or primitive roots.
- Use named exports, matching current UI primitive style: `export { Button, buttonVariants }`, `export { RadioGroup, RadioGroupItem }`.
- Use `cva` and `VariantProps` when variants are real component API, as in `src/components/ui/button.tsx`.
- Use Base UI primitives already present in repo for accessible primitives where applicable (`@base-ui/react`), and style their data attributes directly (`data-disabled`, `data-checked`, `data-slot`, `data-force-state`) when needed for Figma state parity.
- Use `cn` from `#/lib/utils`; do not introduce another class merge helper.
- Resolve Figma node names via `.figma/prop-map/*.json` (`figmaGroups[].name` → `codeComponent`) plus `src/components/ui/`. Missing prop-map → run `figma-props-sync` (or stop). Do not invent near-matches.
- New feature components are allowed only after prop-map + `src/components/ui` + `pnpm ui add` all fail to find a match; each one must be listed in `customGenerated` with `componentName`, `filePath`, and `customGeneratedReason`.

### Styling And Tokens

- Styling uses Tailwind v4 utilities, shadcn CSS variables, and theme tokens in `src/styles.css`.
- IMPORTANT: Do not hardcode colors when an existing token matches. Use CSS variables and Tailwind token utilities such as `bg-background`, `text-foreground`, `border-border`, `text-green-500`, or arbitrary variable classes like `bg-(--btn-color)` only when that maps to a repo token.
- Brand color scales live in `src/styles.css` as `--color-green-*`, `--color-lime-*`, `--color-red-*`, `--color-yellow-*`, `--color-orange-*`, `--color-blue-*`, and `--color-grey-*`.
- Typography source of truth: Figma [Typography](https://www.figma.com/design/k0CrXX6p2CCRPHpzEv3EaW/Knowbe_rakita_CL--Copy-?node-id=590-79435) ↔ utilities in `src/styles.css` (`jp-*` / `en-*`). Default app font is JP-first: `--font-sans: var(--font-jp)`, `--font-jp: "Zen Maru Gothic"`, `--font-en: "Lato"`.
- **Typography when implementing from Figma (required):**
  1. Read the Figma **text style name** (e.g. `JP/Body/Medium`, `EN/Headline/H3`) — do not invent size/weight from raw px alone.
  2. Map to one utility below. Prefer that class over `text-sm` / `text-base` / `font-bold` / arbitrary `text-[14px]`.
  3. JP → `jp-*`. EN → `en-*` (EN utilities already set Lato; do not also add `font-en`).
  4. **Raise / stop** if Figma text style (or size+weight+leading) has no row in the map, or conflicts with repo tokens (e.g. 15px Body, wrong weight). Do not silently invent a new type scale or hardcode px. Ask user or flag in the implement report before shipping.
  5. Do not invent new `@utility jp-*` / `en-*` unless user explicitly asks to extend the type system.

  | Figma text style          | Class                        |
  | ------------------------- | ---------------------------- |
  | `JP/Headline/H1` … `H5`   | `jp-h1` … `jp-h5`            |
  | `JP/Label/L` `M` `S` `XS` | `jp-label-lg` `md` `sm` `xs` |
  | `JP/Body/L` `M` `S` `XS`  | `jp-body-lg` `md` `sm` `xs`  |
  | `EN/Headline/H1` … `H5`   | `en-h1` … `en-h5`            |
  | `EN/Label/L` `M` `S` `XS` | `en-label-lg` `md` `sm` `xs` |
  | `EN/Body/L` `M` `S` `XS`  | `en-body-lg` `md` `sm` `xs`  |

  Note: utility names must stay `jp-*` / `en-*` (not `text-jp-*`) — see comment in `src/styles.css` (tailwind-merge collision).

- Use Tailwind spacing and sizing utilities for layout. Preserve exact Figma dimensions only when they are core to component parity or fixed-format controls.
- Keep parity work light-only unless Figma explicitly includes dark variants. Do not add theme machinery for a light-only Figma frame.
- Avoid global token rewrites for local component mismatches. Patch the local primitive or feature component unless mismatch is clearly systemic.

### Icons And Assets

- Use `lucide-react` icons with `Icon` suffix for UI icons.
- Use `@icons-pack/react-simple-icons` for brand icons.
- IMPORTANT: If Figma MCP returns a localhost image or SVG source, use that source or download that asset; do not create placeholders.
- Do not add new icon packages for Figma work unless the user explicitly approves.
- Store static downloaded assets under `public/` or a feature-owned asset folder only when asset reuse or deployment requires it.

### Routing, Data, And Auth Boundaries

- Follow TanStack Start route patterns in `src/routes/`.
- Use `#/` path aliases from `components.json` (`#/components`, `#/components/ui`, `#/lib`, `#/lib/utils`) instead of deep relative imports when crossing folders.
- Keep auth UI under `_guest` routes and protected app UI under `_auth` routes.
- Respect Better Auth and Drizzle server boundaries; do not move secrets, database calls, or server-only auth work into client components.
- Use `pnpm tanstack ... --json` for TanStack documentation lookups when routing, loader, SSR, server function, or router behavior is uncertain.

### Validation

- Run `pnpm lint` after meaningful code changes. Per repo rule, if `pnpm lint` passes, do not build after every small change.
- For Figma parity changes, use browser or visual-gate evidence when practical, and report exact artifact paths or diff values.
- If lint fails from Tailwind/oxlint dependency resolution after package changes, run `pnpm install` to resync before treating it as a component regression.
