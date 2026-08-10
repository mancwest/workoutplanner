/* =========================================================================
   ui-plan.js — the PLAN screen: week navigation, weekly balance card,
   Build My Week entry point, and the five day cards.
   Exposed on window.App.Plan
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Storage = window.App.Storage;
  const Data = window.App.Data;
  const Planner = window.App.Planner;
  const Modals = window.App.Modals;

  let currentMonday = Utils.formatDateLocal(Utils.getDefaultPlanningMonday());

  function chalkRingSVG(done, total, size, strokeWidth) {
    size = size || 40; strokeWidth = strokeWidth || 4;
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const pct = total > 0 ? done / total : 0;
    const offset = c * (1 - pct);
    return `
      <span class="chalk-ring" style="width:${size}px;height:${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle class="cr-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${strokeWidth}"></circle>
          <circle class="cr-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${strokeWidth}"
            stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
        </svg>
        <span class="cr-label" style="font-size:${size * 0.32}px;">${done}/${total}</span>
      </span>
    `;
  }

  function weeklyBalanceHTML(mondayStr) {
    const b = Planner.getWeeklyBalance(mondayStr);
    const wodTimeLabel = b.wodMinutes > 0
      ? Utils.formatMinutes(b.wodMinutes) + (b.wodUnknownCount ? ` +${b.wodUnknownCount} unknown` : "")
      : (b.wodUnknownCount ? "Unknown" : "\u2014");
    const morningStatsHTML = b.morningBreakdown.map((m) => `
      <div class="wb-stat"><div class="wb-num">${m.count}</div><div class="wb-lbl">${Utils.escapeHtml(m.name)}</div></div>
    `).join("");
    return `
      <div class="wb-title">Weekly Balance</div>
      <div class="wb-grid">
        <div class="wb-stat"><div class="wb-num">${b.wodCount}</div><div class="wb-lbl">WODs</div></div>
        <div class="wb-stat"><div class="wb-num">${b.strengthCount}</div><div class="wb-lbl">Strength</div></div>
        ${morningStatsHTML}
      </div>
      <div class="wb-times">
        <span>WOD time: <b>${Utils.escapeHtml(wodTimeLabel)}</b></span>
        <span>Strength: <b>${Utils.escapeHtml(Utils.formatMinutes(b.strengthMinutes))}</b></span>
        <span>Total: <b>${Utils.escapeHtml(Utils.formatMinutes(b.totalMinutes))}</b></span>
      </div>
    `;
  }

  function activityRowHTML(opts) {
    // opts: {dateStr, activity, checked, badgeClass, badgeLabel, name, meta, actions}
    return `
      <div class="activity-row">
        <button type="button" class="activity-check ${opts.checked ? "checked" : ""}" data-action="toggle-complete" data-date="${opts.dateStr}" data-activity="${opts.activity}" aria-label="Mark ${opts.activity} complete">${opts.checked ? "&#10003;" : ""}</button>
        <div class="activity-info">
          <div class="ai-name ${opts.empty ? "empty" : ""}">${opts.name}</div>
          ${opts.meta ? `<div class="ai-meta">${opts.meta}</div>` : ""}
        </div>
        <div class="activity-actions">${opts.actions || ""}</div>
      </div>
    `;
  }

  function dayCardHTML(mondayStr, dateStr, index) {
    const settings = Storage.getSettings();
    const progress = Planner.getDayProgress(mondayStr, dateStr);
    const completion = progress.completion;
    const day = progress.day;
    const isToday = dateStr === Utils.todayLocalStr();

    // Morning routine — a dynamic, user-configurable list of items
    // (Settings → Morning Routine), not fixed to yoga/meditation.
    const morningRowsHTML = settings.morningRoutine.map((item) => activityRowHTML({
      dateStr, activity: item.id, checked: !!(completion.morning && completion.morning[item.id]),
      name: `<span class="wod-badge badge-morning">${Utils.escapeHtml(item.name)}</span> ${item.minutes} min`,
    })).join("");

    // Strength
    let strengthRow;
    if (day.strength) {
      const s = day.strength;
      strengthRow = activityRowHTML({
        dateStr, activity: "strength", checked: completion.strength,
        name: `<span class="wod-badge badge-strength">${Utils.escapeHtml(s.muscleGroup)}</span> ${Utils.formatMinutes(s.duration)}`,
        meta: (s.exercises || []).map((e) => e.name).filter(Boolean).join(", ") || "No exercises listed",
        actions: `
          <button type="button" class="pill-btn" data-action="edit-strength" data-monday="${mondayStr}" data-date="${dateStr}">Edit</button>
          <button type="button" class="pill-btn" data-action="remove-strength" data-monday="${mondayStr}" data-date="${dateStr}">Remove</button>
        `,
      });
    } else {
      strengthRow = activityRowHTML({
        dateStr, activity: "strength", checked: false, empty: true,
        name: "No strength session planned",
        actions: `<button type="button" class="pill-btn pill-primary" data-action="edit-strength" data-monday="${mondayStr}" data-date="${dateStr}">+ Add</button>`,
      });
    }

    // WOD
    let wodRow;
    if (day.wodId) {
      const w = Data.getWorkoutById(day.wodId);
      if (w) {
        wodRow = activityRowHTML({
          dateStr, activity: "wod", checked: completion.wod,
          name: `<span class="wod-badge badge-wod">${Utils.escapeHtml((w.scoreTypes[0] && Utils.titleCaseSlug(w.scoreTypes[0])) || "WOD")}</span> ${Utils.escapeHtml(w.title)}`,
          meta: `${Utils.escapeHtml(Utils.formatDurationFromSeconds(w.time))} &middot; ${Utils.escapeHtml(w.equipment.map(Utils.titleCaseSlug).join(", ") || "No equipment")}`,
          actions: `
            <button type="button" class="pill-btn" data-action="view-workout" data-workout-id="${w.id}" data-monday="${mondayStr}">View</button>
            <button type="button" class="pill-btn" data-action="swap-wod" data-monday="${mondayStr}" data-date="${dateStr}">Swap</button>
            <button type="button" class="pill-btn" data-action="remove-wod" data-monday="${mondayStr}" data-date="${dateStr}">Remove</button>
          `,
        });
      } else {
        wodRow = activityRowHTML({ dateStr, activity: "wod", checked: false, empty: true, name: "Workout unavailable" });
      }
    } else {
      wodRow = activityRowHTML({
        dateStr, activity: "wod", checked: false, empty: true,
        name: "No WOD planned",
        actions: `<button type="button" class="pill-btn pill-primary" data-action="browse-for-day" data-monday="${mondayStr}" data-date="${dateStr}">+ Add</button>`,
      });
    }

    return `
      <div class="day-card" data-date="${dateStr}">
        <div class="day-card-header ${isToday ? "is-today" : ""}">
          <div class="day-name-wrap">
            ${isToday ? '<span class="today-dot"></span>' : ""}
            <div>
              <div class="day-name">${Utils.weekdayLabel(index)}</div>
              <div class="day-date">${Utils.escapeHtml(Utils.formatShortDate(dateStr))}</div>
            </div>
          </div>
          ${chalkRingSVG(progress.done, progress.total, 38, 4)}
        </div>
        <div class="day-card-body">
          <div class="activity-group">
            <div class="activity-group-title">&#127749; Morning Routine</div>
            ${morningRowsHTML || '<div class="ai-name empty" style="padding:6px 2px;">No morning routine items \u2014 add some in Settings</div>'}
          </div>
          <div class="activity-group">
            <div class="activity-group-title">&#128170; Strength</div>
            ${strengthRow}
          </div>
          <div class="activity-group">
            <div class="activity-group-title">&#128293; WOD</div>
            ${wodRow}
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const screen = document.getElementById("screen-plan");
    if (!screen.classList.contains("active")) return;

    document.getElementById("week-range").textContent = Utils.formatWeekRange(currentMonday);
    document.getElementById("weekly-balance").innerHTML = weeklyBalanceHTML(currentMonday);

    const dates = Utils.getWeekDateStrings(currentMonday);
    const cardsHTML = dates.map((d, i) => dayCardHTML(currentMonday, d, i)).join("");
    document.getElementById("day-cards").innerHTML = cardsHTML;

    const thisWeekBtn = document.querySelector('[data-action="this-week"]');
    if (thisWeekBtn) thisWeekBtn.classList.toggle("active", currentMonday === Utils.formatDateLocal(Utils.getDefaultPlanningMonday()));
  }

  function goPrevWeek() { currentMonday = Utils.formatDateLocal(Utils.addDays(Utils.parseDateLocal(currentMonday), -7)); render(); }
  function goNextWeek() { currentMonday = Utils.formatDateLocal(Utils.addDays(Utils.parseDateLocal(currentMonday), 7)); render(); }
  function goThisWeek() { currentMonday = Utils.formatDateLocal(Utils.getDefaultPlanningMonday()); render(); }
  function goToWeek(mondayStr) { currentMonday = mondayStr; render(); }
  function getCurrentMonday() { return currentMonday; }

  function handleToggleComplete(dateStr, activity) {
    Planner.toggleCompletion(dateStr, activity);
    render();
  }

  function handleRemoveWod(mondayStr, dateStr) {
    Planner.removeWodFromDay(mondayStr, dateStr);
    window.App.UI.showToast("WOD removed");
    render();
  }

  function handleRemoveStrength(mondayStr, dateStr) {
    Modals.openConfirm({
      title: "Remove strength session?",
      message: "This will remove today's planned strength training. This can't be undone.",
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => {
        Planner.removeStrengthFromDay(mondayStr, dateStr);
        window.App.UI.showToast("Strength session removed");
        render();
      },
    });
  }

  window.App = window.App || {};
  window.App.Plan = {
    render, goPrevWeek, goNextWeek, goThisWeek, goToWeek, getCurrentMonday,
    handleToggleComplete, handleRemoveWod, handleRemoveStrength,
  };
})();
