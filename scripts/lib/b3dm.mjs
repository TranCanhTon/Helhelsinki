// Writes and reads B3DM files ("Batched 3D Model", part of the 3D Tiles 1.0 standard).
//
// A B3DM file is:
//   28-byte header
//   feature table   JSON: {"BATCH_LENGTH": number of buildings in this file}
//   batch table     JSON: one array per property, e.g. {"buildingId": ["BID_1", "BID_2"]}
//   GLB             a normal glTF 3D model (binary)
//
// Every vertex in the GLB has a _BATCHID number. _BATCHID 4 means "this vertex
// belongs to building number 4 in this file", and batchTable.buildingId[4]
// says which real building that is. That is how a click on a triangle in the
// browser turns into a building ID.
//
// Binary rules from the spec: JSON parts are padded with spaces and binary
// parts with zeros so every section starts on an 8-byte boundary.

const pad = (buffer, alignment, fill) => {
  const extra = (alignment - (buffer.length % alignment)) % alignment;
  return extra ? Buffer.concat([buffer, Buffer.alloc(extra, fill)]) : buffer;
};
const jsonChunk = (value, offset, alignment = 8) => {
  // Pad so (offset + length) lands on the alignment.
  const raw = Buffer.from(JSON.stringify(value));
  const extra = (alignment - ((offset + raw.length) % alignment)) % alignment;
  return Buffer.concat([raw, Buffer.alloc(extra, 0x20)]);
};

// mesh: {positions: Float32Array (x,y,z...), normals: Float32Array, batchIds: Uint16Array|Uint32Array, indices: Uint32Array}
// properties: {buildingId: [...], ...} one entry per building
export function encodeB3dm(mesh, properties) {
  const batchLength = properties.buildingId.length;
  const glb = encodeGlb(mesh, batchLength);
  const featureTable = jsonChunk({BATCH_LENGTH: batchLength}, 28);
  const batchTable = jsonChunk(properties, 28 + featureTable.length);
  const header = Buffer.alloc(28);
  header.write('b3dm', 0, 'ascii');
  header.writeUInt32LE(1, 4); // version
  header.writeUInt32LE(28 + featureTable.length + batchTable.length + glb.length, 8);
  header.writeUInt32LE(featureTable.length, 12); // feature table JSON
  header.writeUInt32LE(0, 16); // feature table binary
  header.writeUInt32LE(batchTable.length, 20); // batch table JSON
  header.writeUInt32LE(0, 24); // batch table binary
  return Buffer.concat([header, featureTable, batchTable, glb]);
}

function encodeGlb({positions, normals, batchIds, indices}, batchLength) {
  const vertexCount = positions.length / 3;
  if (normals.length !== positions.length || batchIds.length !== vertexCount)
    throw new Error('Mesh arrays have different lengths');
  const ids = vertexCount > 0 && batchLength <= 65535 ? Uint16Array.from(batchIds) : Uint32Array.from(batchIds);
  const parts = [
    Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength),
    Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength),
    Buffer.from(ids.buffer, ids.byteOffset, ids.byteLength),
    Buffer.from(indices.buffer, indices.byteOffset, indices.byteLength),
  ].map(b => pad(b, 4, 0));
  const offsets = [];
  let offset = 0;
  for (const part of parts) {
    offsets.push(offset);
    offset += part.length;
  }
  const binary = Buffer.concat(parts);

  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const gltf = {
    asset: {version: '2.0', generator: 'Helsinki Lens CityGML converter'},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{mesh: 0}],
    meshes: [{primitives: [{attributes: {POSITION: 0, NORMAL: 1, _BATCHID: 2}, indices: 3, material: 0, mode: 4}]}],
    materials: [
      {
        pbrMetallicRoughness: {baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.9},
        doubleSided: true,
      },
    ],
    buffers: [{byteLength: binary.length}],
    bufferViews: [
      {buffer: 0, byteOffset: offsets[0], byteLength: positions.byteLength, target: 34962},
      {buffer: 0, byteOffset: offsets[1], byteLength: normals.byteLength, target: 34962},
      {buffer: 0, byteOffset: offsets[2], byteLength: ids.byteLength, target: 34962},
      {buffer: 0, byteOffset: offsets[3], byteLength: indices.byteLength, target: 34963},
    ],
    accessors: [
      {bufferView: 0, componentType: 5126, count: vertexCount, type: 'VEC3', min, max},
      {bufferView: 1, componentType: 5126, count: vertexCount, type: 'VEC3'},
      {bufferView: 2, componentType: ids instanceof Uint16Array ? 5123 : 5125, count: vertexCount, type: 'SCALAR'},
      {bufferView: 3, componentType: 5125, count: indices.length, type: 'SCALAR'},
    ],
  };
  const json = pad(Buffer.from(JSON.stringify(gltf)), 4, 0x20);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // "BIN"
  return pad(Buffer.concat([header, jsonHeader, json, binHeader, binary]), 8, 0);
}

// Reads a B3DM back: used by the validator and tests to prove the files are correct.
export function decodeB3dm(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'b3dm') throw new Error('Not a b3dm file');
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('b3dm byteLength does not match file size');
  const ftJson = buffer.readUInt32LE(12),
    ftBin = buffer.readUInt32LE(16),
    btJson = buffer.readUInt32LE(20),
    btBin = buffer.readUInt32LE(24);
  const featureTable = JSON.parse(buffer.toString('utf8', 28, 28 + ftJson));
  const batchStart = 28 + ftJson + ftBin;
  const batchTable = JSON.parse(buffer.toString('utf8', batchStart, batchStart + btJson));
  const glbStart = batchStart + btJson + btBin;
  if (glbStart % 8) throw new Error('GLB is not 8-byte aligned');
  if (buffer.toString('ascii', glbStart, glbStart + 4) !== 'glTF') throw new Error('No GLB inside b3dm');
  const jsonLength = buffer.readUInt32LE(glbStart + 12);
  const gltf = JSON.parse(buffer.toString('utf8', glbStart + 20, glbStart + 20 + jsonLength));
  const binStart = glbStart + 20 + jsonLength + 8;
  const view = index => {
    const accessor = gltf.accessors[index],
      bv = gltf.bufferViews[accessor.bufferView];
    const start = binStart + bv.byteOffset;
    const Type = {5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array}[accessor.componentType];
    const size = accessor.type === 'VEC3' ? 3 : 1;
    return new Type(
      buffer.buffer.slice(
        buffer.byteOffset + start,
        buffer.byteOffset + start + accessor.count * size * Type.BYTES_PER_ELEMENT,
      ),
    );
  };
  const primitive = gltf.meshes[0].primitives[0];
  return {
    featureTable,
    batchTable,
    gltf,
    positions: view(primitive.attributes.POSITION),
    normals: view(primitive.attributes.NORMAL),
    batchIds: view(primitive.attributes._BATCHID),
    indices: view(primitive.indices),
  };
}
