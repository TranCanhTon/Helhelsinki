// Low-poly 3D commuter train car for the parked trains at the Central Station
// (Ton, 14 Oct 2026), made here, so no outside model or licence: public/models/train.glb.
// One car; the map puts several in a row along the rail.
//
// Axes: X forward, Y left, Z up, metres, origin at rail level in the middle of the car
// (the map loads them with upAxis Z and forwardAxis X). Two parts: "body" and "cab",
// the driver's end at +X. Middle cars hide the cab; the last car is turned round.
// Flat shading, plain colours, no textures: a few hundred triangles each.
import {mkdir, writeFile} from 'node:fs/promises';

const TYPES = {
  // Commuter train car (Sm5 style): white body, purple lower band and doors.
  train: {
    length: 18.75,
    width: 3.2,
    floor: 1.0,
    top: 4.05,
    windowLow: 1.95,
    windowHigh: 2.95,
    cab: 2.0,
    body: '#eceaf0',
    roof: '#9fa6a8',
    glass: '#1b2422',
    door: '#8c4799',
    skirt: '#8c4799',
    skirtTop: 1.55,
    pattern: ['w', 'd', 'w', 'w', 'w', 'd', 'w'],
    bogies: true,
    roofBox: [3.6, 1.6, 0.42],
  },
};

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = hex => [1, 3, 5].map(i => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

// Triangles per material, flat shaded: each face gets its own vertices and normal.
function meshBuilder() {
  const parts = new Map();
  const part = name => parts.get(name) ?? parts.set(name, {positions: [], normals: [], indices: []}).get(name);
  const normalOf = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
      l = Math.hypot(...n) || 1;
    return n.map(x => x / l);
  };
  // A flat polygon (3 or 4 corners, counter-clockwise seen from outside).
  const face = (material, corners) => {
    const p = part(material),
      base = p.positions.length / 3,
      n = normalOf(corners[0], corners[1], corners[2]);
    for (const c of corners) {
      p.positions.push(...c);
      p.normals.push(...n);
    }
    for (let i = 1; i + 1 < corners.length; i++) p.indices.push(base, base + i, base + i + 1);
  };
  // An axis-aligned box from [x0, y0, z0] to [x1, y1, z1].
  const box = (material, [x0, y0, z0], [x1, y1, z1], {bottom = false} = {}) => {
    face(material, [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ]);
    face(material, [
      [x0, y1, z0],
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
    ]);
    face(material, [
      [x0, y1, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ]);
    face(material, [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ]);
    face(material, [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ]);
    if (bottom)
      face(material, [
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y0, z0],
      ]);
  };
  return {parts, face, box};
}

// Half cross-section, bottom to top on the left side (y > 0): [y, z, kind of the edge
// above this point]. The right side mirrors it; the top edge joins the two halves.
function halfProfile(t) {
  const w = t.width / 2,
    r = 0.45;
  return [
    [w - 0.12, t.floor, 'skirt'],
    [w, t.floor + 0.18, 'skirt'],
    [w, t.skirtTop, 'lower'],
    [w, t.windowLow, 'window'],
    [w, t.windowHigh, 'upper'],
    [w - 0.04, t.top - r, 'roof'],
    [w - r * 0.45, t.top - r * 0.2, 'roof'],
    [w - r, t.top, 'roof'],
  ];
}

// Material of a side strip between x0 and x1 for an edge kind, with windows, pillars and doors.
function sideMaterial(t, kind, slot) {
  if (kind === 'roof') return 'roof';
  if (kind === 'skirt') return 'skirt';
  if (slot === 'd') return 'door';
  return kind === 'window' && slot === 'w' ? 'glass' : 'body';
}

