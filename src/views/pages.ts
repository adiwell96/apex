import { esc, attr, fDateLong, fDateTime, fTime, relTime, fDate } from '../lib/util.ts';
import type { Card, EditionContent } from '../lib/edition.ts';
import { cardStd, cardRow, cardText, figure, credit, photoBy, meta, badges, href, sectionName, sectionSlug, eventTile, trim } from './components.ts';
import { PHASE_LABEL, type Phase } from '../lib/events.ts';
import { SECTIONS, type Section } from '../shared/sources.ts';

export interface Freshness { last_ok: string | null; last_run_ok: boolean | null; race: string[] }

export function statusPill(f: Freshness) {
  if (!f.last_ok) return '<span class="status-pill down">Noch keine Aktualisierung</span>';
  const age = (Date.now() - Date.parse(f.last_ok)) / 60000;
  const cls = age > 180 || f.last_run_ok === false ? 'down' : age > 90 ? 'stale' : '';
  return `<a href="/status" class="status-pill ${cls}" title="Letzte erfolgreiche Nachrichtenabfrage ${attr(fDateTime(f.last_ok))}">Aktualisiert ${esc(fTime(f.last_ok))} Uhr</a>`;
}

function masthead(c: EditionContent | null, f: Freshness, label?: string) {
  return `<section class="masthead"><div class="wrap">
  <h1 class="mast-title" aria-label="APEX">APEX<span>.</span></h1>
  <div class="mast-meta"><b>The Daily Automotive Journal</b><span>${c ? esc(fDateLong(c.date + 'T12:00:00Z')) : esc(fDateLong(new Date()))}</span>
  ${c ? `<span>Ausgabe Nr. ${c.number}</span><span>Erschienen ${esc(fTime(c.published_at))} Uhr</span>` : ''}${label ? `<span>${esc(label)}</span>` : ''}${statusPill(f)}
  ${f.race.length ? `<a href="/updates" class="badge live">● Rennwochenende: ${esc(f.race[0])}</a>` : ''}</div>
</div></section>`;
}

function cover(c: Card) {
  return `<section class="cover reveal" aria-label="Titelgeschichte"><a href="${href(c)}">
  <div class="cover-label">Titelgeschichte</div>${figure(c, '', true)}
  ${c.image_url ? `<p class="credit">Foto: ${esc(photoBy(c))}</p>` : ''}
  <div class="cover-text"><div class="wrap"><div class="inner">
    <span class="kicker"><b>${esc(sectionName(c.section))}</b></span>
    <h2 class="h h-xl">${esc(c.title)}</h2>${c.dek ? `<p class="dek dek-l">${esc(trim(c.dek, 300))}</p>` : ''}
    ${meta(c)}
  </div></div></div></a></section>`;
}

const sh = (title: string, sub: string, link?: string) => `<div class="section-head"><h2><small>${esc(sub)}</small>${esc(title)}</h2>${link ? `<a href="${link}">Alle Meldungen →</a>` : ''}</div>`;

function gtSection(items: Card[]) {
  if (!items.length) return '';
  const [lead, ...rest] = items;
  const list = rest.slice(0, 4), more = rest.slice(4);
  return `<section class="band" id="gt"><div class="wrap">${sh('GT Racing', 'Ressort · Motorsport', '/ressort/gt-racing')}
  <div class="grid gt-grid"><article class="card reveal"><a href="${href(lead)}">${figure(lead, 'r-16x9')}<span class="kicker">${esc(lead.tags.filter((t) => !['gt3', 'gt4'].includes(t))[0]?.toUpperCase() || 'GT Racing')}</span><h3 class="h h-l">${esc(lead.title)}</h3>${lead.dek ? `<p class="dek">${esc(trim(lead.dek, 260))}</p>` : ''}</a>${meta(lead)}${credit(lead)}</article>
  <div class="numbered">${list.map((c) => `<a href="${href(c)}"><div><h3 class="h h-s">${esc(c.title)}</h3>${meta(c)}</div></a>`).join('')}</div></div>
  ${more.length ? `<div class="grid gt-more">${more.map((c) => cardStd(c, { size: 's', dek: false })).join('')}</div>` : ''}
  </div></section>`;
}

