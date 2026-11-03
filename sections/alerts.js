/*
 * sections/alerts.js: the "Alerts" section (owner: Mitchell).
 *
 * WHAT IT DOES
 *   Fills <div id="alerts"> on index.html with:
 *     1. The alert rule, in plain English.
 *     2. A ready-to-send email to the purchasing team for every RED supplier, with
 *        a "Copy email" button and an "Open in my email app" link.
 *     3. A short "watching" line listing Amber suppliers (no email for those).
 *   If nothing is Red, it says so plainly. It never makes up an alert.
 *
 * HOW IT FITS
 *   The risk levels come from sections/risk.js (window.JONAGOLD_RISK.compute()), so
 *   this section can never disagree with the Supplier risk table. It redraws when
 *   other sections announce new warnings (the "jonagold-warnings" event on window).
 *   The warning format is described at the top of sections/risk.js.
 *
 * THE EMAIL (agreed in CLAUDE.md)
 *   1. What happened, in one sentence, with source link and date.
 *   2. Which supplier and parts are affected, and which bikes use them.
 *   3. Weeks of stock left, compared with when the next shipment is due.
 *   4. What to do, chosen to fit the situation.
 *   The "To:" address is left blank on purpose: we don't know the purchasing team's
 *   address, and the repository is public, so none is stored here.
 *
 * ERRORS
 *   Never throws. If the data file or risk.js is missing it shows a short message
 *   inside its box instead.
 */
