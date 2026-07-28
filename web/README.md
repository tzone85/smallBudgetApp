# web/ — revamped UI

Token-first design system for the budget app revamp. The old app stays at the
repo root until later stories migrate it.

## Files

- `styles/tokens.css` — all design tokens as CSS vars: palette, type pairing
  (serif display + system sans body), type scale, spacing, radius, shadows,
  focus ring. Components must consume tokens, not raw values.
- `styles/base.css` — reset, shell layout, and global `:focus-visible` styles.
- `index.html` — the shell: skip link, header, main, footer.

## Tests

```sh
npx vitest run -c web/vitest.config.js
```

Covers: required tokens exist, spacing scale ascends, every text/background
pair meets WCAG AA (4.5:1 text, 3:1 focus ring), the shell has landmarks and
a skip link, and focus outlines are never removed.

Not yet wired into root `npm test`. To wire it, add
`"web/tests/**/*.test.js"` to the `include` list in the root
`vitest.config.js` (that file belongs to another story).