function chinaSection(items: Card[]) {
  if (!items.length) return '';
  const [a, b, ...rest] = items;
  return `<section class="wrap china" id="china">${sh('China Automotive', 'Ressort · Markt & Hersteller', '/ressort/china')}
  <div class="grid china-grid"><div class="china-mark" aria-hidden="true">中国<small>Berichte aus chinesisch- und englischsprachigen Quellen</small></div>
  ${cardStd(a, { size: 'm' })}<div class="stack">${b ? cardRow(b) : ''}${rest.map((c) => cardRow(c)).join('')}</div></div></section>`;
}

function analysisSection(id: string, title: string, sub: string, slug: string, items: Card[]) {
  if (!items.length) return '';
  const [lead, ...rest] = items;
  return `<section class="wrap" id="${id}">${sh(title, sub, `/ressort/${slug}`)}
  <div class="grid analysis"><article class="lead reveal"><a href="${href(lead)}">${figure(lead, 'r-16x9')}<h3 class="h h-l">${esc(lead.title)}</h3>${lead.dek ? `<p class="dek dek-l">${esc(trim(lead.dek, 300))}</p>` : ''}</a>${meta(lead)}${credit(lead)}</article>
  ${rest.map((c) => `<div class="stack">${cardRow(c, true)}</div>`).join('')}</div></section>`;
}

function techSection(items: Card[]) {
  if (!items.length) return '';
  return `<section class="wrap" id="tech">${sh('Technology & E-Mobility', 'Ressort · Technik', '/ressort/technologie')}
  <div class="grid cards-3">${items.slice(0, 3).map((c) => cardStd(c)).join('')}</div>
  ${items.length > 3 ? `<div class="grid cards-3" style="margin-top:28px">${items.slice(3).map((c) => cardText(c)).join('')}</div>` : ''}</section>`;
}

function productsSection(items: Card[]) {
  if (!items.length) return '';
  return `<section class="wrap" id="products">${sh('New Products', 'Fotostrecke · Neuheiten & Premieren', '/ressort/neuheiten')}
  <div class="gallery" tabindex="0" aria-label="Fotostrecke Neuheiten">${items.map((c) => `<article class="card"><a href="${href(c)}">${figure(c, 'r-4x5')}<h3 class="h h-s">${esc(c.title)}</h3></a>${meta(c)}</article>`).join('')}</div></section>`;
}

function calendarSection(c: EditionContent) {
  const { upcoming, focus } = c.calendar;
  if (!upcoming.length && !focus.length) return `<section class="wrap">${sh('Kalender', 'Motorsport & Messen')}<div class="notice">Noch kein Kalender verbunden. <a class="btn small ghost" href="/kalender/verwalten">Kalender verbinden</a></div></section>`;
  const fx = focus.filter((f) => f.items.length || ['preview', 'live', 'review'].includes(f.phase));
  return `<section class="wrap" id="kalender">${sh('Motorsport- & Messekalender', 'Termine in deutscher Zeit', '/kalender')}
  ${fx.map((f) => `<div class="panel" style="margin-bottom:20px"><span class="kicker">${esc(PHASE_LABEL[f.phase as Phase] ?? f.phase)}</span>
     <h3 class="h h-m"><a href="/kalender/${f.event.id}">${esc(f.event.title)}</a></h3>
     ${f.items.length ? `<div class="stack" style="margin-top:14px">${f.items.map((i) => cardRow(i, false)).join('')}</div>` : '<p class="dek">Noch keine passenden bestätigten Meldungen.</p>'}</div>`).join('')}
  <div class="grid events">${upcoming.slice(0, 8).map(eventTile).join('')}</div></section>`;
}

