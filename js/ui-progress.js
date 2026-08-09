/* =========================================================================
   ui-progress.js — the PROGRESS screen: this week's completion, all-time
   totals, streaks, and a clickable weekly history.
   Exposed on window.App.Progress
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Planner = window.App.Planner;

  const ACTIVITY_META = {
    yoga: { icon: "&#127749;", label: "Yoga" },
    meditation: { icon: "&#129497;", label: "Meditation" },
    strength: { icon: "&#128170;", label: "Strength" },
    wod: { icon: "&#128293;", label: "WOD" },
  };

  function pctBarHTML(done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return `<div class="pw-bar"><div class="pw-bar-fill" style="width:${pct}%;"></div></div>`;
  }

  function thisWeekCardHTML() {
    const monday = Utils.formatDateLocal(Utils.getDefaultPlanningMonday());
    const progress = Planner.getWeekProgress(monday);
    const rows = Object.keys(ACTIVITY_META).map((key) => {
      const a = progress.perActivity[key];
      const m = ACTIVITY_META[key];
      return `
        <div class="pw-row">
          <span class="pw-icon">${m.icon}</span>
          <span class="pw-name">${m.label}</span>
          ${pctBarHTML(a.done, a.total)}
          <span class="pw-frac">${a.done}/${a.total}</span>
        </div>
      `;
    }).join("");

    return `
      <h2>This Week</h2>
      <div class="pw-rows">${rows}</div>
      <div style="margin-top:16px; padding-top:14px; border-top:1px dashed var(--border); display:flex; align-items:center; justify-content:space-between;">
        <span style="font-weight:800; font-size:.85rem;">Overall</span>
        <span style="font-family:var(--font-mono); font-weight:800; font-size:1.1rem; color:var(--accent-mint);">${progress.done} / ${progress.total} \u2014 ${progress.pct}%</span>
      </div>
    `;
  }

  function totalsCardHTML() {
    const totals = Planner.getTotals();
    return `
      <h2>Totals</h2>
      <div class="totals-grid">
        <div class="totals-item"><div class="totals-num">${totals.wod}</div><div class="totals-lbl">WODs</div></div>
        <div class="totals-item"><div class="totals-num">${totals.strength}</div><div class="totals-lbl">Strength</div></div>
        <div class="totals-item"><div class="totals-num">${totals.yoga}</div><div class="totals-lbl">Yoga</div></div>
        <div class="totals-item"><div class="totals-num">${totals.meditation}</div><div class="totals-lbl">Meditation</div></div>
      </div>
    `;
  }

  function streaksCardHTML() {
    const s = Planner.getStreaks();
    const item = (num, label) => `
      <div class="streak-item">
        <span class="streak-flame">&#128293;</span>
        <div><div class="streak-num">${num}</div><div class="streak-lbl">${label}</div></div>
      </div>
    `;
    return `
      <h2>Streaks</h2>
      <div class="streaks-grid">
        ${item(s.training, "Training streak")}
        ${item(s.wod, "WOD streak")}
        ${item(s.yoga, "Yoga streak")}
        ${item(s.meditation, "Meditation streak")}
      </div>
    `;
  }

  function historyHTML() {
    const weeks = Planner.getAllWeeksSorted();
    if (!weeks.length) {
      return `<div class="empty-state"><div class="es-icon">&#128197;</div><p class="es-title">No history yet</p><p>Plan your first week to start building a history.</p></div>`;
    }
    const items = weeks.map((week) => {
      const progress = Planner.getWeekProgress(week.startDate);
      const p = progress.perActivity;
      return `
        <div class="history-item" data-action="view-history-week" data-monday="${week.startDate}">
          <div>
            <div class="history-week-label">Week of ${Utils.escapeHtml(Utils.formatWeekRange(week.startDate))}</div>
            <div class="history-breakdown">WOD ${p.wod.done}/${p.wod.total} &middot; Strength ${p.strength.done}/${p.strength.total} &middot; Yoga ${p.yoga.done}/${p.yoga.total} &middot; Meditation ${p.meditation.done}/${p.meditation.total}</div>
          </div>
          <div class="history-pct">${progress.pct}%</div>
        </div>
      `;
    }).join("");
    return `<div class="history-list">${items}</div>`;
  }

  function render() {
    const screen = document.getElementById("screen-progress");
    if (!screen.classList.contains("active")) return;
    const container = document.getElementById("progress-content");
    container.innerHTML = `
      <div class="progress-card">${thisWeekCardHTML()}</div>
      <div class="progress-card">${totalsCardHTML()}</div>
      <div class="progress-card">${streaksCardHTML()}</div>
      <div class="section-label" style="margin-top:0;">History</div>
      ${historyHTML()}
    `;
  }

  function handleViewHistoryWeek(mondayStr) {
    window.App.UI.goToScreen("plan");
    window.App.Plan.goToWeek(mondayStr);
  }

  window.App = window.App || {};
  window.App.Progress = { render, handleViewHistoryWeek };
})();
