# Helsinki Lens

A desktop 3D map for exploring Helsinki buildings and their surroundings. The current version includes all of Helsinki's 85,784 real LOD2 buildings (only those near the camera are drawn), Finnish/Swedish address search, a dark ground map, official place names, postal-area sale/rent averages, and an English/Finnish switch in the tool bar.

## Run locally

You need Node.js 22 or newer. In `D:\HelsinkiMap\helhelsinki`:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. The prepared files already present in this checkout are used immediately. A fresh clone needs the data commands below because generated datasets are git-ignored.

Drag to pan, scroll to zoom, Shift/right-drag to rotate and tilt. Map buttons also provide home, overhead, rotation and north. Search accepts Finnish or Swedish street names, ignores case and accents, and supports arrow keys, Enter and Escape. Shared addresses offer an explicit building choice; an address without a model gets a marker and “No linked 3D building”.

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
| `node scripts/check-data-phase34.mjs` | Audit published points, postal clipping, IDs, schema and file sizes. |
| `npm test` | Unit/regression tests. |
| `npm run check:phase34` | Desktop browser flows; needs the dev server and installed Chrome. Saves screenshots and performance results. |
| `npm run check:picking` | Ten real clicks across the model; needs the dev server and Chrome. |
| `npm run build` | Production files in `dist/`. |

Do not run publishing data commands simultaneously: they update the shared `dataset.json`.

The original CityGML route (`data:buildings`, `data:convert`, `data:pilot`) remains available. The city-tiles import is the existing fallback when the CityGML service is unavailable.

## What the data means

- **Search:** official Helsinki address points, including Swedish aliases and house-number suffixes. Exact normalized Finnish register addresses link to models. No nearest-building guessing. Search covers Helsinki; 3D coverage is all of Helsinki.
- **3D buildings:** every Helsinki building in the city's LOD2 model whose centre is inside the Helsinki boundary (no Espoo or Vantaa). All building tiles in view load, also when zoomed out. At start the map loads a short index (position, type, district, address, noise bands); a building's full record loads with its tile's detail file when its card opens. **Overview, Parking and Construction show the city's textured buildings** (layer "Rakennukset tekstuureilla (LOD2)", streamed from kartta.hel.fi like the city's own 3D map, with its own simpler versions for far away, so zooming out keeps buildings). The map lowers each vertex by the ground grid (`data:ground`); buildings can sink up to a few metres on slopes but never float. In Noise the colours replace the photos. Price colours the postal areas on the ground instead, so the buildings keep their photos. When the city server cannot be reached, the grey buildings are used.
- **Building card:** kept short, with no explaining notes. Current rental ads in the building first (when there are any), then a facts table: register construction year, floors, flats, floor area, elevator indication, source-model height and, for apartment buildings, the loudest modelled noise band and its source. Then average rent in the postal area by flat size (median asking rent of current ads; the official per m² figure when there are no ads), construction within 50 m, street parking, public transport and plan protection. A copy button sits next to the address. Missing facts stay “Not recorded”; absent elevator flags do not mean “No”.
- **Ground:** generalized land, guide areas/lines, green areas, street outlines and central carriageways. Roads are styled by class. Planned/unbuilt roads and underground lines are excluded; carriageways inherit construction status from their street. Real road widths are preserved, with brighter/wider outlines for major roads at distant zooms.
- **Names:** `Nimisto_piste_rekisteritiedot`, `olotila=1`, filtered to Helsinki; HTML labels are culled by zoom, viewport and screen collisions.
- **Sale:** old two-room flats in blocks of flats, EUR/m². At preparation: 2025 Q4 and provisional 2026 Q1. The table declares 2022 postal boundaries.
- **Rent:** non-subsidised two-room flats, EUR/m²/month. At preparation: 2025 Q3–Q4 from the explicitly labelled archive. The table declares 2018 postal boundaries.
- **Prices:** postal-area averages, never a building valuation. Shapes are clipped to Helsinki without changing the original area statistic. Suppressed/missing values stay null. Quarter change needs two valid adjacent quarters. Each metric uses its own geography when assigning the card's area.
- **Parking view:** zones along the streets where the city mapped free, paid, and paid but free with resident permit parking. Each mapped area is grown by 6 m and merged (`public/parking-zones.json`, loaded when the view opens); free wins over paid and paid over permit where they meet. See-through fill with a solid outline. The building card lists spaces per group within 200 m and the zones.
- **Construction (Noise view, Construction button, and card):** work areas from the city's digging notices (`Kaivuilmoitus_alue`) and street area rentals (`Aluevuokraus_alue`) that have not ended yet, shown only when Construction is picked in the noise switch on the left. Coloured heavy, medium or light in one blue (brighter = heavier); buildings stay plain in that mode. The level comes from keyword rules on the Finnish purpose text with later change notes cut off (`src/data/construction.js`, table approved by Ton 13 Oct 2026); work no rule recognises is left out (counted in `dataset.json`). It is a guess from the kind of work, not a noise level. The card lists work within 50 m of the building, nearest first, with dates and addresses. Over/running/upcoming comes from the dates, not the status field. Temporary traffic arrangements (mostly events) are left out. Private sites that rent no street space are missing; work areas are drawn roughly.
- **Stops:** HSL platforms within 80 m of each other become one pin with one icon per type, on every view, when the scale bar reads 60 m or less. Only pins within 200 m of a residential building show. The card lists the three nearest stops within 1.5 km with lines and weekday 7 to 9 departures. Timetable data, not live.
- **Noise view:** apartment buildings only (apartment, small apartment and residential buildings). Each gets the loudest modelled band at its centre or within 10 m of it, per source. The card's facts table shows the loudest band and its source. Other buildings stay plain and have no noise row.
- **Price view:** sale price per m² by postal area, drawn as see-through areas on the ground on one smooth scale from the lowest to the highest area. Areas without a value are left out.
- **Sources:** City of Helsinki, Statistics Finland and HSL, CC BY 4.0. The card ends with one line naming them. Retrieval dates, source URLs, coverage, counts and limitations are in `public/dataset.json`.

## Current limits

There is no terrain surface. Each building is lowered by its own lowest point so it stands on the flat ground map (`groundOffsetM` in the manifest; `heightsN2000` keeps the source heights). On slopes the uphill side can sit slightly above the ground and neighbouring buildings can show small steps. Building height on the card is the model's lowest-to-highest span; the model's own `measuredHeight` is ignored because about 1% of values are clearly wrong (0.9 m for 15 floors). The basemap alignment check puts all 3,628 addressed buildings on land, with one source-water overlap at Capellan puistotie 21. It records this discrepancy rather than shifting geometry.

The ground map is sharpest (zoom 16 to 17) in the central major district only; elsewhere it stops at zoom 15 (about 2.4 m per pixel), so streets look softer up close outside the centre.

Desktop is the current target; no phone app or dedicated phone-layout pass was added. Browser performance is recorded at 1440×900 using headless Chrome/SwiftShader and should not be read as hardware-GPU performance.


Prepared data and screenshots remain local and ignored by git. No deployment or commit is part of this continuation.

