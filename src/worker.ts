// APEX — The Daily Automotive Journal · Cloudflare Worker (Free-Plan)
import { type Env, html, json, redirect, nowIso, berlinParts, berlinDate, jobStart, jobEnd, lastJob, getUsage, SECURITY_HEADERS, esc } from './lib/util.ts';
import { isAuthenticated, createSessionCookie, clearCookie, safeEqual, loginBlocked, recordFail, bearerOk, sameOrigin } from './lib/auth.ts';
import { publishEdition, getEdition, dedupe, toCard } from './lib/edition.ts';
import { translatePending } from './lib/translate.ts';
import { eventKeywords, raceWeekend, linkedItems, upsertEvents, type EventRow } from './lib/events.ts';
import { layout } from './views/layout.ts';
import { editionView, noEditionView, updatesView, sectionView, articleView, listView, type Freshness } from './views/pages.ts';
import { calendarList, calendarMonth, calendarWeek, eventDetail, calendarManage, archiveView, searchView, statusView, loginView } from './views/pages2.ts';
import { SOURCES, SECTIONS } from './shared/sources.ts';

const PUBLIC = [/^\/login$/, /^\/assets\/app\.css$/, /^\/assets\/logout\.js$/, /^\/fonts\//, /^\/icons\//, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/robots\.txt$/];

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    try {
      if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain', ...SECURITY_HEADERS } });
      if (p.startsWith('/api/pipeline/')) return pipelineApi(req, env, ctx, p);
      if (p.startsWith('/api/editorial/')) return editorialApi(req, env, p);
      if (p.startsWith('/kalender/feed/')) return icsFeed(env, p);
      if (p === '/login') return login(req, env, url);
      if (p === '/logout') return redirect('/login?bye=1', { 'set-cookie': clearCookie() });

      if (PUBLIC.some((r) => r.test(p))) return asset(req, env);
      if (!(await isAuthenticated(req, env))) {
        if (p.startsWith('/actions/') || req.headers.get('accept')?.includes('application/json')) return json({ error: 'unauthorized' }, 401);
        return redirect(`/login?next=${encodeURIComponent(p + url.search)}`);
      }
      if (/^\/(assets|fonts|icons)\//.test(p)) return asset(req, env);
      if (req.method === 'POST') {
        if (!sameOrigin(req)) return json({ error: 'csrf' }, 403);
        return actions(req, env, ctx, p);
      }
      return pages(req, env, url);
    } catch (e: any) {
      console.error(e);
      return html(layout({ title: 'Fehler', body: `<section class="wrap page"><h1 class="page-title">Etwas ist schiefgelaufen.</h1><p class="lede">${esc(e?.message || e)}</p><a class="btn" href="/">Zur Ausgabe</a></section>` }), 500);
    }
  },

  async scheduled(ev: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runSchedule(env, new Date(ev.scheduledTime)));
  },
};

async function asset(req: Request, env: Env) {
  const r = await env.ASSETS.fetch(req);
  const res = new Response(r.body, r);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
  if (new URL(req.url).pathname.startsWith('/fonts/')) res.headers.set('cache-control', 'public, max-age=31536000, immutable');
  return res;
}

// ── Anmeldung ─────────────────────────────────────────────────────────
async function login(req: Request, env: Env, url: URL) {
  if (req.method === 'GET') {
    if (await isAuthenticated(req, env)) return redirect('/');
    return html(loginView('', url.searchParams.has('bye')));
  }
  if (!sameOrigin(req)) return html(loginView('Ungültige Anfrage.'), 403);
  if (!env.APP_PASSWORD || env.APP_PASSWORD.length < 12 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32)
    return html(loginView('APEX ist noch nicht eingerichtet: APP_PASSWORD (≥ 12 Zeichen) und SESSION_SECRET (≥ 32 Zeichen) fehlen.'), 503);
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  if (await loginBlocked(env, ip)) return html(loginView('Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.'), 429);
  const form = await req.formData();
  const pw = String(form.get('password') || '');
  if (!(await safeEqual(pw, env.APP_PASSWORD, env.SESSION_SECRET))) {
    await recordFail(env, ip);
    return html(loginView('Falsches Passwort.'), 401);
  }
  const next = url.searchParams.get('next') || '/';
  return redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/', { 'set-cookie': await createSessionCookie(env) });
}

