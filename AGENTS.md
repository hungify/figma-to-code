# Agent Guidelines

## Essentials

- Stack: TypeScript + React (TanStack Start), with Drizzle ORM, shadcn/ui, and Better Auth.
- Use shadcn CLI (`pnpm ui add <component>`) for adding new UI components & primitives.
- Icons: see [Icons And Assets](#icons-and-assets).
- Validation: see [Validation](#validation) — don't build after every small change.

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
- **Local project skills** live under `.agents/skills/`. Generic Figma request → `figma-implement-design`; explicit screen/page → `figma-implement-screen`; explicit component/component-set → `figma-implement-component`; prop-map-only → `figma-props-sync`. `pnpm intent` lists package skills only — read local skill directly (or load via Cursor skill attachment).
- Claude Code discovery adapters live under `.claude/skills/`; keep them metadata-only and route to canonical `.agents/skills/` content. Never duplicate workflow instructions in adapters.
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

## Component Conventions

General rules for any component work, Figma-sourced or not.

### Organization

- Reuse primitives from `src/components/ui/` before creating new UI components.
- Use `pnpm ui add <component>` for missing shadcn/ui primitives instead of hand-building standard primitives.
- Do not hand-build raw repeated markup for common primitives resolved through validated prop maps and the active screen contract (`Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Field`, `SignInSocialButton`).
- Put project UI primitives in `src/components/ui/` and export named React components.
- Put route-level examples/showcases in `src/components/*-showcase.tsx` plus `src/routes/showcase/*` only when building showcase surfaces.
- For feature implementation from Figma, follow `figma-implement-screen`: match existing `src/features/*/screens/*` first; keep screens clean (structure.md — form/hook split is one option, not the only).
- Do not edit generated `src/routeTree.gen.ts` by hand; let TanStack Router generation update it.

### APIs

- Components must accept `className` for composition when they render DOM or primitive roots.
- Use named exports, matching current UI primitive style: `export { Button, buttonVariants }`, `export { RadioGroup, RadioGroupItem }`.
- Use `cva` and `VariantProps` when variants are real component API, as in `src/components/ui/button.tsx`.
- Use Base UI primitives already present in repo for accessible primitives where applicable (`@base-ui/react`), and style their data attributes directly (`data-disabled`, `data-checked`, `data-slot`, `data-force-state`) when needed for Figma state parity.
- Use `cn` from `#/lib/utils`; do not introduce another class merge helper.
- Resolve Figma node names via validated `.figma/prop-map/*.json` (`groups[].name` → `target.component`) plus `src/components/ui/`. Missing/stale prop-map → run `figma-props-sync` or stop. Do not invent near-matches.
- A matching design-system component is mandatory; never replace it with a custom primitive. Feature-specific composed blocks are allowed and must be listed in `screenCompositions[]` with `componentName`, `filePath`, and `reason`.

### Styling And Tokens

- Styling uses Tailwind v4 utilities, shadcn CSS variables, and theme tokens in `src/styles.css`.
- IMPORTANT: Do not hardcode colors when an existing token matches. Use CSS variables and Tailwind token utilities such as `bg-background`, `text-foreground`, `border-border`, `text-green-500`, or arbitrary variable classes like `bg-(--btn-color)` only when that maps to a repo token.
- Brand color scales live in `src/styles.css` as `--color-green-*`, `--color-lime-*`, `--color-red-*`, `--color-yellow-*`, `--color-orange-*`, `--color-blue-*`, and `--color-grey-*`.
- Use Tailwind spacing and sizing utilities for layout. Preserve exact Figma dimensions only when they are core to component parity or fixed-format controls.
- **Mobile↔desktop breakpoint is `md:` (768px) — Tailwind default, matches `src/hooks/use-mobile.ts`.** Do not invent a split at `sm:`/`lg:`/`xl:` for mobile vs desktop layout.
- **PC content caps at 1440px** via `container-page` utility (`src/styles.css`, `--container-page: 90rem`). Apply on a screen's `<main>`/content wrapper only — `Header`/`Footer` stay full-bleed, don't cap their inner content.
- Keep parity work light-only unless Figma explicitly includes dark variants. Do not add theme machinery for a light-only Figma frame.
- Avoid global token rewrites for local component mismatches. Patch the local primitive or feature component unless mismatch is clearly systemic.

**Typography (source of truth: Figma [Typography](https://www.figma.com/design/k0CrXX6p2CCRPHpzEv3EaW/Knowbe_rakita_CL--Copy-?node-id=590-79435) ↔ `src/styles.css` `jp-*` / `en-*` utilities).** Default app font is JP-first: `--font-sans: var(--font-jp)`, `--font-jp: "Zen Maru Gothic"`, `--font-en: "Lato"`.

When implementing from Figma:

1. Read the Figma **text style name** (e.g. `JP/Body/Medium`, `EN/Headline/H3`) — do not invent size/weight from raw px alone.
2. Map to one utility below. Prefer that class over `text-sm` / `text-base` / `font-bold` / arbitrary `text-[14px]`.
3. JP → `jp-*`. EN → `en-*` (EN utilities already set Lato; do not also add `font-en`).
4. **Raise / stop** if the Figma text style (or size+weight+leading) has no row in the map, or conflicts with repo tokens (e.g. 15px Body, wrong weight). Do not silently invent a new type scale or hardcode px. Ask user or flag in the implement report before shipping.
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

### Icons And Assets

- **UI icons → `lucide-react` only**, `Icon` suffix (e.g. `import { Loader2Icon } from "lucide-react"`). Eye / eye-off / chevron / check / loader / close / etc. — never download Figma SVG into `public/` for these. Map Figma INSTANCE_SWAP / icon name → nearest lucide icon.
- Brand icons → `@icons-pack/react-simple-icons` (e.g. `SiGithub`).
- **Download MCP localhost / SVG only for non-icon assets:** photos, illustrations, logos, decorative vectors with no lucide/simple-icons match. Do not create placeholders for those.
- If unsure whether something is a UI icon: prefer lucide. Stop and ask only when no reasonable lucide match exists.
- Do not add new icon packages for Figma work unless the user explicitly approves.
- Store downloaded non-icon assets under `public/` or a feature-owned asset folder only when reuse/deploy needs it.

### Routing, Data, And Auth Boundaries

- Follow TanStack Start route patterns in `src/routes/`.
- Use `#/` path aliases from `components.json` (`#/components`, `#/components/ui`, `#/lib`, `#/lib/utils`) instead of deep relative imports when crossing folders.
- Keep auth UI under `_guest` routes and protected app UI under `_auth` routes.
- Respect Better Auth and Drizzle server boundaries; do not move secrets, database calls, or server-only auth work into client components.
- Use `pnpm tanstack ... --json` for TanStack documentation lookups when routing, loader, SSR, server function, or router behavior is uncertain.

## Figma Workflow

Generic Figma → code: route with `.agents/skills/figma-implement-design/SKILL.md`. Explicit screen/page work follows `figma-implement-screen`; explicit reusable component/component-set work follows `figma-implement-component`.
Prop maps live in `.figma/prop-map/*.json`, owned by `.agents/skills/figma-props-sync/SKILL.md` — **never hand-edit**; fix via match + `finalize`.

0. **Classify:** run `pnpm figma-classify`; implementation artifact binds current classification hash. Wrong/ambiguous target stops before code.
1. **Screen:** follow `figma-implement-screen`; inventory, resolve dependencies, baseline, implement feature/route, page/region fidelity, then `pnpm figma-gate:screen -- --artifact …`.
2. **Component:** follow `figma-implement-component`; code API, prop-map decision, safe target finalize, showcase harness, variant/state coverage, strict crops, then `pnpm figma-gate:component -- --artifact …`.
3. **Props:** missing/stale map → `figma-props-sync`; no guessed props. `--prune` is disabled; obsolete-map cleanup is a separate reviewed change.
4. **Unified dispatch:** `pnpm figma-gate:all -- --artifact …` reads `target.kind` and invokes exact screen/component gate. Weakening flags are rejected. Pressure: `pnpm figma-gate:test`.
5. **Behavior/accessibility:** verify responsive constraints, supplied states, keyboard/focus semantics, and report justified deviations.
6. **App tests:** `pnpm test` (Vitest, `src/**`).

## Validation

- Run `pnpm lint` after meaningful code changes. If `pnpm lint` passes, do not build after every small change.
- For Figma parity changes, use browser or visual-gate evidence when practical, and report exact artifact paths or diff values.
- If lint fails from Tailwind/oxlint dependency resolution after package changes, run `pnpm install` to resync before treating it as a component regression.
