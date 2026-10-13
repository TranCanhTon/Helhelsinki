import test from 'node:test';
import assert from 'node:assert/strict';
import {modeOf, compareLines, activeServices, groupStops, nearestStops, perHourText} from '../src/data/transit.js';
import {parseCsvLine} from '../scripts/lib/gtfs.mjs';

test('HSL route types map to modes, unknown types to null', () => {
  assert.equal(modeOf('0'), 'tram');
  assert.equal(modeOf('900'), 'tram');
  assert.equal(modeOf('1'), 'metro');
  assert.equal(modeOf('109'), 'train');
  assert.equal(modeOf('4'), 'ferry');
  assert.equal(modeOf('701'), 'bus');
  assert.equal(modeOf('1700'), null);
});

test('line numbers sort the way people read them', () => {
  assert.deepEqual(['M2', '71N', '9', '23', 'M1', '7'].sort(compareLines), ['7', '9', '23', '71N', 'M1', 'M2']);
});

test('services: weekday flags and date range, then added and removed dates', () => {
  const calendar = [
    {service_id: 'tue', tuesday: '1', start_date: '20261001', end_date: '20261031'},
    {service_id: 'mon', monday: '1', tuesday: '0', start_date: '20261001', end_date: '20261031'},
    {service_id: 'old', tuesday: '1', start_date: '20260901', end_date: '20260930'},
  ];
  const exceptions = [{service_id: 'tue', date: '20261020', exception_type: '2'}, {service_id: 'extra', date: '20261020', exception_type: '1'}];
  assert.deepEqual([...activeServices(calendar, exceptions, '20261027')], ['tue']);
  assert.deepEqual([...activeServices(calendar, exceptions, '20261020')], ['extra']);
});

test('platforms with the same name and type close together form one stop', () => {
  const p = (name, mode, dx) => ({name, mode, position: [25 + dx / 55600, 60]});
  const groups = groupStops([p('Vaasankatu', 'bus', 0), p('Vaasankatu', 'bus', 40), p('Vaasankatu', 'tram', 20), p('Vaasankatu', 'bus', 900)]);
  assert.equal(groups[0], groups[1]);
  assert.notEqual(groups[0], groups[2]);
  assert.notEqual(groups[0], groups[3]);
});

test('nearest stops: closest platform per stop, within the radius, at most three', () => {
  const x = dx => 25 + dx / 55600;
  const near = nearestStops([[x(300), 60, 0], [x(100), 60, 0], [x(200), 60, 1], [x(50), 60, 2], [x(250), 60, 3], [x(2000), 60, 4]]);
  assert.deepEqual(near([25, 60]).map(s => s.group), [2, 0, 1]);
  assert.equal(near([25, 60])[1].distanceM, 100);
  assert.deepEqual(nearestStops([[x(2000), 60, 0]])([25, 60]), []);
});

test('departures per hour in words, missing stays missing', () => {
  assert.equal(perHourText(89, 2), '45 per hour');
  assert.equal(perHourText(1, 2), 'under 1 per hour');
  assert.equal(perHourText(0, 2), 'no departures');
  assert.equal(perHourText(null, 2), null);
});

test('CSV lines with quoted commas and doubled quotes', () => {
  assert.deepEqual(parseCsvLine('1,"Käpylä, via ""Kallio""",,0'), ['1', 'Käpylä, via "Kallio"', '', '0']);
  assert.deepEqual(parseCsvLine('a,b,'), ['a', 'b', '']);
});