export function editionView(c: EditionContent, f: Freshness, latest: Card[], archived = false) {
  const s = c.sections;
  const top = c.top;
  return `${masthead(c, f, archived ? 'Archivausgabe' : undefined)}
  ${c.cover ? cover(c.cover) : ''}
  ${!archived && latest.length ? `<div class="wrap" style="margin-top:20px"><div class="notice red"><b>Latest&nbsp;Updates</b><span>${latest.length} neue Meldung${latest.length === 1 ? '' : 'en'} seit Erscheinen der Ausgabe – zuletzt: <a href="${href(latest[0])}"><u>${esc(trim(latest[0].title, 90))}</u></a></span><a class="btn small ghost" href="/updates" style="margin-left:auto">Ansehen</a></div></div>` : ''}
  ${top.length ? `<section class="wrap" id="top">${sh('Die wichtigsten Nachrichten', 'Heute in APEX')}
    <div class="grid top-grid">${cardStd(top[0], { size: 'l', ratio: 'r-16x9' })}<div class="stack">${top.slice(1).map((x) => cardRow(x)).join('')}</div></div></section>` : ''}
  ${gtSection(s.gt)}
  ${chinaSection(s.china)}
  ${analysisSection('global', 'Global Automotive', 'Ressort · Industrie & Strategie', 'global', s.global)}
  ${techSection(s.tech)}
  ${productsSection(s.products)}
  ${calendarSection(c)}
  <div class="wrap"><p class="credit" style="margin-top:48px">Diese Ausgabe wurde am ${esc(fDateTime(c.published_at))} Uhr automatisch zusammengestellt aus ${c.stats.candidates} Meldungen von ${c.stats.sources} Quellen (Zeitraum ab ${esc(fDateTime(c.window_from))}). Sie bleibt im Archiv unverändert. Alle Beiträge verlinken auf ihre Originalquelle.</p></div>`;
}

export function noEditionView(f: Freshness, latest: Card[]) {
  return `${masthead(null, f, 'Vorab')}
  <section class="wrap page"><div class="panel"><span class="kicker">Willkommen</span><h2 class="h h-l">Die erste Ausgabe erscheint um 06:00 Uhr.</h2>
  <p class="dek">APEX stellt jeden Morgen automatisch eine Ausgabe aus den zuletzt erfassten Meldungen zusammen. Sie können die heutige Ausgabe auch sofort erzeugen – sie wird dann unverändert archiviert und um 06:00 Uhr nicht erneut erstellt.</p>
  <form method="post" action="/actions/publish" class="actions" data-confirm="Heutige Ausgabe jetzt veröffentlichen? Sie kann danach nicht mehr geändert werden."><button class="btn">Heutige Ausgabe jetzt erstellen</button><a class="btn ghost" href="/status">Status prüfen</a></form></div>
  ${latest.length ? `${sh('Zuletzt erfasst', 'Latest Updates', '/updates')}<div class="grid cards-3">${latest.slice(0, 9).map((c) => cardStd(c, { size: 's' })).join('')}</div>` : '<p class="empty">Noch keine Meldungen erfasst. Sobald die Pipeline läuft, erscheinen sie hier.</p>'}</section>`;
}

export function updatesView(items: Card[], f: Freshness, since: string | null) {
  const groups = new Map<string, Card[]>();
  for (const c of items) { const d = fDate(c.fetched_at); if (!groups.has(d)) groups.set(d, []); groups.get(d)!.push(c); }
  return `<section class="wrap page"><span class="kicker">Laufend aktualisiert</span><h1 class="page-title">Latest Updates</h1>
  <p class="lede">Neue Meldungen ${since ? `seit der Morgenausgabe (${esc(fTime(since))} Uhr)` : 'der letzten 24 Stunden'}. ${statusPill(f)}</p>
  <div class="notice" style="margin-bottom:28px"><span><b>Hinweis:</b> Dies sind <b>regelmäßig abgefragte Nachrichten</b> (stündlich, an Rennwochenenden alle 15 Minuten) – <b>keine Live-Daten</b>. Ergebnisse stammen ausschließlich aus veröffentlichten Meldungen der Quellen. Für Live-Timing nutzen Sie die offiziellen Seiten der Veranstalter.</span></div>
  ${f.race.length ? `<div class="notice red" style="margin-bottom:28px"><span class="badge live">Rennwochenende</span><span>${f.race.map(esc).join(' · ')} – erhöhte Abfragefrequenz aktiv.</span></div>` : ''}
  ${items.length ? [...groups].map(([d, cs]) => `<h2 class="kicker" style="margin:24px 0 16px">${esc(d)}</h2><div class="timeline">${cs.map((c) => `<div class="tl"><time>${esc(fTime(c.fetched_at))}</time>${cardRow(c)}</div>`).join('')}</div>`).join('') : '<p class="empty">Seit der letzten Ausgabe sind noch keine neuen Meldungen eingegangen.</p>'}
  </section>`;
}

