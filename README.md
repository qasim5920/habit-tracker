# Habit Tracker

A minimalist, dark desktop habit tracker for Windows. Everything is stored locally on your PC — no account, no cloud.

![Habit Tracker](docs/screenshot.png)

## Install
Download `HabitTracker-Setup-1.5.0.exe` from the repository's **Releases** page and run it.
The installer is unsigned, so Windows SmartScreen shows an "unknown publisher" warning (click *More info → Run anyway*).
Your data survives updates and uninstalling.

## Features
- **Habits as cards**: add, rename (double-click or F2), drag to reorder (or Alt+↑/↓), archive, delete (with undo).
- **Priorities**: **Main** (only one at a time, 50 pts), High 30, Medium 20, Low 10. Shown as shades of one accent colour.
- **Tracking starts the day a habit is created** and can't be backdated; archived days are skipped, not counted as misses.
- **Scoring and levels**: streak multiplier, Perfect Day bonus, levels from Seed to Ancient Forest. See [docs/SCORING.md](docs/SCORING.md).
- **Graphs**: completion line graph (30D / 90D / 1Y / 5Y / All), month-vs-last-month and year-vs-last-year comparison, and a heatmap with 5+ years of history.
- **Accent colour picker**, soft sound feedback (Ctrl+M to mute), hide completed, show archived.
- **Scales to any window size** (auto zoom, Ctrl +/−/0, F11 fullscreen).
- **Safe data**: atomic saves, daily automatic backups, export/import.

## Keyboard
Ctrl+N new habit · Space tick · Alt+↑/↓ move · F2 rename · Del delete · Ctrl+M sound · Ctrl +/−/0 zoom · F11 fullscreen

## Where your data lives
`%APPDATA%\Habit Tracker\` — `habits.json` (your data), `backups\` (one file per day, last 150 kept), `window.json` (window size and zoom). Format: [docs/DATA.md](docs/DATA.md).

## Develop
```bash
npm install
npm start      # run the app
npm test       # 148 behaviour tests (jsdom, no window needed)
npm run dist   # build dist/HabitTracker-Setup-<version>.exe
```
Building the Windows installer on Linux needs `wine` (for icon embedding). electron-builder prints a harmless
`Cannot read properties of null (reading 'channel')` after it has written the installer.

## Project layout
```
src/main/       Electron main process: window, zoom, file storage, backups, IPC
src/renderer/   The UI (plain HTML/CSS/JS, no framework, no bundler)
  js/           Scripts loaded in order by index.html (see docs/ARCHITECTURE.md)
build/          App icon files   (tools/make_icon.py regenerates them)
tests/run.js    Behaviour tests
docs/           ARCHITECTURE.md · SCORING.md · DATA.md · CHANGELOG.md
CLAUDE.md       Notes for AI assistants working in this repo
```