// ── Seiten ────────────────────────────────────────────────────────────
async function freshness(env: Env): Promise<Freshness> {
  const [ok, last, race] = await Promise.all([lastJob(env, 'ingest', true), lastJob(env, 'ingest'), raceWeekend(env)]);
  return { last_ok: ok?.started_at ?? null, last_run_ok: last ? !!last.ok : null, race: race.map((r) => r.title) };
}

async function latestSince(env: Env, since: string | null, limit = 150) {
  const from = since ?? new Date(Date.now() - 86400000).toISOString();
  const { results } = await env.DB.prepare('SELECT * FROM items WHERE fetched_at > ? AND published_at > ? ORDER BY fetched_at DESC LIMIT ?').bind(from, new Date(Date.now() - 72 * 3600000).toISOString(), limit).all<any>();
  return dedupe(results).sort((a, b) => b.fetched_at.localeCompare(a.fetched_at));
}

async function pages(req: Request, env: Env, url: URL): Promise<Response> {
  const p = url.pathname;
  const page = (title: string, active: string, body: string) => html(layout({ title, active, body }));

  if (p === '/' || p.startsWith('/ausgabe/')) {
    const date = p.startsWith('/ausgabe/') ? p.slice(9) : undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound();
    const [ed, f] = await Promise.all([getEdition(env, date), freshness(env)]);
    if (!ed) {
      if (date) return notFound('Für dieses Datum gibt es keine Ausgabe.');
      return page('', '/', noEditionView(f, await latestSince(env, null, 30)));
    }
    const isToday = ed.edition_date === berlinDate();
    const latest = !date || isToday ? await latestSince(env, ed.published_at, 60) : [];
    return page(date ? `Ausgabe ${date}` : '', date ? '/archiv' : '/', editionView(ed.content, f, latest, !!date && !isToday));
  }
  if (p === '/updates') {
    const ed = await getEdition(env);
    const since = ed && ed.edition_date === berlinDate() ? ed.published_at : null;
    return page('Latest Updates', '/updates', updatesView(await latestSince(env, since), await freshness(env), since));
  }
  if (p.startsWith('/ressort/')) {
    const sec = SECTIONS.find((s) => s.slug === p.slice(9));
    if (!sec) return notFound();
    const pg = Math.max(1, +(url.searchParams.get('p') || 1));
    const { results } = await env.DB.prepare('SELECT * FROM items WHERE section = ? AND published_at > ? ORDER BY relevance DESC LIMIT 500').bind(sec.id, new Date(Date.now() - 7 * 86400000).toISOString()).all<any>();
    const all = dedupe(results);
    const per = 25;
    return page(sec.name, p, sectionView(sec, all.slice((pg - 1) * per, pg * per), pg, all.length > pg * per));
  }
  if (p.startsWith('/artikel/')) {
    const id = +p.slice(9);
    const row = await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<any>();
    if (!row) return notFound('Dieser Artikel existiert nicht.');
    const [{ results: cluster }, fav, wasRead, { results: rel }] = await Promise.all([
      env.DB.prepare('SELECT * FROM items WHERE cluster_id = ? AND id != ? ORDER BY relevance DESC LIMIT 8').bind(row.cluster_id ?? row.id, row.id).all<any>(),
      env.DB.prepare('SELECT 1 FROM favorites WHERE item_id = ?').bind(id).first(),
      env.DB.prepare('SELECT 1 FROM reads WHERE item_id = ?').bind(id).first(),
      env.DB.prepare('SELECT * FROM items WHERE section = ? AND id != ? AND published_at > ? ORDER BY relevance DESC LIMIT 12').bind(row.section, id, new Date(Date.now() - 3 * 86400000).toISOString()).all<any>(),
    ]);
    await env.DB.prepare('INSERT OR IGNORE INTO reads(item_id, read_at) VALUES (?, ?)').bind(id, nowIso()).run();
    const card = toCard(row, cluster.map((o) => ({ source_name: o.source_name, url: o.url, title: o.title })));
    const tagList = card.tags;
    const { results: evs } = await env.DB.prepare('SELECT id, title, starts_at, series, keywords FROM events WHERE ends_at >= ? AND starts_at <= ? ORDER BY starts_at LIMIT 40')
      .bind(new Date(Date.parse(row.published_at) - 3 * 86400000).toISOString(), new Date(Date.parse(row.published_at) + 14 * 86400000).toISOString()).all<any>();
    const text = `${row.title} ${row.summary || ''}`.toLowerCase();
    const linked = evs.filter((e) => (e.series && tagList.includes(e.series)) || String(e.keywords).split('|').some((k: string) => k.length > 4 && text.includes(k))).slice(0, 4);
    return page(card.title, `/ressort/${SECTIONS.find((s) => s.id === row.section)?.slug}`, articleView(card, row, !!fav, !!wasRead, dedupe(rel).filter((r) => r.id !== card.id && !cluster.some((c) => c.id === r.id)).slice(0, 3), linked));
  }
  if (p === '/kalender') {
    const view = url.searchParams.get('view') || 'liste';
    const cals = await env.DB.prepare('SELECT COUNT(*) n FROM calendars').first<{ n: number }>();
    if (view === 'monat') {
      const m = /^\d{4}-\d{2}$/.test(url.searchParams.get('m') || '') ? url.searchParams.get('m')! : berlinDate().slice(0, 7);
      const from = new Date(Date.parse(m + '-01T00:00:00Z') - 8 * 86400000).toISOString(), to = new Date(Date.parse(m + '-01T00:00:00Z') + 45 * 86400000).toISOString();
      const { results } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? AND starts_at <= ? ORDER BY starts_at').bind(from, to).all<EventRow>();
      return page('Kalender', '/kalender', calendarMonth(results, m));
    }
    if (view === 'woche') {
      const w = url.searchParams.get('w');
      const today = new Date(berlinDate() + 'T00:00:00Z');
      const monday = /^\d{4}-\d{2}-\d{2}$/.test(w || '') ? w! : new Date(+today - ((today.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
      const { results } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? AND starts_at <= ? ORDER BY starts_at').bind(new Date(Date.parse(monday) - 86400000).toISOString(), new Date(Date.parse(monday) + 8 * 86400000).toISOString()).all<EventRow>();
      return page('Kalender', '/kalender', calendarWeek(results, monday));
    }
    const { results } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? ORDER BY starts_at LIMIT 200').bind(nowIso()).all<EventRow>();
    return page('Kalender', '/kalender', calendarList(results, (cals?.n ?? 0) > 0));
  }
  if (p === '/kalender/verwalten') {
    const { results } = await env.DB.prepare('SELECT * FROM calendars ORDER BY id').all();
    return page('Kalender verwalten', '/kalender', calendarManage(results, `${url.origin}/kalender/feed/${await feedToken(env)}.ics`));
  }
  if (/^\/kalender\/\d+$/.test(p)) {
    const e = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(+p.slice(10)).first<EventRow>();
    if (!e) return notFound('Termin nicht gefunden.');
    const cal = await env.DB.prepare('SELECT name FROM calendars WHERE id = ?').bind(e.calendar_id).first<{ name: string }>();
    return page(e.title, '/kalender', eventDetail(e, dedupe(await linkedItems(env, e, 30)).sort((a, b) => a.published_at.localeCompare(b.published_at)), cal?.name ?? ''));
  }
  if (p === '/archiv') {
    const d = url.searchParams.get('d');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return redirect(`/ausgabe/${d}`);
    const { results } = await env.DB.prepare('SELECT edition_date, number, item_count, cover_title, published_at, trigger FROM editions ORDER BY edition_date DESC LIMIT 400').all<any>();
    return page('Archiv', '/archiv', archiveView(results));
  }
  if (p === '/suche') return page('Suche', '/suche', await search(env, url));
  if (p === '/merkliste') {
    const { results } = await env.DB.prepare('SELECT i.* FROM favorites f JOIN items i ON i.id = f.item_id ORDER BY f.created_at DESC LIMIT 200').all<any>();
    return page('Merkliste', '/merkliste', listView('Merkliste', 'Gespeichert', 'Ihre gemerkten Artikel – unabhängig vom Archiv dauerhaft verfügbar.', results.map((r) => toCard(r)), 'Noch keine Artikel gemerkt. Nutzen Sie „☆ Merken“ in einem Artikel.'));
  }
  if (p === '/status') return page('Status', '/status', statusView(await statusData(env)));
  return notFound();
}

const notFound = (msg = 'Diese Seite gibt es nicht.') => html(layout({ title: 'Nicht gefunden', body: `<section class="wrap page"><span class="kicker">404</span><h1 class="page-title">${esc(msg)}</h1><a class="btn" href="/">Zur aktuellen Ausgabe</a></section>` }), 404);

async function search(env: Env, url: URL) {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  const sec = url.searchParams.get('s') || '';
  const tag = (url.searchParams.get('tag') || '').replace(/[^a-z0-9-]/g, '');
  if (!q && !sec && !tag) return searchView('', '', '', [], 0);
  const where: string[] = [], args: unknown[] = [];
  let from = 'items i';
  if (q) {
    const toks = q.replace(/["*():^]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8);
    if (toks.length) { from = 'items_fts f JOIN items i ON i.id = f.rowid'; where.push('items_fts MATCH ?'); args.push(toks.map((t) => `"${t}"*`).join(' ')); }
  }
  if (sec) { where.push('i.section = ?'); args.push(sec); }
  if (tag) { where.push('i.tags LIKE ?'); args.push(`%|${tag}|%`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ results }, cnt] = await Promise.all([
    env.DB.prepare(`SELECT i.* FROM ${from} ${w} ORDER BY i.published_at DESC LIMIT 80`).bind(...args).all<any>(),
    env.DB.prepare(`SELECT COUNT(*) n FROM ${from} ${w}`).bind(...args).first<{ n: number }>(),
  ]);
  return searchView(q, sec, tag, results.map((r) => toCard(r)), cnt?.n ?? 0);
}

async function statusData(env: Env) {
  const [ingest, ingestOk, publish, translate, dispatch, editorial, race] = await Promise.all([
    lastJob(env, 'ingest'), lastJob(env, 'ingest', true), lastJob(env, 'publish'), lastJob(env, 'translate'), lastJob(env, 'dispatch'), lastJob(env, 'editorial'), raceWeekend(env)]);
  const since = new Date(Date.now() - 86400000).toISOString();
  const c = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) n FROM items'), env.DB.prepare('SELECT COUNT(*) n FROM items WHERE fetched_at > ?').bind(since),
    env.DB.prepare('SELECT COUNT(*) n FROM editions'), env.DB.prepare('SELECT COUNT(*) n FROM events'),
    env.DB.prepare(`SELECT COUNT(*) n FROM items WHERE translation = 'pending'`), env.DB.prepare(`SELECT COUNT(*) n FROM job_runs WHERE job = 'ingest' AND started_at > ?`).bind(since),
  ]);
  const n = (i: number) => (c[i].results[0] as any).n;
  await syncSources(env);
  const { results: srcRows } = await env.DB.prepare('SELECT * FROM sources').all<any>();
  const sources = SOURCES.map((s) => ({ ...s, ...srcRows.find((r) => r.id === s.id), verified: s.verified, section: s.section }));
  const { results: jobs } = await env.DB.prepare('SELECT * FROM job_runs ORDER BY id DESC LIMIT 40').all();
  const hasToday = await env.DB.prepare('SELECT 1 FROM editions WHERE edition_date = ?').bind(berlinDate()).first();
  return {
    ingest, ingestOk, publish, translate, dispatch, editorial, race: race.map((r) => r.title),
    dispatchConfigured: !!(env.GITHUB_TOKEN && env.GITHUB_REPO), aiCalls: await getUsage(env, 'ai_calls'), aiLimit: +(env.AI_DAILY_LIMIT || 400),
    counts: { items: n(0), today: n(1), editions: n(2), events: n(3), pending: n(4), runs24: n(5) }, sources, jobs,
    nextEdition: hasToday ? 'morgen, 06:00 Uhr (Europe/Berlin)' : berlinParts().hour >= 6 ? 'beim nächsten Zeitplan-Lauf (≤ 15 Min.)' : 'heute, 06:00 Uhr (Europe/Berlin)',
  };
}

// ── Aktionen (POST, angemeldet) ───────────────────────────────────────
async function actions(req: Request, env: Env, ctx: ExecutionContext, p: string): Promise<Response> {
  const wantsJson = req.headers.get('accept')?.includes('application/json');
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/actions\/fav\/(\d+)$/))) {
    const id = +m[1];
    const ex = await env.DB.prepare('SELECT 1 FROM favorites WHERE item_id = ?').bind(id).first();
    if (ex) await env.DB.prepare('DELETE FROM favorites WHERE item_id = ?').bind(id).run();
    else await env.DB.prepare('INSERT INTO favorites(item_id, created_at) VALUES (?, ?)').bind(id, nowIso()).run();
    return wantsJson ? json({ favorite: !ex }) : redirect(`/artikel/${id}`);
  }
  if (p === '/actions/publish') {
    const r = await publishEdition(env, 'manual');
    return redirect(r.status === 'published' || r.status === 'exists' ? '/' : '/status');
  }
  if (p === '/actions/refresh') {
    await dispatchPipeline(env, 'full', 'manuell');
    return redirect('/status');
  }
  if (p === '/actions/calendar/add') {
    const f = await req.formData();
    const name = String(f.get('name') || '').trim().slice(0, 80);
    let u = String(f.get('url') || '').trim().replace(/^webcal:\/\//i, 'https://');
    if (!name || !/^https:\/\/[^\s]+$/.test(u)) return html(layout({ title: 'Fehler', body: '<section class="wrap page"><h1 class="page-title">Ungültige Kalender-URL</h1><p class="lede">Erlaubt sind https:// oder webcal:// Adressen.</p><a class="btn" href="/kalender/verwalten">Zurück</a></section>' }), 400);
    await env.DB.prepare(`INSERT INTO calendars(name, kind, url, last_status) VALUES (?, 'ics_url', ?, 'wartet auf nächste Abfrage')`).bind(name, u).run();
    ctx.waitUntil(dispatchPipeline(env, 'full', 'Kalender hinzugefügt'));
    return redirect('/kalender/verwalten');
  }
  if (p === '/actions/calendar/upload') {
    const body = await req.json<any>().catch(() => null);
    if (!body || !Array.isArray(body.events)) return json({ error: 'Ungültige Daten' }, 400);
    const cal = await env.DB.prepare(`INSERT INTO calendars(name, kind) VALUES (?, 'upload') RETURNING id`).bind(String(body.name || 'Kalender').slice(0, 80)).first<{ id: number }>();
    await upsertEvents(env, cal!.id, body.events);
    const c = await env.DB.prepare('SELECT event_count FROM calendars WHERE id = ?').bind(cal!.id).first<{ event_count: number }>();
    return json({ ok: true, count: c?.event_count ?? 0 });
  }
  if ((m = p.match(/^\/actions\/calendar\/delete\/(\d+)$/))) {
    await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE calendar_id = ?').bind(+m[1]), env.DB.prepare('DELETE FROM calendars WHERE id = ?').bind(+m[1])]);
    return redirect('/kalender/verwalten');
  }
  if ((m = p.match(/^\/actions\/source\/([a-z0-9-]+)$/))) {
    await syncSources(env);
    await env.DB.prepare('UPDATE sources SET enabled = 1 - enabled WHERE id = ?').bind(m[1]).run();
    return redirect('/status');
  }
  return json({ error: 'not found' }, 404);
}

