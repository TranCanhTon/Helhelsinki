import * as Cesium from 'cesium';

// Loads the prepared 3D buildings and the manifest that describes them.
//
// tileset.json lists the tile files and where they sit. Cesium downloads
// only the tiles in view and drops ones far away when memory gets tight.
// buildings-manifest.json has one record per building; clicking a building
// gives us its buildingId, which we look up in the manifest.

const NEUTRAL = '#e9e4d9';
const SELECTED = '#e3b664';

export async function loadBuildings(viewer) {
  // Before any data is prepared these files don't exist. Vite then answers
  // with index.html instead of a 404, so check for that first and say what to do.
  const probe = await fetch('/tileset/tileset.json');
  if (!probe.ok || !(probe.headers.get('content-type') ?? '').includes('json')) {
    throw new Error('No 3D buildings have been prepared yet. Run npm run data:pilot (or data:convert with a CityGML file), then reload.');
  }
  const [manifestResponse, tileset] = await Promise.all([
    fetch('/buildings-manifest.json'),
    Cesium.Cesium3DTileset.fromUrl('/tileset/tileset.json', {
      maximumScreenSpaceError: 8,
      cacheBytes: 256 * 1024 * 1024,   // keep at most ~256 MB of tiles in memory
    }),
  ]);
  if (!manifestResponse.ok) throw new Error(`Building list could not load (HTTP ${manifestResponse.status})`);
  const manifest = await manifestResponse.json();
  const records = new Map(manifest.map(record => [record.buildingId, record]));

  viewer.scene.primitives.add(tileset);
  tileset.shadows = Cesium.ShadowMode.DISABLED;

  // The colour rule is a "style": Cesium applies it to every building in
  // every tile, including tiles that load later. The selected building gets
  // the accent colour; everything else stays neutral.
  const setSelected = buildingId => {
    const conditions = [];
    if (buildingId) conditions.push([`\${buildingId} === ${JSON.stringify(buildingId)}`, `color('${SELECTED}')`]);
    conditions.push(['true', `color('${NEUTRAL}')`]);
    tileset.style = new Cesium.Cesium3DTileStyle({color: {conditions}});
  };
  setSelected(null);

  // Screen position -> building record (or null if nothing was clicked).
  const pick = position => {
    const picked = viewer.scene.pick(position);
    if (!(picked instanceof Cesium.Cesium3DTileFeature)) return null;
    const id = picked.getProperty('buildingId');
    return {buildingId: id, record: records.get(id) ?? null};
  };

  return {tileset, manifest, records, pick, setSelected};
}
