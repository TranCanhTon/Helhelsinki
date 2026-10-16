# Helsinki Lens

A desktop 3D map for exploring Helsinki buildings and their surroundings. The current version includes all of Helsinki's 85,784 real LOD2 buildings (only those near the camera are drawn), Finnish/Swedish address search, a dark ground map, official place names, postal-area sale/rent averages, and an English/Finnish switch in the tool bar.

## Run locally

You need Node.js 22 or newer. In `D:\HelsinkiMap\helhelsinki`:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. The prepared files already present in this checkout are used immediately. A fresh clone needs the data commands below because generated datasets are git-ignored.

Drag to pan, scroll to zoom, Shift/right-drag to rotate and tilt. Keys: `/` search, `F` back to the picked building, `Alt+R` base angle and distance over the same place (Home goes back to the city centre). Map buttons also provide home, overhead, rotation and north. Search accepts Finnish or Swedish street names, ignores case and accents, and supports arrow keys, Enter and Escape. Shared addresses offer an explicit building choice; an address without a model gets a marker and “No linked 3D building”.

## Data commands

Commands run on your computer and fetch from official sources; visitors load only prepared local files. Keep the current public data when a download fails, fix the cause, then retry. Context downloads resume from whole-layer caches; `--force` refreshes them. Each WFS download verifies total counts, stable ordering and duplicate IDs.

| Command | Purpose |
| --- | --- |
| `npm run data:probe` | Small source samples and field metadata. |
| `npm run data:boundary` | Helsinki boundary, islands/holes and district polygons. |
| `npm run data:register -- --area=helsinki` | Building register and plan protection for the model area (`helsinki` = every district; `central` and `pilot` still work). |
| `npm run data:city-tiles -- --area=helsinki` | Import official city LOD2 buildings (about 530 MB of city tiles, cached in `data/raw/buildings/<area>`) and rebuild the tiles, manifest, building index and detail files. Works one 500 m cell at a time, so the whole city fits in memory. Restart the dev server afterwards: it does not watch `public/tileset/`, so new tile files are not served until then. |
| `npm run data:probe:basemap` | Counts, fields, class values and sampled size estimates. |
| `node scripts/complete-basemap-probe.mjs` | Complete class lists from older probes that stored examples only. |
| `npm run data:report:basemap` | Write the readable [basemap report](docs/basemap-probe.md). |
| `npm run data:basemap:fetch` | Cache the selected city ground layers. |
| `npm run data:basemap:build` | Build the dark WebP ground tiles through zoom 17 and record alignment checks. |
| `npm run data:context` | Prepare Helsinki addresses and current labels. Run again after rebuilding the building manifest. |
| `npm run data:split` | Rebuild what the map loads from the current buildings without importing again: the tile tree that loads only nearby tiles, `public/buildings-index.json` and `public/buildings/<tile>.json`. `data:city-tiles` and `data:noise` do this themselves. |
| `npm run data:ground` | Ground height grid for the textured buildings (`public/ground-grid.bin`, 10 m cells): the highest building base in each cell, so the map can lower the city's textured buildings onto the flat ground without any floating. Run after `data:city-tiles`. |
| `npm run data:prices` | Discover StatFin tables, fetch the latest two quarters and matching postal boundaries, validate, then publish. |
| `npm run data:parking` | Street parking areas, paid zones and resident zones into `public/parking.json`. Nearby counts are worked out in the browser, so no rerun is needed after a building rebuild. |
| `npm run data:transit` | HSL timetable (GTFS zip, about 80 MB, cached in `data/raw/transit`): Helsinki stops, lines, weekday 7 to 9 departures and route shapes cut at the border. `--force` downloads a new timetable. |
| `npm run data:construction` | Current digging notices and street area rentals from the city permit system into `public/construction.json`, sorted heavy, medium or light. Downloads fresh every run (the city updates several times a day); run it again to refresh. No rerun needed after a building rebuild. |
| `npm run data:places` | Grocery stores, pharmacies, gyms, Alko, restaurants and cafés in Helsinki from OpenStreetMap (Overpass, cached in `data/raw/places`; `--force` asks again) into `public/places.json`. No rerun needed after a building rebuild. |
| `npm run data:services` | Day care (Finnish, Swedish, English), primary schools (grades 1 to 6) and health stations from the City of Helsinki service map (api.hel.fi/servicemap, `municipality=helsinki`, cached in `data/raw/services`; `--force` asks again) into `public/services.json`. No rerun needed after a building rebuild. |
| `node scripts/check-data-phase34.mjs` | Audit published points, postal clipping, IDs, schema and file sizes. |
| `npm test` | Unit/regression tests. |
| `npm run check:phase34` | Desktop browser flows; needs the dev server and installed Chrome. Saves screenshots and performance results. |
| `npm run check:picking` | Ten real clicks across the model; needs the dev server and Chrome. |
| `npm run build` | Production files in `dist/`. |

