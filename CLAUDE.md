# Workshop house rules

- We are business people, not programmers. Explain what you're doing in plain English.
- These are real companies. Never invent an event or show sample alerts about them.
  Every warning needs a real source link and date. For test data, use only
  Cataloochee Cell Works.
- Never write our API key into any file. This repository is public.
- Everything must work with a double-click on index.html and also at our live link.
- When we say "save to GitHub", commit and push with a short note.
  When we say "get the latest", pull first.

## How our dashboard fits together

Our team builds ONE dashboard together. Each person owns one section of it.

- index.html is the dashboard: the page frame, the layout and an empty box for each
  section. Only the dashboard owner edits it.
- Each section lives in its own file in the sections folder, such as
  sections/weather.js. Only that section's owner edits it.
- A section file draws its content into the box on index.html with the same name.
  For example, sections/weather.js fills <div id="weather">. index.html loads every
  section with a line like <script src="sections/weather.js"></script>.
- If a section's box isn't on index.html yet, the section should still load
  without errors; it simply shows up once the dashboard owner adds the box.
- Our purchasing data is in data/laurel-ridge-data.js, available as
  window.LAUREL_RIDGE. index.html loads it before any section. Use it instead of
  reading the CSV files, so everything works with a double-click.
- Keep each section's styles inside its own file, with names that start with the
  section's name, so sections don't change each other's look.

## Our team's plan

### Goal

An early-warning dashboard that spots supply chain trouble at our 13 suppliers
(data/suppliers.csv) before it stops the production line, and raises an alert.
Every supplier is covered, every warning shows its source link and date, and every
supplier gets a risk level with the reason.

### What we watch

1. Weather and natural disasters near supplier factories and ports (typhoons,
   quakes, floods). Taiwan matters most: four suppliers sit in Taichung, Tainan
   and Kaohsiung.
2. News about each supplier (fires, strikes, shutdowns, recalls, financial trouble).
   Include South Korea news for Samsung SDI, whose cells go into Cataloochee's batteries.
3. Port and shipping trouble at Savannah and Charleston (congestion, strikes, closures).

We decided NOT to watch trade rules or tariffs.

### Risk levels and alert rule

- Red (alert and email): a confirmed event hits a supplier or port AND the affected
  part has less than about 5 weeks of stock (inventory.csv weeks_of_cover) OR has no
  other approved source (parts.csv only_source = Yes).
- Amber (watch): a credible warning that could become a problem, or a confirmed
  event at a supplier whose parts have plenty of stock, or (even with no warning) a
  part projected to run out before its next shipment arrives. Stock alone never
  makes a supplier Red.
- Green: nothing current.

### Alert email to purchasing (sent for every Red)

1. What happened, in one sentence, with source link and date.
2. Which supplier and parts are affected, and which bikes use them.
3. Weeks of stock left, compared with when the next shipment is due (open_orders.csv).
4. What to do, chosen to fit: call the supplier, ask the carrier to expedite or
   reroute, place an extra order, or start talking to a backup supplier if one exists.

### Dashboard sections and owners

Ownership is split between Mitchell and Jeremy. Mitchell has the page frame, the risk
overview and the alerts. Jeremy has the three warning-sign sections (weather, news, ports).
Only one workstation was working at first; if more people join, they put their name next
to a section and take it over.

| Box id (index.html) | File | What it shows | Owner |
| --- | --- | --- | --- |
| (page frame) | index.html | Layout, one empty box per section below | Mitchell |
| risk | sections/risk.js | All 13 suppliers with risk level and why | Mitchell |
| weather | sections/weather.js | Weather and disaster warnings | Jeremy |
| news | sections/news.js | Supplier news warnings | Jeremy |
| ports | sections/ports.js | Savannah and Charleston port and shipping warnings | Jeremy |
| alerts | sections/alerts.js | The alert rule and the ready-to-send email | Mitchell |

### How the warning sections feed the risk and alert sections

Weather, news and ports each add their warnings to one shared list, and the risk and
alerts sections read it. Each warning is an object with these fields:

