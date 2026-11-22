import { esc, attr, fDateLong, fDateTime, fTime, fDate, berlinDate, eventDay, relTime } from '../lib/util.ts';
import type { Card } from '../lib/edition.ts';
import { cardRow, eventTile, catName, cardStd } from './components.ts';
import { type EventRow, phase, PHASE_LABEL } from '../lib/events.ts';
import { SECTIONS } from '../shared/sources.ts';
import { MAKERS, SERIES } from '../shared/classify.ts';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function calHead(view: string, prev: string, next: string, label: string) {
  const v = (k: string, l: string) => `<a href="/kalender?view=${k}"${view === k ? ' aria-current="page"' : ''}>${l}</a>`;
  return `<div class="cal-head"><div class="seg">${v('liste', 'Übersicht')}${v('monat', 'Monat')}${v('woche', 'Woche')}</div>
  ${prev ? `<div style="display:flex;gap:8px;align-items:center"><a class="btn small ghost" href="${prev}" aria-label="Zurück">←</a><b class="kicker" style="color:var(--ink);min-width:150px;justify-content:center">${esc(label)}</b><a class="btn small ghost" href="${next}" aria-label="Weiter">→</a></div>` : ''}
  <a class="btn small ghost" href="/kalender/verwalten">Kalender verwalten</a></div>`;
}

function nextBlock(next: EventRow | undefined) {
  if (!next) return '';
  const live = Date.now() >= Date.parse(next.starts_at);
  return `<div class="band" style="margin:0 0 32px;padding:28px 0"><div class="wrap"><span class="kicker">${live ? '● Läuft gerade' : 'Countdown zum nächsten Ereignis'}</span>
  <h2 class="h h-l" style="margin-bottom:16px"><a href="/kalender/${next.id}">${esc(next.title)}</a></h2>
  ${live ? `<p class="dek">Seit ${esc(fDateTime(next.starts_at))} Uhr · ${esc(next.location || '')}</p>` : `<div class="countdown" data-countdown="${attr(next.starts_at)}" aria-live="off"></div>`}
  <p class="credit">${esc(fDateLong(next.starts_at))}${next.all_day ? '' : ', ' + esc(fTime(next.starts_at)) + ' Uhr (deutsche Zeit)'}${next.location ? ' · ' + esc(next.location) : ''}</p></div></div>`;
}

export function calendarList(events: EventRow[], hasCalendars: boolean) {
  const next = events.find((e) => Date.parse(e.ends_at) >= Date.now());
  const byMonth = new Map<string, EventRow[]>();
  for (const e of events) { const d = eventDay(e.starts_at, e.all_day); const k = d.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k)!.push(e); }
  return `<section class="page"><div class="wrap"><span class="kicker">Motorsport &amp; Messen</span><h1 class="page-title">Kalender</h1><p class="lede">Alle Zeiten in deutscher Ortszeit (Europe/Berlin). Termine stammen ausschließlich aus Ihren verbundenen Kalendern.</p>
  ${calHead('liste', '', '', '')}</div>${nextBlock(next)}<div class="wrap">
  ${!hasCalendars ? '<div class="notice red"><span>Noch kein Kalender verbunden. Importieren Sie eine .ics-Datei oder hinterlegen Sie eine Kalender-URL (Apple iCloud, Google Kalender, Outlook).</span><a class="btn small" href="/kalender/verwalten" style="margin-left:auto">Jetzt verbinden</a></div>' : ''}
  ${[...byMonth].map(([m, es]) => `<h2 class="section-head" style="margin-top:40px"><span style="font:700 32px/1 var(--cond);text-transform:uppercase">${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</span></h2><div class="grid events">${es.map(eventTile).join('')}</div>`).join('')}
  ${hasCalendars && !events.length ? '<p class="empty">Keine kommenden Termine in den verbundenen Kalendern.</p>' : ''}</div></section>`;
}

