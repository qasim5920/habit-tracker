# CLAUDE.md — working notes for AI assistants

Desktop habit tracker: Electron 33, plain JS renderer (no framework, no bundler, no modules), Windows NSIS installer.
Read `docs/ARCHITECTURE.md` first; `docs/SCORING.md` and `docs/DATA.md` for the rules and the data format.

## How the owner wants to work
- **Ask before making changes**, then explain what and why as you go. Don't work as a black box.
- Keep the visual style: black background, white text, minimalist, **one accent colour with shades** (CSS variables
  `--acc`, `--mn`, `--hi`, `--md`, `--lo`). Don't restyle unless asked; "add on top" is the norm.
- This repo is only about the habit tracker.

## Commands
- `npm start` run · `npm test` run the tests (must stay green) · `npm run dist` build the installer into `dist/`.
- The installer is built on Linux with wine; a "channel" error after the build is harmless. It has **not** been run on
  real Windows by the previous sessions, only built and verified structurally and in Electron under xvfb.

## Conventions and gotchas
- Renderer scripts are **classic scripts sharing one global scope**; load order is in `src/renderer/index.html`.
  Code at the top level of a file may only use things from files loaded *before* it; functions may call anything at runtime.
- Data is the single object `state`; every change goes through a function in `actions.js` that calls `save()` then `render()`.
- Points, streaks, levels and heatmap are **derived from `state.log` every time** (nothing is cached on disk).
- Tracking start is **locked** to `created`; never add UI to edit it. Marking days goes through `setDay`, which refuses
  days where `isActiveOn(h, k)` is false (before creation, or while archived).
- Only one Main habit at a time (`setMain`). Main history is kept as date ranges in `habit.mains` so past Main days keep 50 pts.
- Scaling is done in the **main process** (`zoom.js`, `webContents.setZoomFactor`); charts are drawn at the real container
  width (`chartW`). Don't add fixed pixel widths to the right column.
- Sound is synthesized with Web Audio (no audio files). Ramps must never target a value <= 0.
- Tests fake `window.api` and `AudioContext`; add a test for every behaviour change in `tests/run.js`.
- Chart drawing lives in `charts.js` (`plotSeries`, `plotCompare`); a new chart type needs an icon `ICON.c_<type>` in `helpers.js`.
- **One screen, no page scroll.** `.wrap` is exactly `100vh`; only `#list` (cards) and a panel body may scroll. The right side is a
  2-column grid (`#widgets`): slots 1+2 share the top row, 3 and 4 are full width, row heights come from `rowSizes` in `layout.js`.
  Charts and the heatmap are drawn from their container's real width *and height* (`chartW`, `chartH`), so never give them fixed
  heights; each panel must work in a half-width and a full-width slot (container queries at the end of `styles.css`).
- Right-column panels are `<section class="w" data-w="…">` inside `#widgets`; ids live in `layout.js` (`WIDGETS`). A new panel needs
  an entry there and a section in `index.html`. `layout.js` loads before `state.js` because `clean()` calls `cleanLayout`.
- Card glow is CSS only: `.card::after` draws a thin edge strip, driven by `--glow` (0..1) set from `glowOf` in `stats.js`; the
  card also lifts ~1%. Nothing is drawn behind cards. Keep it subtle.
- Version lives in `package.json`; add an entry to `docs/CHANGELOG.md` when you bump it.
