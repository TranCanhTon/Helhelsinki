# Handover: Helsinki Lens (helhelsinki)

Written 12 October 2026 for the next coding agent (Claude Code on Ton's PC).
Read this whole file before doing anything.

## 1. What the project is

A 3D web map of Helsinki for checking a building's surroundings before an apartment viewing. You search an address, select a 3D building, and see:

- Postal-area sale and rent prices
- Modelled traffic noise
- Street parking
- Nearby HSL stops and lines
- Construction work nearby, with a rough heavy, medium or light label

Stack: Node.js 22+, npm, Vite, plain JavaScript modules, HTML/CSS, CesiumJS. Python 3 is allowed later for the HSL GTFS file. No UI framework, no database.

The full original spec is in four Markdown files Ton has: `AI_BUILD_PROMPT.md`, `INTRODUCTION.md`, `START_HERE.md` and `SOURCES_AND_DATA.md`. Ask him for them if they are not in the folder. They are useful for data rules and acceptance checks. **Section 8 of AI_BUILD_PROMPT.md (visual design) is overridden by rule 4 below.**

## 2. Rules from Ton (non-negotiable)

1. **Helsinki only.** No Espoo or Vantaa data downloaded into published files, shown, or requested by the browser. Every dataset is filtered against the Helsinki boundary (`public/map/helsinki-boundary.json`).
2. **Branch `main` stays `main`.** Never rename it. Commit to `main`.
3. **Build from scratch.** The repo `quanbui210/helsinki-city-3d` (folder `helsinki-age`) belongs to Ton's friend. It may be read for reference only. Never change it, and never copy its code or its design.
4. **Own design.** Ton said the current look is too close to his friend's project. The current `src/styles.css` (navy panels, beige accent, serif title) came from the spec and must be replaced with an original visual direction. Agree the direction with Ton before building a lot of UI.
5. **Teach as you go.** Ton wants to understand the code, not just receive it. Before he runs a command, say what it does and which folder to run it in. When fetching a data source, explain what fields it has and what we use them for.
6. **Ask when unsure** instead of assuming.
7. **Communication style:** blunt, no fluff, no emojis, sounds human. Do not use dashes or double dashes as punctuation in prose (hyphens inside commands are fine).
8. Real data only. Missing values stay missing, never zero or invented. No synthetic buildings presented as real.

## 3. Where things are

- **GitHub:** https://github.com/TranCanhTon/helhelsinki, branch `main`.
  - GitHub may still list an old branch `phase-0-1` as default. Ton was asked to set `main` as default in repo Settings and delete `phase-0-1`. Check whether this was done.
- **Local folder:** `D:\HelsinkiMap\helhelsinki` on Ton's Windows PC.
- **Network:** the data servers (kartta.hel.fi, stat.fi, HSL, Overpass) are reachable from Ton's PC.
- **Git identity:** commits so far used `TranCanhTon <tton62550@gmail.com>`.

## 4. Plan and status

| Phase | Content | Status |
| --- | --- | --- |
| 0 | Setup, Vite + Cesium skeleton, data source probe | Done |
| 1 | Helsinki boundary, 400 m pilot of real CityGML buildings, converter to 3D Tiles, viewer with picking | Code done and tested on synthetic shapes. **Not yet run on real data** (see section 6). |
| 2 | Central Helsinki coverage, base map (land, water, streets) in day and dusk, labels, neighbourhood panel, layout shell | Not started |
| 3 | Address search (Finnish and Swedish), selection highlight, unmatched address marker, building card, phone bottom sheet, URL state | Not started |
| 4 | Price: StatFin postal-area sale and rent, translucent ground areas | Not started |
| 5 | Noise: 2022 Lden road, rail, metro, tram, "All" = highest band | Not started |
| 6 | Parking: segments, paid and resident zones, density, clusters, dots | Not started |
| 7 | HSL GTFS stops and lines, nearest 3 within 1.5 km, OSM landmarks | Not started |
| 8 | Construction nearby (Ton's own feature, details in section 7) | Not started |
| 9 | Share URLs, phone polish, error states, sources panel, tests, README, refresh commands, scope audit | Not started |
| 10 | Optional listing links, later Brave search | Not started |

Ton asked to do one or two phases at a time and to walk him through each.

## 5. Code that exists

```
package.json            pinned deps; cesium 1.145.0 with overrides @cesium/engine 26.3.0, @cesium/widgets 16.2.0
                        (newer engine versions break cesium 1.145 imports in Vite)
vite.config.js          defines CESIUM_BASE_URL=/cesium/
index.html              map, brand, map tools, scale, building card, loading screen, credits
src/main.js             creates viewer, light, navigation, loads buildings, click to select, error + retry
src/map/createViewer.js Cesium with all ion/online defaults off (no imagery, no terrain, no geocoder)
src/map/navigation.js   own camera control: drag pan, wheel zoom, Shift/right drag rotate+tilt, pinch,
                        keys, home, overhead, rotate, north, flyTo; camera clamped to a Helsinki rectangle
src/map/buildings.js    loads tileset + manifest, highlight via Cesium3DTileStyle on ${buildingId}, pick()
src/ui/buildingCard.js  card with address, type, postcode, LOD, "Sources & IDs"
src/styles.css          TO BE REDESIGNED (rule 4)
scripts/copy-cesium.mjs copies Cesium Workers/Assets/ThirdParty/Widgets to public/cesium (predev/prebuild)
scripts/lib/http.mjs    fetch with timeout + retries; getJson checks body (WFS errors come as HTTP 200 XML)
scripts/lib/wfs.mjs     paged WFS download with total, duplicate and truncation checks
scripts/lib/geo.mjs     EPSG:3879 <-> lon/lat via proj4, gridSquare()
scripts/lib/frame.mjs   WGS84 ECEF + local east/north/up frame (matches Cesium, tested)
scripts/lib/boundary.mjs union of districts, inside test, area
scripts/lib/citygml.mjs namespace aware CityGML 2.0 parser: Building + BuildingPart, highest LOD only,
                        boundary surfaces preferred over solids, planned objects flagged, RATU/VTJ-PRT
scripts/lib/triangulate.mjs  Newell normal, project to own plane, earcut with holes, consistent winding
scripts/lib/b3dm.mjs    B3DM 1.0 writer/reader (GLB with POSITION, NORMAL, _BATCHID, indices)
scripts/lib/tiles.mjs   project origin [24.95, 60.17, 0], vertex conversion, Y-up axes, bounding boxes,
                        validateTileset() (feature IDs vs manifest, bounds, inside Helsinki)
scripts/lib/register-join.mjs  join by VTJ-PRT then RATU, keeps several addresses, unknown type on conflict
scripts/config.mjs      AREAS (only `pilot`: centre 24.9522, 60.1700, 400 m)
scripts/probe-sources.mjs  small requests to every source -> data/raw/probe/report.json
scripts/fetch-boundary.mjs  -> public/map/helsinki-boundary.json + district-boundaries.json, 8 control points
scripts/fetch-buildings.mjs  citydb WFS, 8 per page, cached pages, resumable
scripts/fetch-register.mjs   register for the area (+150 m margin), only needed fields
scripts/convert-buildings.mjs  CityGML -> data/staging -> validate -> public/tileset, buildings-manifest.json, dataset.json
scripts/check-picking.mjs  Playwright: clicks manifest buildings on desktop and phone, checks the card ID
scripts/screenshot.mjs     screenshots + console errors
tests/                  geo, boundary, buildings tests (18 pass); fixtures are SYNTHETIC and labelled so
```

Commands: `npm test`, `npm run dev`, `npm run build`, `npm run data:probe`, `npm run data:boundary`, `npm run data:buildings -- --area=pilot`, `npm run data:register -- --area=pilot`, `npm run data:convert -- --area=pilot`, `npm run data:pilot`, `npm run check:picking`.

Generated data (`public/tileset/`, `public/buildings-manifest.json`, `public/dataset.json`, `public/map/`) and `data/raw/` are git-ignored for now.

Manifest record shape:

```
{buildingId, sourceIds:{gmlId, ratu, vtjPrt}, position:[lon,lat], heightsN2000:{base, top},
 registerJoin, address, addresses[], addressSv, postcode, use, lod, buildingParts,
 geometrySource, tileContentUri, tileFeatureId}
```

Heights: N2000 is used directly as height above a flat sea-level globe. There is no terrain; this is documented in `dataset.json` limitations.

## 6. Immediate next steps

1. Check `git pull` on Ton's PC is up to date.
2. Run `npm run data:boundary`. Confirm the 8 control points pass and note the area in km².
3. Run `npm run data:buildings -- --area=pilot`.
   - On 12 Oct 2026 the citydb WFS (`https://kartta.hel.fi/3d/citydb-wfs/wfs`) answered **HTTP 503** to everything. Retry first.
   - **Fallback 1:** Ton exports CityGML (LOD2, no textures) for the Senate Square area from the Export / Object Export Wizard at https://kartta.hel.fi/3d/. It emails a download link. Put the `.gml` in `data/raw/buildings/pilot/`. The city says these exports lack building attributes; check whether gml:id, RATU or VTJ-PRT are present. If they are not, the register join will not work and you need to decide with Ton what to do.
   - **Fallback 2:** the 2019 archive `https://3d.hel.ninja/data/citygml/Helsinki3D_CityGML_Kalasatama_20190326.zip` (23.5 MB). It is the only file there, it is old, and the server once had a bad TLS certificate. Never disable TLS checks.
   - The parser was written from the CityGML 2.0 standard and tested on synthetic files only. Expect to adjust it once a real file arrives: generic attribute names, xlink surfaces, srsName text and envelope handling. Check `data/raw/buildings/pilot-warnings.txt` after converting.
4. `npm run data:register -- --area=pilot`, then `npm run data:convert -- --area=pilot`, then `npm run dev`, and check in the browser.
5. Run `npm run check:picking` (uses installed Chrome on Windows) and look at the screenshots.
6. Agree the new design direction with Ton, then continue with Phase 2.

## 7. Probe findings (what each source has)

**City of Helsinki WFS** `https://kartta.hel.fi/ws/geoserver/avoindata/wfs`
- 301 layers.
- Use `srsName=CRS:84` for lon/lat GeoJSON and `sortBy=id` for paging.

| Layer | Records | Key fields |
| --- | --- | --- |
| `Kaupunginosajako` | 60 districts | `tunnus`, `nimi_fi`, `nimi_se`, `kunta` (091) |
| `Rakennukset_alue_rekisteritiedot` | 84,959 | `ratu`, `vtj_prt`, `c_vtj_prt`, `tyyppi`, `c_kayttark`, `tila`, `katunimi_suomi`, `katunimi_ruotsi`, `osoitenumero`, `postinumero`, `i_kerrlkm` (age and energy fields exist but are out of scope) |
| `Helsinki_osoiteluettelo` | 58,317 | `katunimi`, `gatan`, `osoitenumero`, `osoitekirjain`, `osoitenumero_teksti`, `postinumero` (string), `kaupunki`, point |
| `Maavesi_maa_alueet_yleistetty` | 327 | land polygons |
| `Opaskartta_alue` | 15,311 | `tyyppi`, `luokka` (blocks, parks, streets) |
| `Opaskartta_muuviiva` | 2,245 | lines (piers, rail, planned roads) |
| `Nimisto_piste_rekisteritiedot` | 6,977 | `nimi_suomi`, `nimi_ruotsi`, `olotila` (1 = current), `laji_selite` |
| Noise `Meluselvitys_2022_Helsinki_{kadut_ja_maantiet,rautatiet,metro,raitiotie}_Lden` | road: 16,125 | `db_lo`, `db_hi`, `colour` |
| `Pysakointipaikat_alue` | 8,754 | `luokka`, `luokka_nimi`, `tyyppi`, `voimassaolo`, `paikat_ala`, `asukaspysakointitunnus` |
| `Pysakoinnin_maksuvyohykkeet_alue` | 2 | paid zones |
| `Asukas_ja_yrityspysakointivyohykkeet_alue` | 19 | resident zones |

**Construction (HRI dataset "yleisten alueiden tapahtuma- ja maankäyttölupajärjestelmä", same WFS, updated several times a day).** Field descriptions are in `data/raw/probe/construction/field-description.pdf` (Finnish).

- **`Kaivuilmoitus_alue`, excavation notices (3,507).** The main source.
  - `hakemustunnus`
  - `tyo_alkaa` and `tyo_paattyy` (start and end dates)
  - `toiminnallinen_kunto` (winter works: the date the street is usable again)
  - `tyon_tarkoitus`: free-text purpose. Samples: "Tietoliikenne" = telecom, "Puiston rakentaminen" = park construction.
  - `osoite`, `kaupunginosa`
  - `status`: "Käynnissä" = active, "Tuleva" = upcoming
  - `hakija` and `tyon_suorittaja`: only filled for companies.
- **`Aluevuokraus_alue`, area rentals (1,857).** Same fields.
- **`Tilapainen_liikennejarjestely_alue`, temporary traffic arrangements (283).** Liikennejärjestely start and end dates, purpose.
- **`Sijoitussopimus` (3,368):** placement agreements. Start date only, probably skip.
- **`Tapahtumat`** (events) and **`Lyhyt_maanvuokraus`** (short leases): skip.
- **`Winkki_works` and `Winkki_rents_audiences`:** real layer names (titles are the Finnish names). Not yet inspected.
- **Plan:**
  - A heavy, medium or light label from keyword rules on `tyon_tarkoitus` plus the permit type.
  - Unknown stays unknown.
  - **Show the rule table to Ton before using it.**
- **Limits to state in the UI:**
  - Geometry is often inaccurate.
  - Not all permits are published.
  - Private building sites are not in this data.
  - The label is not decibels.
- **Ton's open questions:**
  - Map layer, card row, or both?
  - Active only, or also upcoming?
  - What radius? Default 200 m.

**Statistics Finland**
- **Sale:** `StatFin/ashi/13mt.px`, quarterly by postal code, to 2026Q1 provisional.
- **Rent:** no postal table in current `StatFin/asvu`. Use `StatFin_Passiivi/asvu/statfinpas_asvu_pxt_13eb_2025q4.px` (to 2025Q4, archived), and label it archived.
- **Postal boundaries:** `https://geo.stat.fi/geoserver/postialue/wfs`, layers `pno_2015` to `pno_2026`. Fields `posti_alue`, `nimi`, `namn`, `kunta`. Helsinki (`kunta='091'`) has 84 areas in `pno_2026`. Use the boundary year that matches each table.

**HSL GTFS:** `https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip`, 79 MB, last modified 10 Oct 2026.

**Overpass:** returned 504 (overloaded). Needed only for Phase 7 landmarks. Retry with backoff and cache.

## 8. Things to watch

- Cesium 1.145 needs the engine and widgets overrides in `package.json`; otherwise Vite fails with "No matching export".
- `vite-plugin-static-copy` was dropped (npm audit flagged its dependencies); `scripts/copy-cesium.mjs` replaces it.
- WFS servers return errors as XML with HTTP 200; always check the body.
- The citydb WFS times out on large requests; keep pages small (8).
- Keep postcodes as strings. Keep null as null.
- Do not run the old repo's commands; its README describes a different project.