export function calendarMonth(events: EventRow[], ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startDow = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = berlinDate();
  const cells: string[] = [];
  const start = Date.UTC(y, m - 1, 1 - startDow);
  const total = Math.ceil((startDow + days) / 7) * 7;
  for (let i = 0; i < total; i++) {
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10);
    const es = events.filter((e) => eventDay(e.starts_at, e.all_day) <= d && eventDay(new Date(Date.parse(e.ends_at) - (e.all_day ? 1 : 0)).toISOString(), e.all_day) >= d);
    cells.push(`<div class="day ${d.slice(0, 7) !== ym ? 'out' : ''} ${d === today ? 'today' : ''}"><span class="num">${+d.slice(8)}</span>${es.map((e) => `<a class="e ${attr(e.category)}" href="/kalender/${e.id}" title="${attr(e.title)}">${esc(e.title)}</a>`).join('')}</div>`);
  }
  const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const nm = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return `<section class="wrap page"><span class="kicker">Motorsport &amp; Messen</span><h1 class="page-title">Kalender</h1>
  ${calHead('monat', `/kalender?view=monat&m=${pm}`, `/kalender?view=monat&m=${nm}`, `${MONTHS[m - 1]} ${y}`)}
  <div class="month" role="grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
  <p class="credit" style="margin-top:12px"><span class="cat cat-race"></span>Rennen <span class="cat cat-show" style="margin-left:12px"></span>Messe <span class="cat cat-premiere" style="margin-left:12px"></span>Premiere <span class="cat" style="margin-left:12px"></span>Sonstiges</p>
  ${events.filter((e) => eventDay(e.starts_at, e.all_day).startsWith(ym)).length ? `<div class="grid events" style="margin-top:28px">${events.filter((e) => eventDay(e.starts_at, e.all_day).startsWith(ym)).map(eventTile).join('')}</div>` : ''}</section>`;
}

