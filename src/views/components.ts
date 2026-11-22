import { esc, attr, fTime, fDayMonth, fDateTime, relTime, eventDay, fWeekday } from '../lib/util.ts';
import type { Card } from '../lib/edition.ts';
import { SECTIONS } from '../shared/sources.ts';
import type { EventRow } from '../lib/events.ts';

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5"/>',
  theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 0 0 0-16z" fill="currentColor"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  archive: '<rect x="3" y="4" width="18" height="5"/><path d="M5 9v11h14V9M10 13h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>',
};
export const icon = (n: keyof typeof I) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${I[n]}</svg>`;

export const sectionName = (id: string) => SECTIONS.find((s) => s.id === id)?.kicker ?? id;
export const sectionSlug = (id: string) => SECTIONS.find((s) => s.id === id)?.slug ?? id;

const LANG = { en: 'EN', zh: '中文', de: 'DE' } as Record<string, string>;
export function badges(c: Card, extra = '') {
  const b: string[] = [];
  if (c.mode === 'ai') b.push('<span class="badge ai" title="Von Claude redaktionell bearbeitet – auf Basis der verlinkten Quellen">KI-redaktionell</span>');
  else if (c.mode === 'machine') b.push(`<span class="badge mt" title="Automatisch übersetzt aus ${LANG[c.lang] ?? c.lang}">Übersetzt · ${LANG[c.lang] ?? c.lang}</span>`);
  else if (c.mode === 'untranslated') b.push(`<span class="badge mt" title="Noch nicht übersetzt">Original · ${LANG[c.lang] ?? c.lang}</span>`);
  if (c.verification === 'unconfirmed') b.push('<span class="badge warn" title="Bericht beruht auf nicht bestätigten Informationen">Unbestätigt</span>');
  if (c.verification === 'multi') b.push(`<span class="badge multi" title="Von mehreren Quellen berichtet">${c.others.length + 1} Quellen</span>`);
  if (c.verification === 'official') b.push('<span class="badge multi">Offizielle Quelle</span>');
  if (c.verification === 'aggregator') b.push('<span class="badge" title="Über Google News gefunden">Aggregator</span>');
  return b.join('') + extra;
}

export function meta(c: Card, opts: { time?: boolean } = {}) {
  const t = opts.time === false ? '' : `<time datetime="${attr(c.published_at)}" title="${attr(fDateTime(c.published_at))}">${esc(relTime(c.published_at))}</time>`;
  return `<div class="meta"><span class="src">${esc(c.source_name)}</span>${t}${badges(c)}</div>`;
}

export function figure(c: { image_url: string | null; section: string; title: string }, cls = '', eager = false) {
  const ph = `<div class="ph" aria-hidden="true"><span>APEX</span><em>${esc(sectionName(c.section))}</em></div>`;
  if (!c.image_url) return `<figure class="fig noimg ${cls}">${ph}</figure>`;
  return `<figure class="fig ${cls}"><img src="${attr(c.image_url)}" alt="" referrerpolicy="no-referrer" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${ph}</figure>`;
}
export const photoBy = (c: Card) => c.image_credit || c.source_name.replace(/ \(via Google News\)$/, '');
export const credit = (c: Card) => (c.image_url ? `<div class="credit">Foto: <b>${esc(photoBy(c))}</b>${c.image_credit ? ` · via ${esc(c.source_name)}` : ''}</div>` : '');

export const href = (c: Card) => `/artikel/${c.id}`;

export function cardStd(c: Card, opts: { size?: 'l' | 'm' | 's'; ratio?: string; dek?: boolean } = {}) {
  return `<article class="card reveal"><a href="${href(c)}">${figure(c, opts.ratio ?? '')}
    <span class="kicker">${esc(sectionName(c.section))}</span>
    <h3 class="h h-${opts.size ?? 'm'}">${esc(c.title)}</h3>${opts.dek !== false && c.dek ? `<p class="dek">${esc(trim(c.dek, 200))}</p>` : ''}</a>${meta(c)}</article>`;
}
export function cardRow(c: Card, withImg = true) {
  const img = withImg && c.image_url;
  return `<article class="row ${img ? '' : 'row-noimg'}"><div><a href="${href(c)}"><span class="kicker">${esc(sectionName(c.section))}</span><h3 class="h h-s">${esc(c.title)}</h3>${c.dek ? `<p class="dek">${esc(trim(c.dek, 160))}</p>` : ''}</a>${meta(c)}</div>${img ? `<a href="${href(c)}" tabindex="-1" aria-hidden="true">${figure(c)}</a>` : ''}</article>`;
}
export function cardText(c: Card) {
  return `<article><a href="${href(c)}"><h3 class="h h-s">${esc(c.title)}</h3></a>${meta(c)}</article>`;
}

export const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s);

export function eventTile(e: EventRow) {
  const day = eventDay(e.starts_at, e.all_day);
  const days = Math.ceil((Date.parse(e.starts_at) - Date.now()) / 86400000);
  const live = Date.now() >= Date.parse(e.starts_at) && Date.now() <= Date.parse(e.ends_at);
  const cd = live ? '<span class="cd">● Läuft</span>' : days <= 0 ? '<span class="cd">Heute</span>' : `<span class="cd">in ${days} ${days === 1 ? 'Tag' : 'Tagen'}</span>`;
  return `<a class="ev" href="/kalender/${e.id}">${cd}<div class="date">${esc(fDayMonth(day + 'T12:00:00Z'))}<small>${esc(fWeekday(day + 'T12:00:00Z'))}${e.all_day ? '' : ' · ' + esc(fTime(e.starts_at))}</small></div>
    <div class="t">${esc(e.title)}</div><div class="loc"><span class="cat cat-${attr(e.category)}"></span>${esc(e.location || catName(e.category))}</div></a>`;
}
export const catName = (c: string) => ({ race: 'Rennveranstaltung', show: 'Automesse', premiere: 'Premiere', other: 'Termin' } as Record<string, string>)[c] ?? 'Termin';
