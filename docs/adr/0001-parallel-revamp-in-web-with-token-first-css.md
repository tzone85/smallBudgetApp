# ADR 0001: Build the UI revamp in `web/` with token-first CSS

Date: 2026-07-28
Status: Accepted

## Context

The classic app at the repo root works: a pure `BudgetStore`, storage
adapters, Playwright e2e, and CI. Its UI is Bootstrap with raw values
scattered through the CSS. We want a revamped UI without breaking the
working app or its test suite mid-flight.

## Decision

1. **Build the revamp in a separate `web/` directory.** The classic app
   keeps running at the root. Features migrate into `web/` story by
   story, each behind its own tests. Nothing is deleted until its
   replacement ships.
2. **Design tokens are the single source of truth.** All colors, type,
   spacing, radii, and focus styles live as CSS custom properties in
   `web/styles/tokens.css`. Components consume tokens, never raw values.
3. **Accessibility is enforced by tests, not review.** Vitest checks
   that every text/background token pair meets WCAG AA (4.5:1 text,
   3:1 focus ring), that the shell has landmarks and a skip link, and
   that focus outlines are never removed.
4. **Architecture diagrams are hand-authored SVG**, checked in under
   `docs/`. No Mermaid, no generated-at-build diagrams. SVG renders on
   GitHub, diffs as text, and uses the same token colors as the UI.

## Consequences

- Two UIs exist in the repo until migration finishes. The root README
  says which is which.
- `web/tests` are not yet in the root `npm test`; wiring them into the
  root `vitest.config.js` belongs to a later story.
- Token changes ripple everywhere by design. A bad token value fails
  the WCAG tests instead of shipping.
- Diagram edits are manual. That is the point: they stay small,
  deliberate, and reviewable.
