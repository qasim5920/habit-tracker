# Changelog

## 2.0.0
- **Everything fits on one screen.** The page no longer scrolls. The right side is a grid that holds the Overview, Completion,
  Comparison and Heatmap panels at the same time, and it scales with the window (the existing auto-zoom still applies).
- **The card list scrolls on its own**, with a thin scrollbar and soft fades at the top and bottom. A newly added habit is
  scrolled into view. Header, progress bar and the add row stay put.
- **Panels swap places.** Drag a panel by its grip onto another to swap them (or use the arrow keys on a focused grip).
  Slots: panels 1 and 2 share the top row, 3 and 4 each take a full-width row. A row whose panels are all collapsed shrinks to
  its title bar and gives the space to the others. Reset layout still restores the default.
- Charts are now drawn at their panel's real width **and height**; the heatmap sizes its cells to the panel (never below 9px,
  then it scrolls sideways) and "Tracking since" moved up next to the year.
- The heatmap is centred in its panel when the panel is taller than it needs.
- Panels adapt to their slot: the overview becomes a single row when it has a full-width slot.

## 1.7.1
- The streak glow no longer shines from behind the card. Instead a thin accent strip runs along the card's edge and gets
  brighter as the streak grows (starts at 3 days, full strength at 30), with a faint inner tint and a very small lift
  (about 1%) at full strength. Still dimmer until you tick the habit today; archived habits never glow.

## 1.7.0
- **Movable panels.** The right column is now a stack of windows (Overview, Completion, Comparison, Heatmap). Drag a panel by
  its grip to put it anywhere, or focus the grip and press ↑/↓. Click a panel's title to collapse or expand it.
  The order and collapsed panels are remembered; "Reset layout" (bottom of the page, with Undo) restores the default.
  The habit picker and range tabs stay on top because they control every panel.
- **Ambient glow.** A soft accent glow appears behind a habit card once its streak reaches 3 days and grows with the streak
  (full strength at 30 days). It is dimmer until you tick the habit today, and archived habits never glow.
- The installer is no longer stored in the repo; releases are built and published by the GitHub Actions workflow.

## 1.6.0
- Sort menu: Priority, Most done, Least done (completion % over the days a habit was tracked), Oldest habit, Newest habit.
  Each is a one-time reorder with Undo; cards can still be dragged afterwards.
- Both graphs (completion graph and month/year comparison) can be shown as Line, Column, Area or Column + line,
  each with its own style. The choice is remembered separately for each graph.

## 1.5.0
- Tracking start is locked to the creation date (no editable "Tracking since", no backfilling before creation).
- Archive habits (history kept, archived days are skipped); toolbar toggle to show/hide archived.
- **Main** priority: one habit at a time, 50 points; past Main days keep their value after switching.
- Source reorganised into `src/`, split into focused files; docs and tests added.

## 1.4.0
- UI scales to any window size / fullscreen / zoom. Scoring system (points, streak multiplier, Perfect Day, levels).

## 1.3.0
- Month and year comparison graph. Monochrome user-selectable accent colour; priority shown as shades of it.

## 1.2.0
- Sound feedback, priority (high/medium/low) with draggable cards, quality-of-life features, growth icon, backfilling past days.

## 1.1.0
- Cleaner minimalist UI, 5+ years of history, proper Windows installer with local data storage.

## 1.0.0
- First version: add/remove habits, dark UI, line graph.