function buildCar(t) {
  const body = meshBuilder(),
    cab = meshBuilder();
  const half = halfProfile(t),
    L = t.length / 2;
  // Slots along the side: pillar, then the pattern of windows and doors, each with a pillar after it.
  const slots = [],
    pillar = 0.28,
    endWall = 0.6;
  const usable = t.length - 2 * endWall,
    unit = (usable - pillar * (t.pattern.length + 1)) / t.pattern.length;
  let x = -L;
  slots.push([x, x + endWall, 'p']);
  x += endWall;
  for (const s of t.pattern) {
    slots.push([x, x + pillar, 'p']);
    x += pillar;
    slots.push([x, x + unit, s]);
    x += unit;
  }
  slots.push([x, x + pillar, 'p']);
  x += pillar;
  slots.push([x, L, 'p']);
  // Sides: each profile edge, strip by strip along X.
  for (let i = 0; i + 1 < half.length; i++) {
    const [ya, za, kind] = half[i],
      [yb, zb] = half[i + 1];
    for (const [x0, x1, slot] of slots) {
      const m = sideMaterial(t, kind, slot);
      body.face(m, [
        [x0, ya, za],
        [x0, yb, zb],
        [x1, yb, zb],
        [x1, ya, za],
      ]); // left side, facing +Y
      body.face(m, [
        [x0, -yb, zb],
        [x0, -ya, za],
        [x1, -ya, za],
        [x1, -yb, zb],
      ]); // right side, facing -Y
    }
  }
  // Roof top and underside between the two halves.
  const [yt, zt] = half.at(-1),
    [yf, zf] = half[0];
  body.face('roof', [
    [-L, yt, zt],
    [-L, -yt, zt],
    [L, -yt, zt],
    [L, yt, zt],
  ]);
  body.face('skirt', [
    [-L, -yf, zf],
    [-L, yf, zf],
    [L, yf, zf],
    [L, -yf, zf],
  ]);
  // End walls (between cars): a ladder of strips from bottom to top.
  const ladder = (builder, xEnd, profile, facing, glassBand) => {
    for (let i = 0; i + 1 < profile.length; i++) {
      const [ya, za, kind] = profile[i],
        [yb, zb] = profile[i + 1];
      const m =
        glassBand && kind === 'window' ? 'glass' : kind === 'skirt' ? 'skirt' : kind === 'roof' ? 'roof' : 'body';
      const q = [
        [xEnd, ya, za],
        [xEnd, yb, zb],
        [xEnd, -yb, zb],
        [xEnd, -ya, za],
      ];
      builder.face(m, facing > 0 ? q : q.reverse());
    }
  };
  ladder(body, -L, half, -1, false);
  ladder(body, L, half, 1, false);
  // Bogies and roof equipment.
  if (t.bogies)
    for (const cx of [-L + 3, L - 3])
      body.box('skirt', [cx - 1.4, -t.width / 2 + 0.45, 0.05], [cx + 1.4, t.width / 2 - 0.45, t.floor], {bottom: true});
  const [rl, rw, rh] = t.roofBox;
  body.box('equipment', [-rl / 2, -rw / 2, t.top], [rl / 2, rw / 2, t.top + rh]);

  // Cab: the profile narrows and leans back towards the front, with a windscreen.
  const front = half.map(([y, z, kind]) => {
    const k = (z - t.floor) / (t.top - t.floor); // 0 at the floor, 1 at the roof
    return [y * 0.86, z - k * k * 0.35, kind];
  });
  const lean = z => t.cab * (1 - 0.35 * ((z - t.floor) / (t.top - t.floor)) ** 2);
  for (let i = 0; i + 1 < half.length; i++) {
    const [ya, za, kind] = half[i],
      [yb, zb] = half[i + 1],
      [fya, fza] = front[i],
      [fyb, fzb] = front[i + 1];
    const m = kind === 'window' ? 'glass' : kind === 'skirt' ? 'skirt' : kind === 'roof' ? 'roof' : 'body';
    cab.face(m, [
      [L, ya, za],
      [L, yb, zb],
      [L + lean(zb), fyb, fzb],
      [L + lean(za), fya, fza],
    ]);
    cab.face(m, [
      [L, -yb, zb],
      [L, -ya, za],
      [L + lean(za), -fya, fza],
      [L + lean(zb), -fyb, fzb],
    ]);
  }
  const [hy, hz] = half.at(-1),
    [fy, fz] = front.at(-1),
    [by, bz] = half[0],
    [gy, gz] = front[0];
  cab.face('roof', [
    [L, hy, hz],
    [L, -hy, hz],
    [L + lean(fz), -fy, fz],
    [L + lean(fz), fy, fz],
  ]);
  cab.face('skirt', [
    [L, -by, bz],
    [L, by, bz],
    [L + lean(gz), gy, gz],
    [L + lean(gz), -gy, gz],
  ]);
  // Front face: windscreen band, body below and above, two headlights.
  for (let i = 0; i + 1 < front.length; i++) {
    const [ya, za, kind] = front[i],
      [yb, zb] = front[i + 1];
    const m =
      kind === 'window' || (kind === 'upper' && zb < t.top - 0.2)
        ? 'glass'
        : kind === 'skirt'
          ? 'skirt'
          : kind === 'roof'
            ? 'roof'
            : 'body';
    cab.face(m, [
      [L + lean(za), ya, za],
      [L + lean(zb), yb, zb],
      [L + lean(zb), -yb, zb],
      [L + lean(za), -ya, za],
    ]);
  }
  const lightZ = (t.floor + t.windowLow) / 2;
  for (const side of [1, -1]) {
    const y = side * (t.width * 0.3),
      x = L + lean(lightZ) + 0.02;
    cab.face('light', [
      [x, y + 0.18, lightZ - 0.09],
      [x, y + 0.18, lightZ + 0.09],
      [x, y - 0.18, lightZ + 0.09],
      [x, y - 0.18, lightZ - 0.09],
    ]);
  }
  return {body, cab};
}

