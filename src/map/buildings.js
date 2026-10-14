import * as Cesium from 'cesium';
import {decodeIndex, detailFile} from '../data/buildingIndex.js';

// Loads the prepared 3D buildings and the short index that describes them.
//
// tileset.json lists the tile files and where they sit. Cesium downloads the tiles in
// view, also when zoomed out (Ton removed a 2.5 km limit, 13 Oct 2026), and drops
// ones out of view when memory gets tight.
// buildings-index.json has a short row per building (position, type, district,
// noise...); the full record of a building loads with its tile's detail file
// when a card opens (detail(id)).

const NEUTRAL = '#f3f0ea';   // warm white
const SELECTED = '#c2622f';  // copper
const SELECTED_ON_PRICES = '#1d2826';  // dark ink, stands out from blue and red

export async function loadBuildings(viewer) {
  // Before any data is prepared these files don't exist. Vite then answers
  // with index.html instead of a 404, so check for that first and say what to do.
  const probe = await fetch('/tileset/tileset.json');
  if (!probe.ok || !(probe.headers.get('content-type') ?? '').includes('json')) {
    throw new Error('No 3D buildings have been prepared yet. Run npm run data:pilot (or data:convert with a CityGML file), then reload.');
  }
  const [indexResponse, tileset] = await Promise.all([
    fetch('/buildings-index.json'),
    Cesium.Cesium3DTileset.fromUrl('/tileset/tileset.json', {
      cacheBytes: 256 * 1024 * 1024,   // keep at most ~256 MB of tiles in memory
    }),
  ]);
  if (!indexResponse.ok || !(indexResponse.headers.get('content-type') ?? '').includes('json')) throw new Error(`Building list could not load (HTTP ${indexResponse.status}). Run npm run data:split`);
  const manifest = decodeIndex(await indexResponse.json());
  const records = new Map(manifest.map(record => [record.buildingId, record]));

  // Full records, one file per tile, fetched once.
  const details = new Map();
  const detail = async buildingId => {
    const uri = records.get(buildingId)?.tileContentUri;
    if (!uri) return null;
    if (!details.has(uri)) details.set(uri, fetch('/buildings/' + detailFile(uri)).then(r => {
      if (!r.ok) throw new Error(`Building details could not load (HTTP ${r.status})`);
      return r.json();
    }).then(list => new Map(list.map(r => [r.buildingId, r]))).catch(error => { details.delete(uri); throw error; }));
    return (await details.get(uri)).get(buildingId) ?? null;
  };

  viewer.scene.primitives.add(tileset);
  // Same as the ground (createViewer.js): keep drawing until the tiles in view are in.
  viewer.scene.postRender.addEventListener(() => { if (!tileset.tilesLoaded) viewer.scene.requestRender(); });
  tileset.shadows = Cesium.ShadowMode.DISABLED;

  // The colour rule is a "style": Cesium applies it to every building in
  // every tile, including tiles that load later. The selected building gets
  // the accent colour (dark ink when a price view colours the rest); the others
  // get their price colour, or stay neutral.
  const colors = new Map();
  const colorFor = css => { if (!colors.has(css)) colors.set(css, Cesium.Color.fromCssColorString(css)); return colors.get(css); };
  let selected = null, colorOf = () => null, selectedOnColors = SELECTED_ON_PRICES;
  const applyStyle = () => {
    const style = new Cesium.Cesium3DTileStyle();
    style.color = {evaluateColor: (feature, result) => {
      const id = feature.getProperty('buildingId'), price = colorOf(id);
      const css = id === selected ? (price ? selectedOnColors : SELECTED) : price ?? NEUTRAL;
      return Cesium.Color.clone(colorFor(css), result);
    }};
    tileset.style = style;
    viewer.scene.requestRender();
  };
  // The selected building shows by colour only. An outline effect used to run over the whole screen on every frame.
  const setSelected = buildingId => { selected = buildingId; applyStyle(); };
  // fn(buildingId) -> CSS colour or null. Call again after its answers change.
  // selectedCss: the selected building's colour while the others are coloured.
  const setColoring = (fn, selectedCss = SELECTED_ON_PRICES) => { colorOf = fn ?? (() => null); selectedOnColors = selectedCss; applyStyle(); };
  setSelected(null);

  // Screen position -> building record (or null if nothing was clicked).
  const pick = position => {
    const picked = viewer.scene.pick(position);
    if (!(picked instanceof Cesium.Cesium3DTileFeature)) return null;
    const id = picked.getProperty('buildingId');
    return {buildingId: id, record: records.get(id) ?? null};
  };

  return {tileset, manifest, records, detail, pick, setSelected, setColoring, get selected() { return selected; }};
}
