// Fetches recent news about the Savannah and Charleston ports and saves it to data/ports-news.js.
// Run by the GitHub job in .github/workflows/ports-news.yml (needs Node 18 or newer, no key required).
// If a paid news service is added later, read its key from process.env (a GitHub secret), never from a file.
import { writeFileSync } from "node:fs";

const PORTS = {
  Savannah: '("Port of Savannah" OR "Georgia Ports Authority" OR "Garden City Terminal")',
  Charleston: '("Port of Charleston" OR "South Carolina Ports" OR "SC Ports Authority" OR "Wando Welch" OR "Leatherman Terminal")',
};
const TROUBLE = '(congestion OR strike OR closure OR closed OR delays OR backlog OR shutdown OR "work stoppage" OR hurricane OR "tropical storm" OR "vessel backup")';
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(portQuery) {
  const q = `${portQuery} ${TROUBLE} sourcelang:english`;
  const url = "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json&maxrecords=15&sort=datedesc&timespan=7d&query=" + encodeURIComponent(q);
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (res.ok) {
        try { return (JSON.parse(text).articles || []); } catch { return []; }
      }
    } catch { /* connection problem: wait and retry */ }
    await SLEEP(6000 * attempt); // busy: wait and retry
  }
  throw new Error("News service did not answer for: " + portQuery);
}

// GDELT dates look like 20261103T143000Z -> 2026-11-03
const toDate = (s) => (s && s.length >= 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : "");

const result = { updated: new Date().toISOString(), failed: false, ports: {} };
for (const [port, query] of Object.entries(PORTS)) {
  try {
    const articles = await search(query);
    const seen = new Set();
    result.ports[port] = articles
      .filter((a) => a.url && a.title && !seen.has(a.title) && seen.add(a.title))
      .map((a) => ({ title: a.title, url: a.url, source: a.domain, date: toDate(a.seendate) }));
  } catch (e) {
    console.error(String(e));
    result.failed = true;
    result.ports[port] = null; // null = could not check
  }
  await SLEEP(6000);
}

writeFileSync(
  "data/ports-news.js",
  "// Written automatically by scripts/fetch-ports-news.mjs. Do not edit by hand.\nwindow.PORTS_NEWS = " + JSON.stringify(result, null, 2) + ";\n"
);
console.log(JSON.stringify(result, null, 2));
