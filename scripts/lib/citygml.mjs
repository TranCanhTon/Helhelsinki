// Reads buildings out of a CityGML 2.0 document.
//
// How a CityGML building looks (simplified):
//
//   <bldg:Building gml:id="BID_123">
//     <gen:stringAttribute name="RATU"><gen:value>18116</gen:value></gen:stringAttribute>
//     <bldg:lod2Solid> ...links to the surfaces below... </bldg:lod2Solid>
//     <bldg:boundedBy>
//       <bldg:WallSurface> <bldg:lod2MultiSurface> <gml:Polygon> ... </gml:Polygon>
//       <bldg:RoofSurface> ...
//       <bldg:GroundSurface> ...
//     </bldg:boundedBy>
//     <bldg:consistsOfBuildingPart> <bldg:BuildingPart> ...same structure... </bldg:BuildingPart>
//   </bldg:Building>
//
// A polygon is an outer ring (gml:exterior) plus optional holes (gml:interior),
// each a list of x y z numbers (gml:posList).
//
// LOD = level of detail. LOD1 is a box with a flat roof, LOD2 has real roof
// shapes. One building can contain both; we keep only the highest one so we
// don't draw the same building twice.
import {DOMParser} from '@xmldom/xmldom';

const isGml = n => n?.namespaceURI?.startsWith('http://www.opengis.net/gml');
const isBldg = n => n?.namespaceURI?.startsWith('http://www.opengis.net/citygml/building/');
const isGen = n => n?.namespaceURI?.startsWith('http://www.opengis.net/citygml/generics/');
const ELEMENT = 1;

function* descendants(node) {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== ELEMENT) continue;
    yield child;
    yield* descendants(child);
  }
}
const children = node => {
  const list = [];
  for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === ELEMENT) list.push(c);
  return list;
};
const gmlId = node =>
  node.getAttribute('gml:id') ||
  [...Array.from(node.attributes || [])].find(
    a => a.localName === 'id' && a.namespaceURI?.startsWith('http://www.opengis.net/gml'),
  )?.value ||
  null;

// Things inside a building that are not the building's outer shell.
const SKIP_CONTAINERS = new Set([
  'BuildingInstallation',
  'IntBuildingInstallation',
  'interiorRoom',
  'Room',
  'BuildingFurniture',
  'opening',
  'Door',
  'Window',
]);
// The outer shell surfaces of a building.
const BOUNDARY_SURFACES = new Set([
  'WallSurface',
  'RoofSurface',
  'GroundSurface',
  'ClosureSurface',
  'OuterCeilingSurface',
  'OuterFloorSurface',
]);

export function parseCityGml(xml) {
  const warnings = [];
  const doc = new DOMParser({
    onError: (level, message) => {
      if (level !== 'warning') throw new Error(`XML ${level}: ${message}`);
    },
  }).parseFromString(xml, 'application/xml');
  const srsNames = new Set();
  for (const el of descendants(doc)) {
    const srs = el.getAttribute?.('srsName');
    if (srs) srsNames.add(srs);
  }
  const buildings = [];
  for (const el of descendants(doc)) {
    if (isBldg(el) && el.localName === 'Building') buildings.push(readBuilding(el, warnings));
  }
  return {buildings, srsNames: [...srsNames], warnings};
}

function genericAttributes(node) {
  const attributes = {};
  for (const child of children(node)) {
    if (!isGen(child) || !child.getAttribute('name')) continue;
    const value = children(child).find(c => c.localName === 'value');
    attributes[child.getAttribute('name')] = value?.textContent.trim() ?? null;
  }
  return attributes;
}

function readBuilding(building, warnings) {
  const id = gmlId(building);
  if (!id) throw new Error('A CityGML building has no gml:id');
  const attributes = genericAttributes(building);
  const parts = [building, ...[...descendants(building)].filter(n => isBldg(n) && n.localName === 'BuildingPart')];
  const polygons = [];
  let lod = 0;
  for (const part of parts) {
    const selected = selectPartPolygons(part, id, warnings);
    lod = Math.max(lod, selected.lod);
    polygons.push(...selected.polygons);
  }
  return {
    id,
    attributes,
    parts: parts.length - 1,
    lod,
    polygons,
    planned: isPlanned(attributes),
  };
}

// Helsinki marks planned (not yet built) objects in generic attributes.
function isPlanned(attributes) {
  return Object.entries(attributes).some(
    ([name, value]) => /SUUNNITELMA/i.test(name) || /suunnitteilla|suunniteltu/i.test(value ?? ''),
  );
}

