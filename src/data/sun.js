// Where the sun is over Helsinki at a given moment, and when it rises and sets.
// The NOAA solar calculator formulas (gml.noaa.gov/grad/solcalc), good to about a
// minute for these years. No Cesium here, so the tests run it in Node.
const RAD = Math.PI / 180;
const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD), tan = d => Math.tan(d * RAD);
const asin = x => Math.asin(x) / RAD, acos = x => Math.acos(Math.max(-1, Math.min(1, x))) / RAD;
const mod = (a, n) => ((a % n) + n) % n;

// Helsinki centre (Senate Square). The sun's position changes by under 0.2° across the city.
export const HELSINKI = {lat: 60.1695, lon: 24.9525};
export const TIME_ZONE = 'Europe/Helsinki';

// Sun declination (degrees) and equation of time (minutes) at a moment.
function orbit(ms) {
  const jc = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
  const l0 = mod(280.46646 + jc * (36000.76983 + jc * 0.0003032), 360);
  const m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const centre = sin(m) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + sin(2 * m) * (0.019993 - 0.000101 * jc) + sin(3 * m) * 0.000289;
  const omega = 125.04 - 1934.136 * jc;
  const apparentLong = l0 + centre - 0.00569 - 0.00478 * sin(omega);
  const obliquity = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60 + 0.00256 * cos(omega);
  const declination = asin(sin(obliquity) * sin(apparentLong));
  const y = tan(obliquity / 2) ** 2;
  const equationOfTime = 4 / RAD * (y * sin(2 * l0) - 2 * e * sin(m) + 4 * e * y * sin(m) * cos(2 * l0) - 0.5 * y * y * sin(4 * l0) - 1.25 * e * e * sin(2 * m));
  return {declination, equationOfTime};
}

// Light bending in the air lifts the sun a little near the horizon (NOAA formula, degrees).
function refraction(elevation) {
  if (elevation > 85) return 0;
  const t = tan(elevation);
  const arcsec = elevation > 5 ? 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5
    : elevation > -0.575 ? 1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)))
    : -20.772 / t;
  return arcsec / 3600;
}

// Sun at a moment (Date or ms): azimuth in degrees clockwise from north, and its height
// above the horizon in degrees as seen (with refraction).
export function sunPosition(when, {lat, lon} = HELSINKI) {
  const ms = +when, {declination, equationOfTime} = orbit(ms);
  const minutes = mod(ms / 60000, 1440);
  const solarTime = mod(minutes + equationOfTime + 4 * lon, 1440);
  const hourAngle = solarTime / 4 < 0 ? solarTime / 4 + 180 : solarTime / 4 - 180;
  const zenith = acos(sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle));
  const elevation = 90 - zenith;
  const a = acos((sin(lat) * cos(zenith) - sin(declination)) / (cos(lat) * sin(zenith)));
  const azimuth = hourAngle > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
  return {azimuth, elevation: elevation + refraction(elevation)};
}

// Sunrise, solar noon and sunset (ms) on the local day that contains noonMs.
// Each is worked out again at its own time so the sun's movement during the day counts.
export function sunTimes(noonMs, {lat, lon} = HELSINKI) {
  const event = (ms, sign) => {
    for (let i = 0; i < 3; i++) {
      const {declination, equationOfTime} = orbit(ms);
      const noon = Math.floor(noonMs / 86400000) * 86400000 + (720 - 4 * lon - equationOfTime) * 60000;
      if (!sign) { ms = noon; continue; }
      const cosHour = cos(90.833) / (cos(lat) * cos(declination)) - tan(lat) * tan(declination);
      if (cosHour < -1 || cosHour > 1) return null;   // sun up all day or down all day
      ms = noon + sign * 4 * acos(cosHour) * 60000;
    }
    return ms;
  };
  return {sunrise: event(noonMs, -1), noon: event(noonMs, 0), sunset: event(noonMs, 1)};
}

// Minutes between Helsinki clock time and UTC at a moment (120 in winter, 180 in summer).
export function helsinkiOffset(ms) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'})
    .formatToParts(new Date(ms)).map(p => [p.type, +p.value]));
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(ms / 60000) * 60000) / 60000);
}

// The day the Sun tab shows: the 21st of a month (solstices and equinoxes fall near it),
// as UTC ms of Helsinki midnight, plus its sunrise, sunset and clock offset.
// month: 0 = January.
export function sunDay(year, month) {
  const utcNoon = Date.UTC(year, month, 21, 12);
  const offset = helsinkiOffset(utcNoon);
  const midnight = Date.UTC(year, month, 21) - offset * 60000;
  return {year, month, day: 21, midnight, offset, ...sunTimes(utcNoon)};
}

// Compass point of an azimuth: 0 = N, 1 = NE ... 7 = NW.
export const compassPoint = azimuth => Math.round(mod(azimuth, 360) / 45) % 8;
