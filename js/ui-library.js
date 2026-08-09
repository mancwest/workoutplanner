/* =========================================================================
   ui-library.js — the WORKOUT LIBRARY screen: search, filter panel,
   recently viewed strip, favoriting, and paginated results.
   Exposed on window.App.Library
   ========================================================================= */
(function () {
  "use strict";

  const Utils = window.App.Utils;
  const Storage = window.App.Storage;
  const Data = window.App.Data;
  const Modals = window.App.Modals;

  const PAGE_SIZE = 50;

  let filters = {
    query: "", durationBucket: "any", equipmentSlugs: [], movementCategory: "any",
    scoreType: "any", onlyMyEquipment: false, favoritesOnly: false,
  };
  let visibleCount = PAGE_SIZE;

  function activeFilterCount() {
    let n = 0;
    if (filters.durationBucket !== "any") n++;
    if (filters.equipmentSlugs.length) n++;
    if (filters.movementCategory !== "any") n++;
    if (filters.scoreType !== "any") n++;
    if (filters.onlyMyEquipment) n++;
    if (filters.favoritesOnly) n++;
    return n;
  }

  function filterChipsHTML() {
    const chips = [];
    if (filters.durationBucket !== "any") chips.push({ key: "durationBucket", label: Data.DURATION_BUCKET_LABELS[filters.durationBucket] });
    if (filters.movementCategory !== "any") chips.push({ key: "movementCategory", label: Utils.titleCaseSlug(filters.movementCategory) });
    if (filters.scoreType !== "any") chips.push({ key: "scoreType", label: Utils.titleCaseSlug(filters.scoreType) });
    filters.equipmentSlugs.forEach((slug) => chips.push({ key: "equipment", value: slug, label: Utils.titleCaseSlug(slug) }));
    if (filters.onlyMyEquipment) chips.push({ key: "onlyMyEquipment", label: "My equipment only" });
    if (filters.favoritesOnly) chips.push({ key: "favoritesOnly", label: "Favorites" });

    if (!chips.length) return "";
    return chips.map((c) => `<button type="button" class="chip-btn active" data-action="remove-filter-chip" data-key="${c.key}" data-value="${c.value || ""}">${Utils.escapeHtml(c.label)} &#10005;</button>`).join("");
  }

  function recentViewedHTML() {
    const recent = Storage.getRecent();
    const wrap = document.getElementById("recent-viewed-wrap");
    if (!recent.length || filters.query || activeFilterCount()) { wrap.hidden = true; return; }
    const items = recent.map((r) => Data.getWorkoutById(r.id)).filter(Boolean).slice(0, 10);
    if (!items.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    document.getElementById("recent-viewed").innerHTML = items.map((w) => `
      <div class="recent-chip" data-action="view-workout" data-workout-id="${w.id}">
        <div class="rc-title">${Utils.escapeHtml(w.title)}</div>
        <div class="rc-meta">${Utils.escapeHtml(Utils.formatDurationFromSeconds(w.time))}</div>
      </div>
    `).join("");
  }

  function workoutCardHTML(w) {
    const fav = Storage.isFavorite(w.id);
    const typeTag = w.scoreTypes[0] ? `<span class="tag">${Utils.escapeHtml(Utils.titleCaseSlug(w.scoreTypes[0]))}</span>` : "";
    const equipTags = w.equipment.slice(0, 3).map((e) => `<span class="tag">${Utils.escapeHtml(Utils.titleCaseSlug(e))}</span>`).join("");
    const moreEquip = w.equipment.length > 3 ? `<span class="tag">+${w.equipment.length - 3}</span>` : "";
    return `
      <div class="workout-card" role="listitem" data-action="view-workout" data-workout-id="${w.id}">
        <div class="wc-top">
          <div>
            <div class="wc-title">${Utils.escapeHtml(w.title)}</div>
            ${w.subtitle ? `<div class="wc-subtitle">${Utils.escapeHtml(w.subtitle)}</div>` : ""}
          </div>
          <button type="button" class="fav-btn" data-action="toggle-favorite" data-workout-id="${w.id}" aria-label="Toggle favorite">${fav ? "&#9829;" : "&#9825;"}</button>
        </div>
        <div class="wc-tags">${typeTag}${equipTags}${moreEquip}</div>
        ${w.description ? `<p class="wc-desc">${Utils.escapeHtml(w.description)}</p>` : ""}
        <div class="wc-meta-row">
          <span>&#9201; ${Utils.escapeHtml(Utils.formatDurationFromSeconds(w.time))}</span>
          <span>&#127939; ${w.movements.length} movements</span>
        </div>
      </div>
    `;
  }

  function currentResults() {
    const settings = Storage.getSettings();
    const f = Object.assign({}, filters, {
      myEquipment: settings.equipment,
      favoriteIds: Storage.getFavorites(),
    });
    return Data.filterWorkouts(f);
  }

  function render() {
    const screen = document.getElementById("screen-library");
    if (!screen.classList.contains("active")) return;

    document.getElementById("filter-chips").innerHTML = filterChipsHTML();
    const badge = document.getElementById("filter-count-badge");
    const count = activeFilterCount();
    badge.hidden = count === 0;
    badge.textContent = count;

    recentViewedHTML();

    const results = currentResults();
    const shown = results.slice(0, visibleCount);
    const metaEl = document.getElementById("library-results-meta");
    metaEl.textContent = results.length
      ? `Showing ${shown.length} of ${results.length} workout${results.length === 1 ? "" : "s"}`
      : "";

    const listEl = document.getElementById("library-list");
    if (!results.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="es-icon">&#128533;</div><p class="es-title">No workouts match</p><p>Try clearing a filter or searching something else.</p></div>`;
    } else {
      listEl.innerHTML = shown.map(workoutCardHTML).join("");
    }

    const loadMoreBtn = document.getElementById("load-more-btn");
    loadMoreBtn.hidden = shown.length >= results.length;
  }

  function handleSearch(value) {
    filters.query = value;
    visibleCount = PAGE_SIZE;
    render();
  }

  function handleLoadMore() {
    visibleCount += PAGE_SIZE;
    render();
  }

  function handleRemoveFilterChip(key, value) {
    if (key === "equipment") filters.equipmentSlugs = filters.equipmentSlugs.filter((s) => s !== value);
    else if (key === "onlyMyEquipment") filters.onlyMyEquipment = false;
    else if (key === "favoritesOnly") filters.favoritesOnly = false;
    else filters[key] = key === "movementCategory" || key === "scoreType" ? "any" : "any";
    visibleCount = PAGE_SIZE;
    render();
  }

  function openFilters() {
    Modals.openFiltersPanel(filters, (newFilters) => {
      filters = newFilters;
      visibleCount = PAGE_SIZE;
      render();
    });
  }

  function handleToggleFavorite(workoutId) {
    Storage.toggleFavorite(workoutId);
    render();
  }

  window.App = window.App || {};
  window.App.Library = {
    render, handleSearch, handleLoadMore, handleRemoveFilterChip, openFilters, handleToggleFavorite,
  };
})();