// Finds which Building/BuildingPart a node belongs to, and the facts we need
// about its position in the tree (LOD, inside a wall/roof surface, skipped).
function context(node, owner) {
  let lod = null,
    boundary = false,
    skipped = false;
  for (let n = node.parentNode; n && n !== owner; n = n.parentNode) {
    if (n.nodeType !== ELEMENT) continue;
    if (isBldg(n) && (n.localName === 'BuildingPart' || n.localName === 'Building')) return null; // belongs to a nested part
    if (SKIP_CONTAINERS.has(n.localName)) skipped = true;
    const match = /^lod(\d)/.exec(n.localName);
    if (match && lod === null) lod = Number(match[1]);
    if (isBldg(n) && BOUNDARY_SURFACES.has(n.localName)) boundary = true;
  }
  return {lod: lod ?? 0, boundary, skipped};
}

function selectPartPolygons(part, buildingId, warnings) {
  const found = [];
  for (const el of descendants(part)) {
    if (!isGml(el)) continue;
    if (['Triangle', 'TriangulatedSurface', 'Tin'].includes(el.localName)) {
      const c = context(el, part);
      if (c && !c.skipped) warnings.push(`${buildingId}: unsupported gml:${el.localName} skipped`);
      continue;
    }
    if (el.localName !== 'Polygon') continue;
    const c = context(el, part);
    if (!c || c.skipped) continue;
    found.push({element: el, ...c});
  }
  if (!found.length) return {lod: 0, polygons: []};
  // Highest LOD only. Prefer the wall/roof/ground surfaces over a solid that
  // repeats the same geometry inline.
  const lod = Math.max(...found.map(p => p.lod));
  let chosen = found.filter(p => p.lod === lod);
  if (chosen.some(p => p.boundary)) chosen = chosen.filter(p => p.boundary);

  const polygons = [];
  const seenIds = new Set(),
    seenCoords = new Set();
  for (const {element} of chosen) {
    const id = gmlId(element);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);
    let rings;
    try {
      rings = readRings(element);
    } catch (error) {
      warnings.push(`${buildingId}: polygon ${id ?? '(no id)'} skipped: ${error.message}`);
      continue;
    }
    const key = JSON.stringify(rings);
    if (seenCoords.has(key)) continue;
    seenCoords.add(key);
    if (rings[0].length >= 3) polygons.push(rings);
  }
  return {lod, polygons};
}

// Polygon element -> [outerRing, hole1, hole2, ...], each ring a list of [x, y, z].
export function readRings(polygon) {
  const rings = [];
  for (const boundary of children(polygon)) {
    if (!['exterior', 'interior'].includes(boundary.localName)) continue;
    const ring = children(boundary).find(c => c.localName === 'LinearRing');
    if (!ring) throw new Error(`${boundary.localName} has no LinearRing`);
    const posList = children(ring).find(c => c.localName === 'posList');
    const dimension = Number(posList?.getAttribute('srsDimension') || 3);
    if (dimension !== 3) throw new Error(`srsDimension ${dimension} is not 3D`);
    const text = posList
      ? posList.textContent
      : children(ring)
          .filter(c => c.localName === 'pos')
          .map(c => c.textContent)
          .join(' ');
    const numbers = text.trim().split(/\s+/).map(Number);
    if (numbers.length % 3 || numbers.some(n => !Number.isFinite(n)))
      throw new Error('coordinates are not valid x y z triples');
    const points = [];
    for (let i = 0; i < numbers.length; i += 3) points.push([numbers[i], numbers[i + 1], numbers[i + 2]]);
    // CityGML repeats the first point at the end to close the ring; drop it.
    const [first, last] = [points[0], points.at(-1)];
    if (points.length > 1 && first.every((v, i) => Math.abs(v - last[i]) < 1e-6)) points.pop();
    if (boundary.localName === 'exterior') rings.unshift(points);
    else rings.push(points);
  }
  if (!rings.length) throw new Error('polygon has no exterior ring');
  return rings;
}

// Helsinki building IDs from the generic attributes. Names differ a bit
// between exports, so several spellings are accepted.
export function buildingIds(attributes) {
  const pick = pattern => {
    const entry = Object.entries(attributes).find(([name]) => pattern.test(name));
    return entry?.[1]?.trim() || null;
  };
  const ratuRaw = pick(/^(rakennustunnus_\(ratu\)|ratu)$/i);
  const ratu = /^\d+(\.0+)?$/.test(ratuRaw ?? '') && Number(ratuRaw) > 0 ? String(Number(ratuRaw)) : null;
  const vtjPrt = pick(/^(vtj[_-]?prt|pysyva_rakennustunnus|prt)$/i);
  return {ratu, vtjPrt};
}
