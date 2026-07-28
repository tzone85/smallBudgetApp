# ADR 0002: Fold the web/ revamp into the main app

Date: 2026-07-28. Status: accepted. Supersedes the split in [ADR 0001](0001-parallel-revamp-in-web-with-token-first-css.md).

## Context

ADR 0001 put the new UI in `web/`, next to the classic app, so the design
system could grow without breaking anything. That worked, but it left two
half-apps: the classic one had the features, the shell had the styling.

## Decision

One app. The design tokens and base styles moved from `web/styles` into
`src/styles` (with a dark palette added on `[data-theme="dark"]`), the root
`index.html` was rebuilt on them, and Bootstrap was dropped. `web/` is gone.

The PlantUML pipeline went with it. Diagrams are now hand-authored SVGs in
`docs/` — no generator, edit the file.

## Consequences

- One `index.html`, one stylesheet chain, one test story.
- The token/WCAG suites in `web/tests` were deleted with the shell; contrast
  is now a review concern, not a build gate. Bring the gate back if the
  palette starts churning.
- Old `web/` bookmarks 404. Nothing shipped from there.
