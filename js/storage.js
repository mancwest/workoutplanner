/* =========================================================================
   storage.js — everything that reads/writes localStorage.
   This is the ONLY module that touches localStorage directly.
   The WODWell workout database itself is never written here — only a
   workout's id is ever stored, per the app's data-model requirement.
   Exposed on window.App.Storage
   ========================================================================= */
(function () {
  "use strict";

  const KEYS = {
    SCHEMA: "wp_schema_version",
    WEEKS: "wp_weeks",
    COMPLETION: "wp_completion",
    SETTINGS: "wp_settings",
    STRENGTH_LIB: "wp_strength_library",
    FAVORITES: "wp_favorites",
    RECENT: "wp_recent",
  };

  const SCHEMA_VERSION = 1;
  const RECENT_LIMIT = 20;

  // Equipment the user is assumed to own on first run, mapped to the
  // canonical equipment slugs found in the WODWell dataset (see
  // workoutData.js). "Wall Ball" maps to the closest matching dataset tag,
  // "medicine-ball", since WODWell tags wall-ball work under that equipment.
  const DEFAULT_EQUIPMENT_SLUGS = [
    "barbell", "dumbbells", "kettlebells", "rower", "pull-up-bar",
    "medicine-ball", "box", "sandbag", "bench", "jump-rope",
  ];

  function safeParse(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      console.warn("Storage: failed to parse", e);
      return fallback;
    }
  }

  function getJSON(key, fallback) {
    try {
      return safeParse(localStorage.getItem(key), fallback);
    } catch (e) {
      console.warn("Storage: read failed", key, e);
      return fallback;
    }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Storage: write failed", key, e);
      return false;
    }
  }

  function defaultSettings() {
    return {
      equipment: DEFAULT_EQUIPMENT_SLUGS.slice(),
      morningRoutine: { yogaMin: 20, meditationMin: 10 },
      strengthDefaultDuration: 30,
      theme: "system",
    };
  }

  function init() {
    if (getJSON(KEYS.SCHEMA, null) === null) setJSON(KEYS.SCHEMA, SCHEMA_VERSION);
    if (getJSON(KEYS.SETTINGS, null) === null) setJSON(KEYS.SETTINGS, defaultSettings());
    if (getJSON(KEYS.WEEKS, null) === null) setJSON(KEYS.WEEKS, {});
    if (getJSON(KEYS.COMPLETION, null) === null) setJSON(KEYS.COMPLETION, {});
    if (getJSON(KEYS.STRENGTH_LIB, null) === null) setJSON(KEYS.STRENGTH_LIB, []);
    if (getJSON(KEYS.FAVORITES, null) === null) setJSON(KEYS.FAVORITES, []);
    if (getJSON(KEYS.RECENT, null) === null) setJSON(KEYS.RECENT, []);
  }

  /* ------------------------------- Settings ------------------------------- */
  function getSettings() {
    const s = getJSON(KEYS.SETTINGS, defaultSettings());
    // defensive merge in case an older backup is missing newer fields
    const d = defaultSettings();
    return {
      equipment: Array.isArray(s.equipment) ? s.equipment : d.equipment,
      morningRoutine: {
        yogaMin: Number(s.morningRoutine && s.morningRoutine.yogaMin) || d.morningRoutine.yogaMin,
        meditationMin: Number(s.morningRoutine && s.morningRoutine.meditationMin) || d.morningRoutine.meditationMin,
      },
      strengthDefaultDuration: Number(s.strengthDefaultDuration) || d.strengthDefaultDuration,
      theme: ["light", "dark", "system"].includes(s.theme) ? s.theme : "system",
    };
  }

  function saveSettings(settings) {
    return setJSON(KEYS.SETTINGS, settings);
  }

  /* --------------------------------- Weeks -------------------------------- */
  function getAllWeeks() {
    return getJSON(KEYS.WEEKS, {});
  }

  function getWeek(mondayStr) {
    const weeks = getAllWeeks();
    return weeks[mondayStr] || null;
  }

  function saveWeek(weekObj) {
    const weeks = getAllWeeks();
    weeks[weekObj.startDate] = weekObj;
    return setJSON(KEYS.WEEKS, weeks);
  }

  /* ------------------------------ Completion ------------------------------ */
  function getAllCompletion() {
    return getJSON(KEYS.COMPLETION, {});
  }

  function getDayCompletion(dateStr) {
    const all = getAllCompletion();
    return all[dateStr] || { yoga: false, meditation: false, strength: false, wod: false };
  }

  function setDayCompletion(dateStr, activity, value) {
    const all = getAllCompletion();
    const day = all[dateStr] || { yoga: false, meditation: false, strength: false, wod: false };
    day[activity] = value;
    all[dateStr] = day;
    return setJSON(KEYS.COMPLETION, all);
  }

  /* --------------------------- Strength library --------------------------- */
  function getStrengthLibrary() {
    return getJSON(KEYS.STRENGTH_LIB, []);
  }

  function saveStrengthTemplate(template) {
    const lib = getStrengthLibrary();
    const idx = lib.findIndex((t) => t.id === template.id);
    if (idx >= 0) lib[idx] = template;
    else lib.push(template);
    setJSON(KEYS.STRENGTH_LIB, lib);
    return template;
  }

  function deleteStrengthTemplate(id) {
    const lib = getStrengthLibrary().filter((t) => t.id !== id);
    return setJSON(KEYS.STRENGTH_LIB, lib);
  }

  /* -------------------------------- Favorites ------------------------------ */
  function getFavorites() {
    return getJSON(KEYS.FAVORITES, []);
  }

  function isFavorite(workoutId) {
    return getFavorites().includes(String(workoutId));
  }

  function toggleFavorite(workoutId) {
    const id = String(workoutId);
    let favs = getFavorites();
    if (favs.includes(id)) favs = favs.filter((f) => f !== id);
    else favs.push(id);
    setJSON(KEYS.FAVORITES, favs);
    return favs.includes(id);
  }

  /* --------------------------------- Recent -------------------------------- */
  function getRecent() {
    return getJSON(KEYS.RECENT, []);
  }

  function addRecent(workoutId) {
    const id = String(workoutId);
    let recent = getRecent().filter((r) => r.id !== id);
    recent.unshift({ id, viewedAt: Date.now() });
    recent = recent.slice(0, RECENT_LIMIT);
    setJSON(KEYS.RECENT, recent);
  }

  /* ------------------------------ Export/Import ---------------------------- */
  // Intentionally excludes the WODWell workout database (workouts.json owns that).
  function exportData() {
    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      weeks: getAllWeeks(),
      completion: getAllCompletion(),
      settings: getSettings(),
      strengthLibrary: getStrengthLibrary(),
      favorites: getFavorites(),
      recent: getRecent(),
    };
  }

  function importData(data) {
    if (!data || typeof data !== "object") {
      return { ok: false, error: "That file doesn't look like a Workout Planner backup." };
    }
    try {
      if (data.weeks && typeof data.weeks === "object") setJSON(KEYS.WEEKS, data.weeks);
      if (data.completion && typeof data.completion === "object") setJSON(KEYS.COMPLETION, data.completion);
      if (data.settings && typeof data.settings === "object") setJSON(KEYS.SETTINGS, data.settings);
      if (Array.isArray(data.strengthLibrary)) setJSON(KEYS.STRENGTH_LIB, data.strengthLibrary);
      if (Array.isArray(data.favorites)) setJSON(KEYS.FAVORITES, data.favorites);
      if (Array.isArray(data.recent)) setJSON(KEYS.RECENT, data.recent);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Import failed: " + e.message };
    }
  }

  function clearAllData() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    init();
  }

  window.App = window.App || {};
  window.App.Storage = {
    KEYS,
    init,
    getSettings,
    saveSettings,
    getAllWeeks,
    getWeek,
    saveWeek,
    getAllCompletion,
    getDayCompletion,
    setDayCompletion,
    getStrengthLibrary,
    saveStrengthTemplate,
    deleteStrengthTemplate,
    getFavorites,
    isFavorite,
    toggleFavorite,
    getRecent,
    addRecent,
    exportData,
    importData,
    clearAllData,
  };
})();
