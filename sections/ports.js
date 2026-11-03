// Ports section: port and shipping warnings for Savannah and Charleston.
// Fills <div id="ports"> on index.html. If the box isn't there yet, it quietly does nothing.
// All styles and names start with "ports" so they don't affect other sections.
(function () {
  // ---- WARNINGS: the only thing to edit when a real event is found ----
  // Add one entry per real, confirmed or credible event. Every entry MUST have a source link and date.
  // Example shape (do not add made-up events):
  //   { port: "Savannah", kind: "Congestion", level: "Amber",
  //     summary: "One sentence on what happened.",
  //     sourceName: "Name of the news site", sourceUrl: "https://...", date: "2026-11-02" }
  // level: "Amber" = credible warning that could become a problem (shared as "credible"),
  //        "Confirmed" = event has happened (the risk section decides Red or Amber from stock levels).
  var portsWarnings = [];

  // Last time someone searched for port news and what was found.
  var portsLastChecked = "2026-11-03";

  var portsList = [
    {
      name: "Savannah", state: "GA", entry: "Savannah, GA",
      officialName: "Georgia Ports Authority",
      officialUrl: "https://gaports.com/"
    },
    {
      name: "Charleston", state: "SC", entry: "Charleston, SC",
      officialName: "SC Ports news",
      officialUrl: "https://scspa.com/news/"
    }
  ];

  function portsEsc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function portsSuppliers(entry) {
    var data = window.LAUREL_RIDGE;
    if (!data || !data.suppliers) return [];
    return data.suppliers.filter(function (s) { return s.us_port_of_entry === entry; });
  }

  function portsRender() {
    var box = document.getElementById("ports");
    if (!box) return;

    var css =
      "#ports .ports-title{margin:0 0 4px;font-size:18px}" +
      "#ports .ports-sub{margin:0 0 14px;font-size:13px;color:#5b6b62}" +
      "#ports .ports-port{border-top:1px solid #ddd8cc;padding:12px 0}" +
      "#ports .ports-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}" +
      "#ports .ports-name{font-weight:600}" +
      "#ports .ports-badge{font-size:12px;font-weight:600;padding:2px 8px;border-radius:10px}" +
      "#ports .ports-green{background:#e3f1e8;color:#1d5a3a}" +
      "#ports .ports-amber{background:#fdf0d0;color:#7a5200}" +
      "#ports .ports-red{background:#f9dcd8;color:#8a1c10}" +
      "#ports .ports-text{margin:6px 0 0;font-size:14px;line-height:1.45}" +
      "#ports .ports-small{margin:6px 0 0;font-size:12px;color:#5b6b62;line-height:1.4}" +
      "#ports .ports-list{margin:6px 0 0;padding-left:18px;font-size:14px;line-height:1.45}" +
      "#ports a{color:#2f6b4f}";

    var html = "<style>" + css + "</style>" +
      "<h2 class='ports-title'>Port and shipping warnings</h2>" +
      "<p class='ports-sub'>Savannah and Charleston. Last checked " + portsEsc(portsLastChecked) + ".</p>";

    portsList.forEach(function (p) {
      var items = portsWarnings.filter(function (w) { return w.port === p.name; });
      var sup = portsSuppliers(p.entry);
      var supText = sup.length
        ? sup.length + " suppliers ship through here: " + sup.map(function (s) { return s.supplier_name; }).join(", ") + "."
        : "";

      var level = "Green";
      items.forEach(function (w) {
        if (w.level === "Amber" && level === "Green") level = "Amber";
        if (w.level === "Confirmed") level = "Confirmed";
      });
      // Automatic news feed (data/ports-news.js, refreshed hourly by GitHub). Headlines are unverified.
      var feed = window.PORTS_NEWS && window.PORTS_NEWS.ports ? window.PORTS_NEWS.ports[p.name] : undefined;
      var headlines = Array.isArray(feed) ? feed : [];
      var feedState = feed === undefined ? "none" : (feed === null ? "failed" : "ok");
      var badgeClass = "ports-amber", badgeText;
      if (level === "Confirmed") badgeText = "Event confirmed";
      else if (level === "Amber") badgeText = "Amber: watch";
      else if (headlines.length) badgeText = "Headlines to review";
      else if (feedState === "ok") { badgeClass = "ports-green"; badgeText = "Green: nothing current"; }
      else if (feedState === "failed") badgeText = "News feed could not be checked";
      else { badgeClass = "ports-green"; badgeText = "Green: nothing found at last manual check"; }

      html += "<div class='ports-port'><div class='ports-head'>" +
        "<span class='ports-name'>" + portsEsc(p.name) + ", " + portsEsc(p.state) + "</span>" +
        "<span class='ports-badge " + badgeClass + "'>" + badgeText + "</span></div>";

      if (items.length === 0 && headlines.length === 0 && feedState !== "failed") {
        html += "<p class='ports-text'>No current congestion, strike or closure found in the latest check.</p>";
      }
      if (feedState === "failed") {
        html += "<p class='ports-text'>The automatic news check did not work last time. Check the port's own site below.</p>";
      }
      items.forEach(function (w) {
        html += "<p class='ports-text'><strong>" + portsEsc(w.kind) + ":</strong> " + portsEsc(w.summary) +
          " <a href='" + portsEsc(w.sourceUrl) + "' target='_blank' rel='noopener'>" + portsEsc(w.sourceName) +
          "</a>, " + portsEsc(w.date) + "</p>";
      });

      if (headlines.length) {
        html += "<p class='ports-small'>Possible warnings from the last 7 days. These are headlines, not confirmed events: open the link and read it before acting.</p><ul class='ports-list'>";
        headlines.slice(0, 5).forEach(function (h) {
          html += "<li><a href='" + portsEsc(h.url) + "' target='_blank' rel='noopener'>" + portsEsc(h.title) +
            "</a> <span class='ports-small'>" + portsEsc(h.source) + ", " + portsEsc(h.date) + "</span></li>";
        });
        html += "</ul>";
      }
      if (supText) html += "<p class='ports-small'>" + portsEsc(supText) + "</p>";
      html += "<p class='ports-small'>Check directly: <a href='" + portsEsc(p.officialUrl) +
        "' target='_blank' rel='noopener'>" + portsEsc(p.officialName) + "</a></p></div>";
    });

    if (window.PORTS_NEWS && window.PORTS_NEWS.updated) {
      html += "<p class='ports-small'>News feed last refreshed " + portsEsc(window.PORTS_NEWS.updated.slice(0, 10)) + " (" + portsEsc(window.PORTS_NEWS.updated.slice(11, 16)) + " UTC).</p>";
    }
    box.innerHTML = html;
  }

  // Load the automatic news file first (works with a double-click too), then draw.
  // If the file doesn't exist yet, draw anyway using the manual list only.
  function portsStart() {
    portsRender();
    var tag = document.createElement("script");
    tag.src = "data/ports-news.js";
    tag.onload = portsRender;
    tag.onerror = function () {};
    document.head.appendChild(tag);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", portsStart);
  } else {
    portsStart();
  }

  // Share the manual warnings with the risk and alerts sections (the team's shared list).
  // Unreviewed news headlines are NOT shared: a person must read them and add a real entry above.
  window.JONAGOLD_WARNINGS = window.JONAGOLD_WARNINGS || [];
  portsWarnings.forEach(function (w) {
    if (!w.sourceUrl || !w.date) return;
    window.JONAGOLD_WARNINGS.push({
      type: "ports",
      severity: w.level === "Confirmed" ? "confirmed" : "credible",
      headline: w.summary,
      sourceUrl: w.sourceUrl,
      date: w.date,
      ports: [w.port]
    });
  });
  window.dispatchEvent(new Event("jonagold-warnings"));
})();
