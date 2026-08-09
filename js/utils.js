/* =========================================================================
   utils.js — small, dependency-free helper functions used across the app.
   Exposed on window.App.Utils
   ========================================================================= */
(function () {
  "use strict";

  const WEEKDAY_NAMES = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function pad2(n) { return String(n).padStart(2, "0"); }

  /** Format a Date as YYYY-MM-DD using LOCAL time (never UTC). */
  function formatDateLocal(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  /** Parse a YYYY-MM-DD string into a local-midnight Date object. */
  function parseDateLocal(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  /** Return a new Date offset by n days (local). */
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  /** Return the Monday (local midnight) of the week containing `date`. */
  function getMonday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
    return addDays(d, diff);
  }

  /** Today at local midnight. */
  function todayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function todayLocalStr() {
    return formatDateLocal(todayLocal());
  }

  /**
   * The Monday that the app should default to opening on.
   * Monday–Friday: this week's Monday. Saturday/Sunday: next Monday
   * (the week the person is about to plan).
   */
  function getDefaultPlanningMonday() {
    const today = todayLocal();
    const dow = today.getDay(); // 0 Sun .. 6 Sat
    const thisMonday = getMonday(today);
    if (dow === 0 || dow === 6) {
      return addDays(thisMonday, 7);
    }
    return thisMonday;
  }

  /** Given a Monday date string, return array of 5 weekday date strings (Mon..Fri). */
  function getWeekDateStrings(mondayStr) {
    const monday = parseDateLocal(mondayStr);
    const out = [];
    for (let i = 0; i < 5; i++) out.push(formatDateLocal(addDays(monday, i)));
    return out;
  }

  function formatWeekRange(mondayStr) {
    const monday = parseDateLocal(mondayStr);
    const friday = addDays(monday, 4);
    const sameMonth = monday.getMonth() === friday.getMonth();
    const sameYear = monday.getFullYear() === friday.getFullYear();
    const startPart = `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`;
    let endPart;
    if (sameMonth) endPart = `${friday.getDate()}`;
    else endPart = `${MONTH_NAMES[friday.getMonth()]} ${friday.getDate()}`;
    const yearPart = sameYear ? `, ${friday.getFullYear()}` : `, ${friday.getFullYear()}`;
    return `${startPart}\u2013${endPart}${yearPart}`;
  }

  function weekdayLabel(index) { return WEEKDAY_NAMES[index] || ""; }

  function formatShortDate(dateStr) {
    const d = parseDateLocal(dateStr);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  }

  /** Generate a reasonably unique id (timestamp + random base36). */
  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 9);
    const t = Date.now().toString(36);
    return `${prefix ? prefix + "_" : ""}${t}${rand}`;
  }

  /**
   * Defensively format a workout duration given in SECONDS (the unit used
   * by the WODWell export). Values of 0 / null / non-numeric are treated
   * as "Unknown" rather than "0 min".
   */
  function formatDurationFromSeconds(seconds) {
    const n = Number(seconds);
    if (!n || !isFinite(n) || n <= 0) return "Unknown";
    const totalMinutes = Math.round(n / 60);
    if (totalMinutes < 1) return "< 1 min";
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  /** Minutes -> "1h 30m" style label used for strength / morning routine blocks. */
  function formatMinutes(min) {
    const n = Number(min);
    if (!n || !isFinite(n) || n <= 0) return "0 min";
    if (n < 60) return `${n} min`;
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  /** Escape text before interpolating into an HTML string. */
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Escape + preserve line breaks (for workout prescriptions / free text). */
  function escapeMultiline(str) {
    return escapeHtml(str).replace(/\r\n|\r|\n/g, "\n");
  }

  /** 'pull-up-bar' -> 'Pull-up Bar'; 'air-squat' -> 'Air Squat' */
  function titleCaseSlug(slug) {
    if (!slug) return "";
    return String(slug)
      .split("-")
      .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

  window.App = window.App || {};
  window.App.Utils = {
    pad2,
    formatDateLocal,
    parseDateLocal,
    addDays,
    getMonday,
    todayLocal,
    todayLocalStr,
    getDefaultPlanningMonday,
    getWeekDateStrings,
    formatWeekRange,
    weekdayLabel,
    formatShortDate,
    uid,
    formatDurationFromSeconds,
    formatMinutes,
    clamp,
    debounce,
    escapeHtml,
    escapeMultiline,
    titleCaseSlug,
    sum,
  };
})();
