# Weekly Workout Planner

A fully offline, mobile-first workout planner for a Mon–Fri routine of
Morning Routine + Strength + WOD. The morning routine (yoga, meditation,
stretching, whatever you like) is fully customizable in Settings — add,
remove, rename, or retime any item, or leave it empty if mornings aren't
part of your plan. It's a plain HTML/CSS/JS app (no
frameworks, no build step, no backend) built around your WODWell export
of 7,406 workouts. Everything you plan, complete, or save lives only in
your browser's local storage on your phone — nothing is ever sent
anywhere.

## Running it locally

Because the app loads `workouts.json` via `fetch()`, **opening
`index.html` directly by double-clicking it (a `file://` URL) will
fail** — Chrome blocks local file fetches like that for security
reasons. You'll see a "couldn't load the workout library" screen with
a retry button if this happens.

Instead, serve the folder over plain HTTP. From inside this folder:

```bash
python3 -m http.server 8000
```

Then open **`http://localhost:8000`** (use `localhost`, not
`127.0.0.1` — some browsers treat them differently for installability
checks). Any other static file server (`npx serve`, VS Code's "Live
Server" extension, etc.) works the same way.

## Deploying to GitHub Pages

1. Create a new GitHub repo and push the contents of this folder to it
   (keep the folder structure exactly as-is — `index.html` at the
   repo root, `js/`, `icons/`, and `workouts.json` alongside it).
2. In the repo, go to **Settings → Pages**, set **Source** to your
   main branch (root folder), and save.
3. GitHub gives you a URL like `https://yourname.github.io/your-repo/`.
   That's it — GitHub Pages serves over HTTPS automatically, so the
   `file://` issue above doesn't apply and the service worker (offline
   support) will register correctly.

## Installing it on your phone's home screen

Once it's live on GitHub Pages:

1. Open the GitHub Pages URL in Chrome on your Android phone.
2. Tap the **⋮** menu → **Add to Home screen** (Chrome may also show
   an automatic "Install app" banner/prompt).
3. Confirm. It now opens full-screen like a native app, with the icon
   set you see in `icons/`.

After the first visit, the service worker caches the entire app —
including the workout database — so it keeps working in airplane
mode, on a subway, wherever.

## Updating the app later without losing your history

Your planned weeks, completions, streaks, favorites, and saved
strength templates are stored in the browser's `localStorage`,
**keyed to the site's origin + path** — not to any particular version
of the files. So:

- Pushing new commits to the same GitHub Pages URL and reloading the
  app will **not** erase your history, as long as the URL stays the
  same.
- The one thing to remember: if you change any cached file (HTML, CSS,
  JS, icons), bump `CACHE_NAME` at the top of `service-worker.js`
  (e.g. `"wod-planner-v1"` → `"wod-planner-v2"`). This forces every
  device to fully re-download the new version instead of continuing
  to serve old cached files offline. This has no effect on your
  localStorage data — only on which *files* get served.
- As a manual safety net regardless: **Settings → Export My Data**
  saves a JSON backup you can re-import anytime via **Import My
  Data**, on this device or a new one.

## A couple of judgment calls worth knowing about

- **"Wall Ball" in your default equipment list** — the WODWell dataset
  doesn't have a distinct "wall ball" equipment tag, so it's mapped to
  the closest match, **Medicine Ball**, in Settings → My Equipment.
  Movements tagged with a wall ball in the source data will show up
  under that.
- **Build My Week's "5 WODs"** — since the planner is inherently five
  weekday slots (one WOD per day), this is fixed rather than an
  adjustable number in the Build My Week preferences.
- **How duration/type/equipment/movement tags are generated** — your
  updated 7,406-workout export is a different, sparser format than the
  original (no structured duration, equipment, movement, or WOD-type
  fields, just the free-text prescription). Those tags are now
  extracted from the workout text itself using pattern matching, then
  cross-checked against well-known benchmark WODs (Fran, Cindy, Murph,
  Grace, etc.) for accuracy. It's good, but not perfect: explicit
  duration is only stated in about a quarter of workouts (a "For Time"
  WOD often doesn't have one anyway, matching how the app already
  treats unstated duration as "Unknown"), and equipment/movement tags
  are inferred from wording rather than pulled from a fixed list, so
  the occasional workout may be mis-tagged or under-tagged compared to
  the original 1,000-workout set.

## Project structure

```
index.html          App shell (Plan / Workouts / Progress / Settings)
styles.css           All styling (chalkboard dark theme + whiteboard light theme)
manifest.json         PWA metadata (name, icons, start URL)
service-worker.js     Offline caching
workouts.json         Your trimmed WODWell workout database (7,406 workouts)
js/
  utils.js             Date/formatting helpers
  storage.js           localStorage data layer (only module that touches it)
  workoutData.js        Loads & normalizes workouts.json, filtering logic
  planner.js            Weekly plan + completion + streak logic
  builder.js             "Build My Week" auto-suggestion algorithm
  ui-modals.js            Workout detail, strength editor, filters, Build My Week wizard
  ui-plan.js, ui-library.js, ui-progress.js, ui-settings.js   Screen rendering
  main.js                App bootstrap, navigation, event wiring
icons/                 App icons (192/512/512-maskable/180 apple-touch)
```
