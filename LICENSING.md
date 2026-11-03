# Licensing record

Kept up to date whenever a dependency, data source or third-party file is added or removed.
Last updated: 2026-11-03.

## This project's own license

**Not chosen yet.** No LICENSE file exists. The team needs to decide (for example MIT) before
anyone reuses the code. Until then, nobody outside the team has permission to reuse it.

## Libraries and dependencies

None. The dashboard is plain HTML and JavaScript with no installed packages or CDN scripts.

## Data and services the dashboard reads

| Source | Used by | License / terms | Status |
| --- | --- | --- | --- |
| USGS earthquake feed (earthquake.usgs.gov) | sections/weather.js | US government work, public domain; USGS asks for credit. [Copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits) | OK. Credited on the page. |
| US National Weather Service API (api.weather.gov) | sections/weather.js | US government data, free, no key. [Disclaimer](https://www.weather.gov/disclaimer) | OK. Credited on the page. |
| GDELT DOC API (api.gdeltproject.org) | sections/ports.js (Jeremy's ports section), called from the browser | Free for any use, including commercial, "without fee"; requires a citation to the GDELT Project with a link. Source: [GDELT about page](https://www.gdeltproject.org/about.html), checked 2026-11-03. Note the page covers GDELT "datasets"; it does not mention the DOC API by name. The API also asks for at most one request every 5 seconds, which ports.js follows. | OK. Credited on the page. |

## Sources looked at and deliberately NOT used

- **GDACS** (global disaster alerts): no clear reuse license found. Its [terms of use](https://www.gdacs.org/documents/2025/GDACS_Terms_of_use_Mar_25.pdf) do not state one, and a third-party page claiming CC BY 4.0 is unverified. Needs the owner's answer before use.
- **Open-Meteo free API**: [terms](https://open-meteo.com/en/terms) allow non-commercial use only, which does not fit a company tool.

## Third-party material

- News articles are only **linked** (headline paraphrased in our own words, with source name, link and date). No article text, images or documents are copied into the repository.
- `data/` files and `Start-Here.html` came from the workshop organizers with the starting files. Supplier names, locations and websites are real; every relationship, price, order and stock number is fictional.
- Latitude and longitude values for factories and ports in `sections/weather.js` are public geographic facts.
