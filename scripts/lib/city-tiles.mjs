// Reads the City of Helsinki's own LOD2 building tiles (3D Tiles 1.0, B3DM).
//
// Why this exists: the city publishes the same LOD2 city model in two forms,
// CityGML (through the citydb WFS) and ready-made 3D tiles that its own 3D
// map uses. When the WFS is down we read the tiles instead. They carry the
// same building IDs (gml:id "BID_..."), plus RATU and VTJ-PRT.
//
// What we take out of each tile:
//   - the triangles of every building, converted to Earth-centred coordinates
//   - the batch table row for that building (id and attributes)
// We then rebuild our own tiles from that, so the app never depends on the
// city's tile layout and Helsinki-only filtering stays in our hands.

// glTF is "Y up"; 3D Tiles 1.0 rotates it to "Z up": (x, y, z) -> (x, -z, y).
const yUpToZUp = ([x, y, z]) => [x, -z, y];

const multiply = (a, b) => {
  // 4x4 column-major matrices
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
};
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const applyPoint = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const applyVector = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];

function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  if (node.translation || node.rotation || node.scale) throw new Error('TRS node transforms are not supported in city tiles');
  return IDENTITY;
}

// Returns {rows: [{id, attributes}], buildings: Map(batchId -> {positions:[[x,y,z] ECEF], normals:[[x,y,z]], triangles:[[i,j,k]]})}
export function readCityTile(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'b3dm') throw new Error('Not a b3dm tile');
  const ftJson = buffer.readUInt32LE(12), ftBin = buffer.readUInt32LE(16), btJson = buffer.readUInt32LE(20), btBin = buffer.readUInt32LE(24);
  const featureTable = JSON.parse(buffer.toString('utf8', 28, 28 + ftJson));
  if (btBin) throw new Error('Binary batch tables are not supported');
  const batch = JSON.parse(buffer.toString('utf8', 28 + ftJson + ftBin, 28 + ftJson + ftBin + btJson));
  const glbStart = 28 + ftJson + ftBin + btJson + btBin;
  const jsonLength = buffer.readUInt32LE(glbStart + 12);
  const gltf = JSON.parse(buffer.toString('utf8', glbStart + 20, glbStart + 20 + jsonLength));
  if (gltf.extensionsRequired?.length) throw new Error(`Unsupported glTF extensions: ${gltf.extensionsRequired.join(', ')}`);
  const binStart = glbStart + 20 + jsonLength + 8;
  const rtc = featureTable.RTC_CENTER ?? [0, 0, 0];

  const read = index => {
    const a = gltf.accessors[index], bv = gltf.bufferViews[a.bufferView];
    const components = {SCALAR: 1, VEC3: 3}[a.type];
    const Type = {5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array}[a.componentType];
    if (!components || !Type) throw new Error(`Unsupported accessor ${a.type}/${a.componentType}`);
    const stride = bv.byteStride || components * Type.BYTES_PER_ELEMENT;
    const start = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const values = [];
    for (let i = 0; i < a.count; i++) {
      const offset = start + i * stride;
      const item = [];
      for (let c = 0; c < components; c++) {
        const at = offset + c * Type.BYTES_PER_ELEMENT;
        item.push(Type === Float32Array ? buffer.readFloatLE(at) : Type === Uint32Array ? buffer.readUInt32LE(at) : Type === Uint16Array ? buffer.readUInt16LE(at) : buffer.readUInt8(at));
      }
      values.push(components === 1 ? item[0] : item);
    }
    return values;
  };

  const buildings = new Map();
  const visit = (nodeIndex, parent) => {
    const node = gltf.nodes[nodeIndex];
    const matrix = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        if ((primitive.mode ?? 4) !== 4) throw new Error('Only triangle lists are supported');
        const positions = read(primitive.attributes.POSITION);
        const normals = primitive.attributes.NORMAL !== undefined ? read(primitive.attributes.NORMAL) : null;
        const ids = read(primitive.attributes._BATCHID);
        const indices = primitive.indices !== undefined ? read(primitive.indices) : positions.map((_, i) => i);
        const local = new Map(); // source vertex index -> {building, index}
        const place = i => {
          if (local.has(i)) return local.get(i);
          const id = ids[i];
          if (!buildings.has(id)) buildings.set(id, {positions: [], normals: [], triangles: []});
          const b = buildings.get(id);
          const p = yUpToZUp(applyPoint(matrix, positions[i]));
          b.positions.push([p[0] + rtc[0], p[1] + rtc[1], p[2] + rtc[2]]);
          b.normals.push(normals ? yUpToZUp(applyVector(matrix, normals[i])) : null);
          const entry = {id, index: b.positions.length - 1};
          local.set(i, entry);
          return entry;
        };
        for (let t = 0; t < indices.length; t += 3) {
          const corners = [place(indices[t]), place(indices[t + 1]), place(indices[t + 2])];
          if (corners[0].id !== corners[1].id || corners[0].id !== corners[2].id) throw new Error('A triangle spans two buildings');
          buildings.get(corners[0].id).triangles.push(corners.map(c => c.index));
        }
      }
    }
    for (const child of node.children ?? []) visit(child, matrix);
  };
  for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, IDENTITY);

  const rows = batch.id.map((id, i) => ({id, attributes: batch.attributes?.[i] ?? {}, parent: batch.parentPosition?.[i] ?? -1}));
  return {rows, buildings, batchLength: featureTable.BATCH_LENGTH};
}

// ECEF [x, y, z] -> [lon, lat, height] on WGS84 (Bowring's method, mm accuracy).
export function ecefToGeodetic([x, y, z]) {
  const a = 6378137.0, f = 1 / 298.257223563, b = a * (1 - f), e2 = f * (2 - f), ep2 = (a * a - b * b) / (b * b);
  const p = Math.hypot(x, y), theta = Math.atan2(z * a, p * b);
  const lat = Math.atan2(z + ep2 * b * Math.sin(theta) ** 3, p - e2 * a * Math.cos(theta) ** 3);
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return [Math.atan2(y, x) * 180 / Math.PI, lat * 180 / Math.PI, p / Math.cos(lat) - n];
}