// ── Pipeline-API (GitHub Actions, Bearer-Token) ───────────────────────
async function syncSources(env: Env) {
  await env.DB.batch(SOURCES.map((s) => env.DB.prepare(`INSERT INTO sources(id, name, url, homepage, lang, kind, default_section, motorsport, weight) VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, url = excluded.url, homepage = excluded.homepage, lang = excluded.lang, kind = excluded.kind, default_section = excluded.default_section, motorsport = excluded.motorsport, weight = excluded.weight`)
    .bind(s.id, s.name, s.url, s.homepage, s.lang, s.kind, s.section ?? null, s.motorsport ? 1 : 0, s.weight)));
}

async function pipelineApi(req: Request, env: Env, ctx: ExecutionContext, p: string): Promise<Response> {
  if (!(await bearerOk(req, env.PIPELINE_TOKEN, env))) return json({ error: 'unauthorized' }, 401);
  if (p === '/api/pipeline/context') {
    await syncSources(env);
    const [dis, kws, { results: recent }, { results: calendars }] = await Promise.all([
      env.DB.prepare('SELECT id FROM sources WHERE enabled = 0').all<{ id: string }>(), eventKeywords(env),
      env.DB.prepare('SELECT id, title FROM items WHERE fetched_at > ? ORDER BY id DESC LIMIT 800').bind(new Date(Date.now() - 72 * 3600000).toISOString()).all(),
      env.DB.prepare(`SELECT id, name, url FROM calendars WHERE kind = 'ics_url'`).all(),
    ]);
    return json({ disabledSources: dis.results.map((r) => r.id), eventKeywords: kws, recent, calendars });
  }
  const body = await req.json<any>();
  if (p === '/api/pipeline/known') {
    const hashes: string[] = (body.hashes || []).slice(0, 2000);
    const known: string[] = [];
    for (let i = 0; i < hashes.length; i += 90) {
      const part = hashes.slice(i, i + 90);
      const { results } = await env.DB.prepare(`SELECT url_hash FROM items WHERE url_hash IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ url_hash: string }>();
      known.push(...results.map((r) => r.url_hash));
    }
    return json({ known });
  }
  if (p === '/api/pipeline/items') {
    const items: any[] = (body.items || []).slice(0, 50);
    const now = nowIso();
    const ins = items.map((it) => env.DB.prepare(`INSERT OR IGNORE INTO items(url_hash, url, source_id, source_name, lang, title, summary, translation, section, tags, relevance, verification, image_url, image_credit, image_source, author, published_at, fetched_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(String(it.url_hash).slice(0, 64), String(it.url).slice(0, 1000), it.source_id, String(it.source_name).slice(0, 120), it.lang, String(it.title).slice(0, 400),
      it.summary ? String(it.summary).slice(0, 1200) : null, it.lang === 'de' ? 'original' : 'pending', it.section, `|${(it.tags || []).join('|')}|`, +it.relevance || 0, it.verification,
      it.image_url && /^https?:\/\//.test(it.image_url) ? String(it.image_url).slice(0, 1000) : null, it.image_credit ? String(it.image_credit).slice(0, 200) : null, it.image_source ?? null, it.author ? String(it.author).slice(0, 120) : null,
      new Date(it.published_at).toISOString(), now));
    const res = await env.DB.batch(ins);
    const inserted = res.filter((r) => (r.meta.changes || 0) > 0).length;
    await env.DB.batch(items.map((it) => env.DB.prepare(`UPDATE items SET cluster_id = COALESCE((SELECT COALESCE(cluster_id, id) FROM items WHERE id = ?2), (SELECT COALESCE(cluster_id, id) FROM items WHERE url_hash = ?3), id) WHERE url_hash = ?1 AND cluster_id IS NULL`)
      .bind(it.url_hash, it.related_id ?? null, it.related_hash ?? null)));
    return json({ inserted });
  }
  if (p === '/api/pipeline/events') {
    if (Array.isArray(body.events)) await upsertEvents(env, +body.calendar_id, body.events);
    else await env.DB.prepare('UPDATE calendars SET last_sync_at = ?, last_status = ? WHERE id = ?').bind(nowIso(), String(body.status).slice(0, 200), +body.calendar_id).run();
    return json({ ok: true });
  }
  if (p === '/api/pipeline/finish') {
    const now = nowIso();
    const stmts = (body.reports || []).map((r: any) => env.DB.prepare(`UPDATE sources SET last_fetch_at = ?1, last_ok_at = CASE WHEN ?2 THEN ?1 ELSE last_ok_at END, last_status = ?3, last_error = ?4,
      fail_count = CASE WHEN ?2 THEN 0 ELSE fail_count + 1 END, item_count = (SELECT COUNT(*) FROM items WHERE source_id = ?5) WHERE id = ?5`).bind(now, r.ok ? 1 : 0, r.status ?? null, r.ok ? null : String(r.error || '').slice(0, 300), r.id));
    stmts.push(env.DB.prepare('INSERT INTO job_runs(job, started_at, finished_at, ok, detail) VALUES (?, ?, ?, ?, ?)').bind('ingest', now, now, body.ok ? 1 : 0, String(body.detail || '').slice(0, 1000)));
    await env.DB.batch(stmts);
    ctx.waitUntil(translatePending(env, 20));
    return json({ ok: true });
  }
  return json({ error: 'not found' }, 404);
}

// ── Claude-Redaktion (Claude-Code-Routine, eigener Token) ─────────────
async function editorialApi(req: Request, env: Env, p: string): Promise<Response> {
  if (!(await bearerOk(req, env.EDITORIAL_TOKEN, env))) return json({ error: 'unauthorized' }, 401);
  if (p === '/api/editorial/candidates' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM items WHERE fetched_at > ? AND ai_title IS NULL ORDER BY relevance DESC LIMIT 300').bind(new Date(Date.now() - 30 * 3600000).toISOString()).all<any>();
    const byCluster = new Map<number, any[]>();
    for (const r of results) { const k = r.cluster_id ?? r.id; byCluster.set(k, [...(byCluster.get(k) || []), r]); }
    const out = [...byCluster.values()].map((g) => ({
      item_id: g[0].id, section: g[0].section, relevance: g[0].relevance + (g.length - 1) * 4,
      sources: g.map((r) => ({ source: r.source_name, url: r.url, lang: r.lang, title: r.title, summary: r.summary, published_at: r.published_at, verification: r.verification })),
    })).sort((a, b) => b.relevance - a.relevance).slice(0, 20);
    return json({ generated_at: nowIso(), rules: 'Nur Fakten aus den angegebenen Quellen verwenden. Keine erfundenen Zitate, Daten oder Ergebnisse. Unbestätigtes kennzeichnen. Abweichende Aussagen verschiedener Quellen getrennt nennen.', candidates: out });
  }
  if (p === '/api/editorial/articles' && req.method === 'POST') {
    const job = await jobStart(env, 'editorial');
    const body = await req.json<any>();
    const arts: any[] = (body.articles || []).slice(0, 20);
    const ok = arts.filter((a) => a.item_id && a.title_de && a.body_de && String(a.body_de).length < 12000);
    if (ok.length) await env.DB.batch(ok.map((a) => env.DB.prepare('UPDATE items SET ai_title = ?, ai_dek = ?, ai_body = ?, ai_at = ?, ai_sources = ? WHERE id = ?')
      .bind(String(a.title_de).slice(0, 300), a.dek_de ? String(a.dek_de).slice(0, 600) : null, String(a.body_de), nowIso(), (a.sources || []).join(' · ').slice(0, 1500), +a.item_id)));
    await jobEnd(env, job, ok.length > 0, `${ok.length} von ${arts.length} KI-Artikeln übernommen`);
    return json({ accepted: ok.length });
  }
  return json({ error: 'not found' }, 404);
}

// ── Kalender-Export (geheimer Token in der URL, für Kalender-Apps) ────
async function feedToken(env: Env) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('apex-ics-feed-v1')));
  return [...sig.slice(0, 18)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function icsFeed(env: Env, p: string) {
  const tok = p.slice('/kalender/feed/'.length).replace(/\.ics$/, '');
  if (!env.SESSION_SECRET || !(await safeEqual(tok, await feedToken(env), env.SESSION_SECRET))) return new Response('Not found', { status: 404 });
  const { results } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? ORDER BY starts_at LIMIT 1000').bind(new Date(Date.now() - 60 * 86400000).toISOString()).all<EventRow>();
  const d = (iso: string, allDay: number) => (allDay ? `;VALUE=DATE:${iso.slice(0, 10).replace(/-/g, '')}` : `:${iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`);
  const escI = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//APEX//Daily Automotive Journal//DE', 'X-WR-CALNAME:APEX Motorsport & Messen', 'X-WR-TIMEZONE:Europe/Berlin'];
  for (const e of results) lines.push('BEGIN:VEVENT', `UID:apex-${e.id}-${escI(e.uid).slice(0, 100)}`, `DTSTAMP:${nowIso().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART${d(e.starts_at, e.all_day)}`, `DTEND${d(e.ends_at, e.all_day)}`, `SUMMARY:${escI(e.title)}`, ...(e.location ? [`LOCATION:${escI(e.location)}`] : []), ...(e.url ? [`URL:${e.url}`] : []), 'END:VEVENT');
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n'), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=900', 'x-robots-tag': 'noindex' } });
}

