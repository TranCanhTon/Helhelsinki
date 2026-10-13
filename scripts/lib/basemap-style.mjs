// What the ground map draws, in which order, and in which colours.
//
// Each class picks features from one downloaded layer by its type fields
// (see scripts/probe-basemap.mjs for every value that exists). Classes are
// drawn top to bottom in this order, so later ones cover earlier ones.
// Anything not picked by a class is not drawn (planned roads, underground
// lines, power lines, labels' text frames...).

const guide = (...classes) => (layer, p) => layer === 'guide' && classes.includes(p.luokka);
const street = (...uses) => (layer, p) => layer === 'streets' && !['Rakentamaton', 'Rakentaminen kesken'].includes(p.rakentamisen_tila) && uses.includes(p.kayttotarkoitus);
const line = (...classes) => (layer, p) => layer === 'lines' && classes.includes(p.luokka) && p.voimassaolo !== 'suunnitteilla';
const lane = (...uses) => (layer, p) => layer === 'lanes' && !['Rakentamaton', 'Rakentaminen kesken'].includes(p.rakentamisen_tila) &&
  /^(Ajorata|Ajorata, muu|Pysäköintialue)( \(Silta\))?$/.test(p.alatyyppi ?? '') && uses.includes(p.alueen_kayttotarkoitus);

const MAIN = ['Pääkatu', 'Joukkoliikennekatu'];
const COLLECTOR = ['Kokoojakatu tai -tie', 'Kokoojakatu alueellinen'];
const MOTORWAY = ['Moottoriväylä', 'Yleinen tie'];
const RESIDENTIAL = ['Asuntokatu', 'Pihakatu', 'Hidaskatu', 'Muu toimiluokka', 'Kävelykatu'];
const ALL_STREETS = [...MAIN, ...COLLECTOR, ...MOTORWAY, ...RESIDENTIAL, 'Pysäköintialue', 'Tori', 'Katuaukio'];

// width(z) is in pixels at zoom z, for lines and for the extra outline that
// keeps big roads visible when zoomed out (where their real width is < 1 px).
const grow = (atZ12, atZ17) => z => atZ12 * (atZ17 / atZ12) ** ((Math.min(17, Math.max(12, z)) - 12) / 5);
// Extra road casing in pixels: widest zoomed out, gone by zoom 15 where the
// street's real width is wide enough on its own.
const fade = px => z => (z >= 15 ? 0 : px * (15 - z) / 5);

export const CLASSES = [
  {id: 'land', test: layer => layer === 'land', fill: 'land'},
  {id: 'blocks', test: guide('kerrostalokortteli', 'pientalokortteli'), fill: 'block', minZoom: 13},
  {id: 'industry', test: guide('teollisuuskortteli'), fill: 'industry', minZoom: 13},
  {id: 'fields', test: guide('pelto'), fill: 'field'},
  {id: 'forest', test: guide('metsä'), fill: 'forest'},
  {id: 'parks', test: layer => layer === 'green', fill: 'park'},
  {id: 'water', test: guide('meri', 'joki', 'lampi', 'allas'), fill: 'water'},
  {id: 'squares', test: (l, p) => guide('aukio')(l, p) || street('Tori', 'Katuaukio')(l, p), fill: 'square', minZoom: 14},
  {id: 'paths', test: street('Kevyt liikenne', 'Kevyt liikenne, t/h', 'Erillinen kev.liik.väylä'), fill: 'path', minZoom: 15},
  {id: 'parking', test: street('Pysäköintialue'), fill: 'parking', minZoom: 15},
  {id: 'streets-residential', test: street(...RESIDENTIAL), fill: 'street', minZoom: 13},
  {id: 'streets-collector', test: street(...COLLECTOR), fill: 'collector', outline: fade(1.4), outlineColor: 'outlineCollector', minZoom: 12},
  {id: 'streets-main', test: street(...MAIN), fill: 'main', outline: fade(2.6), outlineColor: 'outlineMain', minZoom: 11},
  {id: 'streets-motorway', test: street(...MOTORWAY), fill: 'motorway', outline: fade(3.2), outlineColor: 'outlineMotorway', minZoom: 10},
  {id: 'bridges', test: guide('silta'), fill: 'bridge', minZoom: 13},
  // Central area, zoomed in: the driving surface on top of the street area, so sidewalks show.
  {id: 'lanes', test: lane(...RESIDENTIAL, 'Pysäköintialue'), fill: 'lane', minZoom: 16},
  {id: 'lanes-big', test: lane(...MAIN, ...COLLECTOR, ...MOTORWAY), fill: 'laneBig', minZoom: 16},
  {id: 'piers', test: line('rantalaituri'), stroke: 'pier', width: grow(0.6, 2.5), minZoom: 14},
  {id: 'light-rail', test: line('pikaraitiotie'), stroke: 'rail', width: grow(0.8, 2.5), minZoom: 12},
  {id: 'metro', test: line('metrorata'), stroke: 'metro', width: grow(1, 3), minZoom: 11},
  {id: 'railway', test: line('rautatie'), stroke: 'rail', width: grow(1, 3.5), dash: 'railDash', minZoom: 11},
];

export const STREET_USES = ALL_STREETS;

export const THEMES = {
  day: {
    outside: '#d7d6d0', sea: '#b4d2cf', water: '#b4d2cf', land: '#ebe9e3',
    block: '#e4e1d9', industry: '#dedbd3', field: '#e3e7d4', forest: '#c6d7b8', park: '#d0dfc3',
    square: '#f1eee8', path: '#f2efe8', parking: '#e6e2da',
    street: '#fbfaf7', collector: '#ffffff', main: '#ffffff', motorway: '#f7e4cf',
    outlineCollector: '#d9d4ca', outlineMain: '#cfc8bb', outlineMotorway: '#d9b48d',
    bridge: '#fdfcfa', lane: '#e1ddd5', laneBig: '#d8d3ca',
    pier: '#cbc5b9', rail: '#959b98', metro: '#d07a4a', railDash: '#f4f2ed',
  },
  dusk: {
    outside: '#101413', sea: '#0e2a2d', water: '#0e2a2d', land: '#1c2321',
    block: '#212927', industry: '#232826', field: '#212a23', forest: '#1d2f27', park: '#21342b',
    square: '#28302d', path: '#262d2b', parking: '#262c2a',
    street: '#323a37', collector: '#5e4c36', main: '#a8743c', motorway: '#c88a43',
    outlineCollector: '#3d3529', outlineMain: '#7a5730', outlineMotorway: '#8f6233',
    bridge: '#3a423f', lane: '#2a312f', laneBig: '#6a5033',
    pier: '#46504c', rail: '#5d6663', metro: '#b4683f', railDash: '#1c2321',
  },
};
