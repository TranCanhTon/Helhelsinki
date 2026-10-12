// Areas we download 3D buildings for. Coordinates are [longitude, latitude];
// `size` is the side of the square in metres.
// Phase 1 uses only the pilot. Phase 2 will add the central neighbourhoods.
import {gridSquare} from './lib/geo.mjs';

export const AREAS = {
  // About 400 m around Senate Square and the Cathedral.
  pilot: {center: [24.9522, 60.1700], size: 400},
};

export function areaBbox(name) {
  const area = AREAS[name];
  if (!area) throw new Error(`Unknown area "${name}". Known areas: ${Object.keys(AREAS).join(', ')}`);
  return gridSquare(area.center, area.size);
}

// Reads --area=name from the command line (default: pilot).
export function areaFromArgs(argv = process.argv) {
  return argv.find(a => a.startsWith('--area='))?.slice(7) || 'pilot';
}

export const CITYGML_WFS = 'https://kartta.hel.fi/3d/citydb-wfs/wfs';