export function calendarWeek(events: EventRow[], monday: string) {
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(monday + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10));
  const prev = new Date(Date.parse(monday + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
  const next = new Date(Date.parse(monday + 'T00:00:00Z') + 7 * 86400000).toISOString().slice(0, 10);
  return `<section class="wrap page"><span class="kicker">Motorsport &amp; Messen</span><h1 class="page-title">Kalender</h1>
  ${calHead('woche', `/kalender?view=woche&w=${prev}`, `/kalender?view=woche&w=${next}`, `${fDate(days[0] + 'T12:00:00Z')} – ${fDate(days[6] + 'T12:00:00Z')}`)}
  <div class="stack">${days.map((d) => {
    const es = events.filter((e) => eventDay(e.starts_at, e.all_day) <= d && eventDay(new Date(Date.parse(e.ends_at) - (e.all_day ? 1 : 0)).toISOString(), e.all_day) >= d);
    return `<div style="display:grid;grid-template-columns:110px 1fr;gap:16px"><div><b style="font:700 26px/1 var(--cond)">${+d.slice(8)}.</b><div class="kicker" style="color:var(--muted)">${esc(fDateLong(d + 'T12:00:00Z').split(',')[0])}</div></div>
    <div>${es.length ? es.map((e) => `<div style="margin-bottom:10px"><a href="/kalender/${e.id}"><span class="cat cat-${attr(e.category)}"></span><b>${esc(e.title)}</b></a><div class="credit">${e.all_day ? 'ganztägig' : `${esc(fTime(e.starts_at))} – ${esc(fTime(e.ends_at))} Uhr`}${e.location ? ' · ' + esc(e.location) : ''}</div></div>`).join('') : '<span class="credit">—</span>'}</div></div>`;
  }).join('')}</div></section>`;
}

export function eventDetail(e: EventRow, items: Card[], calName: string) {
  const ph = phase(e);
  const steps: [string, string][] = [['research', '14 Tage vorher: Recherche zu Teilnehmern, Herstellern, Technik'], ['preview', '3 Tage vorher: Vorschau mit Zeitplan und Starterfeld'], ['live', 'Veranstaltungstag: aktuelle Meldungen und bestätigte Ergebnisse'], ['review', 'Folgetag: Nachbericht und Analyse']];
  const pre = items.filter((i) => Date.parse(i.published_at) < Date.parse(e.starts_at));
  const during = items.filter((i) => Date.parse(i.published_at) >= Date.parse(e.starts_at) && Date.parse(i.published_at) <= Date.parse(e.ends_at) + 6 * 3600000);
  const post = items.filter((i) => Date.parse(i.published_at) > Date.parse(e.ends_at) + 6 * 3600000);
  const block = (t: string, list: Card[]) => (list.length ? `<div class="section-head"><h2><small>Verknüpfte Nachrichten</small>${t}</h2></div><div class="stack">${list.map((c) => cardRow(c)).join('')}</div>` : '');
  return `<section class="band" style="margin-top:0;padding-top:0"><div class="wrap page">
  <span class="kicker"><span class="cat cat-${attr(e.category)}"></span>${esc(catName(e.category))}${e.series ? ` · ${esc(e.series.toUpperCase())}` : ''}</span>
  <h1 class="page-title" style="color:var(--on-dark)">${esc(e.title)}</h1>
  <p class="dek dek-l">${esc(fDateLong(e.starts_at))}${e.all_day ? '' : `, ${esc(fTime(e.starts_at))} Uhr`} – ${esc(fDateLong(new Date(Date.parse(e.ends_at) - (e.all_day ? 1000 : 0))))}${e.all_day ? '' : `, ${esc(fTime(e.ends_at))} Uhr`} <span class="credit">(deutsche Zeit)</span></p>
  ${e.location ? `<p class="dek">📍 ${esc(e.location)}</p>` : ''}
  ${Date.parse(e.starts_at) > Date.now() ? `<div class="countdown" data-countdown="${attr(e.starts_at)}" style="margin:20px 0"></div>` : ''}
  <p><span class="badge ${ph === 'live' ? 'live' : ''}">${esc(PHASE_LABEL[ph])}</span></p>
  </div></section>
  <section class="wrap page">
  <div class="two"><div>
    ${e.description ? `<div class="panel"><span class="kicker">Beschreibung aus Ihrem Kalender</span><p style="white-space:pre-line">${esc(e.description)}</p></div>` : ''}
    ${e.url ? `<p><a class="btn" href="${attr(e.url)}" target="_blank" rel="noopener noreferrer">Offizielle Veranstaltungsseite ↗</a></p>` : ''}
    <p class="credit">Kalender: ${esc(calName)}</p></div>
  <div class="panel"><span class="kicker">Redaktionelle Begleitung</span><ol style="padding-left:18px">${steps.map(([k, t]) => `<li style="${k === ph ? 'font-weight:700' : 'color:var(--muted)'}">${esc(t)}</li>`).join('')}</ol>
  <p class="credit">Stichworte für die Recherche: ${esc(e.keywords.split('|').join(', ') || '—')}. Treffer erhalten in der Pipeline einen Relevanzbonus.</p></div></div>
  ${block('Vorschau & Vorberichte', pre)}${block('Am Veranstaltungswochenende', during)}${block('Nachberichte', post)}
  ${!items.length ? '<p class="empty">Noch keine passenden Meldungen gefunden. Sobald Quellen über diese Veranstaltung berichten, erscheinen die Beiträge hier.</p>' : ''}
  </section>`;
}

export function calendarManage(cals: any[], icsFeedUrl: string) {
  return `<section class="wrap page"><span class="kicker">Einstellungen</span><h1 class="page-title">Kalender verwalten</h1>
  <p class="lede">Ihr vorhandener Motorsport- und Messekalender wird per ICS eingebunden. Abonnierte Kalender-URLs werden bei jeder vollständigen Nachrichtenabfrage (stündlich) neu eingelesen.</p>
  <div class="two">
  <form class="panel" method="post" action="/actions/calendar/add"><span class="kicker">Kalender-URL abonnieren</span>
    <div class="field" style="margin-top:14px"><label for="cn">Name</label><input class="input" id="cn" name="name" required maxlength="80" placeholder="Motorsport &amp; Messen"></div>
    <div class="field"><label for="cu">ICS-/Webcal-URL</label><input class="input" id="cu" name="url" required type="text" inputmode="url" placeholder="webcal://p01-caldav.icloud.com/… oder https://calendar.google.com/…/basic.ics"></div>
    <button class="btn">Abonnieren</button>
    <details style="margin-top:14px"><summary class="credit">Wo finde ich die URL?</summary><div class="credit">
      <p><b>Apple Kalender (iCloud):</b> Kalender-App → Kalender → (i) neben dem Kalender → „Öffentlicher Kalender“ aktivieren → Link teilen. Hinweis: Der Link ist für jeden mit der URL lesbar.</p>
      <p><b>Google Kalender:</b> calendar.google.com → Einstellungen → Kalender auswählen → „Privatadresse im iCal-Format“ kopieren.</p>
      <p><b>Outlook:</b> Einstellungen → Kalender → Freigegebene Kalender → Kalender veröffentlichen → ICS-Link.</p></div></details>
  </form>
  <form class="panel" id="ics-upload"><span class="kicker">ICS-Datei importieren</span>
    <div class="field" style="margin-top:14px"><label for="un">Name</label><input class="input" id="un" name="name" maxlength="80" placeholder="z. B. Saison 2027"></div>
    <div class="field"><label for="uf">Datei (.ics)</label><input class="input" id="uf" type="file" accept=".ics,text/calendar"></div>
    <button class="btn">Importieren</button><p id="ics-result" class="credit" aria-live="polite"></p>
    <p class="credit">Die Datei wird direkt in Ihrem Browser gelesen; übertragen werden nur die Termine.</p>
  </form></div>
  <h2 class="section-head"><span style="font:700 28px/1 var(--cond);text-transform:uppercase">Verbundene Kalender</span></h2>
  ${cals.length ? `<div class="scroll-x"><table class="table"><thead><tr><th>Name</th><th>Art</th><th>Termine</th><th>Letzte Synchronisierung</th><th></th></tr></thead><tbody>
  ${cals.map((c) => `<tr><td><b>${esc(c.name)}</b>${c.url ? `<div class="credit">${esc(c.url.replace(/(\/\/[^/]+\/).{6,}(.{6})$/, '$1…$2'))}</div>` : ''}</td><td>${c.kind === 'ics_url' ? 'Abo (URL)' : 'Datei-Import'}</td><td>${c.event_count}</td>
  <td>${c.last_sync_at ? esc(fDateTime(c.last_sync_at)) : '—'}<div class="credit ${c.last_status && c.last_status !== 'ok' ? 'bad' : ''}">${esc(c.last_status || (c.kind === 'ics_url' ? 'wartet auf nächste Abfrage' : ''))}</div></td>
  <td><form method="post" action="/actions/calendar/delete/${c.id}" data-confirm="Kalender „${attr(c.name)}“ und alle Termine entfernen?"><button class="btn small ghost">Entfernen</button></form></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Noch keine Kalender verbunden.</p>'}
  <div class="panel" style="margin-top:32px"><span class="kicker">APEX-Kalender abonnieren (Export)</span>
  <p class="dek">Alle Termine als privater Kalender-Feed – z. B. für Apple Kalender („Ablage → Neues Kalenderabonnement“) oder Google Kalender („Per URL hinzufügen“). Die URL enthält einen geheimen Schlüssel; geben Sie sie nicht weiter.</p>
  <input class="input" readonly value="${attr(icsFeedUrl)}" aria-label="Kalender-Feed-URL"></div></section>`;
}

export function archiveView(editions: { edition_date: string; number: number; item_count: number; cover_title: string | null; published_at: string; trigger: string }[]) {
  const byMonth = new Map<string, typeof editions>();
  for (const e of editions) { const k = e.edition_date.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k)!.push(e); }
  return `<section class="wrap page"><span class="kicker">Alle Ausgaben</span><h1 class="page-title">Archiv</h1>
  <p class="lede">Jede Morgenausgabe wird unverändert gespeichert. Wählen Sie ein Datum oder blättern Sie durch die Monate.</p>
  <form action="/archiv" method="get" class="searchbar" style="max-width:420px;margin-bottom:24px"><input class="input" type="date" name="d" aria-label="Datum" ${editions.length ? `min="${editions[editions.length - 1].edition_date}" max="${editions[0].edition_date}"` : ''}><button class="btn">Öffnen</button></form>
  <p><a class="btn small ghost" href="/suche">Archiv durchsuchen</a></p>
  ${[...byMonth].map(([m, es]) => `<h2 class="section-head"><span style="font:700 28px/1 var(--cond);text-transform:uppercase">${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</span></h2>
  <div class="stack">${es.map((e) => `<a href="/ausgabe/${e.edition_date}" style="display:grid;grid-template-columns:120px 1fr;gap:18px"><div><b style="font:700 30px/1 var(--cond)">${esc(fDate(e.edition_date + 'T12:00:00Z').slice(0, 6))}</b><div class="credit">Nr. ${e.number}</div></div><div><h3 class="h h-s">${esc(e.cover_title || 'Ausgabe ohne Titelgeschichte')}</h3><div class="credit">${e.item_count} Beiträge · erschienen ${esc(fTime(e.published_at))} Uhr${e.trigger === 'manual' ? ' (manuell)' : ''}</div></div></a>`).join('')}</div>`).join('')}
  ${!editions.length ? '<p class="empty">Noch keine Ausgaben im Archiv.</p>' : ''}</section>`;
}

export function searchView(q: string, sec: string, tag: string, items: Card[], total: number) {
  const chips = (list: string[], cur: string, key: string) => list.map((t) => `<a class="tag ${cur === t ? 'on' : ''}" href="/suche?${new URLSearchParams({ ...(q ? { q } : {}), ...(sec && key !== 's' ? { s: sec } : {}), ...(tag && key !== 'tag' ? { tag } : {}), ...(cur === t ? {} : { [key]: t }) })}">${esc(t)}</a>`).join('');
  const series = Object.keys(SERIES).filter((s) => s !== 'f1');
  const makers = Object.keys(MAKERS);
  return `<section class="wrap page"><span class="kicker">Archiv &amp; Meldungen</span><h1 class="page-title">Suche</h1>
  <form class="searchbar" action="/suche" method="get" role="search"><input class="input" type="search" name="q" value="${attr(q)}" placeholder="Stichwort, Hersteller, Modell, Rennserie …" autocomplete="off" enterkeyhint="search" aria-label="Suchbegriff">${sec ? `<input type="hidden" name="s" value="${attr(sec)}">` : ''}${tag ? `<input type="hidden" name="tag" value="${attr(tag)}">` : ''}<button class="btn">Suchen</button></form>
  <div class="filters" aria-label="Ressort">${SECTIONS.map((s) => `<a class="tag ${sec === s.id ? 'on' : ''}" href="/suche?${new URLSearchParams({ ...(q ? { q } : {}), ...(tag ? { tag } : {}), ...(sec === s.id ? {} : { s: s.id }) })}">${esc(s.kicker)}</a>`).join('')}</div>
  <details ${series.includes(tag) ? 'open' : ''}><summary class="kicker" style="cursor:pointer;margin-top:10px">Rennserien</summary><div class="filters">${chips(series, tag, 'tag')}</div></details>
  <details ${makers.includes(tag) ? 'open' : ''}><summary class="kicker" style="cursor:pointer;margin-top:10px">Hersteller</summary><div class="filters">${chips(makers, tag, 'tag')}</div></details>
  ${q || sec || tag ? `<p class="credit" style="margin:20px 0">${total} Treffer${total > items.length ? ` – die ${items.length} relevantesten werden angezeigt` : ''}</p><div class="stack">${items.map((c) => cardRow(c)).join('')}</div>` : '<p class="empty">Durchsucht werden alle erfassten Meldungen – Originaltitel, Übersetzungen, Kurzfassungen, Hersteller- und Serien-Schlagworte.</p>'}
  ${(q || sec || tag) && !items.length ? '<p class="empty">Keine Treffer.</p>' : ''}</section>`;
}

export function statusView(d: any) {
  const row = (j: any) => j ? `<span class="${j.ok ? 'ok' : 'bad'}">${j.ok ? '✓' : '✗'}</span> ${esc(fDateTime(j.started_at))} Uhr · ${esc(j.detail || '')}` : '<span class="credit">noch nie ausgeführt</span>';
  return `<section class="wrap page"><span class="kicker">Betrieb</span><h1 class="page-title">Status</h1>
  <p class="lede">Tatsächlicher Zustand der Automatisierung. Angezeigt wird nur, was wirklich ausgeführt wurde.</p>
  <div class="two">
    <div class="panel"><span class="kicker">Automatisierung</span><table class="table" style="margin-top:10px"><tbody>
      <tr><td>Letzte Nachrichtenabfrage</td><td>${row(d.ingest)}</td></tr>
      <tr><td>Letzte erfolgreiche Abfrage</td><td>${d.ingestOk ? `${esc(fDateTime(d.ingestOk.started_at))} Uhr (${esc(relTime(d.ingestOk.started_at))})` : '—'}</td></tr>
      <tr><td>Letzte Ausgabe</td><td>${row(d.publish)}</td></tr>
      <tr><td>Übersetzung</td><td>${row(d.translate)}</td></tr>
      <tr><td>Pipeline-Anstoß (GitHub)</td><td>${d.dispatchConfigured ? row(d.dispatch) : '<span class="bad">nicht konfiguriert</span> – nur der Zeitplan in GitHub Actions läuft'}</td></tr>
      <tr><td>KI-Artikel (Claude)</td><td>${d.editorial ? row(d.editorial) : '<span class="credit">nicht aktiv – Basismodus (siehe Dokumentation)</span>'}</td></tr>
      <tr><td>Rennwochenende</td><td>${d.race.length ? `<span class="badge live">aktiv</span> ${esc(d.race.join(', '))}` : 'nein'}</td></tr>
      <tr><td>Nächste Ausgabe</td><td>${esc(d.nextEdition)}</td></tr>
    </tbody></table>
    <form method="post" action="/actions/refresh" class="actions"><button class="btn small" ${d.dispatchConfigured ? '' : 'disabled'}>Nachrichten jetzt abrufen</button><a class="btn small ghost" href="/status">Neu laden</a></form></div>
    <div class="panel"><span class="kicker">Kostenlose Kontingente (heute)</span><table class="table" style="margin-top:10px"><tbody>
      <tr><td>Workers-AI-Aufrufe</td><td>${d.aiCalls} / ${d.aiLimit} (eigenes Limit; Free-Tier 10.000 Neuronen/Tag)</td></tr>
      <tr><td>Meldungen gespeichert</td><td>${d.counts.items} gesamt · ${d.counts.today} in 24 h</td></tr>
      <tr><td>Ausgaben im Archiv</td><td>${d.counts.editions}</td></tr>
      <tr><td>Termine</td><td>${d.counts.events}</td></tr>
      <tr><td>Übersetzung offen</td><td>${d.counts.pending}</td></tr>
      <tr><td>Pipeline-Läufe (24 h)</td><td>${d.counts.runs24} (GitHub Actions; Privat-Repo: 2.000 Min./Monat frei)</td></tr>
    </tbody></table><p class="credit">Cloudflare Workers Free: 100.000 Anfragen/Tag · D1 Free: 5 GB, 5 Mio. gelesene / 100.000 geschriebene Zeilen pro Tag. Bei Erreichen eines Limits wird nichts berechnet – Anfragen schlagen dann fehl, die letzte Ausgabe bleibt lesbar.</p></div>
  </div>
  <h2 class="section-head"><span style="font:700 28px/1 var(--cond);text-transform:uppercase">Quellen</span></h2>
  <div class="scroll-x"><table class="table"><thead><tr><th>Quelle</th><th>Art</th><th>Status</th><th>Zuletzt ok</th><th>Meldungen</th><th></th></tr></thead><tbody>
  ${d.sources.map((s: any) => `<tr><td><b>${esc(s.name)}</b><div class="credit">${esc(s.lang.toUpperCase())} · ${esc(s.section)}${s.verified ? ' · in Entwicklung geprüft' : ' · ungeprüft'}</div></td><td>${esc(s.kind)}</td>
  <td class="${s.fail_count ? 'bad' : s.last_ok_at ? 'ok' : ''}">${s.enabled ? '' : '<b>deaktiviert</b> · '}${esc(s.last_error || s.last_status || 'noch nicht abgefragt')}${s.fail_count ? ` (${s.fail_count}× in Folge)` : ''}</td>
  <td>${s.last_ok_at ? esc(relTime(s.last_ok_at)) : '—'}</td><td>${s.item_count}</td>
  <td><form method="post" action="/actions/source/${attr(s.id)}"><button class="btn small ghost">${s.enabled ? 'Deaktivieren' : 'Aktivieren'}</button></form></td></tr>`).join('')}</tbody></table></div>
  <h2 class="section-head"><span style="font:700 28px/1 var(--cond);text-transform:uppercase">Protokoll</span></h2>
  <div class="scroll-x"><table class="table"><thead><tr><th>Zeit</th><th>Job</th><th>Ergebnis</th></tr></thead><tbody>
  ${d.jobs.map((j: any) => `<tr><td style="white-space:nowrap">${esc(fDateTime(j.started_at))}</td><td>${esc(j.job)}</td><td class="${j.ok === 0 ? 'bad' : ''}">${j.ok === null ? 'läuft …' : ''}${esc(j.detail || '')}</td></tr>`).join('')}</tbody></table></div>
  <p style="margin-top:32px"><a class="btn ghost" href="/logout">Abmelden</a></p></section>`;
}

export function loginView(error = '', bye = false) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>APEX · Anmeldung</title>
<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#0b0c0e"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="APEX">
<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="stylesheet" href="/assets/app.css"></head>
<body style="padding:0"><main class="login"><form method="post" action="/login">
<h1 class="mast-title">APEX<span>.</span></h1><p style="font:600 14px/1.4 var(--cond);letter-spacing:.16em;text-transform:uppercase;margin:6px 0 28px">The Daily Automotive Journal · Private Ausgabe</p>
${bye ? '<p>Sie wurden abgemeldet. Zwischengespeicherte Seiten wurden auf diesem Gerät gelöscht.</p>' : ''}
<div class="field"><label for="pw" style="color:#a3a4a8">Passwort</label><input class="input" id="pw" name="password" type="password" autocomplete="current-password" required autofocus></div>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}<button class="btn">Anmelden</button>
<p>Zugriff ausschließlich für den Inhaber. Die Anmeldung bleibt auf diesem Gerät 90 Tage gültig.</p></form></main>
${bye ? '<script src="/assets/logout.js"></script>' : ''}</body></html>`;
}

export { cardStd };
