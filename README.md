# Helsinki Lens

A desktop 3D map for exploring Helsinki buildings and their surroundings. The current version includes the central major district's 5,525 real LOD2 buildings, Finnish/Swedish address search, daylight/dusk ground maps, official place names and trees, and postal-area sale/rent averages.

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
| `npm run data:register -- --area=central` | Building register and plan protection for the model area. |
| `npm run data:city-tiles -- --area=central` | Import official city LOD2 buildings and rebuild the manifest. |
| `npm run data:probe:basemap` | Counts, fields, class values and sampled size estimates. |
| `node scripts/complete-basemap-probe.mjs` | Complete class lists from older probes that stored examples only. |
| `npm run data:report:basemap` | Write the readable [basemap report](docs/basemap-probe.md). |
| `npm run data:basemap:fetch` | Cache the selected city ground layers. |
| `npm run data:basemap:build` | Build day/dusk WebP tiles through zoom 17 and record alignment checks. |
| `npm run data:context` | Prepare Helsinki addresses, current labels and tree cells. Run again after rebuilding the building manifest. |
| `npm run data:prices` | Discover StatFin tables, fetch the latest two quarters and matching postal boundaries, validate, then publish. |
| `npm run data:parking` | Street parking areas, paid zones and resident zones into `public/parking.json`. Nearby counts are worked out in the browser, so no rerun is needed after a building rebuild. |
| `npm run data:transit` | HSL timetable (GTFS zip, about 80 MB, cached in `data/raw/transit`): Helsinki stops, lines, weekday 7 to 9 departures and route shapes cut at the border. `--force` downloads a new timetable. |
| `npm run data:landmarks` | Landmarks from OpenStreetMap (Overpass, cached in `data/raw/landmarks`) into `public/landmarks.json`. |
| `node scripts/check-data-phase34.mjs` | Audit published points, postal clipping, IDs, schema and file sizes. |
| `npm test` | Unit/regression tests. |
| `npm run check:phase34` | Desktop browser flows; needs the dev server and installed Chrome. Saves screenshots and performance results. |
| `npm run check:picking` | Ten real clicks across the model; needs the dev server and Chrome. |
| `npm run build` | Production files in `dist/`. |

Do not run publishing data commands simultaneously: they update the shared `dataset.json`.

The original CityGML route (`data:buildings`, `data:convert`, `data:pilot`) remains available. The city-tiles import is the existing fallback when the CityGML service is unavailable.

## What the data means

- **Search:** official Helsinki address points, including Swedish aliases and house-number suffixes. Exact normalized Finnish register addresses link to models. No nearest-building guessing. Search covers Helsinki; 3D coverage is currently the central major district.
- **Building facts:** the existing card keeps register construction year, floors, flat/business counts, floor area, heating/fuel, structural frame, facade, elevator indication, source-model height, building class and plan protection. Missing facts stay “Not recorded”; absent elevator flags do not mean “No”.
- **Ground:** generalized land, guide areas/lines, green areas, street outlines and central carriageways. Roads are styled by class. Planned/unbuilt roads and underground lines are excluded; carriageways inherit construction status from their street. Real road widths are preserved, with brighter/wider outlines for major roads at distant zooms.
- **Names:** `Nimisto_piste_rekisteritiedot`, `olotila=1`, filtered to Helsinki; HTML labels are culled by zoom, viewport and screen collisions.
- **Trees:** official street and park tree positions/species. Cells load only nearby at close zoom. **Shape and height are illustrative.** This is not a forest inventory.
- **Sale:** old two-room flats in blocks of flats, EUR/m². At preparation: 2025 Q4 and provisional 2026 Q1. The table declares 2022 postal boundaries.
- **Rent:** non-subsidised two-room flats, EUR/m²/month. At preparation: 2025 Q3–Q4 from the explicitly labelled archive. The table declares 2018 postal boundaries.
- **Prices:** postal-area averages, never a building valuation. Shapes are clipped to Helsinki without changing the original area statistic. Suppressed/missing values stay null. Quarter change needs two valid adjacent quarters. Each metric uses its own geography when assigning the card's area.
- **Parking view:** zones along the streets where the city mapped free, paid, and paid but free with resident permit parking. Each mapped area is grown by 6 m and merged (`public/parking-zones.json`, loaded when the view opens); free wins over paid and paid over permit where they meet. See-through fill with a solid outline. The building card lists spaces per group within 200 m and the zones.
- **Stops:** HSL platforms within 80 m of each other become one pin with one icon per type, on every view, when the scale bar reads 70 m or less. Only pins within 200 m of a residential building show. The card lists the three nearest stops within 1.5 km with lines and weekday 7 to 9 departures. Timetable data, not live.
- **Landmarks:** about 140 well known places from OpenStreetMap (items with a Wikidata link; rides, boards and similar left out), shown when the scale bar reads 70 m or less. Click one to zoom in. A building matched to a landmark (city outlines from `data:register`) shows the landmark's name as its card title, with the address under it.
- **Noise view:** apartment buildings only (apartment, small apartment and residential buildings). Each gets the loudest modelled band at its centre or within 10 m of it, per source. The card says which source is loudest. Other buildings stay plain and have no noise section.
- **Trees:** 3 in 10 trees are drawn, chosen by position so the same ones show every time.
- **Price view:** sale price per m² by postal area on one smooth scale from the lowest to the highest area.
- **Listing buttons:** Oikotie, Etuovi, Vuokraovi, SATO and Lumo open area searches. There is no verified live address-to-ad mapping in this project. Copy address helps narrow an external search.
- **Sources:** City of Helsinki, Statistics Finland and HSL, CC BY 4.0; landmarks © OpenStreetMap contributors, ODbL. Retrieval dates, source URLs, coverage, counts and limitations are in `public/dataset.json`.

## Current limits

There is no terrain surface. Each building is lowered by its own lowest point so it stands on the flat ground map (`groundOffsetM` in the manifest; `heightsN2000` keeps the source heights). On slopes the uphill side can sit slightly above the ground and neighbouring buildings can show small steps. Building height on the card is the model's lowest-to-highest span; the model's own `measuredHeight` is ignored because about 1% of values are clearly wrong (0.9 m for 15 floors). Trees have illustrative height. The basemap alignment check puts all 3,628 addressed buildings on land, with one source-water overlap at Capellan puistotie 21. It records this discrepancy rather than shifting geometry.

Construction remains a later phase. Desktop is the current target; no phone app or dedicated phone-layout pass was added. Browser performance is recorded at 1440×900 using headless Chrome/SwiftShader and should not be read as hardware-GPU performance.

Prepared data and screenshots remain local and ignored by git. No deployment or commit is part of this continuation.

