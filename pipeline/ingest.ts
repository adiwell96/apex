// APEX Nachrichten-Pipeline — läuft in GitHub Actions (kostenloses Kontingent), nicht auf dem Mac.
// Ruft RSS-Feeds und ICS-Kalender ab, klassifiziert, erkennt Dubletten und überträgt alles an den APEX-Worker.
//   APEX_URL=https://apex.<name>.workers.dev PIPELINE_TOKEN=... node pipeline/ingest.ts [full|motorsport]
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { SOURCES, type SourceDef } from '../src/shared/sources.ts';
import { classify, titleTokens, similarity, canonicalUrl, idfFrom } from '../src/shared/classify.ts';
// @ts-ignore – plain JS module shared with the browser
import { parseICS } from '../public/assets/ics.js';

const APEX = (process.env.APEX_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const TOKEN = process.env.PIPELINE_TOKEN || '';
const MODE = (process.argv[2] || process.env.MODE || 'full') as 'full' | 'motorsport';
const UA = 'APEX-Reader/1.0 (private, non-commercial RSS reader)';
const MAX_AGE_H = 72;
const SIM = 0.5;             // Schwelle der gewichteten Titelähnlichkeit für "gleiches Ereignis"

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string, body?: unknown): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(APEX + path, {
        method: body ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.ok) return r.json();
      if (r.status < 500) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
    } catch (e) { if (i === 2) throw e; }
    await sleep(2000 * (i + 1));
  }
}

