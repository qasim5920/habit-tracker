# Architecture

## Processes
- **Main process** (`src/main/`) — creates the frameless dark window, keeps it scaled, and owns all disk access.
  - `main.js`: window (bounds and zoom remembered in `window.json`), single-instance lock, IPC handlers
    `load / save / backup / export / import / openFolder`, atomic writes, daily backups (last 150 kept),
    keyboard handling for zoom (Ctrl +/−/0) and F11.
  - `zoom.js`: `fitZoom(width, height, userZoom)` — proportional zoom against a 1180×720 design size.
  - `preload.js`: exposes the small `window.api` bridge (context isolation on, no node in the page).
- **Renderer** (`src/renderer/`) — the UI. When `window.api` is missing (plain browser, tests) it falls back to `localStorage`.

## Renderer scripts (loaded in this order by `index.html`)
| File | Responsibility |
|---|---|
| `theme.js` | Accent colour → shade variables (`--acc/--mn/--hi/--md/--lo`), swatches and colour popover |
| `charts.js` | Drawing for the four chart types (line, column, area, column + line) and the type switchers, shared by both graphs |
| `compare.js` | Month-vs-last-month / year-vs-last-year comparison graph |
| `score.js` | Points, streaks, Perfect Day bonus, levels (`scoreDays`, `scoreSummary`, `levelInfo`) |
| `state.js` | The `state` object, validation/migration (`clean`), `load`/`save` |
| `helpers.js` | `$`, `el`, date helpers (`dk`, `pk`, `addD`, `today`), SVG icons |
| `sound.js` | Synthesized chimes (done, all-done, level-up, undo, add) |
| `toast.js` | Toast with Undo |
| `stats.js` | `calcStarts`, `isActiveOn`, `dayCounts`, streaks, graph buckets |
| `actions.js` | Everything that changes data: add/remove/archive, priority & Main, `setDay`, reorder, rename |
| `render-cards.js` | Left column: cards, progress bar, toolbar, add row |
| `render-panel.js` | Right column: habit picker, stats, line graph, heatmap |
| `app.js` | Resize handling, event wiring, keyboard shortcuts, import/export, start-up (`render()`) |

## Data flow
`user event → action (actions.js) → mutate state → save() → render()`. `render()` redraws everything from `state`;
derived numbers (streaks, points, level) are recomputed each time. Undo toasts restore a snapshot taken before the action.

## Scaling
The main process zooms the page proportionally to the window size (clamped 0.75–2.6, plus the user's Ctrl +/− zoom).
Inside the page, charts are drawn at the container's real pixel width and the heatmap cell size is derived from it, so layouts
stay sharp and nothing overflows at any size (verified from 760×540 up to 3840×2160).

## Packaging
`electron-builder` → NSIS x64 installer (per-user, choosable directory, desktop and Start-menu shortcuts).
Packaged files: `src/**/*` and `build/icon-256.png`; installer/exe icon from `build/icon.ico`.
