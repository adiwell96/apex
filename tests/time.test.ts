import { test } from 'node:test';
import assert from 'node:assert/strict';
import { berlinParts } from '../src/lib/util.ts';

test('06:00 Uhr Berlin – Winterzeit (MEZ, UTC+1) = 05:00 UTC', () => {
  const p = berlinParts(new Date('2026-12-01T05:00:00Z'));
  assert.equal(p.date, '2026-12-01'); assert.equal(p.hour, 6); assert.equal(p.minute, 0);
});
test('06:00 Uhr Berlin – Sommerzeit (MESZ, UTC+2) = 04:00 UTC', () => {
  const p = berlinParts(new Date('2027-07-01T04:00:00Z'));
  assert.equal(p.hour, 6);
});
test('Zeitumstellungstag Ende März', () => {
  assert.equal(berlinParts(new Date('2027-03-28T04:00:00Z')).hour, 6); // nach Umstellung um 02:00
  assert.equal(berlinParts(new Date('2027-03-27T05:00:00Z')).hour, 6); // Vortag, noch MEZ
});
test('Datumswechsel: 23:30 UTC ist in Berlin bereits der nächste Tag', () => {
  assert.equal(berlinParts(new Date('2026-12-31T23:30:00Z')).date, '2027-01-01');
});
