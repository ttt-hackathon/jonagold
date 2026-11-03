/*
 * sections/news.js: the "Supplier news" section (owner: Mitchell).
 *
 * WHAT IT DOES
 *   Fills <div id="news"> on index.html with one row per supplier (all 13, plus Samsung
 *   SDI, whose cells go into our Cataloochee battery packs). Each row says either what
 *   real news was found (with source link and date) or "nothing found" with the date
 *   someone last searched, and has a link to search the latest news yourself.
 *
 * HOW IT FITS
 *   There is no free news feed we can legally and reliably read from a page opened by
 *   double-click, so a person (or Claude) searches the web, reads the source, and types
 *   confirmed findings into newsItems below. Items are added to window.JONAGOLD_WARNINGS
 *   (format: top of sections/risk.js and CLAUDE.md), so the Supplier risk and Alerts
 *   sections react. Refresh by searching again and editing newsItems and newsCheckedOn.
 *
 * RULES
 *   - Every item needs a real source link and the source's date. Never invent an event.
 *   - severity "confirmed" means the event has happened and is still in effect;
 *     "credible" means a real report that is old, unconfirmed or of unknown current status.
 *
 * ERRORS
 *   Never throws; if the box is missing it does nothing.
 */
(function () {
  "use strict";

  var newsCheckedOn = "2026-11-03";

  /* ---------- the only part a person edits ---------- */
  var newsItems = [
    {
      type: "news", severity: "credible", supplierIds: ["S04"],
      headline: "US Customs has an import hold (a 'withhold release order', issued Sept 24, 2025) on bicycles and parts made by Giant in Taiwan, over forced-labor allegations. As of March 2026 Giant's petition was still under review; we found no later update, so current status is unverified. Our Giant frames ship from Taichung to Savannah.",
      sourceName: "SGB Media",
      sourceUrl: "https://sgbonline.com/exec-cbp-forced-labor-division-sees-giant-bicycles-issue-as-a-top-priority/",
      date: "2026-03-10"
    }
  ];

  /** Suppliers shown, with the search words used for the "latest news" link. */
  function rows() {
    var data = window.LAUREL_RIDGE;
    var list = (data && data.suppliers ? data.suppliers : []).map(function (s) {
      return { id: s.supplier_id, name: s.supplier_name, query: s.supplier_name };
    });
    list.push({ id: "S01", name: "Samsung SDI (battery cells inside Cataloochee packs)", query: "Samsung SDI", cells: true });
    return list;
  }

  /** Escape text so it is safe to put inside HTML. */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Add this section's styles once. All class names start with "news-". */
  function addStyles() {
    if (document.getElementById("news-styles")) { return; }
    var el = document.createElement("style");
    el.id = "news-styles";
    el.textContent =
      ".news-row{border-top:1px solid #ece9e1;padding:7px 0;font-size:14px}" +
      ".news-name{font-weight:700}" +
      ".news-none{color:#5b6b62}" +
      ".news-badge{display:inline-block;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700;margin-right:6px;border:1px solid}" +
      ".news-confirmed{background:#fde8e6;color:#9b1c13;border-color:#e8a29c}" +
      ".news-credible{background:#fff1d6;color:#8a4b00;border-color:#e8b56a}" +
      ".news-small{font-size:12px;color:#5b6b62;margin:8px 0 0}";
    document.head.appendChild(el);
  }

  /** Draw the section. Does nothing if the box is missing. */
  function render() {
    var box = document.getElementById("news");
    if (!box) { return; }
    addStyles();
    var html = "";
    rows().forEach(function (r) {
      var mine = newsItems.filter(function (n) { return n.supplierIds.indexOf(r.id) !== -1 && (!r.cells || n.cells); });
      var search = "https://news.google.com/search?q=" + encodeURIComponent('"' + r.query.trim() + '"') + "&hl=en-US";
      html += '<div class="news-row"><span class="news-name">' + esc(r.name) + "</span> ";
      if (!mine.length) {
        html += '<span class="news-none">Nothing found as of ' + esc(newsCheckedOn) + ".</span>";
      }
      mine.forEach(function (n) {
        html += '<div><span class="news-badge news-' + n.severity + '">' + (n.severity === "confirmed" ? "Confirmed" : "Credible") + "</span>" +
          esc(n.headline) + ' <a href="' + esc(n.sourceUrl) + '" target="_blank" rel="noopener">' + esc(n.sourceName) + "</a>, " + esc(n.date) + "</div>";
      });
      html += ' <a class="news-none" href="' + esc(search) + '" target="_blank" rel="noopener">latest news</a></div>';
    });
    html += '<p class="news-small">Searched by hand on ' + esc(newsCheckedOn) +
      ". Not a complete picture: no live news feed is connected, so use the &quot;latest news&quot; links to check before acting.</p>";
    box.innerHTML = html;
  }

  /** Add the items to the shared warning list and tell the risk and alerts sections. */
  function publish() {
    window.JONAGOLD_WARNINGS = window.JONAGOLD_WARNINGS || [];
    newsItems.forEach(function (n) {
      window.JONAGOLD_WARNINGS.push({
        type: "news", severity: n.severity, headline: n.headline, sourceUrl: n.sourceUrl, date: n.date, supplierIds: n.supplierIds
      });
    });
    window.dispatchEvent(new Event("jonagold-warnings"));
  }

  function start() { render(); publish(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
