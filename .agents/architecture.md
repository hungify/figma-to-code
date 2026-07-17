# Architecture — feature-sliced placement

Where every file type goes: screens, components, hooks, utils, types, data layer.

## Layers

```txt
src/
  routes/<segment>/<screen>.tsx        # URL wiring only — thin, calls feature screen
  features/<feature>/
    screens/<screen>/
      <screen>-screen.tsx              # screen root component
      testids.ts                       # data-testid map (see figma-implement-design/references/automation.md)
      components/<name>.tsx            # used by THIS screen only
      hooks/use-<x>.ts                 # used by THIS screen only
      utils.ts                         # used by THIS screen only
      constants.ts                     # used by THIS screen only
      sections/<section>.tsx           # optional — only when screen is large enough to split by block
    components/<name>.tsx              # used by 2+ screens in this feature
    hooks/use-<x>.ts                   # used by 2+ screens in this feature
    utils.ts                           # used by 2+ screens in this feature
    constants.ts                       # used by 2+ screens in this feature
    types.ts                           # feature-level types
  components/
    ui/<name>.tsx                      # design-system primitives (shadcn) — no business logic
    <name>.tsx                         # cross-feature shared UI (e.g. sign-in-social-button.tsx)
  hooks/use-<x>.ts                     # cross-app generic hooks (no domain data)
  lib/
    utils.ts                           # cross-app generic utils (cn, etc.)
    constants.ts                       # cross-app generic constants (routes, limits, ...)
    <domain>/                          # data layer: queries, mutations, server functions, clients
      queries.ts
      functions.ts
      *-client.ts
```

## Decision table

| File does this                                              | Goes here                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Renders one specific screen                                 | `features/<feature>/screens/<screen>/<screen>-screen.tsx`                                              |
| UI block reused by only that screen                         | `features/<feature>/screens/<screen>/components/`                                                      |
| UI block reused by 2+ screens, same feature                 | `features/<feature>/components/`                                                                       |
| UI block reused across features                             | `src/components/<name>.tsx`                                                                            |
| Design-system primitive (button/input/...)                  | `src/components/ui/`                                                                                   |
| Hook reads/writes only that screen's local state            | `screens/<screen>/hooks/`                                                                              |
| Hook shared by screens in same feature                      | `features/<feature>/hooks/`                                                                            |
| Hook is generic, no domain data (`useMobile`, `useLazyRef`) | `src/hooks/`                                                                                           |
| Pure helper used only in that screen                        | `screens/<screen>/utils.ts`                                                                            |
| Pure helper shared in feature                               | `features/<feature>/utils.ts`                                                                          |
| Pure helper generic app-wide                                | `src/lib/utils.ts`                                                                                     |
| Constant used only in that screen                           | `screens/<screen>/constants.ts`                                                                        |
| Constant shared in feature                                  | `features/<feature>/constants.ts`                                                                      |
| Constant generic app-wide (routes, limits...)               | `src/lib/constants.ts`                                                                                 |
| Query/mutation/server function/API client                   | `src/lib/<domain>/` (data layer — **not** under `features/`)                                           |
| Type used only inside a screen                              | co-locate in that screen file, or `screens/<screen>/types.ts` if reused in-screen                      |
| Type shared across a feature                                | `features/<feature>/types.ts`                                                                          |
| Zod/form validation schema, screen-only                     | co-locate in screen file, or `screens/<screen>/schema.ts` if large                                     |
| Zod/form validation schema, shared in feature               | `features/<feature>/schemas.ts`                                                                        |
| Zod/form validation schema, tied to a data-layer domain     | `src/lib/<domain>/schema.ts` (next to `queries.ts`/`functions.ts`)                                     |
| React Context/Provider, app-wide singleton                  | `src/components/<name>-provider.tsx` (see `theme-provider.tsx`)                                        |
| React Context/Provider, scoped to one feature               | `features/<feature>/context.tsx`                                                                       |
| Layout shell used by many routes (Header/Footer/Shell)      | `src/components/layout/`                                                                               |
| Test file                                                   | co-locate next to source: `<name>.test.ts(x)` (Vitest scope: `src/**`)                                 |
| Static asset (image/svg/font)                               | `public/` — feature-owned assets under `public/<feature>/...`                                          |
| Env var validation/schema                                   | `src/env/` (app-wide only — don't duplicate per feature)                                               |
| DB table schema (Drizzle)                                   | `src/lib/db/schema/<domain>.schema.ts`                                                                 |
| API route handler (catch-all, webhook, etc.)                | `src/routes/api/<domain>/$.ts` — thin, delegates to `src/lib/<domain>/`                                |
| Route search-param validation (`validateSearch`)            | inline in the route file itself, not a separate schema file                                            |
| App-wide error/not-found boundary                           | `src/components/default-catch-boundary.tsx` / `default-not-found.tsx` (registered in `src/router.tsx`) |

## Rules

- Shared chrome (Header/Footer) for a route group lives **once** in that group's pathless layout route (e.g. `src/routes/_guest/route.tsx` renders `<Header/><main><Outlet/></main><Footer/>`). Individual screens (`login-screen.tsx`, etc.) render only their own content — never re-import `Header`/`Footer` per screen.
- **Never** put data-fetching (queries/mutations/server functions) inside `features/<feature>/screens/`. UI layer calls into `src/lib/<domain>/` — keep screens presentational + form-handling only.
- Promote screen-scoped file → feature-scoped the moment a **second** screen needs it (don't pre-shared speculatively).
- Promote feature-scoped file → `src/components|hooks|lib` only when a **second feature** needs it.
- `sections/` is optional — use only when a screen file would otherwise get too large to review in one pass. Don't create empty `sections/` folders by convention alone.
- Route files (`src/routes/**`) stay thin: route params/loaders/guards → hand off to the feature screen component. No screen JSX in route files.
- Follow existing precedent before inventing new folders — check sibling features first.
- **Don't** create `index.ts` barrel files per feature/screen to re-export everything. Import from the direct file path (see barrel-import cost in `vercel-react-best-practices`).

## Related

- Figma implement output paths: `.agents/skills/figma-implement-design/SKILL.md` Step 5
- Testids: `.agents/skills/figma-implement-design/references/automation.md`
