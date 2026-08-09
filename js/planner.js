/* =========================================================================
   planner.js — weekly plan CRUD, completion bookkeeping, weekly balance,
   history, streak calculation. Sits on top of Storage + Data.
   Exposed on window.App.Planner
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Storage = window.App.Storage;
  const Data = window.App.Data;

  function emptyDay() {
    return { strength: null, wodId: null };
  }

  /**
   * Returns the week object for `mondayStr`, creating (and persisting) a
   * scaffold with 5 empty weekday entries if it doesn't exist yet.
   * NEVER overwrites a week that already has data — existing weeks are
   * always returned as-is so historical / already-planned weeks survive.
   */
  function getOrCreateWeek(mondayStr) {
    let week = Storage.getWeek(mondayStr);
    if (week) {
      // defensive: make sure all 5 days exist even if this was an older/partial record
      const dates = Utils.getWeekDateStrings(mondayStr);
      let changed = false;
      dates.forEach((d) => {
        if (!week.days[d]) { week.days[d] = emptyDay(); changed = true; }
      });
      if (changed) Storage.saveWeek(week);
      return week;
    }
    const dates = Utils.getWeekDateStrings(mondayStr);
    const days = {};
    dates.forEach((d) => { days[d] = emptyDay(); });
    week = { startDate: mondayStr, days };
    Storage.saveWeek(week);
    return week;
  }

  function getDayPlan(mondayStr, dateStr) {
    const week = getOrCreateWeek(mondayStr);
    return week.days[dateStr] || emptyDay();
  }

  /** Add a WOD to a day. Returns {ok, conflict, existingWorkout}. */
  function addWodToDay(mondayStr, dateStr, workoutId, opts) {
    opts = opts || {};
    const week = getOrCreateWeek(mondayStr);
    const day = week.days[dateStr] || emptyDay();

    if (day.wodId && day.wodId !== String(workoutId) && !opts.replace) {
      return { ok: false, conflict: true, existingWorkout: Data.getWorkoutById(day.wodId) };
    }

    day.wodId = String(workoutId);
    week.days[dateStr] = day;
    Storage.saveWeek(week);

    // A freshly (re)assigned WOD reverts to not-completed unless it's the same workout.
    const wasSame = day.wodId === String(workoutId);
    if (!wasSame) Storage.setDayCompletion(dateStr, "wod", false);

    return { ok: true, conflict: false };
  }

  function removeWodFromDay(mondayStr, dateStr) {
    const week = getOrCreateWeek(mondayStr);
    const day = week.days[dateStr] || emptyDay();
    day.wodId = null;
    week.days[dateStr] = day;
    Storage.saveWeek(week);
    Storage.setDayCompletion(dateStr, "wod", false);
  }

  function setStrengthForDay(mondayStr, dateStr, strengthObj) {
    const week = getOrCreateWeek(mondayStr);
    const day = week.days[dateStr] || emptyDay();
    day.strength = strengthObj;
    week.days[dateStr] = day;
    Storage.saveWeek(week);
  }

  function removeStrengthFromDay(mondayStr, dateStr) {
    const week = getOrCreateWeek(mondayStr);
    const day = week.days[dateStr] || emptyDay();
    day.strength = null;
    week.days[dateStr] = day;
    Storage.saveWeek(week);
    Storage.setDayCompletion(dateStr, "strength", false);
  }

  function toggleCompletion(dateStr, activity) {
    const current = Storage.getDayCompletion(dateStr);
    Storage.setDayCompletion(dateStr, activity, !current[activity]);
    return !current[activity];
  }

  /**
   * Completion summary for one date. "total" only counts components that
   * are actually applicable that day: yoga & meditation are always
   * applicable (auto-created every weekday); strength/WOD only count once
   * something has actually been planned for that slot.
   */
  function getDayProgress(mondayStr, dateStr) {
    const day = getDayPlan(mondayStr, dateStr);
    const completion = Storage.getDayCompletion(dateStr);
    const items = [
      { key: "yoga", applicable: true, done: !!completion.yoga },
      { key: "meditation", applicable: true, done: !!completion.meditation },
      { key: "strength", applicable: !!day.strength, done: !!completion.strength },
      { key: "wod", applicable: !!day.wodId, done: !!completion.wod },
    ];
    const applicable = items.filter((i) => i.applicable);
    const done = applicable.filter((i) => i.done).length;
    return { done, total: applicable.length, items, day, completion };
  }

  function getWeekProgress(mondayStr) {
    const dates = Utils.getWeekDateStrings(mondayStr);
    const perActivity = {
      yoga: { done: 0, total: 0 },
      meditation: { done: 0, total: 0 },
      strength: { done: 0, total: 0 },
      wod: { done: 0, total: 0 },
    };
    let done = 0, total = 0;
    dates.forEach((d) => {
      const p = getDayProgress(mondayStr, d);
      done += p.done; total += p.total;
      p.items.forEach((i) => {
        if (!i.applicable) return;
        perActivity[i.key].total += 1;
        if (i.done) perActivity[i.key].done += 1;
      });
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, perActivity, dates };
  }

  /** Weekly balance card: counts + estimated time totals. */
  function getWeeklyBalance(mondayStr) {
    const week = getOrCreateWeek(mondayStr);
    const settings = Storage.getSettings();
    const dates = Utils.getWeekDateStrings(mondayStr);

    let wodCount = 0, strengthCount = 0, wodSeconds = 0, wodUnknownCount = 0, strengthMinutes = 0;
    const movementCatCounts = {};

    dates.forEach((d) => {
      const day = week.days[d];
      if (day.wodId) {
        wodCount++;
        const w = Data.getWorkoutById(day.wodId);
        if (w) {
          const secs = Data.getDurationSeconds(w);
          if (secs) wodSeconds += secs; else wodUnknownCount++;
          w.movements.forEach((m) => {
            const cat = Data.categoryForMovement(m);
            movementCatCounts[cat] = (movementCatCounts[cat] || 0) + 1;
          });
        }
      }
      if (day.strength) {
        strengthCount++;
        strengthMinutes += Number(day.strength.duration) || 0;
      }
    });

    const yogaCount = 5, meditationCount = 5; // auto-created every weekday
    const yogaMinutes = yogaCount * settings.morningRoutine.yogaMin;
    const meditationMinutes = meditationCount * settings.morningRoutine.meditationMin;
    const wodMinutes = Math.round(wodSeconds / 60);
    const totalMinutes = wodMinutes + strengthMinutes + yogaMinutes + meditationMinutes;

    return {
      wodCount, strengthCount, yogaCount, meditationCount,
      wodMinutes, wodUnknownCount, strengthMinutes, yogaMinutes, meditationMinutes, totalMinutes,
      movementCatCounts,
    };
  }

  /** All weeks that have ever been created/visited, most recent first. */
  function getAllWeeksSorted() {
    const weeks = Storage.getAllWeeks();
    return Object.keys(weeks).sort().reverse().map((k) => weeks[k]);
  }

  /**
   * A weekday counts as a "training day" if it had at least one applicable
   * planned component, and every applicable component was completed.
   * Streaks walk backward from today (skipping Sat/Sun, since the planner
   * is Mon–Fri only) and stop at the first day that isn't fully complete
   * or has no data yet.
   */
  function isQualifyingDay(dateStr, activityFilter) {
    const monday = Utils.formatDateLocal(Utils.getMonday(Utils.parseDateLocal(dateStr)));
    const p = getDayProgress(monday, dateStr);
    if (activityFilter) {
      const item = p.items.find((i) => i.key === activityFilter);
      return !!(item && item.applicable && item.done);
    }
    return p.total > 0 && p.done === p.total;
  }

  function computeStreak(activityFilter) {
    let streak = 0;
    let cursor = Utils.todayLocal();
    // If today is a weekday but not yet complete, start counting from yesterday
    // instead of breaking the streak outright (the day isn't "missed" until it's over).
    const todayStr = Utils.formatDateLocal(cursor);
    const todayDow = cursor.getDay();
    const todayIsWeekday = todayDow >= 1 && todayDow <= 5;
    if (todayIsWeekday && !isQualifyingDay(todayStr, activityFilter)) {
      cursor = Utils.addDays(cursor, -1);
    }
    // eslint-disable-next-line no-constant-condition
    for (let guard = 0; guard < 3650; guard++) {
      const dow = cursor.getDay();
      if (dow === 0 || dow === 6) { cursor = Utils.addDays(cursor, -1); continue; } // skip weekends
      const dateStr = Utils.formatDateLocal(cursor);
      if (isQualifyingDay(dateStr, activityFilter)) {
        streak++;
        cursor = Utils.addDays(cursor, -1);
      } else {
        break;
      }
    }
    return streak;
  }

  function getStreaks() {
    return {
      training: computeStreak(null),
      yoga: computeStreak("yoga"),
      meditation: computeStreak("meditation"),
      wod: computeStreak("wod"),
    };
  }

  /** All-time totals across every date that has completion data. */
  function getTotals() {
    const completion = Storage.getAllCompletion();
    const totals = { wod: 0, strength: 0, yoga: 0, meditation: 0 };
    Object.keys(completion).forEach((dateStr) => {
      const c = completion[dateStr];
      if (c.wod) totals.wod++;
      if (c.strength) totals.strength++;
      if (c.yoga) totals.yoga++;
      if (c.meditation) totals.meditation++;
    });
    return totals;
  }

  window.App = window.App || {};
  window.App.Planner = {
    getOrCreateWeek,
    getDayPlan,
    addWodToDay,
    removeWodFromDay,
    setStrengthForDay,
    removeStrengthFromDay,
    toggleCompletion,
    getDayProgress,
    getWeekProgress,
    getWeeklyBalance,
    getAllWeeksSorted,
    getStreaks,
    getTotals,
  };
})();
