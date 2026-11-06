# Data format

Location: `%APPDATA%\Habit Tracker\habits.json` (plain JSON). Daily copies in `backups\`, window state in `window.json`.

```jsonc
{
  "habits": [
    {
      "id": "h1abc",              // unique id
      "name": "Deep work",
      "created": "2026-01-01",    // tracking starts here; never edited after creation
      "priority": "high",         // "high" | "med" | "low"  (Main is stored separately, below)
      "pauses": [ { "from": "2026-03-01", "to": "2026-04-01" } ],  // optional archive ranges; "to": null = archived now
      "mains":  [ { "from": "2026-06-01", "to": null } ]           // optional Main ranges; "to": null = Main now
    }
  ],
  "log": { "h1abc": { "2026-01-02": true } },   // completed days per habit id
  "settings": { "sound": true, "hideDone": false, "accent": "#9db7ff", "cmp": "month", "showArchived": false }
}
```
- Range ends are exclusive (`to` is the first day *not* in the range).
- At most one habit has an open Main range; `clean()` in `state.js` repairs data that breaks this.
- Older files (no priority, no settings, no pauses/mains) are migrated on load; the order of `habits` is the card order.
- Export/Import in the app reads and writes this same format.