// glTF binary (GLB) with one node per part and one primitive per material.
function glb(name, t, car) {
  const materials = {
    body: t.body,
    roof: t.roof,
    glass: t.glass,
    door: t.door,
    skirt: t.skirt,
    equipment: '#5b6462',
    light: '#fff4d6',
  };
  const materialNames = Object.keys(materials);
  const json = {
    asset: {version: '2.0', generator: 'daroad scripts/build-vehicle-models.mjs'},
    scene: 0,
    scenes: [{nodes: [0, 1]}],
    nodes: [
      {name: 'body', mesh: 0},
      {name: 'cab', mesh: 1},
    ],
    meshes: [],
    materials: materialNames.map(m => ({
      name: m,
      pbrMetallicRoughness: {
        baseColorFactor: [...linear(materials[m]), 1],
        metallicFactor: m === 'glass' ? 0.2 : 0,
        roughnessFactor: m === 'glass' ? 0.35 : 0.75,
      },
      ...(m === 'light' ? {emissiveFactor: linear('#fff4d6')} : {}),
    })),
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  const chunks = [];
  let offset = 0;
  const view = (bytes, target) => {
    const pad = (4 - (bytes.byteLength % 4)) % 4;
    json.bufferViews.push({buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target});
    chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), Buffer.alloc(pad));
    offset += bytes.byteLength + pad;
    return json.bufferViews.length - 1;
  };
  let triangles = 0;
  for (const part of [car.body, car.cab]) {
    const primitives = [];
    for (const [material, p] of part.parts) {
      const positions = new Float32Array(p.positions),
        normals = new Float32Array(p.normals),
        indices = new Uint16Array(p.indices);
      const min = [0, 1, 2].map(k => Math.min(...p.positions.filter((_, i) => i % 3 === k)));
      const max = [0, 1, 2].map(k => Math.max(...p.positions.filter((_, i) => i % 3 === k)));
      json.accessors.push({
        bufferView: view(positions, 34962),
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min,
        max,
      });
      json.accessors.push({
        bufferView: view(normals, 34962),
        componentType: 5126,
        count: normals.length / 3,
        type: 'VEC3',
      });
      json.accessors.push({
        bufferView: view(indices, 34963),
        componentType: 5123,
        count: indices.length,
        type: 'SCALAR',
      });
      const a = json.accessors.length;
      primitives.push({
        attributes: {POSITION: a - 3, NORMAL: a - 2},
        indices: a - 1,
        material: materialNames.indexOf(material),
      });
      triangles += indices.length / 3;
    }
    json.meshes.push({primitives});
  }
  json.buffers.push({byteLength: offset});
  const bin = Buffer.concat(chunks);
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12),
    jsonHead = Buffer.alloc(8),
    binHead = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  jsonHead.writeUInt32LE(text.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  return {bytes: Buffer.concat([header, jsonHead, text, binHead, bin]), triangles};
}

await mkdir(new URL('../public/models/', import.meta.url), {recursive: true});
for (const [name, t] of Object.entries(TYPES)) {
  const {bytes, triangles} = glb(name, t, buildCar(t));
  await writeFile(new URL(`../public/models/${name}.glb`, import.meta.url), bytes);
  console.log(name, triangles, 'triangles', bytes.length, 'bytes');
}