- type: "weather", "news" or "ports"
- severity: "confirmed" (it has happened) or "credible" (a real warning, not yet confirmed)
- headline: one plain-English sentence about what happened
- sourceUrl: the real link (required)
- date: the source's date as YYYY-MM-DD (required)
- who it hits, at least one of: supplierIds (such as ["S04"]), ports (such as
  ["Savannah"]), countries (such as ["Taiwan"])

To add warnings, a section does two things:

    window.JONAGOLD_WARNINGS = window.JONAGOLD_WARNINGS || [];
    window.JONAGOLD_WARNINGS.push({ ...warning... });
    window.dispatchEvent(new Event("jonagold-warnings"));

Warnings without a source link or valid date are ignored. See the top of
sections/risk.js for the full description. For test warnings, only use Cataloochee
Cell Works (S01) and label them "TEST ONLY".

### TEMPORARY: instructions for Jeremy's Claude (follow in order, then tell Jeremy what you did)

Jeremy owns sections/weather.js, sections/news.js and sections/ports.js. Mitchell owns
index.html, sections/risk.js and sections/alerts.js. Two things need reconciling.
Mitchell will delete this whole block from CLAUDE.md once both are confirmed done.

**Problem 1: index.html was edited by Jeremy's side, and the two versions collided.**
Mitchell's version is the one the team keeps. It was already merged into the main branch.

1. Say "Get the latest from GitHub": run `git pull`.
2. If git reports a conflict in index.html, or Jeremy has unsaved local edits to
   index.html, throw Jeremy's version away and take the main branch's version:
   `git checkout origin/main -- index.html`
   (Use exactly this command: it works whether git is merging or rebasing, where the
   words "ours" and "theirs" mean opposite things.) Then `git add index.html` and finish
   with `git merge --continue` or `git rebase --continue`, whichever git asks for.
3. Check no conflict markers are left anywhere: `grep -rn "<<<<<<<" .` must print nothing.
4. From now on, never edit index.html, sections/risk.js or sections/alerts.js. If a box
   on the dashboard needs to change, tell Jeremy to ask Mitchell.

**Problem 2: sections/ports.js keeps its warnings in its own format, so the Supplier
risk and Alerts sections cannot see them.** Fix ports.js (Jeremy's file) like this:

1. Keep the `portsWarnings` list and the way entries are written. Do not add any
   invented events: every entry still needs a real source link and date.
2. At the bottom, delete the line `window.PORTS_WARNINGS = portsWarnings;` (nothing
   reads it) and put this in its place, inside the same function:

       // Share warnings with the risk and alerts sections (format: see CLAUDE.md).
       window.JONAGOLD_WARNINGS = window.JONAGOLD_WARNINGS || [];
       portsWarnings.forEach(function (w) {
         window.JONAGOLD_WARNINGS.push({
           type: "ports",
           severity: w.level === "Confirmed" ? "confirmed" : "credible",
           headline: w.kind + ": " + w.summary,
           sourceUrl: w.sourceUrl,
           date: w.date,
           ports: [w.port]
         });
       });
       window.dispatchEvent(new Event("jonagold-warnings"));

   This maps his fields to the shared format: level "Confirmed" becomes severity
   "confirmed", and level "Amber" becomes severity "credible".
3. The dashboard box already has the heading "Ports and shipping". In portsRender,
   delete the `<h2 class='ports-title'>Port and shipping warnings</h2>` text from the
   `html` string so the title is not shown twice. Keep the "Last checked" line.
4. Build weather.js and news.js the same way: for each real warning, push an object in
   the shared format (see "How the warning sections feed the risk and alert sections"
   above) onto window.JONAGOLD_WARNINGS, then dispatch the "jonagold-warnings" event.
   Weather warnings use `countries` or `supplierIds`, news uses `supplierIds` (use
   S01 for the Samsung SDI battery-cell news).

**Check your work (then tell Jeremy the results in plain English):**
- Open index.html by double-click. All five boxes should show, with no red error text.
- With no real warnings entered, the Supplier risk table showing four suppliers as Amber
  (Giant, Fox, Tektro, DT Swiss) is CORRECT. That comes from stock gaps, not a bug.
- Only after the above works, say "Save my work to GitHub". If the push is rejected,
  "get the latest" first, then push again.