(function () {
  "use strict";

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY_MS = 86400000;

  /* ---------- helpers ---------- */

  /** Escape text so it is safe to put inside HTML. */
  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Turn "YYYY-MM-DD" into UTC milliseconds, or NaN. */
  function parseDay(text) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ""));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }

  /** Format UTC milliseconds as "Nov 23". */
  function fmtDay(ms) {
    var d = new Date(ms);
    return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
  }

  /** "1 day" / "5 days". */
  function days(n) { return n + (n === 1 ? " day" : " days"); }

  /* ---------- building the email ---------- */

  /**
   * Open orders for one part, as text lines for the email.
   * Input: a part number. Output: array of strings (empty if no open orders).
   */
  function orderLines(partNumber) {
    return window.LAUREL_RIDGE.openOrders
      .filter(function (o) { return o.part_number === partNumber; })
      .map(function (o) {
        return o.po_number + ": " + o.quantity + " units, " + o.status.toLowerCase() +
          ", due " + fmtDay(parseDay(o.promised_arrival_date));
      });
  }

  /**
   * Pick the recommended actions to fit this supplier's situation.
   * Input: one row from JONAGOLD_RISK.compute() (a Red supplier).
   * Output: array of plain-English action sentences, most urgent first.
   */
  function actionsFor(r) {
    var s = r.supplier;
    var acts = [];
    var tight = r.exposed.filter(function (p) { return p.shortDays > 0 || p.weeks < 5; });
    var late = r.positions.filter(function (p) { return p.shortDays > 0; });
    var ocean = /ocean/i.test(s.shipping_route);

    acts.push("Call " + s.supplier_name + " today to confirm whether production and shipping are affected, and get a firm date for anything on order.");

    if (late.length || tight.length) {
      acts.push(ocean
        ? "Ask the freight forwarder or carrier to expedite or reroute open shipments (our port of entry is " + s.us_port_of_entry + "), starting with parts that run out before their next shipment."
        : "Ask for the next delivery to be pulled forward by truck.");
      acts.push("Consider placing an extra order now for the parts listed above, or ask " + s.supplier_name + " to pull forward the next shipment.");
    }

    var noBackup = r.exposed.filter(function (p) { return p.onlySource; });
    if (noBackup.length) {
      acts.push("No second approved source exists for " + noBackup.map(function (p) { return p.name; }).join(", ") +
        ". Start talking to a backup supplier now, and plan which bike builds to protect first if supply is cut.");
    } else {
      acts.push("A second approved source exists for these parts; ask it to take extra volume.");
    }
    return acts;
  }

  /**
   * Build the email for one Red supplier.
   * Input: one row from JONAGOLD_RISK.compute().
   * Output: { subject, body } as plain text.
   */
  function buildEmail(r) {
    var s = r.supplier;
    var confirmed = r.warnings.filter(function (w) { return w.severity === "confirmed"; });
    var lead = confirmed[0] || r.warnings[0];
    var lines = [];

    lines.push("Hello purchasing team,", "");
    lines.push("WHAT HAPPENED");
    r.warnings.forEach(function (w) {
      lines.push("- " + (w.severity === "confirmed" ? "Confirmed" : "Credible") + ": " + w.headline);
      lines.push("  Source: " + w.sourceUrl + " (" + fmtDay(parseDay(w.date)) + ")");
    });

    lines.push("", "WHO IS AFFECTED");
    lines.push("Supplier: " + s.supplier_name + " (" + s.factory_city + ", " + s.factory_country + ")");
    r.positions.forEach(function (p) {
      lines.push("- " + p.name + (p.onlySource ? " (only source)" : "") + ", used in: " + p.bikes.join(", "));
    });

    lines.push("", "HOW MUCH STOCK WE HAVE");
    r.positions.forEach(function (p) {
      var next;
      if (p.nextArrival === null) { next = "no open order"; }
      else if (p.shortDays > 0) { next = "next shipment " + fmtDay(p.nextArrival) + ", which is " + days(p.shortDays) + " too late"; }
      else { next = "next shipment " + fmtDay(p.nextArrival) + ", in time"; }
      lines.push("- " + p.name + ": " + p.weeks.toFixed(1) + " weeks of stock, runs out about " + fmtDay(p.runOut) + "; " + next + ".");
      orderLines(p.part).forEach(function (l) { lines.push("    " + l); });
    });

    lines.push("", "WHAT TO DO");
    actionsFor(r).forEach(function (a, i) { lines.push((i + 1) + ". " + a); });

    lines.push("", "Stock figures are as of " + fmtDay(parseDay(window.LAUREL_RIDGE.asOf)) +
      " and assume normal production and on-time shipments.",
      "Sent from the Team Jonagold supplier early-warning dashboard.");

    return {
      subject: "RED ALERT: " + s.supplier_name + " - " + lead.headline,
      body: lines.join("\n")
    };
  }

  /* ---------- drawing ---------- */

  /** Add this section's styles once. All class names start with "alerts-". */
  function addStyles() {
    if (document.getElementById("alerts-styles")) { return; }
    var css =
      ".alerts-none{background:#e3f1e8;border-left:4px solid #1f5c3a;padding:10px 14px;border-radius:6px;margin:0 0 12px}" +
      ".alerts-card{border:2px solid #e8a29c;background:#fff8f7;border-radius:10px;padding:14px 16px;margin:0 0 14px}" +
      ".alerts-card h3{margin:0 0 4px;font-size:17px;color:#9b1c13}" +
      ".alerts-sub{color:#5b6b62;font-size:13px;margin:0 0 8px}" +
      ".alerts-field{font-size:14px;margin:0 0 6px}" +
      ".alerts-body{width:100%;min-height:260px;font:13px/1.45 ui-monospace,Consolas,monospace;border:1px solid #ddd8cc;border-radius:6px;padding:8px;background:#fff;color:#1f2a24}" +
      ".alerts-buttons{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px}" +
      ".alerts-btn{border:1px solid #2f6b4f;background:#2f6b4f;color:#fff;border-radius:6px;padding:7px 14px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}" +
      ".alerts-btn.alerts-alt{background:#fff;color:#2f6b4f}" +
      ".alerts-copied{font-size:13px;color:#1f5c3a;font-weight:600}" +
      ".alerts-watch{font-size:14px;margin:8px 0}" +
      ".alerts-rule{font-size:14px;margin-top:10px}" +
      ".alerts-rule summary{cursor:pointer;font-weight:600}" +
      ".alerts-rule ul{margin:6px 0 0;padding-left:20px}";
    var el = document.createElement("style");
    el.id = "alerts-styles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  /** Copy text to the clipboard. Falls back to select-and-copy for older or file:// pages. */
  function copyText(text, textarea, done) {
    function fallback() {
      textarea.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* user can copy by hand */ }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /** The plain-English rule box shown at the bottom of the section. */
  function ruleHtml() {
    return '<details class="alerts-rule"><summary>How an alert is decided</summary><ul>' +
      "<li><b>Red (email):</b> a confirmed event hits a supplier or port, <i>and</i> a part from that supplier has under about 5 weeks of stock or has no other approved source.</li>" +
      "<li><b>Amber (watch):</b> a credible but unconfirmed warning, a confirmed event where stock is healthy and a second source exists, or a part due to run out before its next shipment arrives.</li>" +
      "<li><b>Green:</b> nothing current.</li>" +
      "<li>Every warning needs a real source link and date, or it is ignored.</li></ul></details>";
  }

  /** Draw (or redraw) the section. Does nothing if the box is missing. */
  function render() {
    var box = document.getElementById("alerts");
    if (!box) { return; }
    addStyles();
    if (!window.LAUREL_RIDGE || !window.JONAGOLD_RISK) {
      box.innerHTML = "<p>Alerts can't load: the purchasing data or the risk section is missing.</p>";
      return;
    }

    var rows = window.JONAGOLD_RISK.compute();
    var reds = rows.filter(function (r) { return r.level === "red"; });
    var ambers = rows.filter(function (r) { return r.level === "amber"; });
    var html = "";

    if (!reds.length) {
      html += '<p class="alerts-none"><b>No red alerts right now.</b> No confirmed event is hitting a supplier with thin stock or no second source.</p>';
    }

    reds.forEach(function (r, i) {
      var mail = buildEmail(r);
      html += '<div class="alerts-card">' +
        "<h3>▲ RED: " + esc(r.supplier.supplier_name) + "</h3>" +
        '<p class="alerts-sub">Ready to send to the purchasing team. Check it, then copy it into your email.</p>' +
        '<p class="alerts-field"><b>Subject:</b> ' + esc(mail.subject) + "</p>" +
        '<textarea class="alerts-body" id="alerts-body-' + i + '" readonly>' + esc(mail.body) + "</textarea>" +
        '<div class="alerts-buttons">' +
        '<button class="alerts-btn" type="button" data-alerts-copy="' + i + '">Copy email</button>' +
        '<a class="alerts-btn alerts-alt" href="mailto:?subject=' + encodeURIComponent(mail.subject) +
        "&body=" + encodeURIComponent(mail.body) + '">Open in my email app</a>' +
        '<span class="alerts-copied" id="alerts-copied-' + i + '"></span></div></div>';
    });

    if (ambers.length) {
      html += '<p class="alerts-watch"><b>● Watching (Amber, no email):</b> ' +
        ambers.map(function (r) { return esc(r.supplier.supplier_name); }).join(", ") + ".</p>";
    }

    box.innerHTML = html + ruleHtml();

    // Wire up the copy buttons (rebuilt on every draw, so no duplicate listeners).
    Array.prototype.forEach.call(box.querySelectorAll("[data-alerts-copy]"), function (btn) {
      btn.addEventListener("click", function () {
        var i = btn.getAttribute("data-alerts-copy");
        var area = document.getElementById("alerts-body-" + i);
        copyText(area.value, area, function () {
          document.getElementById("alerts-copied-" + i).textContent = "Copied.";
        });
      });
    });
  }

  /* ---------- start up ---------- */

  // risk.js loads after this file, so wait until the whole page has loaded before the first draw.
  window.addEventListener("jonagold-warnings", render);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
