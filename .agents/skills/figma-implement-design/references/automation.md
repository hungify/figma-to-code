# Automation / testability (implement screens)

**Read in Step 5 (screens) and Step 8.** Not for showcase / lone ui primitives.

## Locator priority (tests + POM)

1. `getByRole` (+ accessible name)
2. `getByLabel` / `getByPlaceholder`
3. `getByText` / `getByAltText` (stable copy)
4. `getByTestId` (`data-testid`)
5. CSS / XPath — **forbidden** in new specs

Page objects: locators + actions only; assertions in specs.

## When to add `data-testid`

| Add                                              | Skip                         |
| ------------------------------------------------ | ---------------------------- |
| Screen root (capture / POM anchor)               | Every layout wrapper         |
| Primary CTA, icon-only controls                  | Clear role+name              |
| Regions: form, list, dialog **content** (portal) | Decorative text              |
| Rows: `…item.${businessId}`                      | Index `…-0`                  |
| Ambiguous twins                                  | `src/components/ui` defaults |

Treat testids as public API.

## Naming + file

```
{feature}.{screen}.{slot}[.{variant}]
```

```
src/features/<feature>/screens/<screen>/testids.ts
```

```ts
export const loginTestIds = {
  root: "auth.login",
  email: "auth.login.email",
  submit: "auth.login.submit",
} as const;
```

Pass into primitives; never hardcode inside `ui/`. Shell: `app.shell.*`.

## Visual capture note

Prefer root testid. Artifact folders / gold loop: [visual.md](visual.md).

## Optional E2E generate

After visual + gate (skill Step 8). **User confirm** first.

| Do                                        | Don't                                        |
| ----------------------------------------- | -------------------------------------------- |
| POM from route + `testids` + role-first   | Full a11y explore / perception.json          |
| Thin `@smoke` (open → root → 1–2 actions) | Mega smoke/core/edge plan                    |
| One run; fix locators ≤2                  | N-run quarantine / heal product UI for tests |

```
e2e/pages/screens/<feature>/<screen>.page.ts
e2e/specs/<feature>/<screen>.spec.ts
```

Run: `pnpm test:e2e`. Out of scope: Vitest under `src/**`; full aidlc-style agent.
