/* =========================================================================
   builder.js — "Build My Week" suggestion engine.
   Pure local JavaScript scoring: no network calls, no AI model. Greedily
   fills Monday..Friday, scoring each candidate workout against the chosen
   training style and penalizing repeated movements/equipment/body-focus
   so the proposed week doesn't accidentally become five leg-dominant days.
   Exposed on window.App.Builder
   ========================================================================= */
(function () {
  "use strict";

  const Data = window.App.Data;
  const Storage = window.App.Storage;

  const STYLE_CATEGORY_WEIGHTS = {
    conditioning: { conditioning: 3, running: 3, "full-body": 2, legs: 1, core: 1 },
    strength: { legs: 3, back: 3, shoulders: 3, chest: 3, arms: 2, core: 1, conditioning: -1, running: -1 },
    balanced: {},
    random: {},
  };

  function matchesDurationPref(workout, pref) {
    if (!pref || pref === "any") return true;
    const secs = Data.getDurationSeconds(workout);
    if (secs === null) return false; // unknown duration can't satisfy a specific length ask
    const mins = secs / 60;
    if (pref === "short") return mins <= 15;
    if (pref === "medium") return mins > 15 && mins <= 30;
    if (pref === "long") return mins > 30;
    return true;
  }

  function buildPool(prefs) {
    const settings = Storage.getSettings();
    return Data.getAllWorkouts().filter((w) => {
      if (!matchesDurationPref(w, prefs.durationPref)) return false;
      if (prefs.equipmentPref === "mine" && !Data.isEquipmentSatisfied(w, settings.equipment)) return false;
      return true;
    });
  }

  function dominantCategory(workout) {
    const counts = {};
    workout.movements.forEach((m) => {
      const c = Data.categoryForMovement(m);
      counts[c] = (counts[c] || 0) + 1;
    });
    let best = "full-body", bestCount = -1;
    Object.keys(counts).forEach((c) => {
      if (counts[c] > bestCount) { best = c; bestCount = counts[c]; }
    });
    return best;
  }

  function styleScore(workout, style) {
    if (style === "random" || !style) return 0;
    const weights = STYLE_CATEGORY_WEIGHTS[style] || {};
    const cats = new Set(workout.movements.map(Data.categoryForMovement));
    let score = 0;
    cats.forEach((c) => { score += weights[c] || 0; });
    if (style === "conditioning" && workout.scoreTypes.some((s) => ["amrap", "for-time", "emom"].includes(s))) score += 1.5;
    if (style === "strength" && workout.scoreTypes.some((s) => ["for-load", "emom"].includes(s))) score += 1.5;
    return score;
  }

  function scoreCandidate(candidate, selectedSoFar, prefs) {
    let score = styleScore(candidate, prefs.style) + Math.random() * 0.6; // jitter for variety

    const dom = dominantCategory(candidate);
    const domCounts = {};
    selectedSoFar.forEach((s) => { const d = dominantCategory(s); domCounts[d] = (domCounts[d] || 0) + 1; });
    const domWeight = prefs.style === "balanced" ? 2.2 : prefs.style === "random" ? 0 : 0.8;
    score -= (domCounts[dom] || 0) * domWeight;

    if (prefs.avoidRepeatMovements) {
      const used = new Set();
      selectedSoFar.forEach((s) => s.movements.forEach((m) => used.add(m)));
      const overlap = candidate.movements.filter((m) => used.has(m)).length;
      score -= overlap * 1.2;
    }
    if (prefs.avoidRepeatEquipment) {
      const used = new Set();
      selectedSoFar.forEach((s) => s.equipment.forEach((e) => used.add(e)));
      const overlap = candidate.equipment.filter((e) => used.has(e)).length;
      score -= overlap * 0.7;
    }
    return score;
  }

  function pickForSlot(pool, selectedSoFar, prefs, excludeIds) {
    const candidates = pool.filter((w) => !excludeIds.has(w.id));
    if (!candidates.length) return null;
    const scored = candidates.map((w) => ({ w, score: scoreCandidate(w, selectedSoFar, prefs) }));
    scored.sort((a, b) => b.score - a.score);
    const topN = scored.slice(0, Math.min(4, scored.length));
    return topN[Math.floor(Math.random() * topN.length)].w;
  }

  /**
   * dates: array of 5 weekday date strings.
   * prefs: { durationPref, equipmentPref, style, avoidRepeatMovements, avoidRepeatEquipment }
   * returns { proposal: [{date, workoutId}], relaxed: 'equipment'|'duration'|null, poolSize }
   */
  function buildWeek(dates, prefs) {
    let pool = buildPool(prefs);
    let relaxed = null;

    if (pool.length < dates.length) {
      pool = buildPool(Object.assign({}, prefs, { equipmentPref: "any" }));
      relaxed = "equipment";
    }
    if (pool.length < dates.length) {
      pool = buildPool(Object.assign({}, prefs, { equipmentPref: "any", durationPref: "any" }));
      relaxed = "duration";
    }
    if (pool.length < dates.length) pool = Data.getAllWorkouts();

    const selected = [];
    const excludeIds = new Set();
    dates.forEach((date) => {
      const pick = pickForSlot(pool, selected, prefs, excludeIds);
      if (pick) { selected.push(pick); excludeIds.add(pick.id); }
    });

    return {
      proposal: dates.map((d, i) => ({ date: d, workoutId: selected[i] ? selected[i].id : null })),
      relaxed,
      poolSize: pool.length,
    };
  }

  /** Replace a single slot in an existing proposal, keeping the rest fixed. */
  function replaceSlot(targetDate, currentProposal, prefs) {
    const excludeIds = new Set(currentProposal.map((p) => p.workoutId).filter(Boolean));
    const selectedOthers = currentProposal
      .filter((p) => p.date !== targetDate && p.workoutId)
      .map((p) => Data.getWorkoutById(p.workoutId))
      .filter(Boolean);

    let pool = buildPool(prefs).filter((w) => !excludeIds.has(w.id));
    if (!pool.length) pool = Data.getAllWorkouts().filter((w) => !excludeIds.has(w.id));

    return pickForSlot(pool, selectedOthers, prefs, new Set());
  }

  window.App = window.App || {};
  window.App.Builder = { buildWeek, replaceSlot };
})();
