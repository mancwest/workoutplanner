/* =========================================================================
   main.js — bootstraps the app: loads the workout database, applies the
   theme, wires navigation + the single delegated click handler that
   routes every data-action in the app, and registers the service worker.
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Storage = window.App.Storage;
  const Data = window.App.Data;
  const Planner = window.App.Planner;
  const Modals = window.App.Modals;

  let currentScreen = "plan";

  /* --------------------------------- Theme --------------------------------- */
  function resolveTheme(pref) {
    if (pref === "light" || pref === "dark") return pref;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme() {
    const settings = Storage.getSettings();
    const resolved = resolveTheme(settings.theme);
    document.documentElement.setAttribute("data-theme", resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "light" ? "#F6F5F0" : "#15181A");
  }

  /* ------------------------------- Navigation ------------------------------- */
  function goToScreen(name) {
    currentScreen = name;
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === name));
    document.querySelectorAll(".nav-btn").forEach((b) => {
      const active = b.dataset.screen === name;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    refreshCurrentScreen();
    window.scrollTo({ top: 0 });
  }

  function refreshCurrentScreen() {
    if (currentScreen === "plan") window.App.Plan.render();
    else if (currentScreen === "library") window.App.Library.render();
    else if (currentScreen === "progress") window.App.Progress.render();
    else if (currentScreen === "settings") window.App.Settings.render();
  }

  /* --------------------------------- Toast ---------------------------------- */
  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  window.App.UI = { goToScreen, refreshCurrentScreen, showToast, applyTheme };

  /* --------------------------- Global click delegation ----------------------- */
  document.addEventListener("click", (e) => {
    // Modal backdrop: only close when the backdrop itself (not its children) was clicked.
    if (e.target && e.target.id === "modal-overlay") {
      Modals.closeModal();
      refreshCurrentScreen();
      return;
    }

    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      // ---- Navigation ----
      case "nav":
        goToScreen(el.dataset.screen);
        break;

      // ---- Plan: week nav ----
      case "prev-week": window.App.Plan.goPrevWeek(); break;
      case "next-week": window.App.Plan.goNextWeek(); break;
      case "this-week": window.App.Plan.goThisWeek(); break;

      // ---- Plan: day card actions ----
      case "toggle-complete":
        window.App.Plan.handleToggleComplete(el.dataset.date, el.dataset.activity);
        break;
      case "edit-strength":
        Modals.openStrengthEditor(el.dataset.monday, el.dataset.date);
        break;
      case "remove-strength":
        window.App.Plan.handleRemoveStrength(el.dataset.monday, el.dataset.date);
        break;
      case "view-workout":
        Modals.openWorkoutDetail(el.dataset.workoutId, window.App.Plan.getCurrentMonday());
        break;
      case "swap-wod":
      case "browse-for-day":
        Modals.openSwapPicker(el.dataset.monday, el.dataset.date);
        break;
      case "remove-wod":
        window.App.Plan.handleRemoveWod(el.dataset.monday, el.dataset.date);
        break;

      // ---- Build My Week ----
      case "open-build-week":
        Modals.openBuildWeekWizard(window.App.Plan.getCurrentMonday());
        break;
      case "bmw-set-pref": Modals.handleBmwSetPref(el.dataset.key, el.dataset.value); break;
      case "bmw-generate": Modals.handleBmwGenerate(); break;
      case "bmw-shuffle": Modals.handleBmwShuffle(); break;
      case "bmw-clear": Modals.handleBmwClear(); break;
      case "bmw-replace": Modals.handleBmwReplace(el.dataset.date); break;
      case "bmw-accept": Modals.handleBmwAccept(); break;

      // ---- Workout detail / add / swap ----
      case "toggle-favorite": {
        const nowFav = Storage.toggleFavorite(el.dataset.workoutId);
        el.innerHTML = nowFav ? "&#9829;" : "&#9825;";
        if (currentScreen === "library") window.App.Library.render();
        break;
      }
      case "add-to-day":
        Modals.handleAddToDay(el.dataset.workoutId, el.dataset.monday, el.dataset.date);
        break;
      case "swap-toggle-mine":
        Modals.handleSwapToggleMine(currentSwapMonday(el), currentSwapDate(el));
        break;
      case "swap-duration":
        Modals.handleSwapDuration(el.dataset.value, currentSwapMonday(el), currentSwapDate(el));
        break;
      case "swap-select":
        Modals.handleSwapSelect(el.dataset.monday, el.dataset.date, el.dataset.workoutId);
        break;

      // ---- Strength editor ----
      case "strength-tab": Modals.handleStrengthTab(el.dataset.tab); break;
      case "add-exercise": Modals.handleAddExercise(); break;
      case "remove-exercise": Modals.handleRemoveExercise(Number(el.dataset.index)); break;
      case "save-strength": Modals.handleSaveStrength(); break;
      case "load-strength-template": Modals.handleLoadStrengthTemplate(el.dataset.id); break;

      // ---- Library ----
      case "open-filters": window.App.Library.openFilters(); break;
      case "load-more": window.App.Library.handleLoadMore(); break;
      case "remove-filter-chip": window.App.Library.handleRemoveFilterChip(el.dataset.key, el.dataset.value); break;

      // ---- Progress ----
      case "view-history-week": window.App.Progress.handleViewHistoryWeek(el.dataset.monday); break;

      // ---- Settings ----
      case "set-theme": window.App.Settings.handleSetTheme(el.dataset.theme); break;
      case "export-data": window.App.Settings.handleExportData(); break;
      case "import-data": window.App.Settings.handleImportClick(); break;
      case "clear-data": window.App.Settings.handleClearData(); break;

      // ---- Modal shell ----
      case "close-modal":
        Modals.closeModal();
        refreshCurrentScreen();
        break;
      case "confirm-yes":
        Modals.handleConfirmYes();
        break;

      default:
        break;
    }
  });

  // The swap picker's toggle/duration buttons don't carry monday/date themselves
  // (they live inside the modal, keyed off whatever day opened it) — read it back
  // from the day-picker context stored on the modal box via data attributes set at open time.
  function currentSwapMonday() { return document.getElementById("modal-box").dataset.monday; }
  function currentSwapDate() { return document.getElementById("modal-box").dataset.date; }

  /* --------------------------------- Init ------------------------------------ */
  function wireStaticInputs() {
    const searchInput = document.getElementById("library-search");
    searchInput.addEventListener("input", Utils.debounce((e) => window.App.Library.handleSearch(e.target.value), 180));

    document.getElementById("import-file-input").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) window.App.Settings.handleImportFile(file);
      e.target.value = "";
    });

    document.getElementById("retry-load-btn").addEventListener("click", boot);
  }

  function showApp() {
    document.getElementById("app-loading").hidden = true;
    document.getElementById("load-error").hidden = true;
    document.getElementById("app").hidden = false;
  }

  function showLoadError() {
    document.getElementById("app-loading").hidden = true;
    document.getElementById("app").hidden = true;
    document.getElementById("load-error").hidden = false;
  }

  function registerServiceWorker() {
    // isSecureContext is the browser's own authoritative check — it covers
    // https:, localhost, and loopback addresses like 127.0.0.1/::1, which a
    // hand-rolled hostname === "localhost" check would miss.
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("service-worker.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    }
  }

  let booted = false;
  function boot() {
    document.getElementById("app-loading").hidden = false;
    document.getElementById("load-error").hidden = true;
    Storage.init();
    applyTheme();

    Data.loadWorkouts()
      .then(() => {
        showApp();
        if (!booted) {
          wireStaticInputs();
          goToScreen("plan");
          booted = true;
        } else {
          refreshCurrentScreen();
        }
        registerServiceWorker();
      })
      .catch((err) => {
        console.warn("Failed to load workouts.json:", err);
        showLoadError();
      });
  }

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      const settings = Storage.getSettings();
      if (settings.theme === "system") applyTheme();
    });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
