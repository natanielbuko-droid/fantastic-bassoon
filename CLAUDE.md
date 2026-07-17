# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page calculator web app — no build step, no package manager, no dependencies. Three files:

- `index.html` — markup for the display and keypad
- `style.css` — dark-theme styling, keypad laid out as a 4-column CSS grid
- `script.js` — all calculator logic and event wiring

## Running it

There is no build/test/lint tooling in this repo. To view changes:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Opening `index.html` directly in a browser also works since everything is relative, self-contained, and loaded via `<script src>` / `<link>` (no ES modules, no bundler).

## Deployment

The site is served by GitHub Pages from the `gh-pages` branch at
https://natanielbuko-droid.github.io/fantastic-bassoon/. On every push to `main`,
`.github/workflows/pages.yml` force-pushes `main` to `gh-pages` — never commit to
`gh-pages` directly, it gets overwritten.

## Architecture

`script.js` implements a small state machine for calculator input, holding three pieces of state at module scope:

- `firstOperand` — the left-hand operand once an operator has been pressed
- `operator` — the pending operator (`+`, `-`, `*`, `/`)
- `currentInput` — the string shown on the display, built up digit by digit
- `waitingForSecondOperand` — true right after an operator is pressed, so the next digit press starts a fresh number instead of appending to `currentInput`

Key/button dispatch is unified: both the on-screen keypad (via a single delegated `click` listener on `.keys`, reading `data-value` / `data-action` attributes on each button) and the physical keyboard (via a `keydown` listener) call into the same handler functions (`inputDigit`, `handleOperator`, `handleEquals`, `inputDecimal`, `backspace`, `clearAll`, `inputPercent`). When adding a new operation or key, wire it into both listeners the same way existing ones are.

`compute(a, b, op)` is the only place arithmetic happens. `updateDisplay()` is the only place the DOM is written to (`#current` and `#expression`), and formats numbers via `toLocaleString("pl-PL", ...)` — the UI and number formatting are in Polish (e.g. decimal key is `,`, division sign `÷`), so keep new user-facing strings consistent with that.
