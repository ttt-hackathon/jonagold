/*
 * sections/weather.js: the "Weather and disasters" section (owner: Mitchell).
 *
 * WHAT IT DOES
 *   Fills <div id="weather"> on index.html. It watches for natural disasters near our
 *   suppliers' factories and our two US ports, from two kinds of source:
 *     1. LIVE, checked every time the page opens:
 *          - USGS earthquake feed (worldwide), compared with each factory/port location.
 *          - US National Weather Service severe-weather alerts, for our US sites.
 *     2. CURATED, a short list typed in by a person after reading a news source
 *        (weatherNotes below), used for regions with no free live feed we may reuse.
 *   Every warning shows its source link and date. Nothing is ever invented: if a live
 *   source finds nothing, the page says "nothing found" with the time it checked.
 *
 * HOW IT FITS
 *   Real warnings are added to window.JONAGOLD_WARNINGS (format: top of risk.js and
 *   CLAUDE.md) and the "jonagold-warnings" event is fired, so the Supplier risk and
 *   Alerts sections react.
 *
 * SOURCES AND LICENSES (also recorded in LICENSING.md)
 *   - USGS earthquake feeds: US government work, public domain; credit requested.
 *     https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits
 *   - NWS API (api.weather.gov): US government data, free, no key.
 *     https://www.weather.gov/disclaimer
 *   We deliberately do NOT use GDACS (no clear reuse licence) or Open-Meteo's free
 *   tier (non-commercial only).
 *
 * THE EARTHQUAKE RULE (our own choice, easy to change in QUAKE_RULES)
 *   confirmed: magnitude 6.0 or more within 200 km of a site.
 *   credible:  magnitude 5.0 or more within 300 km of a site.
 *
 * ERRORS
 *   Never throws. If a live source cannot be reached (offline, blocked) the section
 *   says so and carries on with the others.
 */
