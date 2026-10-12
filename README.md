# Helsinki Lens

A 3D map of Helsinki for checking a building's surroundings before an apartment viewing: area prices, modelled traffic noise, street parking, nearby public transport and construction work.

**Helsinki only.** No Espoo or Vantaa data is downloaded into published files or shown.

Status: Phase 1 (Helsinki boundary and the first real 3D buildings).

## What you need

- Node.js 22 or newer (`node -v`)
- Git
- Python 3 (used later for the HSL timetable file)

## First setup

Run these in the project folder (for example `D:\HelsinkiMap\helhelsinki`):

```
npm install
```

This reads `package.json` and downloads the libraries into `node_modules/`. Exact versions are locked in `package-lock.json`, so everyone gets the same ones. On later setups use `npm ci`, which installs exactly what the lock file says.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the local website at http://localhost:5173. Keep the terminal open while you use it. |
| `npm run build` | Builds the finished website into `dist/`. |
| `npm test` | Runs the automated tests. |
| `npm run data:probe` | Makes small test requests to every data source and saves samples to `data/raw/probe/`. |
| `npm run data:boundary` | Downloads the 60 Helsinki districts and builds the Helsinki boundary. |
| `npm run data:buildings -- --area=pilot` | Downloads 3D buildings (CityGML) for an area, page by page. Resumes if stopped. |
| `npm run data:register -- --area=pilot` | Downloads the building register (addresses, building type) for the same area. |
| `npm run data:convert -- --area=pilot` | Converts the CityGML into 3D tiles, checks them and publishes to `public/`. |
| `npm run data:pilot` | All four steps above for the pilot area. |
| `npm run data:city-tiles -- --area=pilot` | Alternative building source: reads the city's own published LOD2 3D tiles (same model and IDs) when the CityGML service is down, then builds our tiles the same way. |
| `npm run check:picking` | With `npm run dev` running: opens the map in Chrome, clicks buildings and checks the right one is selected. |

If the city's 3D service is down, put a CityGML file you exported yourself from https://kartta.hel.fi/3d/ into `data/raw/buildings/pilot/` and run `npm run data:convert -- --area=pilot`.

## Folders

| Folder | Contents |
| --- | --- |
| `src/` | The website code that runs in the browser. |
| `scripts/` | Node scripts that download and prepare data. They run on your computer, never in the visitor's browser. |
| `data/raw/` | Original downloads. Not committed to git. |
| `public/` | Prepared files the website loads (3D tiles, JSON). |
| `tests/` | Automated tests. |

## Data sources

Filled in as each source is added. All sources are public open data; licences and retrieval dates are recorded with the prepared files.
