/*
 * sections/poems.js: the "Poems" section (owner: Mitchell).
 *
 * WHAT IT DOES
 *   Fills <div id="poems"> on index.html with two short poems about this project: a
 *   haiku and a sonnet. Purely for fun; it does not read or change any supplier data
 *   and does not affect risk levels or alerts.
 *
 * HOW IT FITS
 *   Like every section, it draws into the box with its own name and keeps its styles
 *   inside this file, with class names starting "poems-". If the box is not on the page
 *   it quietly does nothing.
 *
 * ERRORS
 *   Never throws.
 */
(function () {
  "use strict";

  // The poems were written by Claude for the team (original work, no outside source).
  var HAIKU = [
    "Storms, strikes, ports, and fires,",
    "the dashboard glows amber,",
    "warning us in time."
  ];
  var SONNET = [
    "Our bikes depend on parts from distant shores,",
    "Where typhoons rise and ports can silent fall,",
    "Yet we would only learn, with shuttered doors,",
    "When trucks stayed empty and we heard no call.",
    "So two of us, each with a helper's hand,",
    "Divided up one page and built it well:",
    "A map of risk across the supplier land,",
    "With sources shown for every tale we tell.",
    "Red lights an email, ready, plain, and clear,",
    "While amber whispers, \"Watch the shelves with care.\"",
    "No story made, no secret kept too near,",
    "Each warning dated, linked, and fair.",
    "Now purchasing can see the trouble start,",
    "And act in time, before the line departs."
  ];

  /** Escape text so it is safe to put inside HTML. */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Turn a list of lines into one poem block with a title. */
  function poem(title, lines) {
    return '<div class="poems-card"><h3 class="poems-title">' + esc(title) + "</h3><p class=\"poems-text\">" +
      lines.map(esc).join("<br>") + "</p></div>";
  }

  /** Draw the section. Does nothing if the box is missing. */
  function render() {
    var box = document.getElementById("poems");
    if (!box) { return; }
    if (!document.getElementById("poems-styles")) {
      var el = document.createElement("style");
      el.id = "poems-styles";
      el.textContent =
        ".poems-wrap{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}" +
        ".poems-card{background:#eef3ef;border-radius:10px;padding:14px 18px}" +
        ".poems-title{margin:0 0 8px;font-size:16px;color:#1f3d2e}" +
        ".poems-text{margin:0;font-family:Cambria,Georgia,serif;font-style:italic;font-size:15px;line-height:1.6}";
      document.head.appendChild(el);
    }
    box.innerHTML = '<div class="poems-wrap">' + poem("Haiku", HAIKU) + poem("Sonnet", SONNET) + "</div>";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