// ── Zeitsteuerung (Cloudflare Cron, alle 15 Minuten) ──────────────────
async function dispatchPipeline(env: Env, mode: 'full' | 'motorsport', reason: string) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return false;
  const job = await jobStart(env, 'dispatch');
  try {
    const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW || 'ingest.yml'}/dispatches`, {
      method: 'POST', headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'apex-worker', 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { mode } }),
    });
    await jobEnd(env, job, r.status === 204, `${mode} (${reason}): HTTP ${r.status}${r.status === 204 ? '' : ' ' + (await r.text()).slice(0, 200)}`);
    return r.status === 204;
  } catch (e: any) { await jobEnd(env, job, false, `${mode}: ${e?.message || e}`); return false; }
}

export async function runSchedule(env: Env, at: Date) {
  const b = berlinParts(at);
  const publishHour = +(env.PUBLISH_HOUR || 6);
  // 1) Morgenausgabe um 06:00 Europe/Berlin (holt verpasste Läufe nach; doppelte Veröffentlichung ist ausgeschlossen)
  if (b.hour >= publishHour) {
    try { await publishEdition(env, 'cron'); } catch (e) { console.error('publish failed', e); }
  }
  // 2) Nachrichtenabfrage anstoßen
  const slot = Math.floor(b.minute / 15);
  const race = (await raceWeekend(env)).length > 0;
  if (b.hour === publishHour - 1 && slot === 2) await dispatchPipeline(env, 'full', 'vor der Morgenausgabe');
  else if (race && b.hour >= 7 && b.hour <= 23) await dispatchPipeline(env, slot === 0 ? 'full' : 'motorsport', 'Rennwochenende');
  else if (slot === 0 && (b.hour >= 6 || b.hour % 2 === 0)) await dispatchPipeline(env, 'full', 'stündlich');
  // 3) Übersetzungen nachziehen
  await translatePending(env, 10).catch(() => {});
  // 4) Aufräumen (nachts): Protokolle 30 Tage, Meldungen 365 Tage (Ausgaben selbst sind Snapshots und bleiben)
  if (b.hour === 3 && slot === 0) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM job_runs WHERE started_at < ?').bind(new Date(Date.now() - 30 * 86400000).toISOString()),
      env.DB.prepare('DELETE FROM items WHERE published_at < ? AND id NOT IN (SELECT item_id FROM favorites)').bind(new Date(Date.now() - 365 * 86400000).toISOString()),
      env.DB.prepare('DELETE FROM usage_daily WHERE day < ?').bind(berlinDate(new Date(Date.now() - 90 * 86400000))),
    ]);
  }
}