Do not run publishing data commands simultaneously: they update the shared `dataset.json`.

The original CityGML route (`data:buildings`, `data:convert`, `data:pilot`) remains available. The city-tiles import is the existing fallback when the CityGML service is unavailable.

## Publishing the data (Vercel)

The prepared data is made on this computer and stays git-ignored (about 640 MB: raw downloads, the Oikotie ads, files only the scripts use). The public site needs only what the browser loads: 8,371 files, 521 MB (grey tiles 389 MB, building details 92 MB, building index 10 MB, ground map 10 MB, addresses 10 MB, the rest 9 MB). Visitors normally download about 100 MB of it; the grey tiles are only a fallback when the city's textured buildings do not load.

- `npm run data:pack` copies those files into `data/snapshot/`, checks they come from one preparation run (every building ID in the index, its grey tile and its detail file, and search addresses pointing at known buildings), leaves out `listings.json` and the ads part of `dataset.json`, stores the folder as one git commit outside any branch and pushes it to GitHub as `refs/daroad-data/<time>`. It writes `deploy/data-snapshot.json`, which pins that commit. `--dry` only checks.
- `npm run build` (also on Vercel) runs `scripts/fetch-data.mjs` first: with no data in `public/` it fetches exactly the pinned commit, checks the file count and puts it in `public/`, so a clean checkout builds the complete site and a deployment never mixes two runs. A computer with its own data in `public/` keeps it (`DATA_SNAPSHOT=fetch` replaces it with the snapshot).
- `vercel.json`: data files are revalidated on every visit (`max-age=0, must-revalidate`), so after a deploy browsers do not keep old files; the hashed code bundles are cached for a year.
- Normal clones do not download the snapshots (they are not branches). Old snapshots stay on GitHub; files that did not change are stored once.

Refresh after new data (in `D:\HelsinkiMap\helhelsinki`):

1. Run the data commands you need (table above), then `npm test`.
2. `npm run data:pack` (about 3 minutes; pushes the snapshot).
3. Commit `deploy/data-snapshot.json` and push `main`. Vercel builds with the new snapshot.
4. Check `https://helhelsinki.vercel.app/buildings-index.json` and `/tileset/tileset.json` answer 200 with JSON.

## What the data means

