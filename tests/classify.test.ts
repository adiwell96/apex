import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, titleTokens, similarity, idfFrom, canonicalUrl } from '../src/shared/classify.ts';
import { SOURCES } from '../src/shared/sources.ts';
// @ts-ignore
import { parseICS, zonedToUtc } from '../public/assets/ics.js';

const src = (id: string) => SOURCES.find((s) => s.id === id)!;

test('GT-Meldung landet im GT-Ressort mit Serien-Tags', () => {
  const c = classify('Wright Motorsports adds second Porsche for GT World Challenge Europe', 'The GT3 entry ...', src('carscoops'), 2);
  assert.equal(c.section, 'gt');
  assert.ok(c.tags.includes('gtwc-europe') && c.tags.includes('porsche'));
});
test('China-Hersteller → China-Ressort', () => {
  assert.equal(classify('BYD opens plant in Hungary', 'BYD starts production', src('electrive-en'), 1).section, 'china');
});
test('Gerüchte werden als unbestätigt markiert, deutsche Planungsformulierungen nicht', () => {
  assert.equal(classify('Peugeot reportedly set to quit WEC', '', src('msport-wec'), 1).verification, 'unconfirmed');
  assert.equal(classify('Neues Werk soll ab Mai produzieren', '', src('electrive-de'), 1).verification, 'media');
});
test('Kurze Schlüsselwörter nur als ganzes Wort', () => {
  assert.ok(!classify('Mustang GTD review', 'gtdx', src('carscoops'), 1).tags.includes('nls'));
  assert.ok(classify('NLS-Finale am Nürburgring', '', src('msport-de-gt'), 1).tags.includes('nls'));
});
test('Dubletten: gleiche Meldung verknüpft, unterschiedliche Ereignisse derselben Serie nicht', () => {
  const docs = ['FIA-GT-Weltcup Macau 2026: Heinrich gewinnt Qualirennen, aber Vanthoor stark', 'FIA-GT-Weltcup Macau 2026: Heinrich fährt im Regen auf Pole', 'FIA-GT-Weltcup Macau 2026: Mächtiger Antritt von Lietz',
    'Inter Europol Competition expands to two-car LMP2 program', 'Inter Europol Expands to Two-Car Full-Season Effort', 'Toyota confirms new driver', 'Ferrari wins at Bahrain'].map(titleTokens);
  const idf = idfFrom(docs);
  assert.ok(similarity(docs[0], docs[1], idf) < 0.5, 'Macau-Qualirennen ≠ Macau-Pole');
  assert.ok(similarity(docs[3], docs[4], idf) >= 0.5, 'Inter Europol doppelt');
  assert.ok(similarity(docs[0], docs[2], idf) < 0.5);
  const en = titleTokens('Kevin Estre replaces retired Mike Conway in Toyota’s WEC driver line-up'), de = titleTokens('Endlich offiziell: Kevin Estre ersetzt Mike Conway');
  assert.ok(similarity(en, de, idfFrom([...docs, en, de])) >= 0.5, 'EN/DE gleiche Meldung');
});
test('URL-Normalisierung entfernt Tracking', () => {
  assert.equal(canonicalUrl('https://www.motorsport.com/a/1/?utm_source=RSS&utm_medium=x'), 'https://motorsport.com/a/1');
});
test('ICS: Zeitzonen inkl. Sommerzeit, Ganztag, Zeilenfaltung', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:24h Nürburg\r\n ring\r\nDTSTART;TZID=Europe/Berlin:20270619T160000\r\nDTEND;TZID=Europe/Berlin:20270620T160000\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:b\r\nSUMMARY:IAA\r\nDTSTART;VALUE=DATE:20270907\r\nDTEND;VALUE=DATE:20270913\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:c\r\nSUMMARY:Rolex 24\r\nDTSTART;TZID=America/New_York:20270130T133000\r\nDURATION:PT24H\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const ev = parseICS(ics);
  assert.equal(ev.length, 3);
  assert.equal(ev[0].title, '24h Nürburgring');
  assert.equal(ev[0].start, '2027-06-19T14:00:00.000Z');       // MESZ = UTC+2
  assert.equal(ev[1].allDay, true);
  assert.equal(ev[2].start, '2027-01-30T18:30:00.000Z');       // EST = UTC−5
  assert.equal(ev[2].end, '2027-01-31T18:30:00.000Z');
  assert.equal(new Date(zonedToUtc(2026, 12, 1, 6, 0, 0, 'Europe/Berlin')).toISOString(), '2026-12-01T05:00:00.000Z'); // MEZ
});
