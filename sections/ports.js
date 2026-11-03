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
  // level: "Amber" = credible warning that could become a problem,
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
      var badgeClass = level === "Green" ? "ports-green" : "ports-amber";
      var badgeText = level === "Green" ? "Green: nothing current" : (level === "Confirmed" ? "Event confirmed" : "Amber: watch");

      html += "<div class='ports-port'><div class='ports-head'>" +
        "<span class='ports-name'>" + portsEsc(p.name) + ", " + portsEsc(p.state) + "</span>" +
        "<span class='ports-badge " + badgeClass + "'>" + badgeText + "</span></div>";

      if (items.length === 0) {
        html += "<p class='ports-text'>No current congestion, strike or closure found in the latest check.</p>";
      }
      items.forEach(function (w) {
        html += "<p class='ports-text'><strong>" + portsEsc(w.kind) + ":</strong> " + portsEsc(w.summary) +
          " <a href='" + portsEsc(w.sourceUrl) + "' target='_blank' rel='noopener'>" + portsEsc(w.sourceName) +
          "</a>, " + portsEsc(w.date) + "</p>";
      });

      if (supText) html += "<p class='ports-small'>" + portsEsc(supText) + "</p>";
      html += "<p class='ports-small'>Check directly: <a href='" + portsEsc(p.officialUrl) +
        "' target='_blank' rel='noopener'>" + portsEsc(p.officialName) + "</a></p></div>";
    });

    box.innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", portsRender);
  } else {
    portsRender();
  }

  // Lets the risk and alerts sections read the port warnings.
  window.PORTS_WARNINGS = portsWarnings;
})();
