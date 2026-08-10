/* =========================================================================
   ui-settings.js — the SETTINGS screen: My Equipment, Morning Routine
   (add/remove/edit your own items), default strength duration, theme,
   and data export/import/clear.
   Exposed on window.App.Settings
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Storage = window.App.Storage;
  const Data = window.App.Data;
  const Modals = window.App.Modals;

  function equipmentGridHTML(settings) {
    const options = Data.getEquipmentOptions();
    return options.map((o) => {
      const checked = settings.equipment.includes(o.slug);
      return `
        <label class="equip-chip ${checked ? "checked" : ""}">
          <input type="checkbox" data-action="settings-equipment-toggle" data-slug="${o.slug}" ${checked ? "checked" : ""}>
          ${Utils.escapeHtml(o.label)}
        </label>
      `;
    }).join("");
  }

  // Reuses the .exercise-row / .remove-ex-btn / .add-ex-btn styling from
  // the strength editor's exercise list, since it's the same "editable
  // rows with a remove button and an add-row button" shape.
  function morningRoutineRowsHTML(settings) {
    if (!settings.morningRoutine.length) {
      return `<p class="settings-hint" style="margin:0 0 10px;">No morning routine items \u2014 add one below, or leave it empty if mornings aren't part of your plan.</p>`;
    }
    return settings.morningRoutine.map((item, i) => `
      <div class="exercise-row">
        <input type="text" placeholder="Name" value="${Utils.escapeHtml(item.name)}" data-mr-field="name" data-mr-index="${i}">
        <input type="text" class="ex-sets" placeholder="Min" value="${item.minutes}" data-mr-field="minutes" data-mr-index="${i}">
        <button type="button" class="remove-ex-btn" data-action="remove-morning-item" data-index="${i}" aria-label="Remove ${Utils.escapeHtml(item.name)}">&#10005;</button>
      </div>
    `).join("");
  }

  function render() {
    const screen = document.getElementById("screen-settings");
    if (!screen.classList.contains("active")) return;
    const settings = Storage.getSettings();
    const container = document.getElementById("settings-content");
    container.innerHTML = `
      <div class="settings-section">
        <h2>My Equipment</h2>
        <p class="settings-hint">Used by "Only show workouts I can do" and Build My Week. Options are drawn from equipment tags in your workout library.</p>
        <div class="equipment-grid" id="equipment-grid">${equipmentGridHTML(settings)}</div>
      </div>

      <div class="settings-section">
        <h2>Morning Routine</h2>
        <p class="settings-hint">What shows up under Morning Routine every weekday. Add, remove, rename, or change the length of anything here \u2014 it doesn't have to be yoga and meditation.</p>
        <div id="morning-routine-rows">${morningRoutineRowsHTML(settings)}</div>
        <button type="button" class="add-ex-btn" data-action="add-morning-item">+ Add Item</button>
      </div>

      <div class="settings-section">
        <h2>Default Strength Duration</h2>
        <select id="set-strength-duration">
          ${[15, 20, 30, 40, 45, 60].map((d) => `<option value="${d}" ${settings.strengthDefaultDuration === d ? "selected" : ""}>${d} min</option>`).join("")}
        </select>
      </div>

      <div class="settings-section">
        <h2>Theme</h2>
        <div class="segmented" id="theme-segmented">
          <button type="button" data-action="set-theme" data-theme="light" class="${settings.theme === "light" ? "active" : ""}">Light</button>
          <button type="button" data-action="set-theme" data-theme="dark" class="${settings.theme === "dark" ? "active" : ""}">Dark</button>
          <button type="button" data-action="set-theme" data-theme="system" class="${settings.theme === "system" ? "active" : ""}">System</button>
        </div>
      </div>

      <div class="settings-section">
        <h2>Data Management</h2>
        <button type="button" class="settings-btn" data-action="export-data">&#11015;&#65039; Export My Data</button>
        <button type="button" class="settings-btn" data-action="import-data">&#11014;&#65039; Import My Data</button>
        <button type="button" class="settings-btn danger" data-action="clear-data">&#128465;&#65039; Clear All Data</button>
      </div>

      <div class="settings-section about">
        <p class="app-version">Weekly Workout Planner &middot; works fully offline</p>
      </div>
    `;

    wire();
  }

  function wire() {
    document.querySelectorAll('[data-action="settings-equipment-toggle"]').forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const settings = Storage.getSettings();
        const slug = e.target.dataset.slug;
        if (e.target.checked) {
          if (!settings.equipment.includes(slug)) settings.equipment.push(slug);
        } else {
          settings.equipment = settings.equipment.filter((s) => s !== slug);
        }
        Storage.saveSettings(settings);
        e.target.closest(".equip-chip").classList.toggle("checked", e.target.checked);
      });
    });

    document.querySelectorAll('[data-mr-field]').forEach((input) => {
      input.addEventListener("change", (e) => {
        const settings = Storage.getSettings();
        const idx = Number(e.target.dataset.mrIndex);
        const field = e.target.dataset.mrField;
        const item = settings.morningRoutine[idx];
        if (!item) return;
        if (field === "name") {
          const trimmed = e.target.value.trim();
          item.name = trimmed || item.name; // don't allow it to go blank
          e.target.value = item.name;
        } else if (field === "minutes") {
          item.minutes = Utils.clamp(Number(e.target.value) || 1, 1, 180);
          e.target.value = item.minutes;
        }
        Storage.saveSettings(settings);
        window.App.UI.showToast("Saved");
        window.App.Plan.render();
      });
    });

    const strengthDur = document.getElementById("set-strength-duration");
    strengthDur.addEventListener("change", (e) => {
      const settings = Storage.getSettings();
      settings.strengthDefaultDuration = Number(e.target.value);
      Storage.saveSettings(settings);
    });
  }

  function handleAddMorningItem() {
    const settings = Storage.getSettings();
    settings.morningRoutine.push({ id: Utils.uid("mr"), name: "New Item", minutes: 15 });
    Storage.saveSettings(settings);
    render();
    window.App.Plan.render();
  }

  function handleRemoveMorningItem(index) {
    const settings = Storage.getSettings();
    settings.morningRoutine.splice(Number(index), 1);
    Storage.saveSettings(settings);
    render();
    window.App.Plan.render();
  }

  function handleSetTheme(theme) {
    const settings = Storage.getSettings();
    settings.theme = theme;
    Storage.saveSettings(settings);
    window.App.UI.applyTheme();
    render();
  }

  function handleExportData() {
    const data = Storage.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = Utils.todayLocalStr();
    a.href = url;
    a.download = `workout-planner-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    window.App.UI.showToast("Backup downloaded");
  }

  function handleImportClick() {
    document.getElementById("import-file-input").click();
  }

  function handleImportFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        window.App.UI.showToast("That file isn't valid JSON");
        return;
      }
      Modals.openConfirm({
        title: "Import data?",
        message: "This will overwrite your current weekly plans, completion history, favorites, and settings with the contents of this backup file.",
        confirmLabel: "Import",
        onConfirm: () => {
          const result = Storage.importData(parsed);
          if (result.ok) {
            window.App.UI.showToast("Data imported");
            window.App.UI.applyTheme();
            window.App.UI.refreshCurrentScreen();
            render();
          } else {
            window.App.UI.showToast(result.error || "Import failed");
          }
        },
      });
    };
    reader.readAsText(file);
  }

  function handleClearData() {
    Modals.openConfirm({
      title: "Clear all data?",
      message: "This permanently deletes every weekly plan, completion record, favorite, saved strength workout, and setting on this device. This cannot be undone.",
      confirmLabel: "Clear Everything",
      danger: true,
      onConfirm: () => {
        Storage.clearAllData();
        window.App.UI.showToast("All data cleared");
        window.App.UI.applyTheme();
        window.App.Plan.goToWeek(Utils.formatDateLocal(Utils.getDefaultPlanningMonday()));
        window.App.UI.refreshCurrentScreen();
        render();
      },
    });
  }

  window.App = window.App || {};
  window.App.Settings = {
    render, handleSetTheme, handleExportData, handleImportClick, handleImportFile, handleClearData,
    handleAddMorningItem, handleRemoveMorningItem,
  };
})();
