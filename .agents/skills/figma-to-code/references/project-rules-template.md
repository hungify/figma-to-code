# Project Rules Template

Use this before codegen. Prefer existing repo rules over this template when they conflict.

## Rule Discovery

Read, in order:

1. Root `AGENTS.md`.
2. Nearest nested `AGENTS.md` for target feature/screen.
3. Existing route and feature files near target path.
4. Existing `src/components/ui/*` and shadcn usage.
5. `src/app/globals.css` or project global CSS token file.

Do not invent structure before checking repo truth.

## Feature-Sliced Output

For full-page Figma implementation:

```txt
src/features/<feature>/
  AGENTS.md
  screens/
    <screen>/
      AGENTS.md
      <screen>.tsx
      sections/
        <section>.tsx
      index.ts
  components/
    <shared-component>.tsx
```

Rules:

- `screens/<screen>/sections/*`: screen-specific sections.
- `screens/<screen>/<screen>.tsx`: page/screen composition only.
- `components/*`: reused by 2+ screens in same feature.
- `src/components/ui/*`: shadcn/design-system primitives only.
- Main agent owns route/page shell integration.
- Sub-agents only create section component + section docs.

## Token Precedence

1. Existing CSS variables and Tailwind token classes.
2. Existing shadcn/ui variants.
3. Existing feature component props/variants.
4. Codebase-native nearest token with documented designer feedback.
5. Tailwind arbitrary value only when visual fidelity needs it.

When codebase-native differs from Figma raw value, warn:

```txt
Designer feedback: Figma uses <value>, codebase token uses <token>/<value>. Update design token or accept deviation.
```

## Component Rules

- Reuse `src/components/ui/*` before writing custom primitives.
- If shadcn component exists in registry but not repo, install with project command (`pnpm ui add <name>` preferred, fallback `pnpm dlx shadcn@latest add <name>`).
- Use `lucide-react` icons with `Icon` suffix.
- Do not clone shadcn behavior by hand.
- Do not add global tokens unless user or project rules explicitly require it.

## Documentation Rules

Initial implementation creates or updates:

```txt
src/features/<feature>/AGENTS.md
src/features/<feature>/screens/<screen>/AGENTS.md
```

Feature `AGENTS.md` contains durable feature rules. Screen `AGENTS.md` contains:

- Figma file/key/node ids.
- Route.
- Section list and component paths.
- Token deviations and designer feedback.
- Visual diff result.
- Known accepted deviations.

`.figma/artifacts` is evidence only, not source of truth.
