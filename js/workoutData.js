/* =========================================================================
   workoutData.js — loads workouts.json and provides read-only access to it.
   This module never writes back to the dataset; the WODWell library is
   treated as immutable local data. All duration math accounts for the
   dataset's `time` field being expressed in SECONDS, with 0/unknown
   treated as "Unknown" rather than 0 minutes.
   Exposed on window.App.Data
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;

  let WORKOUTS = [];          // raw, defensively-normalized workout objects
  let BY_ID = new Map();      // id -> workout
  let EQUIPMENT_OPTIONS = []; // [{slug,label,count}] built from the dataset
  let SCORE_TYPE_OPTIONS = [];
  let MOVEMENT_CATEGORY_COUNTS = {};

  /**
   * Local, app-side heuristic mapping from WODWell movement slugs to a
   * user-friendly body-area / style grouping. This mapping is NOT part of
   * the WODWell dataset — it's our own classification layered on top so
   * the library can offer a "filter by movement group" control. Any
   * movement slug not covered below falls back to "full-body".
   */
  const MOVEMENT_CATEGORY_MAP = {
    // Legs
    "air-squat": "legs", "back-squat": "legs", "front-squat": "legs", "overhead-squat": "legs",
    "box-jump": "legs", "box-step-up": "legs", "lunge": "legs", "pistol": "legs",
    "goblet-squat": "legs", "broad-jump": "legs", "wall-sit": "legs",
    "sled-push-prowler-push": "legs", "sled-pull": "legs", "lateral-jump": "legs",
    // Back / posterior chain
    "pull-up": "back", "muscle-up": "back", "rope-climb": "back", "bent-over-row": "back",
    "ring-row": "back", "deadlift": "back", "sumo-deadlift-high-pull": "back",
    "good-mornings": "back", "back-extension": "back", "monkey-bar-traverse": "back",
    "pegboard-ascent": "back",
    // Shoulders / overhead
    "push-press": "shoulders", "strict-press": "shoulders", "shoulder-to-overhead": "shoulders",
    "handstand-push-up": "shoulders", "handstand-walk": "shoulders", "handstand-hold": "shoulders",
    "jerk": "shoulders", "push-up": "shoulders", "dip": "shoulders", "curl": "arms",
    // Core
    "sit-up": "core", "ghd-sit-up": "core", "toes-to-bar": "core", "v-up": "core",
    "plank-hold": "core", "hollow-rock": "core", "hollow-hold": "core", "russian-twist": "core",
    "l-sit": "core", "flutterkick": "core", "mountain-climber": "core",
    "arch-up-superman-hold": "core", "ball-slams": "core", "candlestick": "core",
    "back-scale": "core", "front-scale": "core",
    // Running
    "run": "running", "shuttle-run": "running",
    // Conditioning / engine
    "row": "conditioning", "air-bike": "conditioning", "ski": "conditioning", "bike-bicycle": "conditioning",
    "double-under": "conditioning", "jump-rope-singles": "conditioning", "swim": "conditioning",
    "burpee": "conditioning", "jumping-jack": "conditioning", "up-down": "conditioning",
    "weighted-walk-run": "conditioning", "farmers-carry": "conditioning", "firemans-carry": "conditioning",
    "yoke-carry": "conditioning", "ruck": "conditioning", "dumbbell-swing": "conditioning",
    // Full body / olympic / mixed
    "clean": "full-body", "snatch": "full-body", "thruster": "full-body", "devil-press": "full-body",
    "wall-ball-shot": "full-body", "kettlebell-swing": "full-body", "ground-to-overhead": "full-body",
    "man-maker": "full-body", "turkish-get-up": "full-body", "wall-climb": "full-body",
    "bench-press": "chest",
  };

  const MOVEMENT_CATEGORY_LABELS = {
    chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms", legs: "Legs",
    core: "Core", "full-body": "Full Body", running: "Running", conditioning: "Conditioning",
  };

  function categoryForMovement(slug) {
    return MOVEMENT_CATEGORY_MAP[slug] || "full-body";
  }

  /** Duration is stored in SECONDS. 0 / missing / non-numeric => unknown. */
  function getDurationSeconds(workout) {
    const n = Number(workout.time);
    if (!isFinite(n) || n <= 0) return null;
    return n;
  }

  function durationBucket(workout) {
    const secs = getDurationSeconds(workout);
    if (secs === null) return "unknown";
    const mins = secs / 60;
    if (mins < 10) return "under10";
    if (mins < 20) return "10-20";
    if (mins < 30) return "20-30";
    if (mins < 45) return "30-45";
    return "45plus";
  }

  const DURATION_BUCKET_LABELS = {
    any: "Any", under10: "Under 10 min", "10-20": "10\u201320 min", "20-30": "20\u201330 min",
    "30-45": "30\u201345 min", "45plus": "45+ min", unknown: "Unknown duration",
  };

  /** Defensive normalization of one raw workout record from workouts.json. */
  function normalizeWorkout(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = raw.id !== undefined && raw.id !== null ? String(raw.id) : null;
    if (!id) return null;
    return {
      id,
      title: (raw.title || "Untitled Workout").toString().trim(),
      subtitle: (raw.subtitle || "").toString().trim(),
      workout: (raw.workout || "").toString(),
      description: (raw.description || "").toString(),
      notes: (raw.notes || "").toString(),
      coachNotes: (raw.coachNotes || "").toString(),
      time: raw.time, // kept raw; use getDurationSeconds() for safe access
      url: (raw.url || "").toString(),
      scoreTypes: Array.isArray(raw.scoreTypes) ? raw.scoreTypes.filter(Boolean) : [],
      movements: Array.isArray(raw.movements) ? raw.movements.filter(Boolean) : [],
      equipment: Array.isArray(raw.equipment) ? raw.equipment.filter(Boolean) : [],
      categories: Array.isArray(raw.categories) ? raw.categories.filter(Boolean) : [],
      creator: (raw.creator || "").toString(),
      creatorType: (raw.creatorType || "").toString(),
    };
  }

  function buildIndices() {
    const equipCounts = new Map();
    const scoreCounts = new Map();
    MOVEMENT_CATEGORY_COUNTS = {};

    WORKOUTS.forEach((w) => {
      w.equipment.forEach((e) => equipCounts.set(e, (equipCounts.get(e) || 0) + 1));
      w.scoreTypes.forEach((s) => scoreCounts.set(s, (scoreCounts.get(s) || 0) + 1));
      const cats = new Set(w.movements.map(categoryForMovement));
      cats.forEach((c) => { MOVEMENT_CATEGORY_COUNTS[c] = (MOVEMENT_CATEGORY_COUNTS[c] || 0) + 1; });
    });

    EQUIPMENT_OPTIONS = Array.from(equipCounts.entries())
      .map(([slug, count]) => ({ slug, label: Utils.titleCaseSlug(slug), count }))
      .sort((a, b) => b.count - a.count);

    SCORE_TYPE_OPTIONS = Array.from(scoreCounts.entries())
      .map(([slug, count]) => ({ slug, label: Utils.titleCaseSlug(slug), count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Fetch + parse workouts.json. Returns a Promise. */
  function loadWorkouts() {
    return fetch("workouts.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then((json) => {
        if (!Array.isArray(json)) throw new Error("Unexpected workouts.json format");
        WORKOUTS = json.map(normalizeWorkout).filter(Boolean);
        BY_ID = new Map(WORKOUTS.map((w) => [w.id, w]));
        buildIndices();
        return WORKOUTS.length;
      });
  }

  function getAllWorkouts() { return WORKOUTS; }
  function getWorkoutById(id) { return id ? BY_ID.get(String(id)) || null : null; }
  function getEquipmentOptions() { return EQUIPMENT_OPTIONS; }
  function getScoreTypeOptions() { return SCORE_TYPE_OPTIONS; }
  function getMovementCategoryOptions() {
    return Object.keys(MOVEMENT_CATEGORY_COUNTS)
      .map((slug) => ({ slug, label: MOVEMENT_CATEGORY_LABELS[slug] || Utils.titleCaseSlug(slug), count: MOVEMENT_CATEGORY_COUNTS[slug] }))
      .sort((a, b) => b.count - a.count);
  }

  /** True if every equipment tag the workout requires is in ownedSlugs. No requirement => always true. */
  function isEquipmentSatisfied(workout, ownedSlugs) {
    if (!workout.equipment || workout.equipment.length === 0) return true;
    const owned = new Set(ownedSlugs || []);
    return workout.equipment.every((e) => owned.has(e));
  }

  /**
   * filters shape:
   * { query, durationBucket, equipmentSlugs:[], movementCategory, scoreType,
   *   onlyMyEquipment, myEquipment:[], favoritesOnly, favoriteIds:[], excludeId }
   */
  function workoutMatchesFilters(w, filters) {
    if (filters.excludeId && w.id === String(filters.excludeId)) return false;

    if (filters.query) {
      const q = filters.query.toLowerCase();
      const hay = (w.title + " " + w.workout + " " + w.description).toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (filters.durationBucket && filters.durationBucket !== "any") {
      if (durationBucket(w) !== filters.durationBucket) return false;
    }

    if (filters.equipmentSlugs && filters.equipmentSlugs.length) {
      const need = filters.equipmentSlugs;
      const has = w.equipment.some((e) => need.includes(e));
      if (!has) return false;
    }

    if (filters.movementCategory && filters.movementCategory !== "any") {
      const has = w.movements.some((m) => categoryForMovement(m) === filters.movementCategory);
      if (!has) return false;
    }

    if (filters.scoreType && filters.scoreType !== "any") {
      if (!w.scoreTypes.includes(filters.scoreType)) return false;
    }

    if (filters.onlyMyEquipment) {
      if (!isEquipmentSatisfied(w, filters.myEquipment || [])) return false;
    }

    if (filters.favoritesOnly) {
      const favs = filters.favoriteIds || [];
      if (!favs.includes(w.id)) return false;
    }

    return true;
  }

  function filterWorkouts(filters) {
    return WORKOUTS.filter((w) => workoutMatchesFilters(w, filters || {}));
  }

  window.App = window.App || {};
  window.App.Data = {
    loadWorkouts,
    getAllWorkouts,
    getWorkoutById,
    getEquipmentOptions,
    getScoreTypeOptions,
    getMovementCategoryOptions,
    categoryForMovement,
    getDurationSeconds,
    durationBucket,
    DURATION_BUCKET_LABELS,
    isEquipmentSatisfied,
    filterWorkouts,
    workoutMatchesFilters,
  };
})();
