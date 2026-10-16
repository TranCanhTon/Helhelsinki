import * as Cesium from 'cesium';
import {decodeIndex, detailFile} from '../data/buildingIndex.js';
import {loadJson, dataUrl} from '../data/load.js';

// Loads the prepared 3D buildings and the short index that describes them.
//
// tileset.json lists the tile files and where they sit. Cesium downloads the tiles in
// view, also when zoomed out (Ton removed a 2.5 km limit, 13 Oct 2026), and drops
// ones out of view when memory gets tight.
// buildings-index.json has a short row per building (position, type, district,
// noise...); the full record of a building loads with its tile's detail file
// when a card opens (detail(id)).

// Ton chose textured buildings (13 Oct 2026): the city's textured LOD2 model, the same
// buildings and IDs as ours, streamed from the city's server like its own 3D map
// (kartta.hel.fi/3d, layer 'Rakennukset tekstuureilla (LOD2)', City of Helsinki,
// CC BY 4.0). It has simpler versions for far away built in, so zooming out keeps
// the buildings. The model holds Helsinki buildings only (data:city-tiles found 0
// outside the boundary). Our grey tiles are the fallback when it cannot load.
export const TEXTURED_URL = 'https://kartta.hel.fi/3d/datasource-data/e5e7158a-52df-45a1-9be0-1be8f2828abd/tileset.json';

