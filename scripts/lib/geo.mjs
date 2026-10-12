import proj4 from 'proj4';

// EPSG:3879 = ETRS-GK25FIN, the Finnish national grid zone used by Helsinki.
// Coordinates are metres: "east" around 25,49x,xxx and "north" around 6,67x,xxx.
// The leading "25" in the east value is the zone number (25 degrees east).
export const EPSG_3879 = '+proj=tmerc +lat_0=0 +lon_0=25 +k=1 +x_0=25500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';
proj4.defs('EPSG:3879', EPSG_3879);

const toGrid = proj4('EPSG:4326', 'EPSG:3879');

// [longitude, latitude] -> [east, north] in metres
export const lonLatToGrid = point => toGrid.forward(point);
// [east, north] -> [longitude, latitude]
export const gridToLonLat = point => toGrid.inverse(point);

// A square of `size` metres centred on a longitude/latitude point,
// returned as an EPSG:3879 bounding box [minEast, minNorth, maxEast, maxNorth].
export function gridSquare([lon, lat], size) {
  const [east, north] = lonLatToGrid([lon, lat]);
  const half = size / 2;
  return [east - half, north - half, east + half, north + half].map(v => Math.round(v));
}
