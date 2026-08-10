/* =========================================================================
   ui-modals.js — the generic modal shell plus every modal's content:
   workout detail, add-to-day / swap pickers, strength editor, the
   Build My Week wizard, the library filter panel, and confirm dialogs.
   Exposed on window.App.Modals
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Storage = window.App.Storage;
  const Data = window.App.Data;
  const Planner = window.App.Planner;
  const Builder = window.App.Builder;

  const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const overlay = document.getElementById("modal-overlay");
  const contentEl = document.getElementById("modal-content");

  let pendingConfirm = null;      // { onConfirm: fn }
  let strengthDraft = null;       // in-progress strength editor state
  let buildWeekState = null;      // in-progress build-my-week wizard state

  /* ------------------------------- Shell ---------------------------------- */
  function openModal(html) {
    contentEl.innerHTML = html;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    contentEl.scrollTop = 0;
    const box = document.getElementById("modal-box");
    if (box) box.scrollTop = 0;
  }

  function closeModal() {
    overlay.hidden = true;
    contentEl.innerHTML = "";
    document.body.style.overflow = "";
    pendingConfirm = null;
    strengthDraft = null;
    buildWeekState = null;
  }

  function isOpen() { return !overlay.hidden; }

  /* ------------------------------ Confirm dialog --------------------------- */
  function openConfirm(opts) {
    // opts: {title, message, confirmLabel, danger, onConfirm}
    pendingConfirm = { onConfirm: opts.onConfirm };
    const dangerClass = opts.danger ? "btn-danger" : "btn-primary";
    openModal(`
      <h2 class="modal-title">${Utils.escapeHtml(opts.title || "Are you sure?")}</h2>
      <p class="confirm-text">${Utils.escapeHtml(opts.message || "")}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
        <button type="button" class="btn ${dangerClass}" data-action="confirm-yes">${Utils.escapeHtml(opts.confirmLabel || "Confirm")}</button>
      </div>
    `);
  }

  function handleConfirmYes() {
    const cb = pendingConfirm && pendingConfirm.onConfirm;
    closeModal();
    if (cb) cb();
  }

  /* ---------------------------- Workout detail ----------------------------- */
  function typeBadges(workout) {
    const badges = [];
    workout.scoreTypes.forEach((s) => badges.push(`<span class="tag">${Utils.escapeHtml(Utils.titleCaseSlug(s))}</span>`));
    return badges.join("");
  }

  function dayPickButtonsHTML(workoutId, mondayStr, excludeDate) {
    const dates = Utils.getWeekDateStrings(mondayStr);
    return `<div class="day-pick-grid">${dates.map((d, i) => {
      const day = Planner.getDayPlan(mondayStr, d);
      const hasWod = !!day.wodId;
      const excluded = excludeDate && d === excludeDate;
      return `<button type="button" class="day-pick-btn ${hasWod ? "has-wod" : ""} ${excluded ? "excluded" : ""}"
                data-action="add-to-day" data-workout-id="${Utils.escapeHtml(workoutId)}" data-monday="${mondayStr}" data-date="${d}">
                ${DAY_SHORT[i]}<span class="dp-sub">${hasWod ? "planned" : "open"}</span>
              </button>`;
    }).join("")}</div>`;
  }

  function openWorkoutDetail(workoutId, mondayStr) {
    const w = Data.getWorkoutById(workoutId);
    if (!w) { openModal(`<p class="confirm-text">This workout couldn't be found.</p>`); return; }
    Storage.addRecent(w.id);
    const fav = Storage.isFavorite(w.id);
    const durationLabel = Utils.formatDurationFromSeconds(w.time);
    const equipmentTags = w.equipment.length
      ? w.equipment.map((e) => `<span class="tag">${Utils.escapeHtml(Utils.titleCaseSlug(e))}</span>`).join("")
      : `<span class="tag">No equipment</span>`;
    const movementTags = w.movements.map((m) => `<span class="tag">${Utils.escapeHtml(Utils.titleCaseSlug(m))}</span>`).join("");

    openModal(`
      <div class="wc-top" style="margin-bottom:4px;">
        <div>
          <h2 class="modal-title" style="margin-bottom:2px;">${Utils.escapeHtml(w.title)}</h2>
          ${w.subtitle ? `<p class="wc-subtitle">${Utils.escapeHtml(w.subtitle)}</p>` : ""}
        </div>
        <button type="button" class="fav-btn" data-action="toggle-favorite" data-workout-id="${w.id}" aria-label="Toggle favorite">${fav ? "&#9829;" : "&#9825;"}</button>
      </div>
      <div class="detail-tags">${typeBadges(w)}${equipmentTags}</div>

      <div class="detail-meta-grid">
        <div class="dmg-item"><div class="dmg-val">${Utils.escapeHtml(durationLabel)}</div><div class="dmg-lbl">Duration</div></div>
        <div class="dmg-item"><div class="dmg-val">${w.equipment.length}</div><div class="dmg-lbl">Equipment</div></div>
        <div class="dmg-item"><div class="dmg-val">${w.movements.length}</div><div class="dmg-lbl">Movements</div></div>
      </div>

      ${movementTags ? `<div class="detail-section"><h3>Movements</h3><div class="detail-tags">${movementTags}</div></div>` : ""}

      <div class="detail-section">
        <h3>Workout</h3>
        <div class="prescription-box">${Utils.escapeMultiline(w.workout) || "<em>No prescription text available.</em>"}</div>
      </div>

      ${w.description ? `<div class="detail-section"><h3>About</h3><p>${Utils.escapeMultiline(w.description)}</p></div>` : ""}
      ${w.notes ? `<div class="detail-section"><h3>Scaling &amp; Notes</h3><p>${Utils.escapeMultiline(w.notes)}</p></div>` : ""}
      ${w.coachNotes ? `<div class="detail-section"><h3>Coach Tips</h3><p>${Utils.escapeMultiline(w.coachNotes)}</p></div>` : ""}

      <div class="detail-section">
        <h3>Add to Week</h3>
        ${dayPickButtonsHTML(w.id, mondayStr)}
      </div>

      ${w.url ? `<div class="external-link-row"><a class="external-link" href="${Utils.escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer">Open on WODWell &#8599;</a></div>` : ""}
    `);
  }

  /** Add-to-day click from anywhere (detail modal or a quick-add button). */
  function handleAddToDay(workoutId, mondayStr, dateStr) {
    const result = Planner.addWodToDay(mondayStr, dateStr, workoutId, { replace: false });
    if (result.ok) {
      closeModal();
      window.App.UI.showToast(`Added to ${Utils.weekdayLabel(Utils.getWeekDateStrings(mondayStr).indexOf(dateStr)).slice(0, 1) + Utils.weekdayLabel(Utils.getWeekDateStrings(mondayStr).indexOf(dateStr)).slice(1).toLowerCase()}`);
      window.App.UI.refreshCurrentScreen();
      return;
    }
    if (result.conflict) {
      const existingTitle = result.existingWorkout ? result.existingWorkout.title : "a workout";
      openConfirm({
        title: "Replace existing WOD?",
        message: `${Utils.escapeHtml(existingTitle)} is already planned for that day. Replace it with this workout?`,
        confirmLabel: "Replace",
        danger: false,
        onConfirm: () => {
          Planner.addWodToDay(mondayStr, dateStr, workoutId, { replace: true });
          window.App.UI.showToast("Workout replaced");
          window.App.UI.refreshCurrentScreen();
        },
      });
    }
  }

  /* -------------------------------- Swap picker ----------------------------- */
  function swapPickerState() {
    return { query: "", onlyMine: false, durationBucket: "any" };
  }
  let swapState = swapPickerState();

  function renderSwapList(mondayStr, dateStr) {
    const settings = Storage.getSettings();
    const filters = {
      query: swapState.query,
      durationBucket: swapState.durationBucket,
      onlyMyEquipment: swapState.onlyMine,
      myEquipment: settings.equipment,
      excludeId: Planner.getDayPlan(mondayStr, dateStr).wodId,
    };
    const results = Data.filterWorkouts(filters).slice(0, 40);
    if (!results.length) {
      return `<div class="empty-state"><div class="es-icon">&#128269;</div><p class="es-title">No matches</p><p>Try loosening your filters.</p></div>`;
    }
    return results.map((w) => `
      <div class="saved-strength-item" data-action="swap-select" data-monday="${mondayStr}" data-date="${dateStr}" data-workout-id="${w.id}">
        <div class="ssi-name">${Utils.escapeHtml(w.title)}</div>
        <div class="ssi-meta">${Utils.escapeHtml(Utils.formatDurationFromSeconds(w.time))} &middot; ${Utils.escapeHtml((w.scoreTypes[0] && Utils.titleCaseSlug(w.scoreTypes[0])) || "\u2014")}</div>
      </div>
    `).join("");
  }

  function openSwapPicker(mondayStr, dateStr) {
    swapState = swapPickerState();
    const hasExisting = !!Planner.getDayPlan(mondayStr, dateStr).wodId;
    openModal(`
      <h2 class="modal-title">${hasExisting ? "Swap Workout" : "Add a Workout"}</h2>
      <input type="search" id="swap-search" placeholder="Search workouts&hellip;" style="margin-bottom:10px;">
      <div class="filter-options" style="margin-bottom:14px;">
        <button type="button" class="filter-opt" data-action="swap-toggle-mine">Only workouts I can do</button>
        <button type="button" class="filter-opt" data-action="swap-duration" data-value="under10">Under 10</button>
        <button type="button" class="filter-opt" data-action="swap-duration" data-value="10-20">10&ndash;20</button>
        <button type="button" class="filter-opt" data-action="swap-duration" data-value="20-30">20&ndash;30</button>
        <button type="button" class="filter-opt" data-action="swap-duration" data-value="any">Any length</button>
      </div>
      <div id="swap-results">${renderSwapList(mondayStr, dateStr)}</div>
    `);
    const box = document.getElementById("modal-box");
    box.dataset.monday = mondayStr;
    box.dataset.date = dateStr;
    const input = document.getElementById("swap-search");
    input.addEventListener("input", Utils.debounce((e) => {
      swapState.query = e.target.value;
      document.getElementById("swap-results").innerHTML = renderSwapList(mondayStr, dateStr);
    }, 200));
    syncSwapButtons();
  }

  function syncSwapButtons() {
    document.querySelectorAll('[data-action="swap-toggle-mine"]').forEach((b) => b.classList.toggle("active", swapState.onlyMine));
    document.querySelectorAll('[data-action="swap-duration"]').forEach((b) => b.classList.toggle("active", b.dataset.value === swapState.durationBucket));
  }

  function handleSwapToggleMine(mondayStr, dateStr) {
    swapState.onlyMine = !swapState.onlyMine;
    document.getElementById("swap-results").innerHTML = renderSwapList(mondayStr, dateStr);
    syncSwapButtons();
  }
  function handleSwapDuration(value, mondayStr, dateStr) {
    swapState.durationBucket = value;
    document.getElementById("swap-results").innerHTML = renderSwapList(mondayStr, dateStr);
    syncSwapButtons();
  }
  function handleSwapSelect(mondayStr, dateStr, workoutId) {
    Planner.addWodToDay(mondayStr, dateStr, workoutId, { replace: true });
    closeModal();
    window.App.UI.showToast("Workout swapped");
    window.App.UI.refreshCurrentScreen();
  }

  /* ------------------------------ Strength editor --------------------------- */
  const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Full Body", "Custom"];
  const DURATION_OPTIONS = [15, 20, 30, 40, 45, 60];

  function newExercise() { return { id: Utils.uid("ex"), name: "", sets: "3", reps: "10" }; }

  function freshStrengthDraft(existing) {
    if (existing) {
      return {
        tab: "new",
        id: existing.id || Utils.uid("str"),
        muscleGroup: existing.muscleGroup || "Chest",
        duration: existing.duration || Storage.getSettings().strengthDefaultDuration,
        exercises: (existing.exercises && existing.exercises.length ? existing.exercises : [newExercise()]).map((e) => Object.assign({}, e)),
        notes: existing.notes || "",
        saveAsTemplate: false,
      };
    }
    return {
      tab: "new",
      id: Utils.uid("str"),
      muscleGroup: "Chest",
      duration: Storage.getSettings().strengthDefaultDuration,
      exercises: [newExercise()],
      notes: "",
      saveAsTemplate: false,
    };
  }

  function renderExerciseRows() {
    return strengthDraft.exercises.map((ex, i) => `
      <div class="exercise-row">
        <input type="text" placeholder="Exercise name" value="${Utils.escapeHtml(ex.name)}" data-ex-field="name" data-ex-index="${i}">
        <input type="text" class="ex-sets" placeholder="Sets" value="${Utils.escapeHtml(ex.sets)}" data-ex-field="sets" data-ex-index="${i}">
        <input type="text" class="ex-sets" placeholder="Reps" value="${Utils.escapeHtml(ex.reps)}" data-ex-field="reps" data-ex-index="${i}">
        <button type="button" class="remove-ex-btn" data-action="remove-exercise" data-index="${i}" aria-label="Remove exercise">&#10005;</button>
      </div>
    `).join("");
  }

  function renderStrengthNewTab() {
    return `
      <div class="field-row">
        <label>Muscle Group
          <select id="sf-muscle-group">${MUSCLE_GROUPS.map((g) => `<option value="${g}" ${strengthDraft.muscleGroup === g ? "selected" : ""}>${g}</option>`).join("")}</select>
        </label>
        <label>Duration
          <select id="sf-duration">${DURATION_OPTIONS.map((d) => `<option value="${d}" ${Number(strengthDraft.duration) === d ? "selected" : ""}>${d} min</option>`).join("")}<option value="custom" ${!DURATION_OPTIONS.includes(Number(strengthDraft.duration)) ? "selected" : ""}>Custom&hellip;</option></select>
        </label>
      </div>
      <div id="sf-custom-duration-wrap" ${DURATION_OPTIONS.includes(Number(strengthDraft.duration)) ? "hidden" : ""} style="margin-bottom:16px;">
        <label>Custom duration (min)<input type="number" id="sf-duration-custom" min="1" max="240" value="${Utils.escapeHtml(strengthDraft.duration)}"></label>
      </div>

      <label style="margin-bottom:8px;">Exercises</label>
      <div id="sf-exercise-list">${renderExerciseRows()}</div>
      <button type="button" class="add-ex-btn" data-action="add-exercise">+ Add Exercise</button>

      <label style="margin-top:16px;">Notes<textarea id="sf-notes" placeholder="Free-text notes&hellip;">${Utils.escapeHtml(strengthDraft.notes)}</textarea></label>

      <label class="toggle-row" style="cursor:pointer;">
        <span><span class="tr-label">Save as reusable template</span><span class="tr-sub">Keep this in your saved strength workouts</span></span>
        <span class="switch"><input type="checkbox" id="sf-save-template" ${strengthDraft.saveAsTemplate ? "checked" : ""}><span class="switch-track"></span></span>
      </label>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="save-strength">Save</button>
      </div>
    `;
  }

  function renderStrengthSavedTab() {
    const lib = Storage.getStrengthLibrary();
    if (!lib.length) {
      return `<div class="empty-state"><div class="es-icon">&#128190;</div><p class="es-title">No saved workouts yet</p><p>Create one in the "New" tab and toggle "Save as reusable template".</p></div>`;
    }
    return lib.map((t) => `
      <div class="saved-strength-item" data-action="load-strength-template" data-id="${t.id}">
        <div class="ssi-name">${Utils.escapeHtml(t.name || t.muscleGroup)}</div>
        <div class="ssi-meta">${Utils.escapeHtml(t.muscleGroup)} &middot; ${Utils.escapeHtml(String(t.duration))} min &middot; ${t.exercises.length} exercise${t.exercises.length === 1 ? "" : "s"}</div>
      </div>
    `).join("");
  }

  function renderStrengthEditor(mondayStr, dateStr) {
    return `
      <h2 class="modal-title">Strength Training</h2>
      <div class="tab-row">
        <button type="button" data-action="strength-tab" data-tab="new" class="${strengthDraft.tab === "new" ? "active" : ""}">New / Edit</button>
        <button type="button" data-action="strength-tab" data-tab="saved" class="${strengthDraft.tab === "saved" ? "active" : ""}">Saved</button>
      </div>
      <div id="strength-tab-content">${strengthDraft.tab === "new" ? renderStrengthNewTab() : renderStrengthSavedTab()}</div>
    `;
  }

  function openStrengthEditor(mondayStr, dateStr) {
    const existing = Planner.getDayPlan(mondayStr, dateStr).strength;
    strengthDraft = freshStrengthDraft(existing);
    strengthDraft._mondayStr = mondayStr;
    strengthDraft._dateStr = dateStr;
    openModal(renderStrengthEditor(mondayStr, dateStr));
    wireStrengthNewTab();
  }

  function rerenderStrengthTab() {
    document.getElementById("strength-tab-content").innerHTML =
      strengthDraft.tab === "new" ? renderStrengthNewTab() : renderStrengthSavedTab();
    document.querySelectorAll('[data-action="strength-tab"]').forEach((b) => b.classList.toggle("active", b.dataset.tab === strengthDraft.tab));
    if (strengthDraft.tab === "new") wireStrengthNewTab();
  }

  function wireStrengthNewTab() {
    const mgSel = document.getElementById("sf-muscle-group");
    if (mgSel) mgSel.addEventListener("change", (e) => { strengthDraft.muscleGroup = e.target.value; });
    const durSel = document.getElementById("sf-duration");
    if (durSel) durSel.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        strengthDraft.duration = strengthDraft.duration || 30;
        document.getElementById("sf-custom-duration-wrap").hidden = false;
      } else {
        strengthDraft.duration = Number(e.target.value);
        document.getElementById("sf-custom-duration-wrap").hidden = true;
      }
    });
    const durCustom = document.getElementById("sf-duration-custom");
    if (durCustom) durCustom.addEventListener("input", (e) => { strengthDraft.duration = Number(e.target.value) || 0; });
    const notes = document.getElementById("sf-notes");
    if (notes) notes.addEventListener("input", (e) => { strengthDraft.notes = e.target.value; });
    const saveTpl = document.getElementById("sf-save-template");
    if (saveTpl) saveTpl.addEventListener("change", (e) => { strengthDraft.saveAsTemplate = e.target.checked; });

    document.querySelectorAll('[data-ex-field]').forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.exIndex);
        const field = e.target.dataset.exField;
        if (strengthDraft.exercises[idx]) strengthDraft.exercises[idx][field] = e.target.value;
      });
    });
  }

  function handleAddExercise() {
    strengthDraft.exercises.push(newExercise());
    rerenderStrengthTab();
  }
  function handleRemoveExercise(index) {
    strengthDraft.exercises.splice(index, 1);
    if (!strengthDraft.exercises.length) strengthDraft.exercises.push(newExercise());
    rerenderStrengthTab();
  }
  function handleStrengthTab(tab) {
    strengthDraft.tab = tab;
    rerenderStrengthTab();
  }
  function handleLoadStrengthTemplate(id) {
    const tpl = Storage.getStrengthLibrary().find((t) => t.id === id);
    if (!tpl) return;
    strengthDraft.muscleGroup = tpl.muscleGroup;
    strengthDraft.duration = tpl.duration;
    strengthDraft.exercises = tpl.exercises.map((e) => Object.assign({}, e, { id: Utils.uid("ex") }));
    strengthDraft.notes = tpl.notes || "";
    strengthDraft.tab = "new";
    rerenderStrengthTab();
    window.App.UI.showToast("Template loaded \u2014 review and save");
  }

  function handleSaveStrength() {
    const cleanExercises = strengthDraft.exercises
      .filter((e) => e.name && e.name.trim())
      .map((e) => ({ id: e.id, name: e.name.trim(), sets: (e.sets || "").toString().trim(), reps: (e.reps || "").toString().trim() }));

    const dayEntry = {
      id: strengthDraft.id,
      muscleGroup: strengthDraft.muscleGroup,
      duration: Number(strengthDraft.duration) || 0,
      exercises: cleanExercises,
      notes: strengthDraft.notes || "",
    };

    Planner.setStrengthForDay(strengthDraft._mondayStr, strengthDraft._dateStr, dayEntry);

    if (strengthDraft.saveAsTemplate) {
      Storage.saveStrengthTemplate({
        id: Utils.uid("tpl"),
        name: strengthDraft.muscleGroup,
        muscleGroup: strengthDraft.muscleGroup,
        duration: dayEntry.duration,
        exercises: cleanExercises,
        notes: dayEntry.notes,
      });
    }

    closeModal();
    window.App.UI.showToast("Strength session saved");
    window.App.UI.refreshCurrentScreen();
  }

  /* --------------------------- Build My Week wizard -------------------------- */
  function freshBuildWeekState(mondayStr) {
    return {
      step: "prefs",
      mondayStr,
      prefs: {
        durationPref: "any",
        equipmentPref: "mine",
        style: "balanced",
        avoidRepeatMovements: true,
        avoidRepeatEquipment: false,
      },
      proposal: null,
      relaxed: null,
    };
  }

  function renderBuildWeekPrefs() {
    const p = buildWeekState.prefs;
    const seg = (name, options, current) => options.map((o) =>
      `<button type="button" class="filter-opt ${current === o.value ? "active" : ""}" data-action="bmw-set-pref" data-key="${name}" data-value="${o.value}">${o.label}</button>`
    ).join("");

    return `
      <h2 class="modal-title">&#10024; Build My Week</h2>
      <p class="settings-hint" style="margin-bottom:16px;">Suggests one WOD for each weekday from your local library. Nothing is saved until you accept.</p>

      <div class="filter-section">
        <h3>Preferred Duration</h3>
        <div class="filter-options">${seg("durationPref", [
          { value: "short", label: "Short" }, { value: "medium", label: "Medium" },
          { value: "long", label: "Long" }, { value: "any", label: "Any" },
        ], p.durationPref)}</div>
      </div>

      <div class="filter-section">
        <h3>Equipment</h3>
        <div class="filter-options">${seg("equipmentPref", [
          { value: "mine", label: "My Equipment" }, { value: "any", label: "Any" },
        ], p.equipmentPref)}</div>
      </div>

      <div class="filter-section">
        <h3>Training Style</h3>
        <div class="filter-options">${seg("style", [
          { value: "balanced", label: "Balanced" }, { value: "conditioning", label: "Conditioning Heavy" },
          { value: "strength", label: "Strength Heavy" }, { value: "random", label: "Random" },
        ], p.style)}</div>
      </div>

      <label class="toggle-row" style="cursor:pointer;">
        <span class="tr-label">Avoid repeated movements</span>
        <span class="switch"><input type="checkbox" id="bmw-avoid-movements" ${p.avoidRepeatMovements ? "checked" : ""}><span class="switch-track"></span></span>
      </label>
      <label class="toggle-row" style="cursor:pointer;">
        <span class="tr-label">Avoid repeated equipment</span>
        <span class="switch"><input type="checkbox" id="bmw-avoid-equipment" ${p.avoidRepeatEquipment ? "checked" : ""}><span class="switch-track"></span></span>
      </label>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
        <button type="button" class="btn btn-primary" data-action="bmw-generate">Generate Week</button>
      </div>
    `;
  }

  function proposalRowHTML(item, index) {
    const w = item.workoutId ? Data.getWorkoutById(item.workoutId) : null;
    const existing = Planner.getDayPlan(buildWeekState.mondayStr, item.date);
    const willReplace = existing.wodId && existing.wodId !== item.workoutId;
    return `
      <div class="bmw-day-row">
        <div class="bmw-day-tag">${DAY_SHORT[index]}${willReplace ? ' <span title="Replaces existing WOD">&#9888;</span>' : ""}</div>
        <div class="bmw-day-info">
          <div class="bdi-title">${w ? Utils.escapeHtml(w.title) : "No suitable workout found"}</div>
          <div class="bdi-meta">${w ? Utils.escapeHtml(Utils.formatDurationFromSeconds(w.time)) + " &middot; " + Utils.escapeHtml((w.scoreTypes[0] && Utils.titleCaseSlug(w.scoreTypes[0])) || "") : ""}</div>
        </div>
        <button type="button" class="pill-btn bmw-replace-btn" data-action="bmw-replace" data-date="${item.date}">Replace</button>
      </div>
    `;
  }

  function renderBuildWeekProposal() {
    const relaxedNote = buildWeekState.relaxed === "equipment"
      ? `<p class="settings-hint">Not enough matches with your equipment &amp; duration filters together &mdash; equipment filter was loosened.</p>`
      : buildWeekState.relaxed === "duration"
        ? `<p class="settings-hint">Not enough matches &mdash; duration &amp; equipment filters were both loosened.</p>` : "";
    return `
      <h2 class="modal-title">Your Proposed Week</h2>
      ${relaxedNote}
      <div class="bmw-proposal-list">${buildWeekState.proposal.map(proposalRowHTML).join("")}</div>
      <div class="modal-actions" style="flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" data-action="bmw-clear">Clear</button>
        <button type="button" class="btn btn-secondary" data-action="bmw-shuffle">Shuffle</button>
        <button type="button" class="btn btn-primary" data-action="bmw-accept" style="flex:2;">Accept All</button>
      </div>
    `;
  }

  function rerenderBuildWeek() {
    contentEl.innerHTML = buildWeekState.step === "prefs" ? renderBuildWeekPrefs() : renderBuildWeekProposal();
  }

  function openBuildWeekWizard(mondayStr) {
    buildWeekState = freshBuildWeekState(mondayStr);
    openModal(renderBuildWeekPrefs());
  }

  function handleBmwSetPref(key, value) {
    buildWeekState.prefs[key] = value;
    rerenderBuildWeek();
  }

  function handleBmwGenerate() {
    const movementToggle = document.getElementById("bmw-avoid-movements");
    const equipToggle = document.getElementById("bmw-avoid-equipment");
    if (movementToggle) buildWeekState.prefs.avoidRepeatMovements = movementToggle.checked;
    if (equipToggle) buildWeekState.prefs.avoidRepeatEquipment = equipToggle.checked;

    const dates = Utils.getWeekDateStrings(buildWeekState.mondayStr);
    const result = Builder.buildWeek(dates, buildWeekState.prefs);
    buildWeekState.proposal = result.proposal;
    buildWeekState.relaxed = result.relaxed;
    buildWeekState.step = "proposal";
    rerenderBuildWeek();
  }

  function handleBmwShuffle() {
    const dates = Utils.getWeekDateStrings(buildWeekState.mondayStr);
    const result = Builder.buildWeek(dates, buildWeekState.prefs);
    buildWeekState.proposal = result.proposal;
    buildWeekState.relaxed = result.relaxed;
    rerenderBuildWeek();
  }

  function handleBmwClear() {
    buildWeekState.step = "prefs";
    buildWeekState.proposal = null;
    rerenderBuildWeek();
  }

  function handleBmwReplace(date) {
    const replacement = Builder.replaceSlot(date, buildWeekState.proposal, buildWeekState.prefs);
    const item = buildWeekState.proposal.find((p) => p.date === date);
    if (item) item.workoutId = replacement ? replacement.id : item.workoutId;
    rerenderBuildWeek();
  }

  // Takes an explicit snapshot rather than reading the module-level
  // buildWeekState, because when this runs as a confirm-dialog callback,
  // closeModal() has already reset buildWeekState to null by the time
  // the callback fires (see handleConfirmYes).
  function commitBuildWeek(mondayStr, proposal) {
    proposal.forEach((item) => {
      if (item.workoutId) Planner.addWodToDay(mondayStr, item.date, item.workoutId, { replace: true });
    });
    closeModal();
    window.App.UI.showToast("Your week is set \u2014 nice work!");
    window.App.UI.refreshCurrentScreen();
  }

  function handleBmwAccept() {
    const mondaySnapshot = buildWeekState.mondayStr;
    const proposalSnapshot = buildWeekState.proposal.slice();

    const willReplaceCount = proposalSnapshot.filter((item) => {
      const existing = Planner.getDayPlan(mondaySnapshot, item.date);
      return existing.wodId && existing.wodId !== item.workoutId;
    }).length;

    if (willReplaceCount > 0) {
      openConfirm({
        title: "Replace existing plans?",
        message: `This will replace the WOD already planned on ${willReplaceCount} day${willReplaceCount === 1 ? "" : "s"} this week. Continue?`,
        confirmLabel: "Replace & Save",
        onConfirm: () => commitBuildWeek(mondaySnapshot, proposalSnapshot),
      });
    } else {
      commitBuildWeek(mondaySnapshot, proposalSnapshot);
    }
  }

  /* -------------------------------- Filters panel ---------------------------- */
  function openFiltersPanel(currentFilters, onApply) {
    const equipmentOptions = Data.getEquipmentOptions();
    const movementOptions = Data.getMovementCategoryOptions();
    const scoreOptions = Data.getScoreTypeOptions();
    const durationBuckets = ["any", "under10", "10-20", "20-30", "30-45", "45plus", "unknown"];

    const draft = Object.assign({
      durationBucket: "any", equipmentSlugs: [], movementCategory: "any", scoreType: "any",
      onlyMyEquipment: false, favoritesOnly: false,
    }, currentFilters);

    function render() {
      return `
        <h2 class="modal-title">Filters</h2>

        <div class="filter-section">
          <h3>Duration</h3>
          <div class="filter-options">${durationBuckets.map((b) => `<button type="button" class="filter-opt ${draft.durationBucket === b ? "active" : ""}" data-action="f-duration" data-value="${b}">${Data.DURATION_BUCKET_LABELS[b]}</button>`).join("")}</div>
        </div>

        <div class="filter-section">
          <h3>Workout Type</h3>
          <div class="filter-options">
            <button type="button" class="filter-opt ${draft.scoreType === "any" ? "active" : ""}" data-action="f-scoretype" data-value="any">Any</button>
            ${scoreOptions.map((o) => `<button type="button" class="filter-opt ${draft.scoreType === o.slug ? "active" : ""}" data-action="f-scoretype" data-value="${o.slug}">${Utils.escapeHtml(o.label)}</button>`).join("")}
          </div>
        </div>

        <div class="filter-section">
          <h3>Movement / Body Area</h3>
          <div class="filter-options">
            <button type="button" class="filter-opt ${draft.movementCategory === "any" ? "active" : ""}" data-action="f-movement" data-value="any">Any</button>
            ${movementOptions.map((o) => `<button type="button" class="filter-opt ${draft.movementCategory === o.slug ? "active" : ""}" data-action="f-movement" data-value="${o.slug}">${Utils.escapeHtml(o.label)}</button>`).join("")}
          </div>
        </div>

        <div class="filter-section">
          <h3>Equipment</h3>
          <div class="filter-options equip-scroll">
            ${equipmentOptions.map((o) => `<button type="button" class="filter-opt ${draft.equipmentSlugs.includes(o.slug) ? "active" : ""}" data-action="f-equipment" data-value="${o.slug}">${Utils.escapeHtml(o.label)}</button>`).join("")}
          </div>
        </div>

        <label class="toggle-row" style="cursor:pointer;">
          <span><span class="tr-label">Only show workouts I can do</span><span class="tr-sub">Based on My Equipment in Settings</span></span>
          <span class="switch"><input type="checkbox" id="f-only-mine" ${draft.onlyMyEquipment ? "checked" : ""}><span class="switch-track"></span></span>
        </label>
        <label class="toggle-row" style="cursor:pointer;">
          <span class="tr-label">Favorites only</span>
          <span class="switch"><input type="checkbox" id="f-favorites" ${draft.favoritesOnly ? "checked" : ""}><span class="switch-track"></span></span>
        </label>

        <div class="modal-actions">
          <button type="button" id="f-reset" class="btn btn-secondary">Reset</button>
          <button type="button" id="f-apply" class="btn btn-primary">Apply Filters</button>
        </div>
      `;
    }

    function rerender() {
      contentEl.innerHTML = render();
      wire();
    }

    function wire() {
      document.getElementById("f-only-mine").addEventListener("change", (e) => { draft.onlyMyEquipment = e.target.checked; });
      document.getElementById("f-favorites").addEventListener("change", (e) => { draft.favoritesOnly = e.target.checked; });
      document.querySelectorAll('[data-action="f-duration"]').forEach((b) => b.addEventListener("click", () => { draft.durationBucket = b.dataset.value; rerender(); }));
      document.querySelectorAll('[data-action="f-scoretype"]').forEach((b) => b.addEventListener("click", () => { draft.scoreType = b.dataset.value; rerender(); }));
      document.querySelectorAll('[data-action="f-movement"]').forEach((b) => b.addEventListener("click", () => { draft.movementCategory = b.dataset.value; rerender(); }));
      document.querySelectorAll('[data-action="f-equipment"]').forEach((b) => b.addEventListener("click", () => {
        const v = b.dataset.value;
        if (draft.equipmentSlugs.includes(v)) draft.equipmentSlugs = draft.equipmentSlugs.filter((x) => x !== v);
        else draft.equipmentSlugs.push(v);
        rerender();
      }));
      document.getElementById("f-reset").addEventListener("click", () => {
        Object.assign(draft, { durationBucket: "any", equipmentSlugs: [], movementCategory: "any", scoreType: "any", onlyMyEquipment: false, favoritesOnly: false });
        rerender();
      });
      document.getElementById("f-apply").addEventListener("click", () => {
        closeModal();
        onApply(draft);
      });
    }

    openModal(render());
    wire();
  }

  window.App = window.App || {};
  window.App.Modals = {
    openModal, closeModal, isOpen,
    openConfirm, handleConfirmYes,
    openWorkoutDetail, handleAddToDay,
    openSwapPicker, handleSwapToggleMine, handleSwapDuration, handleSwapSelect,
    openStrengthEditor, handleAddExercise, handleRemoveExercise, handleStrengthTab,
    handleLoadStrengthTemplate, handleSaveStrength,
    openBuildWeekWizard, handleBmwSetPref, handleBmwGenerate, handleBmwShuffle,
    handleBmwClear, handleBmwReplace, handleBmwAccept,
    openFiltersPanel,
  };
})();