// The textured buildings stand at their real height; our ground map is flat at 0.
// The vertex shader lowers every vertex by the ground grid under it (data:ground,
// 10 m cells, checked against the city tiles: no building floats, median sinks 0.4 m):
// the highest building base in each 10 m cell, so a building may sink a little but
// never floats.
export async function groundShader() {
  const [meta, bytes] = await Promise.all([loadJson('/ground-grid.json'), fetch(dataUrl('/ground-grid.bin')).then(r => {
    if (!r.ok) throw new Error('Ground grid unavailable. Run npm run data:ground');
    return r.arrayBuffer();
  })]);
  if (bytes.byteLength !== meta.width * meta.height) throw new Error('ground-grid.bin does not match ground-grid.json. Run npm run data:ground');
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...meta.origin));
  const up = Cesium.Matrix4.getColumn(frame, 2, new Cesium.Cartesian4());
  return new Cesium.CustomShader({
    uniforms: {
      u_toLocal: {type: Cesium.UniformType.MAT4, value: Cesium.Matrix4.inverseTransformation(frame, new Cesium.Matrix4())},
      u_up: {type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(up.x, up.y, up.z)},
      u_grid: {type: Cesium.UniformType.VEC4, value: new Cesium.Cartesian4(meta.minE, meta.minN, meta.width * meta.cellM, meta.height * meta.cellM)},
      u_heights: {type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(meta.minM, meta.stepM, meta.fallbackM)},
      u_plain: {type: Cesium.UniformType.VEC3, value: PLAIN_SHADE.clone()},
      u_ground: {type: Cesium.UniformType.SAMPLER_2D, value: new Cesium.TextureUniform({
        typedArray: new Uint8Array(bytes), width: meta.width, height: meta.height,
        pixelFormat: Cesium.PixelFormat.LUMINANCE, pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
        minificationFilter: Cesium.TextureMinificationFilter.NEAREST, magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST, wrapS: Cesium.TextureWrap.CLAMP_TO_EDGE, wrapT: Cesium.TextureWrap.CLAMP_TO_EDGE,
      })},
    },
    vertexShaderText: `
      void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
        vec3 local = (u_toLocal * (czm_model * vec4(vsOutput.positionMC, 1.0))).xyz;
        vec2 uv = (local.xy - u_grid.xy) / u_grid.zw;
        float h = u_heights.z;
        if (uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0) {
          float v = texture(u_ground, uv).r * 255.0;
          if (v > 0.5) h = u_heights.x + (floor(v + 0.5) - 1.0) * u_heights.y;
        }
        vsOutput.positionMC -= (czm_inverseModel * vec4(u_up * h, 0.0)).xyz;
      }`,
    // Parts without a photo draw in their white base colour and pop out of the photo
    // city. Those are shaded down to granite (Ton, 15 Oct 2026). Only near grey colours:
    // the copper selected building keeps its colour. Coloured views set u_plain to 1.
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        #ifndef HAS_BASE_COLOR_TEXTURE
          vec3 d = material.diffuse;
          if (max(d.r, max(d.g, d.b)) - min(d.r, min(d.g, d.b)) < 0.12) material.diffuse = d * u_plain;
        #endif
      }`,
  });
}
// Multiplier for the parts without a photo in Overview, Price and Sun: about #6f7572 on white.
const PLAIN_SHADE = new Cesium.Cartesian3(0.42, 0.45, 0.44);
const NO_SHADE = new Cesium.Cartesian3(1, 1, 1);

async function loadTextured() {
  const customShader = await groundShader();
  const tileset = await Cesium.Cesium3DTileset.fromUrl(TEXTURED_URL, {cacheBytes: 256 * 1024 * 1024});
  tileset.customShader = customShader;
  // The city's tree has empty levels above its 2 km tiles, and Cesium opens those only
  // near the camera, so zoomed out the far city was empty. Opening every empty level
  // always shows at least the simplest version of every area in view (Ton wants
  // buildings when zoomed out, 13 Oct 2026); nearer areas still get more detail.
  const openEmpty = tile => {
    if (!tile.hasRenderableContent) tile.geometricError = tile._geometricError = 1e9;
    for (const child of tile.children) openEmpty(child);
  };
  openEmpty(tileset.root);
  tileset.tileLoad.addEventListener(openEmpty);
  return tileset;
}

const NEUTRAL = '#f3f0ea';   // warm white: the grey buildings in Overview
const NEUTRAL_COLOURED = '#454c48';  // dark granite: buildings a coloured view leaves out
const SELECTED = '#c2622f';  // copper
const SELECTED_ON_PRICES = '#1d2826';  // dark ink, stands out from blue and red

export async function loadBuildings(viewer) {
  const [indexResponse, textured] = await Promise.all([
    fetch(dataUrl('/buildings-index.json')),
    // A city server that does not answer must not hold up the map: grey after 8 s.
    Promise.race([loadTextured(), new Promise((_, reject) => setTimeout(() => reject(new Error('no answer in 8 s')), 8000))])
      .catch(error => { console.warn('Textured buildings unavailable, using the grey ones', error); return null; }),
  ]);
  // The grey buildings (373 MB) are only the fallback: the public site does not carry them.
  // A missing file comes back as a 404 or as index.html, so check for JSON.
  const isJson = r => r.ok && (r.headers.get('content-type') ?? '').includes('json');
  if (!isJson(indexResponse)) {
    console.error('Missing buildings-index.json. Locally: npm run data:split. Public site: npm run data:upload.');
    throw new Error('Map data is missing on this server (buildings-index.json)');
  }
  let tileset = textured;
  if (!tileset) {
    if (!isJson(await fetch('/tileset/tileset.json').catch(() => ({ok: false, headers: new Headers()})))) {
      console.error('No textured buildings (city server or ground-grid files) and no grey fallback. Locally: npm run data:ground, data:pilot.');
      throw new Error('Map data is missing on this server (3D buildings)');
    }
    tileset = await Cesium.Cesium3DTileset.fromUrl('/tileset/tileset.json', {cacheBytes: 256 * 1024 * 1024});
  }
  const manifest = decodeIndex(await indexResponse.json());
  const records = new Map(manifest.map(record => [record.buildingId, record]));

  // Full records, one file per tile, fetched once.
  const details = new Map();
  const detail = async buildingId => {
    const uri = records.get(buildingId)?.tileContentUri;
    if (!uri) return null;
    if (!details.has(uri)) details.set(uri, fetch(dataUrl('/buildings/' + detailFile(uri))).then(r => {
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
  // Building ID of a feature: 'buildingId' in our tiles, 'id' in the textured ones,
  // where a building part points to its building through __PARENT_FEATURE.
  const idOf = feature => {
    const own = feature.getProperty('buildingId') ?? feature.getProperty('id');
    if (!textured || records.has(own)) return own;
    const parent = feature.getProperty('__PARENT_FEATURE');
    return parent >= 0 ? feature.content.getFeature(parent)?.getProperty('id') ?? own : own;
  };
  // Textured: the photo shows in Overview and Price (tinted copper when selected); in
  // a coloured view the colour washes over the photo.
  let coloured = false;
  const applyStyle = () => {
    if (textured) {
      // Coloured views keep the photos under a 60% wash of the colour (Ton, 15 Oct 2026),
      // so windows and roofs still show; the other views show the plain photo.
      tileset.colorBlendMode = coloured ? Cesium.Cesium3DTileColorBlendMode.MIX : Cesium.Cesium3DTileColorBlendMode.HIGHLIGHT;
      tileset.colorBlendAmount = 0.6;
      tileset.customShader.setUniform('u_plain', coloured ? NO_SHADE : PLAIN_SHADE);
    }
    const neutral = coloured ? NEUTRAL_COLOURED : textured ? '#ffffff' : NEUTRAL;
    const style = new Cesium.Cesium3DTileStyle();
    style.color = {evaluateColor: (feature, result) => {
      // Some city tiles carry no building data; Cesium then asks once for the whole tile, without a feature.
      if (!feature) return Cesium.Color.clone(colorFor(neutral), result);
      const id = idOf(feature), price = colorOf(id);
      // In a coloured view the selected building always takes that view's selected colour,
      // also when the view leaves it out (copper would read as a noise level).
      const css = id === selected ? (coloured ? selectedOnColors : SELECTED) : price ?? neutral;
      return Cesium.Color.clone(colorFor(css), result);
    }};
    tileset.style = style;
    viewer.scene.requestRender();
  };
  // The selected building shows by colour only. An outline effect used to run over the whole screen on every frame.
  const setSelected = buildingId => { selected = buildingId; applyStyle(); };
  // fn(buildingId) -> CSS colour or null. Call again after its answers change.
  // selectedCss: the selected building's colour while the others are coloured.
  const setColoring = (fn, selectedCss = SELECTED_ON_PRICES) => { coloured = !!fn; colorOf = fn ?? (() => null); selectedOnColors = selectedCss; applyStyle(); };
  setSelected(null);

  // Screen position -> building record (or null if nothing was clicked).
  const pick = position => {
    const picked = viewer.scene.pick(position);
    if (!(picked instanceof Cesium.Cesium3DTileFeature)) return null;
    const id = idOf(picked);
    return {buildingId: id, record: records.get(id) ?? null};
  };

  return {tileset, textured: !!textured, manifest, records, detail, pick, setSelected, setColoring, get selected() { return selected; }};
}
