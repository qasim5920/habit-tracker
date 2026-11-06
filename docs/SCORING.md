# Scoring

Every completed habit-day earns points:

| Priority | Base points |
|---|---|
| Main (only one habit) | 50 |
| High | 30 |
| Medium | 20 |
| Low | 10 |

- **Streak multiplier**: +10% for each consecutive day a habit has been done, capped at ×2.0 (10 days in a row).
  Archived gaps and missed days break the run.
- **Perfect Day**: +25% of that day's points when *every active habit* is done that day.
- **Active** means tracked that day: on or after the habit's creation date and not archived.
- **Main**: whichever habit was Main on a given day is worth 50 that day. Switching Main to another habit does not rewrite
  history — the days earned while Main keep their Main value (stored as date ranges in `habit.mains`). Other priorities are
  read from the habit's current priority.
- Points are always derived from the log; unticking or editing a day re-scores it.

## Levels
Total XP needed to reach level L is `150 × (L − 1) × L`: L2 300, L3 900, L4 1,800, L5 3,000, L6 4,500 … each level needs 300 XP
more than the previous. Names: Seed, Sprout, Seedling, Sapling, Shrub, Young Tree, Tree, Grove, Forest, Ancient Forest
(levels beyond 10 keep the last name).

The code is `src/renderer/js/score.js`; constants are at the top.
