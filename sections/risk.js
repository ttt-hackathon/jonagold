/*
 * sections/risk.js: the "Supplier risk" section (owner: Mitchell).
 *
 * WHAT IT DOES
 *   Draws one row per supplier (all 13) into <div id="risk"> on index.html, with a
 *   risk level (Red / Amber / Green) and the reason. It also shows each supplier's
 *   most exposed part: how many weeks of stock we have and whether the next
 *   shipment arrives before we run out.
 *
 * HOW IT FITS
 *   - Purchasing data comes from window.LAUREL_RIDGE (data/laurel-ridge-data.js).
 *   - Live warnings come from the other sections (weather, news, ports). They add
 *     their warnings to window.JONAGOLD_WARNINGS (see "WARNING FORMAT" below) and
 *     fire a "jonagold-warnings" event on window. This file listens and redraws.
 *   - alerts.js (also Mitchell's) can call window.JONAGOLD_RISK.compute() to get the
 *     same levels, so the two sections never disagree.
 *
 * THE RULE (agreed in CLAUDE.md)
 *   Red   = a CONFIRMED warning hits the supplier AND one of its parts has less than
 *           5 weeks of stock OR is an only-source part.
 *   Amber = a credible warning, or a confirmed warning where every part has plenty
 *           of stock and a second source, OR (no warning needed) a part is projected
 *           to run out BEFORE its next shipment arrives ("stock watch").
 *   Green = no current warning and no stock shortfall.
 *   Stock alone can only ever make a supplier Amber, never Red: Red always needs a
 *   real, sourced, confirmed warning.
 *
 * WARNING FORMAT (what weather.js, news.js and ports.js must produce)
 *   Each item pushed onto window.JONAGOLD_WARNINGS is an object:
 *     {
 *       type:        "weather" | "news" | "ports",
 *       severity:    "confirmed" | "credible",
 *       headline:    "One plain-English sentence about what happened",
 *       sourceUrl:   "https://...",          // real link, required
 *       date:        "YYYY-MM-DD",           // date of the source, required
 *       supplierIds: ["S04", "S08"],         // optional: suppliers hit directly
 *       ports:       ["Savannah"],           // optional: hits suppliers landing there
 *       countries:   ["Taiwan"]              // optional: hits suppliers built there
 *     }
 *   At least one of supplierIds, ports or countries is needed. Items with no source
 *   link, no valid date or no target are ignored (house rule: every warning needs a
 *   real source and date).
 *
 * ERRORS
 *   Never throws on bad input: if the data file is missing it logs a console note and
 *   draws nothing; bad warnings are skipped with a console note.
 */