(function () {
  "use strict";

  /* ---------- 1. CURATED NOTES: the only part a person edits ---------- */
  // Each note must have a real source link and a source date. Set pushToRisk to true only
  // for something still active that could hit supply; false means "recent, shown for context".
  var weatherCheckedOn = "2026-11-03"; // last time someone searched for the curated notes
  var weatherNotes = [
    {
      type: "weather", severity: "credible", pushToRisk: true,
      headline: "Malaysia's weather service expects the Northeast Monsoon (from Oct 27) to bring several episodes of heavy rain and possible floods between November and January; our Shimano factory is in Johor.",
      sourceName: "SAYS (METMalaysia advisory)",
      sourceUrl: "https://says.com/my/news/metmalaysia-warns-of-heavy-rain-floods-heatwaves-during-northeast-monsoon",
      date: "2026-10-27", supplierIds: ["S06"]
    },
    {
      type: "weather", severity: "credible", pushToRisk: false,
      headline: "Typhoon Champi passed Taiwan; the land warning was expected to lift on Oct 24. Taichung (Giant, Fox, Tektro) was among the hit areas. No port closure found, but ask forwarders about any backlog.",
      sourceName: "Focus Taiwan",
      sourceUrl: "https://focustaiwan.tw/society/202610240004",
      date: "2026-10-24", countries: ["Taiwan"]
    }
  ];

  /* ---------- 2. SITES WE WATCH (factory and port locations are public facts) ---------- */
  var SITES = [
    { name: "Taichung, Taiwan (Giant, Fox, Tektro)", lat: 24.15, lon: 120.67, supplierIds: ["S04", "S05", "S08"] },
    { name: "Tainan, Taiwan (KMC)", lat: 22.99, lon: 120.21, supplierIds: ["S07"] },
    { name: "Kaohsiung port, Taiwan (KMC ships from here)", lat: 22.62, lon: 120.30, supplierIds: ["S07"] },
    { name: "Suzhou, China (Bafang)", lat: 31.30, lon: 120.62, supplierIds: ["S03"] },
    { name: "Johor, Malaysia (Shimano)", lat: 1.52, lon: 103.67, supplierIds: ["S06"] },
    { name: "Miskolc, Hungary (Bosch)", lat: 48.10, lon: 20.78, supplierIds: ["S02"] },
    { name: "Korbach, Germany (Continental)", lat: 51.27, lon: 8.87, supplierIds: ["S09"] },
    { name: "Meinerzhagen, Germany (Busch & Muller)", lat: 51.11, lon: 7.64, supplierIds: ["S11"] },
    { name: "Biel, Switzerland (DT Swiss)", lat: 47.14, lon: 7.25, supplierIds: ["S10"] },
    { name: "Pozzoleone, Italy (Selle Royal)", lat: 45.67, lon: 11.63, supplierIds: ["S12"] },
    { name: "Cheonan, South Korea (Samsung SDI cells inside our batteries)", lat: 36.82, lon: 127.15, supplierIds: ["S01"] },
    { name: "Waynesville, NC (Cataloochee)", lat: 35.49, lon: -82.99, supplierIds: ["S01"], us: true },
    { name: "Pleasant Prairie, WI (Uline)", lat: 42.53, lon: -87.91, supplierIds: ["S13"], us: true },
    { name: "Port of Savannah, GA", lat: 32.08, lon: -81.09, ports: ["Savannah"], us: true },
    { name: "Port of Charleston, SC", lat: 32.78, lon: -79.93, ports: ["Charleston"], us: true }
  ];
  var QUAKE_RULES = { confirmed: { mag: 6.0, km: 200 }, credible: { mag: 5.0, km: 300 } };
  var QUAKE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson";

  /* ---------- helpers ---------- */

  /** Escape text so it is safe to put inside HTML. */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Distance in km between two latitude/longitude points (haversine formula). */
  function km(lat1, lon1, lat2, lon2) {
    var r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }

  /** "YYYY-MM-DD" from a millisecond timestamp or ISO text (UTC). */
  function isoDay(v) { return new Date(v).toISOString().slice(0, 10); }

  /** Copy only the shared-format fields of a site's targets onto a warning. */
  function targets(site) {
    var t = {};
    if (site.supplierIds) { t.supplierIds = site.supplierIds; }
    if (site.ports) { t.ports = site.ports; }
    return t;
  }

  /* ---------- live source 1: USGS earthquakes ---------- */

  /**
   * Fetch the USGS "magnitude 4.5+ in the past week" feed and keep quakes that meet
   * QUAKE_RULES near any site.
   * Returns a Promise of an array of warnings in the shared format (plus a "where" label).
   * Rejects if the feed cannot be read.
   */
  function checkQuakes() {
    return fetch(QUAKE_URL).then(function (r) {
      if (!r.ok) { throw new Error("USGS " + r.status); }
      return r.json();
    }).then(function (geo) {
      var out = [];
      (geo.features || []).forEach(function (f) {
        var mag = f.properties.mag, c = f.geometry.coordinates; // [lon, lat, depth]
        SITES.forEach(function (site) {
          var d = km(site.lat, site.lon, c[1], c[0]), sev = null;
          if (mag >= QUAKE_RULES.confirmed.mag && d <= QUAKE_RULES.confirmed.km) { sev = "confirmed"; }
          else if (mag >= QUAKE_RULES.credible.mag && d <= QUAKE_RULES.credible.km) { sev = "credible"; }
          if (!sev) { return; }
          var w = {
            type: "weather", severity: sev,
            headline: "Magnitude " + mag.toFixed(1) + " earthquake, " + Math.round(d) + " km from " + site.name + " (" + f.properties.place + ").",
            sourceUrl: f.properties.url, date: isoDay(f.properties.time), where: site.name, sourceName: "USGS"
          };
          var t = targets(site); for (var k in t) { w[k] = t[k]; }
          out.push(w);
        });
      });
      return out;
    });
  }

  /* ---------- live source 2: US National Weather Service alerts ---------- */

  /**
   * For each US site, fetch active NWS alerts and keep Severe or Extreme ones.
   * "Warning" alerts that are observed/likely count as confirmed; anything else
   * (watches, possible events) counts as credible.
   * Returns a Promise of warnings in the shared format. Individual site failures are skipped;
   * rejects only if every site failed.
   */
  function checkNws() {
    var us = SITES.filter(function (s) { return s.us; });
    var failures = 0;
    return Promise.all(us.map(function (site) {
      var url = "https://api.weather.gov/alerts/active?point=" + site.lat + "," + site.lon;
      return fetch(url, { headers: { Accept: "application/geo+json" } }).then(function (r) {
        if (!r.ok) { throw new Error("NWS " + r.status); }
        return r.json();
      }).then(function (geo) {
        return (geo.features || []).filter(function (f) {
          return f.properties.severity === "Severe" || f.properties.severity === "Extreme";
        }).map(function (f) {
          var p = f.properties;
          var firm = /warning/i.test(p.event) && /observed|likely/i.test(p.certainty || "");
          var w = {
            type: "weather", severity: firm ? "confirmed" : "credible",
            headline: p.event + " near " + site.name + ": " + (p.headline || p.event) + ".",
            sourceUrl: "https://forecast.weather.gov/MapClick.php?lat=" + site.lat + "&lon=" + site.lon,
            date: isoDay(p.sent || p.effective), where: site.name, sourceName: "National Weather Service"
          };
          var t = targets(site); for (var k in t) { w[k] = t[k]; }
          return w;
        });
      }).catch(function () { failures += 1; return []; });
    })).then(function (lists) {
      if (failures === us.length) { throw new Error("NWS unreachable"); }
      return [].concat.apply([], lists);
    });
  }

  /* ---------- drawing ---------- */

  /** Add this section's styles once. All class names start with "weather-". */
  function addStyles() {
    if (document.getElementById("weather-styles")) { return; }
    var el = document.createElement("style");
    el.id = "weather-styles";
    el.textContent =
      ".weather-item{border-top:1px solid #ece9e1;padding:9px 0;font-size:14px}" +
      ".weather-badge{display:inline-block;border-radius:6px;padding:1px 8px;font-size:12px;font-weight:700;margin-right:6px;border:1px solid}" +
      ".weather-confirmed{background:#fde8e6;color:#9b1c13;border-color:#e8a29c}" +
      ".weather-credible{background:#fff1d6;color:#8a4b00;border-color:#e8b56a}" +
      ".weather-context{background:#eef0ee;color:#5b6b62;border-color:#ccd2cd}" +
      ".weather-ok{background:#e3f1e8;border-left:4px solid #1f5c3a;padding:8px 12px;border-radius:6px;font-size:14px;margin:0 0 8px}" +
      ".weather-small{font-size:12px;color:#5b6b62;margin:6px 0 0}";
    document.head.appendChild(el);
  }

  /** HTML for one warning row (live or curated). */
  function itemHtml(w, label) {
    return '<div class="weather-item"><span class="weather-badge weather-' + label.cls + '">' + esc(label.text) + "</span>" +
      esc(w.headline) + ' <a href="' + esc(w.sourceUrl) + '" target="_blank" rel="noopener">' + esc(w.sourceName || "source") +
      "</a>, " + esc(w.date) + "</div>";
  }

  /**
   * Draw the section. liveStatus is { quakes, nws } where each is "ok", "down" or "pending";
   * live is the list of live warnings found so far.
   */
  function render(live, liveStatus) {
    var box = document.getElementById("weather");
    if (!box) { return; }
    addStyles();
    var html = "";

    live.forEach(function (w) {
      html += itemHtml(w, w.severity === "confirmed" ? { cls: "confirmed", text: "Confirmed" } : { cls: "credible", text: "Credible" });
    });
    weatherNotes.forEach(function (w) {
      html += itemHtml(w, w.pushToRisk
        ? (w.severity === "confirmed" ? { cls: "confirmed", text: "Confirmed" } : { cls: "credible", text: "Credible" })
        : { cls: "context", text: "Recent, for context" });
    });

    var now = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
    var status = [];
    status.push("Earthquakes (USGS): " + (liveStatus.quakes === "ok" ? "checked " + now + (live.some(function (w) { return w.sourceName === "USGS"; }) ? "" : ", nothing near our sites") : liveStatus.quakes === "pending" ? "checking..." : "could not be reached"));
    status.push("US severe weather (NWS): " + (liveStatus.nws === "ok" ? "checked " + now + (live.some(function (w) { return w.sourceName === "National Weather Service"; }) ? "" : ", no severe alerts at our US sites") : liveStatus.nws === "pending" ? "checking..." : "could not be reached"));
    html = '<p class="weather-ok">' + status.map(esc).join("<br>") + "</p>" + html +
      '<p class="weather-small">Notes for Asia and Europe were last searched by hand on ' + esc(weatherCheckedOn) +
      ". Check directly: " +
      '<a href="https://www.cwa.gov.tw/eng/" target="_blank" rel="noopener">Taiwan CWA</a>, ' +
      '<a href="https://www.met.gov.my/en/" target="_blank" rel="noopener">METMalaysia</a>, ' +
      '<a href="https://www.dwd.de/EN/" target="_blank" rel="noopener">Germany DWD</a>, ' +
      '<a href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" rel="noopener">USGS map</a>.</p>';
    box.innerHTML = html;
  }

  /* ---------- start up ---------- */

  /** Add valid warnings to the shared list and tell the risk and alerts sections. */
  function publish(list) {
    window.JONAGOLD_WARNINGS = window.JONAGOLD_WARNINGS || [];
    list.forEach(function (w) {
      window.JONAGOLD_WARNINGS.push({
        type: w.type, severity: w.severity, headline: w.headline, sourceUrl: w.sourceUrl, date: w.date,
        supplierIds: w.supplierIds, ports: w.ports, countries: w.countries
      });
    });
    window.dispatchEvent(new Event("jonagold-warnings"));
  }

  function start() {
    var live = [], status = { quakes: "pending", nws: "pending" };
    render(live, status);
    // Curated notes that are still active go to the risk section straight away.
    publish(weatherNotes.filter(function (w) { return w.pushToRisk; }));

    function done(key, list) {
      status[key] = "ok";
      live = live.concat(list);
      render(live, status);
      publish(list);
    }
    function failed(key) { status[key] = "down"; render(live, status); }

    checkQuakes().then(function (l) { done("quakes", l); }, function () { failed("quakes"); });
    checkNws().then(function (l) { done("nws", l); }, function () { failed("nws"); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
