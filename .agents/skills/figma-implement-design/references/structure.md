# Screen structure (Step 5)

**Read with Step 5 for feature screens.** Placement: [`.agents/architecture.md`](../../../architecture.md).

Goal: **clean, maintainable code that matches this repo** — not a single mandatory template.

## 1. Follow existing code first

Before inventing structure, APIs, or folder names:

1. Find a sibling under `src/features/*/screens/*/` (same feature preferred; else nearest).
2. Mirror naming, imports (`#/…`), tokens, layout ownership, and how that screen splits UI vs logic.
3. Prefer copy-adapt over greenfield.
4. Fall back to architecture.md + practices below only when no sibling exists.

## 2. Clean-code practices (apply as needed)

These are **habits**, not a checklist that every screen must expand into the same files.

| Practice                                                                          | Why                                                               |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Thin route + thin screen shell                                                    | Route wires params/context; screen composes; no fat JSX in routes |
| Separate UI blocks from orchestration                                             | Easier review, test, and reuse                                    |
| Keep side effects / submit / local interactive state out of presentational markup | Form stays props-in; logic stays testable                         |
| Chrome once in layout routes                                                      | Don’t re-import Header/Footer per screen                          |
| Promote only when a 2nd consumer appears                                          | No speculative shared folders                                     |
| No `index.ts` barrels under screens                                               | Direct imports (bundle / clarity)                                 |

### One common pattern: form + hook (example, not the only shape)

When a screen has a real form / interactive block + state/mutation, **one** clean approach (see login):

```txt
features/auth/screens/login/
  login-screen.tsx           # shell: title + compose
  testids.ts
  components/login-form.tsx  # presentational fields/CTA
  hooks/use-login-form.ts    # state, submit, mutation wiring
```

Other screens may use `sections/`, a single small component, or a different sibling precedent — **match what’s already in the codebase** for that kind of UI.

| Concern (when you split)        | Typical path                              |
| ------------------------------- | ----------------------------------------- |
| Screen shell                    | `…/<screen>-screen.tsx`                   |
| UI block                        | `…/components/<name>.tsx`                 |
| Local state / handlers / mutate | `…/hooks/use-<name>.ts`                   |
| Testids                         | `…/testids.ts`                            |
| Shared Header/Footer            | pathless layout (e.g. `_guest/route.tsx`) |

## 3. When to split further

| Signal                          | Action                                             |
| ------------------------------- | -------------------------------------------------- |
| Hard to review in one pass      | extract `components/` or optional `sections/`      |
| Same block needed by 2nd screen | promote to `features/<feature>/components\|hooks/` |
| Same across features            | `src/components/` / `src/hooks/` / `src/lib/`      |

## 4. Gate `--files`

Scan every screen TSX that uses resolved primitives (comma-separated), e.g. screen + form component if both use `Button` / `TextField`:

```bash
--files src/features/<f>/screens/<s>/<s>-screen.tsx,src/features/<f>/screens/<s>/components/<form>.tsx
```

## Anti-patterns

- Invent structure when a sibling already shows how this repo does it
- Monolith: huge form + mutation + toggles all inside `<screen>-screen.tsx` with no reason
- Re-import Header/Footer when the layout route already owns chrome
- Speculative shared folders / screen-level barrels