export function sectionView(sec: { id: Section; name: string; slug: string }, items: Card[], page: number, hasMore: boolean) {
  const [lead, ...rest] = items;
  return `<section class="${sec.id === 'gt' ? 'band' : ''}" style="${sec.id === 'gt' ? 'margin-top:0' : ''}"><div class="wrap page">
  <span class="kicker">Ressort</span><h1 class="page-title">${esc(sec.name)}</h1><p class="lede">Alle Meldungen der letzten 7 Tage, nach Relevanz und Aktualität sortiert. Dubletten sind zusammengefasst.</p>
  ${lead && page === 1 ? `<div class="grid top-grid">${cardStd(lead, { ratio: 'r-16x9' })}<div class="stack">${rest.slice(0, 4).map((c) => cardRow(c)).join('')}</div></div>` : ''}
  <div class="grid cards-3" style="margin-top:40px">${(page === 1 ? rest.slice(4) : items).map((c) => cardStd(c, { size: 's' })).join('')}</div>
  ${!items.length ? '<p class="empty">In diesem Ressort liegen aktuell keine Meldungen vor.</p>' : ''}
  <div class="pager">${page > 1 ? `<a class="btn ghost" href="?p=${page - 1}">← Neuer</a>` : '<span></span>'}${hasMore ? `<a class="btn ghost" href="?p=${page + 1}">Ältere →</a>` : ''}</div>
  </div></section>`;
}

