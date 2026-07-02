# Agent Guidelines

## Essentials

- Stack: TypeScript + React (TanStack Start), with Drizzle ORM, shadcn/ui, and Better Auth.
- Use shadcn CLI (`pnpm ui add <component>`) for adding new UI components & primitives.
- Use `lucide-react` for UI icons (use `Icon` suffix, e.g. `import { Loader2Icon } from "lucide-react"`); for brand icons use `@icons-pack/react-simple-icons` (e.g. `SiGithub`).
- Don't build after every little change. If `pnpm lint` passes; assume changes work.

## Topic-specific Guidelines

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

These rules apply to every Figma-driven implementation or parity fix in this repo.

### Required Figma Flow

1. Parse `fileKey` and `nodeId` from the Figma URL before touching code.
2. Run `get_design_context` for the exact node first.
3. Run `get_screenshot` for the same node and keep it as the visual source of truth.
4. If `get_design_context` is too large or truncated, run `get_metadata` and re-fetch only the needed child node.
5. Treat MCP React/Tailwind output as design context, not final repo code. Translate into this repo's component, token, route, and file patterns.
6. Validate final UI against the Figma screenshot before marking complete. For visual-gate work, exact 0% diff is not required when remaining diff is font or antialiasing noise and the artifact is inside the documented human-accept band.

### Figma Pipeline Artifacts

- Use `.agents/skills/figma-to-code/scripts/` for Figma pipeline scripts; run them with `python3`.
- Store and mirror Figma evidence under `.figma/artifacts/<feature>/<screen>/` when using the project pipeline.
- Keep generated docs/artifacts explicit about `shadcnChecked`, `shadcnReused`, `shadcnInstalled`, `customLookupUsed`, `customGenerated`, gate status, and any token deviations.
- If a large Figma file stalls cache/init, prefer node-level MCP calls (`get_design_context`, `get_metadata`, `get_variable_defs`, `get_screenshot`) instead of waiting on full-file cache.
- If a visual diff lands in `NEEDS_HUMAN_ACCEPT`, report the exact diff and the likely cause; do not chase font/antialiasing noise after layout and state parity are correct.

### Component Organization

- Reuse primitives from `src/components/ui/` before creating new UI components.
- Use `pnpm ui add <component>` for missing shadcn/ui primitives instead of hand-building standard primitives.
- Put project UI primitives in `src/components/ui/` and export named React components.
- Put route-level examples/showcases in `src/components/*-showcase.tsx` plus `src/routes/showcase/*` only when building showcase surfaces.
- For feature implementation from Figma, prefer feature-sliced output from the `figma-to-code` skill: `src/features/<feature>/screens/<screen>/sections/<section>.tsx` and shared feature components in `src/features/<feature>/components/`.
- Do not edit generated `src/routeTree.gen.ts` by hand; let TanStack Router generation update it.

### Component APIs

- Components must accept `className` for composition when they render DOM or primitive roots.
- Use named exports, matching current UI primitive style: `export { Button, buttonVariants }`, `export { RadioGroup, RadioGroupItem }`.
- Use `cva` and `VariantProps` when variants are real component API, as in `src/components/ui/button.tsx`.
- Use Base UI primitives already present in repo for accessible primitives where applicable (`@base-ui/react`), and style their data attributes directly (`data-disabled`, `data-checked`, `data-slot`, `data-force-state`) when needed for Figma state parity.
- Use `cn` from `#/lib/utils`; do not introduce another class merge helper.
- Before using non-shadcn custom components from Figma node names, run `pnpm component-lookup info`; if stale or missing, run `pnpm component-lookup:gen`, then use `pnpm component-lookup search`, `figma`, or `docs` before writing JSX.

### Styling And Tokens

- Styling uses Tailwind v4 utilities, shadcn CSS variables, and theme tokens in `src/styles.css`.
- IMPORTANT: Do not hardcode colors when an existing token matches. Use CSS variables and Tailwind token utilities such as `bg-background`, `text-foreground`, `border-border`, `text-green-500`, or arbitrary variable classes like `bg-(--btn-color)` only when that maps to a repo token.
- Brand color scales live in `src/styles.css` as `--color-green-*`, `--color-red-*`, `--color-yellow-*`, `--color-orange-*`, `--color-blue-*`, and `--color-grey-*`.
- Typography tokens and font family mapping live in `src/styles.css`. Default app font is JP-first: `--font-sans: var(--font-jp)`, `--font-jp: "Zen Maru Gothic"`, `--font-en: "Lato"`.
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
