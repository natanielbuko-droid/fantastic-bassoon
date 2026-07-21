# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two independent apps in one repo:

1. **Calculator** (repo root) — a static, single-page calculator web app; no build step, no package manager, no dependencies. Three files:
   - `index.html` — markup for the display and keypad
   - `style.css` — dark-theme styling, keypad laid out as a 4-column CSS grid
   - `script.js` — all calculator logic and event wiring
2. **GRAWITON Deluxe** (`grawiton-deluxe/`) — a neon 2D gravity-flip runner game built with Vite + vanilla TypeScript (strict), no game engine, no UI framework. Modules under `grawiton-deluxe/src/`; see `grawiton-deluxe/README.md` for the module map and gameplay rules.

## Running it

Calculator — no build/test/lint tooling. To view changes:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly in a browser also works since everything is relative, self-contained, and loaded via `<script src>` / `<link>` (no ES modules, no bundler).

Game — standard Vite workflow inside `grawiton-deluxe/`:

```bash
cd grawiton-deluxe
npm install
npm run dev       # dev server
npm run build     # tsc (strict, must stay error-free) + vite build to dist/
npm run preview   # serve the production build
```

## Deployment

The site is served by GitHub Pages from the `gh-pages` branch at
https://natanielbuko-droid.github.io/fantastic-bassoon/. On every push to `main`,
`.github/workflows/pages.yml` builds the game (`npm ci && npm run build` in
`grawiton-deluxe/`), assembles a `_site/` tree (calculator at the root, game
build under `/grawiton-deluxe/`), and force-pushes it to `gh-pages` — never
commit to `gh-pages` directly, it gets overwritten. The game's Vite config uses
`base: "./"` so the build works under that subpath.

## Architecture (calculator)

`script.js` implements a small state machine for calculator input, holding three pieces of state at module scope:

- `firstOperand` — the left-hand operand once an operator has been pressed
- `operator` — the pending operator (`+`, `-`, `*`, `/`)
- `currentInput` — the string shown on the display, built up digit by digit
- `waitingForSecondOperand` — true right after an operator is pressed, so the next digit press starts a fresh number instead of appending to `currentInput`

Key/button dispatch is unified: both the on-screen keypad (via a single delegated `click` listener on `.keys`, reading `data-value` / `data-action` attributes on each button) and the physical keyboard (via a `keydown` listener) call into the same handler functions (`inputDigit`, `handleOperator`, `handleEquals`, `inputDecimal`, `backspace`, `clearAll`, `inputPercent`). When adding a new operation or key, wire it into both listeners the same way existing ones are.

`compute(a, b, op)` is the only place arithmetic happens. `updateDisplay()` is the only place the DOM is written to (`#current` and `#expression`), and formats numbers via `toLocaleString("pl-PL", ...)` — the UI and number formatting are in Polish (e.g. decimal key is `,`, division sign `÷`), so keep new user-facing strings consistent with that.
