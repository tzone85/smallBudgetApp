# Nozzles Budget App

A tiny single-page budget tracker — set a budget, log expenses, watch the
balance go red.

[![CI](https://github.com/tzone85/smallBudgetApp/actions/workflows/ci.yml/badge.svg)](https://github.com/tzone85/smallBudgetApp/actions/workflows/ci.yml)
![Node 20+](https://img.shields.io/badge/node-20%2B-339933)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

Originally a single `js/app.js` with a `UI` class that mixed business logic,
DOM access, and event handlers — plus two real bugs (`return ... ; this.showBalance()`
in `editExpense` and `deleteExpense` meant the balance never updated after either
action). Rewritten with a pure `BudgetStore`, a swappable storage adapter,
Vite bundling, Vitest, Playwright e2e, and CI.

## The revamp (in progress)

A new UI is being built in `web/`, next to the classic app — not on top of
it. So far it ships the shell and the design system it stands on:

- `web/styles/tokens.css` — every color, font, size, spacing step, radius,
  and focus style as a CSS custom property. Components use tokens, never
  raw values.
- `web/index.html` + `web/styles/base.css` — the page shell: skip link,
  header/main/footer landmarks, reset, `:focus-visible` styles.
- `web/tests/` — vitest suites that fail the build if a required token goes
  missing, a text/background pair drops below WCAG AA (4.5:1), or a focus
  outline gets removed.

Features migrate over story by story; both UIs share the same `BudgetStore`.
The reasoning is written up in
[ADR 0001](docs/adr/0001-parallel-revamp-in-web-with-token-first-css.md).

## Highlights

- **Pure logic separated from the DOM** — `BudgetStore` returns `{ok, error?}`
  from every mutation, fires a snapshot to subscribers, and never touches HTML.
- **Pluggable persistence** — `LocalStorage` adapter in production,
  `NullStorage` in tests/SSR. State auto-saves on every change.
- **XSS-safe rendering** — all user content goes through DOM `textContent`
  rather than `innerHTML` (regression test exercises an `<img onerror>` payload).
- **97% line coverage** on the pure modules, 6 Playwright flows exercising
  the real UI in Chromium.
- **Vite + ESM + Bootstrap 5** (replaces jQuery + Bootstrap 4 bundle).
- **CI**: lint → unit (with coverage gate 85%) → Playwright e2e → Vite build,
  with `dist/` and `playwright-report/` uploaded as artifacts.

## Architecture

### Overview

![Architecture overview: the classic app at the repo root beside the new web/ revamp shell](docs/architecture.svg)

The overview is a hand-authored SVG (`docs/architecture.svg`) — edit it
directly; there is no generator. Decisions live in `docs/adr/`.

### Components

![Component diagram](docs/architecture/component.svg)

### Add-expense flow

![Sequence diagram](docs/architecture/sequence_add_expense.svg)

### Deployment

![Deployment](docs/architecture/deployment.svg)

The detail diagrams are PlantUML sources under `docs/architecture/*.puml`;
rendered SVGs are checked in. Regenerate with `./scripts/render_diagrams.sh`
(requires `plantuml` — `brew install plantuml`).

## Quick start

```bash
npm install
npm run dev          # vite dev server on :5173
npm run build        # produces dist/
npm run preview      # serve dist/ on :4173
npm test             # vitest + coverage
npm run test:e2e     # playwright against the preview server
npm run lint         # eslint
```

## Project layout

```
src/
├── main.js          # entrypoint — wires store, storage, ui
├── budget-store.js  # pure BudgetStore (no DOM, no I/O)
├── storage.js       # LocalStorage + NullStorage adapters
├── ui.js            # thin DOM-binding layer
└── styles/main.css
web/
├── index.html       # revamp shell
├── styles/          # tokens.css + base.css
└── tests/           # token, WCAG, and shell suites
tests/
├── unit/            # vitest, happy-dom env
└── e2e/             # playwright + chromium
docs/
├── architecture.svg # hand-authored overview diagram
├── architecture/    # PlantUML sources + rendered SVGs
└── adr/             # architecture decision records
.github/workflows/ci.yml
```

## API of the store

```js
const store = new BudgetStore();
store.setBudget(1000);                            // {ok:true}
store.addExpense({title: "rent", amount: 400});   // {ok:true, expense:{...}}
store.updateExpense(id, {amount: 500});           // {ok:true, expense:{...}}
store.removeExpense(id);                          // {ok:true}
store.subscribe((snap) => console.log(snap));     // returns unsubscribe fn
store.hydrate({budget, expenses});                // restore from storage
store.snapshot();                                 // {budget, expenses, totalExpenses, balance, balanceState}
```

`balanceState` is `"positive" | "negative" | "zero"` — used by the UI to swap
the CSS class on the balance display.

## License

MIT — see [LICENSE](LICENSE).