- **Search:** official Helsinki address points, including Swedish aliases and house-number suffixes. Exact normalized Finnish register addresses link to models. No nearest-building guessing. Search covers Helsinki; 3D coverage is all of Helsinki.
- **3D buildings:** every Helsinki building in the city's LOD2 model whose centre is inside the Helsinki boundary (no Espoo or Vantaa). All building tiles in view load, also when zoomed out. At start the map loads a short index (position, type, district, address, noise bands); a building's full record loads with its tile's detail file when its card opens. **Overview, Parking and Construction show the city's textured buildings** (layer "Rakennukset tekstuureilla (LOD2)", streamed from kartta.hel.fi like the city's own 3D map, with its own simpler versions for far away, so zooming out keeps buildings). The map lowers each vertex by the ground grid (`data:ground`); buildings can sink up to a few metres on slopes but never float. In Noise the colours wash over the photos (60%), so windows and roofs still show. Price colours the postal areas on the ground instead, so the buildings keep their photos. When the city server cannot be reached, the grey buildings are used.
- **Building card:** kept short, with no explaining notes. Current rental ads in the building first (when there are any), then a facts table: register construction year, floors, flats, floor area, elevator indication, source-model height and, for apartment buildings, the loudest modelled noise band and its source. Then average rent in the postal area by flat size (median asking rent of current ads; the official per m² figure when there are no ads), construction within 50 m, street parking, public transport, nearby shops and services, and plan protection. A copy button sits next to the address. Missing facts stay “Not recorded”; absent elevator flags do not mean “No”.
- **Ground:** generalized land, guide areas/lines, green areas, street outlines and central carriageways. Roads are styled by class. Planned/unbuilt roads and underground lines are excluded; carriageways inherit construction status from their street. Real road widths are preserved, with brighter/wider outlines for major roads at distant zooms.
- **Names:** `Nimisto_piste_rekisteritiedot`, `olotila=1`, filtered to Helsinki; HTML labels are culled by zoom, viewport and screen collisions.
- **Sale:** old two-room flats in blocks of flats, EUR/m². At preparation: 2025 Q4 and provisional 2026 Q1. The table declares 2022 postal boundaries.
- **Rent:** non-subsidised two-room flats, EUR/m²/month. At preparation: 2025 Q3–Q4 from the explicitly labelled archive. The table declares 2018 postal boundaries.
- **Prices:** postal-area averages, never a building valuation. Shapes are clipped to Helsinki without changing the original area statistic. Suppressed/missing values stay null. Quarter change needs two valid adjacent quarters. Each metric uses its own geography when assigning the card's area.
- **Parking view:** zones along the streets where the city mapped free, paid, and paid but free with resident permit parking. Each mapped area is grown by 1.5 m and merged (`public/parking-zones.json`, loaded when the view opens), so the zones show as thin strips along the kerb; free wins over paid and paid over permit where they meet. Solid fill, no outline. The building card lists spaces per group within 200 m and the zones.
- **Construction (Noise view, Construction button, and card):** work areas from the city's digging notices (`Kaivuilmoitus_alue`) and street area rentals (`Aluevuokraus_alue`) that have not ended yet, shown only when Construction is picked in the noise switch on the left. Coloured heavy, medium or light in one blue (brighter = heavier); buildings stay plain in that mode. The level comes from keyword rules on the Finnish purpose text with later change notes cut off (`src/data/construction.js`, table approved by Ton 13 Oct 2026); work no rule recognises is left out (counted in `dataset.json`). It is a guess from the kind of work, not a noise level. The card lists work within 50 m of the building, nearest first, with dates and addresses. Over/running/upcoming comes from the dates, not the status field. Temporary traffic arrangements (mostly events) are left out. Private sites that rent no street space are missing; work areas are drawn roughly.
- **Stops:** HSL platforms within 80 m of each other become one pin with one icon per type, on every view, when the scale bar reads 60 m or less. Only pins within 200 m of a residential building show. The card lists the three nearest stops within 1.5 km with lines and weekday 7 to 9 departures. Timetable data, not live.
- **Noise view:** apartment buildings only (apartment, small apartment and residential buildings). Each gets the loudest modelled band at its centre or within 10 m of it, per source. The card's facts table shows the loudest band and its source. Other buildings stay plain and have no noise row.
- **Price view:** sale price per m² by postal area, drawn as see-through areas on the ground on one smooth scale from the lowest to the highest area. Areas without a value are left out.
- **Sun view:** the sun's position over Helsinki from the NOAA solar formulas (`src/data/sun.js`), on the 21st of the chosen month this year, in Helsinki time. The slider runs from sunrise to sunset. The panel shows the time, the sun's height (as seen, with air refraction; shown as 0° at the two ends) and its compass direction; the dial on the left turns with the map and shows N, E, S, W and the sun. Cesium casts shadows from the textured (or grey) buildings onto each other and onto the flat ground, only while this view is open. No terrain or trees, so hills and trees cast no shadow. At sunrise and sunset the light stays at least 0.5° up so the shadows can be drawn.
- **Nearby shops and services:** the nearest grocery store, pharmacy, gym, Alko, restaurant and café within 1 km of the building, with name and straight-line distance, from OpenStreetMap (`data:places`). Small K-Markets and Alepas are tagged as corner shops there, so corner shops count as grocery stores, except petrol station shops. On the card only, not drawn on the map.
- **Ads view:** every building with a current Oikotie ad in one bright amber, the rest dark, no filters. An ad is linked to every building at its exact address, so the count is by address. Ads without a matching address are counted but not drawn. Re-link saved ads to buildings without fetching (after `data:context`): `node scripts/fetch-listings.mjs --publish-only`.
- **Schools and health (card):** nearest day care, primary school and health station within 3 km, straight line. Not the school or health station the address belongs to.
- **Sources:** City of Helsinki, Statistics Finland and HSL, CC BY 4.0; shops and services © OpenStreetMap contributors, ODbL. The card ends with one line naming them. Retrieval dates, source URLs, coverage, counts and limitations are in `public/dataset.json`.

## Current limits

There is no terrain surface. Each building is lowered by its own lowest point so it stands on the flat ground map (`groundOffsetM` in the manifest; `heightsN2000` keeps the source heights). On slopes the uphill side can sit slightly above the ground and neighbouring buildings can show small steps. Building height on the card is the model's lowest-to-highest span; the model's own `measuredHeight` is ignored because about 1% of values are clearly wrong (0.9 m for 15 floors). The basemap alignment check puts all 3,628 addressed buildings on land, with one source-water overlap at Capellan puistotie 21. It records this discrepancy rather than shifting geometry.

The ground map is sharpest (zoom 16 to 17) in the central major district only; elsewhere it stops at zoom 15 (about 2.4 m per pixel), so streets look softer up close outside the centre.

Desktop is the current target; no phone app or dedicated phone-layout pass was added. Browser performance is recorded at 1440×900 using headless Chrome/SwiftShader and should not be read as hardware-GPU performance.


Prepared data and screenshots remain local and ignored by git; the public site gets its data from the pinned snapshot (Publishing the data, above).