(function () {
  "use strict";

  var DATA = window.LAUREL_RIDGE;
  var CLOSE_STOCK_WEEKS = 5; // "less than about 5 weeks of stock" from the plan
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY_MS = 86400000;

  // Share the (initially empty) warning list with the other sections, whatever the load order.
  window.JONAGOLD_WARNINGS = window.JONAGOLD_WARNINGS || [];

  /* ---------- small helpers ---------- */

  /** Escape text so it is safe to put inside HTML. */
  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Return the URL only if it is a normal web link (blocks javascript: links); else "". */
  function safeUrl(url) {
    return /^https?:\/\//i.test(String(url || "")) ? String(url) : "";
  }

  /** Turn "YYYY-MM-DD" into a day number in milliseconds (UTC), or NaN if invalid. */
  function parseDay(text) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ""));
    if (!m) { return NaN; }
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return isNaN(t) ? NaN : t;
  }

  /** Format a UTC millisecond day number as "Nov 23". */
  function fmtDay(ms) {
    var d = new Date(ms);
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
  }

  /* ---------- stock position of each part ---------- */

  /**
   * Work out the stock position of one part.
   * Input: a part row from DATA.parts.
   * Output: { part, name, weeks, runOut, nextArrival, shortDays, onlySource, bikes }
   *   weeks       weeks of stock on hand (inventory.csv weeks_of_cover)
   *   runOut      day number when stock hits zero at normal usage
   *   nextArrival day number of the earliest open order, or null if none
   *   shortDays   days between running out and the next shipment (0 if it lands in time)
   *   bikes       names of the bike models that use the part
   * Returns null if the part has no inventory row.
   */
  function partPosition(part) {
    var inv = DATA.inventory.filter(function (i) { return i.part_number === part.part_number; })[0];
    if (!inv) { return null; }
    var asOf = parseDay(inv.as_of) || parseDay(DATA.asOf);
    var runOut = asOf + inv.weeks_of_cover * 7 * DAY_MS;

    var arrivals = DATA.openOrders
      .filter(function (o) { return o.part_number === part.part_number; })
      .map(function (o) { return parseDay(o.promised_arrival_date); })
      .filter(function (t) { return !isNaN(t); });
    var nextArrival = arrivals.length ? Math.min.apply(null, arrivals) : null;

    var bikeIds = {};
    DATA.bom.forEach(function (b) { if (b.part_number === part.part_number) { bikeIds[b.product_id] = true; } });
    var bikes = DATA.products
      .filter(function (p) { return bikeIds[p.product_id]; })
      .map(function (p) { return p.product_name; });

    return {
      part: part.part_number,
      name: part.description,
      weeks: inv.weeks_of_cover,
      runOut: runOut,
      nextArrival: nextArrival,
      shortDays: nextArrival === null ? 0 : Math.max(0, Math.round((nextArrival - runOut) / DAY_MS)),
      onlySource: part.only_source === "Yes",
      bikes: bikes
    };
  }

  /** True if a part counts as "exposed" under the rule: under 5 weeks of stock or only source. */
  function isExposed(pos) {
    return pos.weeks < CLOSE_STOCK_WEEKS || pos.onlySource;
  }

  /* ---------- warnings ---------- */

  /**
   * Return the warnings that pass the house rule (real source link and a valid date,
   * a valid severity, and at least one target). Others are skipped with a console note.
   */
  function validWarnings() {
    return window.JONAGOLD_WARNINGS.filter(function (w) {
      var hasTarget = w && ((w.supplierIds && w.supplierIds.length) || (w.ports && w.ports.length) || (w.countries && w.countries.length));
      var ok = w && (w.severity === "confirmed" || w.severity === "credible") &&
        w.headline && safeUrl(w.sourceUrl) && !isNaN(parseDay(w.date)) && hasTarget;
      if (!ok) { console.warn("risk.js: skipped a warning that is missing a source link, date, severity or target.", w); }
      return ok;
    });
  }

  /** Does warning w hit supplier s (directly, through its US port, or through its country)? */
  function hits(w, s) {
    var direct = (w.supplierIds || []).indexOf(s.supplier_id) !== -1;
    var port = (w.ports || []).some(function (p) {
      return String(s.us_port_of_entry).toLowerCase().indexOf(String(p).toLowerCase()) !== -1;
    });
    var country = (w.countries || []).some(function (c) {
      return String(s.factory_country).toLowerCase() === String(c).toLowerCase();
    });
    return direct || port || country;
  }

  /* ---------- the risk calculation (shared with alerts.js) ---------- */

  /**
   * Work out the risk for every supplier.
   * Output: array (Red first, then Amber, then Green; tightest stock first within a level)
   * of { supplier, level, warnings, exposed, positions, worst } where
   *   level      "red" | "amber" | "green"
   *   warnings   the valid warnings that hit this supplier
   *   exposed    this supplier's parts that are under 5 weeks of stock or only-source
 *   short      this supplier's parts that run out before their next shipment arrives
   *   positions  stock position of each of its parts
   *   worst      the single most exposed part (longest shortfall, then least stock)
   */
  function compute() {
    var warnings = validWarnings();
    var rank = { red: 0, amber: 1, green: 2 };

    var rows = DATA.suppliers.map(function (s) {
      var positions = DATA.parts
        .filter(function (p) { return p.supplier_id === s.supplier_id; })
        .map(partPosition)
        .filter(Boolean);
      var exposed = positions.filter(isExposed);
      var mine = warnings.filter(function (w) { return hits(w, s); });
      var confirmed = mine.some(function (w) { return w.severity === "confirmed"; });

      // Parts projected to run out before their next shipment lands (stock watch).
      var short = positions.filter(function (p) { return p.shortDays > 0; });

      var level = "green";
      if (confirmed && exposed.length) { level = "red"; }
      else if (mine.length || short.length) { level = "amber"; }

      var worst = positions.slice().sort(function (a, b) {
        return (b.shortDays - a.shortDays) || (a.weeks - b.weeks);
      })[0] || null;

      return { supplier: s, level: level, warnings: mine, exposed: exposed, short: short, positions: positions, worst: worst };
    });

    return rows.sort(function (a, b) {
      return (rank[a.level] - rank[b.level]) ||
        ((b.worst ? b.worst.shortDays : 0) - (a.worst ? a.worst.shortDays : 0)) ||
        ((a.worst ? a.worst.weeks : 99) - (b.worst ? b.worst.weeks : 99));
    });
  }

  /* ---------- drawing ---------- */

  var LABEL = { red: "Red", amber: "Amber", green: "Green" };
  var ICON = { red: "▲", amber: "●", green: "✔" }; // shape + word, so colour is never the only signal

  /** Add this section's styles once. All class names start with "risk-". */
  function addStyles() {
    if (document.getElementById("risk-styles")) { return; }
    var css =
      ".risk-wrap{overflow-x:auto}" +
      ".risk-summary{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px}" +
      ".risk-chip{border-radius:999px;padding:4px 12px;font-weight:700;font-size:14px;border:1px solid}" +
      ".risk-notice{background:#eef4f0;border-left:4px solid #2f6b4f;padding:8px 12px;margin:0 0 12px;font-size:14px;border-radius:6px}" +
      ".risk-table{width:100%;border-collapse:collapse;font-size:14px}" +
      ".risk-table th{text-align:left;font-size:12px;color:#5b6b62;padding:6px 10px;border-bottom:2px solid #ddd8cc;white-space:nowrap}" +
      ".risk-table td{vertical-align:top;padding:9px 10px;border-bottom:1px solid #ece9e1}" +
      ".risk-name{font-weight:700}" +
      ".risk-sub{color:#5b6b62;font-size:12px}" +
      ".risk-badge{display:inline-block;border-radius:6px;padding:2px 9px;font-weight:700;font-size:13px;white-space:nowrap;border:1px solid}" +
      ".risk-red{background:#fde8e6;color:#9b1c13;border-color:#e8a29c}" +
      ".risk-amber{background:#fff1d6;color:#8a4b00;border-color:#e8b56a}" +
      ".risk-green{background:#e3f1e8;color:#1f5c3a;border-color:#9cc9ac}" +
      ".risk-short{color:#9b1c13;font-weight:700}" +
      ".risk-why ul{margin:0;padding-left:18px}" +
      ".risk-why li{margin-bottom:3px}";
    var el = document.createElement("style");
    el.id = "risk-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /** Plain-English "why" cell: the warnings (with source and date) or "no current warning". */
  function whyHtml(r) {
    if (!r.warnings.length) {
      if (!r.short.length) { return "No current warning."; }
      return "<b>Stock watch:</b> " + r.short.map(function (p) {
        return esc(p.name) + " runs out about " + esc(fmtDay(p.runOut)) + ", " + p.shortDays +
          (p.shortDays === 1 ? " day" : " days") + " before the next shipment (" + esc(fmtDay(p.nextArrival)) + ")";
      }).join("; ") + ".<div class=\"risk-sub\">Amber because of the stock gap alone; no outside warning yet.</div>";
    }
    var items = r.warnings.map(function (w) {
      return "<li><b>" + (w.severity === "confirmed" ? "Confirmed" : "Credible") + ":</b> " + esc(w.headline) +
        ' (<a href="' + esc(safeUrl(w.sourceUrl)) + '" target="_blank" rel="noopener">source</a>, ' +
        esc(fmtDay(parseDay(w.date))) + ")</li>";
    });
    var because = "";
    if (r.level === "red") {
      because = "<div class=\"risk-sub\">Red because " + r.exposed.map(function (p) {
        return esc(p.name) + (p.weeks < CLOSE_STOCK_WEEKS ? " has only " + p.weeks.toFixed(1) + " weeks of stock" : " has no other approved source");
      }).join("; ") + ".</div>";
    } else if (r.warnings.every(function (w) { return w.severity === "credible"; })) {
      because = "<div class=\"risk-sub\">Amber because the warning is credible but not yet confirmed.</div>";
    } else {
      because = "<div class=\"risk-sub\">Amber because stock is healthy and there is a second source.</div>";
    }
    return "<ul>" + items.join("") + "</ul>" + because;
  }

  /** Plain-English "stock" cell for the supplier's most exposed part. */
  function stockHtml(r) {
    var p = r.worst;
    if (!p) { return "No stock data."; }
    var text = "<b>" + esc(p.name) + "</b>" + (p.onlySource ? " <span class=\"risk-sub\">(only source)</span>" : "") +
      "<br>" + p.weeks.toFixed(1) + " weeks of stock, out about " + esc(fmtDay(p.runOut)) + ".<br>";
    if (p.nextArrival === null) {
      text += "<span class=\"risk-short\">No open order.</span>";
    } else if (p.shortDays > 0) {
      text += "<span class=\"risk-short\">Next shipment " + esc(fmtDay(p.nextArrival)) + ": about " + p.shortDays + (p.shortDays === 1 ? " day" : " days") + " too late.</span>";
    } else {
      text += "Next shipment " + esc(fmtDay(p.nextArrival)) + ", in time.";
    }
    return text + "<br><span class=\"risk-sub\">Used in: " + esc(p.bikes.join(", ")) + "</span>";
  }

  /** Draw (or redraw) the whole section into <div id="risk">. Does nothing if the box is missing. */
  function render() {
    var box = document.getElementById("risk");
    if (!box || !DATA) { return; }
    addStyles();
    var rows = compute();
    var counts = { red: 0, amber: 0, green: 0 };
    rows.forEach(function (r) { counts[r.level] += 1; });

    var html = '<div class="risk-summary">' +
      ["red", "amber", "green"].map(function (l) {
        return '<span class="risk-chip risk-' + l + '">' + ICON[l] + " " + counts[l] + " " + LABEL[l] + "</span>";
      }).join("") + "</div>";

    if (!validWarnings().length) {
      html += '<p class="risk-notice">No live warnings have been loaded yet. Any Amber below comes from stock alone (a part running out before its next shipment); ' +
        "nothing is Red until a confirmed warning arrives.</p>";
    }

    html += '<div class="risk-wrap"><table class="risk-table"><thead><tr>' +
      "<th>Supplier</th><th>Risk</th><th>Why</th><th>Most exposed part</th></tr></thead><tbody>" +
      rows.map(function (r) {
        var s = r.supplier;
        return "<tr><td><div class=\"risk-name\">" + esc(s.supplier_name) + "</div>" +
          '<div class="risk-sub">' + esc(s.factory_city) + ", " + esc(s.factory_country) + "<br>" + esc(s.parts_supplied) + "</div></td>" +
          '<td><span class="risk-badge risk-' + r.level + '">' + ICON[r.level] + " " + LABEL[r.level] + "</span></td>" +
          '<td class="risk-why">' + whyHtml(r) + "</td>" +
          "<td>" + stockHtml(r) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="risk-sub" style="margin-top:8px">Stock figures are as of ' + esc(fmtDay(parseDay(DATA.asOf))) +
      ", assuming normal production and that every shipment arrives on its promised date.</p>";

    box.innerHTML = html;
  }

  /* ---------- start up ---------- */

  window.JONAGOLD_RISK = { compute: compute };

  if (!DATA) {
    console.warn("risk.js: window.LAUREL_RIDGE is missing, so the risk section was not drawn.");
    return;
  }
  window.addEventListener("jonagold-warnings", render); // other sections fire this after adding warnings
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
