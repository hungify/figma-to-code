# Behavioral validation

**Read in Step 5 and Step 7** for screens or interactive components. Visual pixel comparison stays in [visual.md](visual.md); test locators stay in [automation.md](automation.md).

## Responsive behavior

Read Figma Auto Layout, constraints, min/max sizing, hug/fill behavior, and overflow before coding.

- One supplied node still carries responsive constraints; do not turn it into a fixed screenshot.
- Do not invent a second visual layout or breakpoint without evidence.
- Use repo breakpoint conventions (`md:` for mobile↔desktop) and existing container rules.
- Preserve fluid widths and intrinsic content behavior between supplied viewports.
- Check narrow, target, and adjacent wider widths for clipping, overflow, and unintended reflow.

## Interactive states

Inventory states exposed by Figma component properties and existing code primitives before implementation.

- Implement supplied hover, focus, active, disabled, selected/checked, error, and loading states through prop maps and existing component APIs.
- Preserve keyboard and pointer behavior from accessible primitives.
- Do not invent business states absent from design/product requirements.
- Verify every supplied state; a default-state screenshot alone does not complete an interactive component.

## Accessibility

- Prefer semantic elements and existing accessible primitives.
- Give controls accessible names; associate labels, descriptions, and errors with fields.
- Preserve keyboard navigation, visible focus, disabled semantics, and appropriate roles/states.
- Keep text and control contrast at project/WCAG requirements.
- Use ARIA only when native semantics or primitive APIs are insufficient.
- Accessibility wins over literal visual replication when they directly conflict, but never hide that deviation.

## Deviations

Do not silently diverge from Figma. A deviation is allowed only for an accessibility requirement or verified technical constraint—not implementation convenience.

Report each deviation with:

- Figma node or affected intent;
- constraint and evidence;
- implemented behavior;
- visual/behavior impact.

Add a code comment only when the reason remains non-obvious to future maintainers. A deviation never bypasses prop-map, component, or fidelity gates. Stop for user direction when impact is material or requires a product/design choice.

## Completion checklist

- [ ] Responsive constraints implemented without invented layouts
- [ ] Supplied interactive states implemented and verified
- [ ] Keyboard interaction and visible focus work
- [ ] Labels, roles, errors, and disabled states are accessible
- [ ] Assets and content have correct accessible treatment
- [ ] Deviations are absent or explicitly reported with evidence