async function fetchText(url: string, timeout = 20000, retries = 2): Promise<{ status: number; text: string }> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/calendar, text/html;q=0.8, */*;q=0.5' }, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
      const text = await r.text();
      if (r.status >= 500 || r.status === 429) { last = new Error(`HTTP ${r.status}`); await sleep(1500 * (i + 1)); continue; }
      return { status: r.status, text };
    } catch (e) { last = e; await sleep(1500 * (i + 1)); }
  }
  throw last;
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const decode = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
const strip = (html: string) => decode(String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const txt = (v: any): string => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : v['#text'] ?? v.__cdata ?? '');

function cleanSummary(s: string, src: SourceDef): string {
  let out = strip(s)
    .replace(/The post .* appeared first on .*$/i, '')
    .replace(/For details, please visit .*$/i, '')
    .replace(/(Keep reading|Read more|Weiterlesen|Mehr lesen)\s*$/i, '')
    .replace(/\[(…|\.\.\.)\]\s*$/, '…').trim();
  if (src.kind === 'aggregator') out = '';           // Google-News-Snippets enthalten nur Linklisten
  if (out.length > 520) out = out.slice(0, 500).replace(/\s+\S*$/, '') + ' …';
  return out;
}

function pickImage(it: any): { url?: string; credit?: string } {
  const media = it['media:content'] ?? it['media:group']?.['media:content'];
  const arr = Array.isArray(media) ? media : media ? [media] : [];
  const best = arr.filter((m) => m['@_url'] && (!m['@_medium'] || m['@_medium'] === 'image')).sort((a, b) => (+b['@_width'] || 0) - (+a['@_width'] || 0))[0];
  const credit = txt(it['media:credit'] ?? best?.['media:credit']) || undefined;
  if (best) return { url: best['@_url'], credit };
  const enc = Array.isArray(it.enclosure) ? it.enclosure : it.enclosure ? [it.enclosure] : [];
  const img = enc.find((e: any) => String(e['@_type'] || '').startsWith('image') || /\.(jpe?g|png|webp)/i.test(e['@_url'] || ''));
  if (img) return { url: img['@_url'], credit };
  const thumb = it['media:thumbnail'];
  if (thumb?.['@_url']) return { url: thumb['@_url'], credit };
  const html = txt(it['content:encoded']) + txt(it.description) + txt(it.content) + txt(it.summary);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) {
    // WordPress liefert im Feed oft verkleinerte Varianten (…-400x267.jpg) — Originalgröße bevorzugen
    return { url: decode(m[1]).replace(/-\d{2,4}x\d{2,4}(\.(jpe?g|png|webp))$/i, '$1'), credit };
  }
  return { credit };
}

interface RawItem { url: string; title: string; summary: string; published: string; image?: string; credit?: string; author?: string; via?: string }

function parseFeed(xml: string, src: SourceDef): RawItem[] {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', cdataPropName: '__cdata', processEntities: true, htmlEntities: true });
  const doc = p.parse(xml);
  const channel = doc.rss?.channel ?? doc['rdf:RDF'] ?? null;
  const entries: any[] = channel ? [].concat(channel.item ?? doc['rdf:RDF']?.item ?? []) : [].concat(doc.feed?.entry ?? []);
  const out: RawItem[] = [];
  for (const it of entries) {
    let title = strip(txt(it.title));
    let link = txt(it.link);
    if (!link && it.link) {
      const links = [].concat(it.link);
      link = (links.find((l: any) => l['@_rel'] === 'alternate' || !l['@_rel']) as any)?.['@_href'] ?? '';
    }
    if (!link && it.guid && /^https?:/.test(txt(it.guid))) link = txt(it.guid);
    if (!title || !link) continue;
    let via: string | undefined;
    if (src.kind === 'aggregator') {
      via = txt(it.source) || undefined;
      if (via && title.endsWith(` - ${via}`)) title = title.slice(0, -(via.length + 3));
    }
    const date = txt(it.pubDate) || txt(it.published) || txt(it.updated) || txt(it['dc:date']);
    const ts = Date.parse(date);
    const img = pickImage(it);
    out.push({
      url: link.trim(), title, via,
      summary: cleanSummary(txt(it.description) || txt(it.summary) || txt(it.content), src),
      published: isNaN(ts) ? new Date().toISOString() : new Date(Math.min(ts, Date.now())).toISOString(),
      image: img.url, credit: img.credit, author: strip(txt(it['dc:creator']) || txt(it.author?.name) || txt(it.author)) || undefined,
    });
  }
  return out;
}

async function ogImage(url: string): Promise<string | undefined> {
  try {
    const { status, text } = await fetchText(url, 12000, 0);
    if (status !== 200) return;
    const head = text.slice(0, 300000);
    const m = head.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)(?::src)?["'][^>]+content=["']([^"']+)["']/i)
      ?? head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return m ? decode(m[1]) : undefined;
  } catch { return; }
}

async function main() {
  if (!TOKEN) throw new Error('PIPELINE_TOKEN fehlt');
  const started = Date.now();
  const ctx = await api(`/api/pipeline/context?mode=${MODE}`);
  const disabled = new Set<string>(ctx.disabledSources ?? []);
  const eventKeywords: string[] = ctx.eventKeywords ?? [];
  const recent: { id: number; title: string; tokens?: string[] }[] = (ctx.recent ?? []).map((r: any) => ({ ...r, tokens: titleTokens(r.title) }));
  const sources = SOURCES.filter((s) => !disabled.has(s.id) && (MODE === 'full' || s.motorsport));
  log(`Modus ${MODE}: ${sources.length} Quellen, ${eventKeywords.length} Kalender-Stichworte, ${recent.length} jüngste Meldungen`);

  const reports: any[] = [];
  const batch: any[] = [];
  const seen = new Set<string>();

  await Promise.all(sources.map(async (src, i) => {
    await sleep(i * 150);
    try {
      const { status, text } = await fetchText(src.url);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(text.slice(0, 3000))) throw new Error('Antwort ist kein RSS/Atom-Feed');
      const raw = parseFeed(text, src);
      let n = 0;
      for (const r of raw) {
        const ageH = (Date.now() - Date.parse(r.published)) / 3600000;
        if (ageH > MAX_AGE_H) continue;
        const canon = canonicalUrl(r.url);
        const h = hash(canon);
        if (seen.has(h)) continue;
        seen.add(h);
        const c = classify(r.title, r.summary, src, ageH, eventKeywords);
        if (c.drop) continue;
        batch.push({
          url_hash: h, url: r.url, source_id: src.id, source_name: r.via ? `${r.via} (via Google News)` : src.name, lang: src.lang,
          title: r.title.slice(0, 400), summary: r.summary, section: c.section, tags: c.tags, relevance: c.relevance,
          verification: c.verification, image_url: r.image ?? null, image_credit: r.credit ?? null,
          image_source: r.image ? new URL(r.image, r.url).hostname.replace(/^www\./, '') : null,
          author: r.author ?? null, published_at: r.published, _tokens: titleTokens(r.title), _agg: src.kind === 'aggregator',
        });
        n++;
      }
      reports.push({ id: src.id, ok: true, status: `${raw.length} Einträge, ${n} aktuell` });
      log(`✓ ${src.name}: ${raw.length} Einträge, ${n} ≤${MAX_AGE_H}h`);
    } catch (e: any) {
      reports.push({ id: src.id, ok: false, status: 'Fehler', error: String(e?.message || e).slice(0, 300) });
      log(`✗ ${src.name}: ${e?.message || e}`);
    }
  }));

  // Bereits bekannte Meldungen nicht erneut übertragen
  const known: string[] = batch.length ? (await api('/api/pipeline/known', { hashes: batch.map((b) => b.url_hash) })).known : [];
  const knownSet = new Set(known);
  const fresh = batch.filter((b) => !knownSet.has(b.url_hash)).sort((a, b) => b.relevance - a.relevance);

  // Dubletten / gleiche Ereignisse gruppieren — Meldungen bleiben getrennt, werden nur verknüpft
  const idf = idfFrom([...recent.map((r) => r.tokens!), ...fresh.map((f) => f._tokens)]);
  fresh.forEach((it: any, idx) => {
    let best = 0;
    for (const r of recent) {
      const s = similarity(it._tokens, r.tokens!, idf);
      if (s >= SIM && s > best) { best = s; it.related_id = r.id; delete it.related_hash; }
    }
    for (let j = 0; j < idx; j++) {
      const s = similarity(it._tokens, fresh[j]._tokens, idf);
      if (s >= SIM && s > best) { best = s; it.related_hash = fresh[j].url_hash; delete it.related_id; }
    }
  });

  // Fehlende Bilder über og:image der Originalseite ergänzen (begrenzt, höflich)
  const noImg = fresh.filter((f) => !f.image_url && !f._agg).slice(0, 25);
  for (const f of noImg) {
    const img = await ogImage(f.url);
    if (img) { f.image_url = new URL(img, f.url).toString(); f.image_source = new URL(f.image_url).hostname.replace(/^www\./, ''); }
  }

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 40) {
    const chunk = fresh.slice(i, i + 40).map(({ _tokens, _agg, ...rest }) => rest);
    const res = await api('/api/pipeline/items', { items: chunk, offset: i });
    inserted += res.inserted;
  }

  // Kalender-Feeds
  let calReports: string[] = [];
  if (MODE === 'full') {
    for (const cal of ctx.calendars ?? []) {
      try {
        const { status, text } = await fetchText(String(cal.url).replace(/^webcal:/i, 'https:'), 30000);
        if (status !== 200 || !text.includes('BEGIN:VCALENDAR')) throw new Error(`HTTP ${status} / kein ICS`);
        const events = parseICS(text);
        await api('/api/pipeline/events', { calendar_id: cal.id, events, status: 'ok' });
        calReports.push(`${cal.name}: ${events.length} Termine`);
      } catch (e: any) {
        await api('/api/pipeline/events', { calendar_id: cal.id, events: null, status: `Fehler: ${e?.message || e}` });
        calReports.push(`${cal.name}: Fehler`);
      }
    }
  }

  const okCount = reports.filter((r) => r.ok).length;
  const detail = `${MODE}: ${okCount}/${reports.length} Quellen ok, ${fresh.length} neu, ${inserted} gespeichert${calReports.length ? '; ' + calReports.join(', ') : ''} (${Math.round((Date.now() - started) / 1000)}s)`;
  await api('/api/pipeline/finish', { ok: okCount > 0, detail, reports, mode: MODE });
  log(detail);
  if (okCount === 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  try { await api('/api/pipeline/finish', { ok: false, detail: `Abbruch: ${String(e?.message || e).slice(0, 300)}`, reports: [], mode: MODE }); } catch {}
  process.exit(1);
});