export function articleView(c: Card, row: any, fav: boolean, wasRead: boolean, related: Card[], events: { id: number; title: string; starts_at: string }[]) {
  const body = row.ai_body ? renderMarkdown(row.ai_body) : '';
  const verif: Record<string, string> = { official: 'Offizielle Quelle', media: 'Fachmedium', multi: 'Von mehreren Quellen berichtet', unconfirmed: 'Unbestätigt – Quelle beruft sich auf nicht bestätigte Informationen', aggregator: 'Über Google News gefunden – Originalquelle prüfen' };
  const modeTxt: Record<string, string> = { ai: 'KI-redaktionell bearbeitet (Claude) auf Basis der unten genannten Quellen', machine: 'Überschrift und Kurzfassung maschinell übersetzt (Cloudflare Workers AI, m2m100)', original: 'Originaltext der Quelle (deutsch)', untranslated: 'Originaltext der Quelle (noch nicht übersetzt)' };
  return `<div class="article-hero">${c.image_url ? figure(c, '', true) : ''}${c.image_url ? `<div class="wrap">${credit(c)}</div>` : ''}</div>
  <article class="wrap"><div class="article">
    <span class="kicker"><a href="/ressort/${sectionSlug(c.section)}">${esc(sectionName(c.section))}</a><span class="sep">/</span>${esc(c.source_name)}</span>
    <h1 class="h h-xl">${esc(c.title)}</h1>
    ${c.dek && !body ? `<p class="dek dek-l">${esc(c.dek)}</p>` : row.ai_dek ? `<p class="dek dek-l">${esc(row.ai_dek)}</p>` : ''}
    ${c.title !== c.orig_title ? `<p class="orig" lang="${attr(c.lang)}">Originaltitel: „${esc(c.orig_title)}“</p>` : ''}
    <div class="meta"><time datetime="${attr(c.published_at)}">${esc(fDateTime(c.published_at))} Uhr</time>${badges(c, wasRead ? '<span class="badge read">Gelesen</span>' : '')}</div>
    ${body ? `<div class="body ${body.length > 2500 ? 'cols' : ''}">${body}</div>` : ''}
    ${!body && c.mode !== 'original' && row.summary && row.summary !== c.dek ? `<details style="margin-top:18px"><summary class="credit">Original-Kurzbeschreibung anzeigen</summary><p class="dek" lang="${attr(c.lang)}">${esc(row.summary)}</p></details>` : ''}
    <div class="actions">
      <a class="btn" href="${attr(c.url)}" target="_blank" rel="noopener noreferrer">Originalartikel bei ${esc(c.source_name.replace(/ \(via Google News\)$/, ''))} lesen ↗</a>
      <form method="post" action="/actions/fav/${c.id}" data-fav><button class="btn ghost" aria-pressed="${fav}">${fav ? '★ Gemerkt' : '☆ Merken'}</button></form>
    </div>
    ${c.others.length ? `<div class="factbox"><span class="kicker">Weitere Quellen zum Thema</span><p class="credit">Getrennt aufgeführt – die Aussagen der einzelnen Quellen werden nicht vermischt.</p><div class="stack" style="margin-top:12px">${c.others.map((o) => `<div><a href="${attr(o.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(o.source_name)}</b>: ${esc(o.title)} ↗</a></div>`).join('')}</div></div>` : ''}
    <div class="factbox"><span class="kicker">Quelle &amp; Nachweis</span><dl style="margin-top:14px">
      <dt>Quelle</dt><dd>${esc(c.source_name)}</dd>
      <dt>Original-URL</dt><dd><a href="${attr(c.url)}" target="_blank" rel="noopener noreferrer">${esc(trim(c.url, 90))}</a></dd>
      <dt>Veröffentlicht</dt><dd>${esc(fDateTime(c.published_at))} Uhr</dd>
      <dt>Erfasst</dt><dd>${esc(fDateTime(c.fetched_at))} Uhr</dd>
      ${c.author ? `<dt>Autor</dt><dd>${esc(c.author)}</dd>` : ''}
      <dt>Ressort</dt><dd>${esc(sectionName(c.section))}</dd>
      <dt>Relevanz</dt><dd>${Math.round(c.relevance)} / 100 (regelbasiert)</dd>
      <dt>Status</dt><dd>${esc(verif[c.verification] ?? c.verification)}</dd>
      <dt>Bearbeitung</dt><dd>${esc(modeTxt[c.mode])}</dd>
      ${c.image_url ? `<dt>Bild</dt><dd>${esc(c.image_credit || 'Urheber nicht angegeben')} · Bildquelle: <a href="${attr(c.image_url)}" target="_blank" rel="noopener noreferrer">${esc(c.image_source || '')}</a> · aus dem Feed/Artikel der Quelle, eingebunden zur privaten Nutzung</dd>` : ''}
      ${row.ai_sources ? `<dt>KI-Grundlage</dt><dd>${esc(row.ai_sources)}</dd>` : ''}
    </dl>
    ${c.tags.length ? `<div class="tags">${c.tags.map((t) => `<a class="tag" href="/suche?tag=${attr(t)}">${esc(t)}</a>`).join('')}</div>` : ''}</div>
    ${events.length ? `<div class="factbox"><span class="kicker">Verknüpfte Termine</span><div class="stack" style="margin-top:12px">${events.map((e) => `<div><a href="/kalender/${e.id}"><b>${esc(e.title)}</b> · ${esc(fDate(e.starts_at))}</a></div>`).join('')}</div></div>` : ''}
  </div>
  ${related.length ? `<div class="section-head"><h2><small>Mehr aus dem Ressort</small>Weiterlesen</h2></div><div class="grid cards-3">${related.map((r) => cardStd(r, { size: 's', dek: false })).join('')}</div>` : ''}
  </article>`;
}

/** Sehr kleiner, sicherer Markdown-Renderer für Claude-Artikel (Absätze, ##, Listen, **fett**, *kursiv*). */
export function renderMarkdown(md: string) {
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  return md.replace(/\r/g, '').split(/\n{2,}/).map((block) => {
    const b = block.trim();
    if (!b) return '';
    if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
    if (/^[-*] /m.test(b) && b.split('\n').every((l) => /^[-*] /.test(l))) return `<ul>${b.split('\n').map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${inline(b).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

export function listView(title: string, kicker: string, lede: string, items: Card[], empty: string) {
  return `<section class="wrap page"><span class="kicker">${esc(kicker)}</span><h1 class="page-title">${esc(title)}</h1><p class="lede">${lede}</p>
  ${items.length ? `<div class="stack">${items.map((c) => cardRow(c)).join('')}</div>` : `<p class="empty">${esc(empty)}</p>`}</section>`;
}

export { SECTIONS, relTime };
