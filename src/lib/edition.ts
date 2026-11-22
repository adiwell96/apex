// Tägliche Morgenausgabe: Auswahl, Gewichtung, unveränderlicher Snapshot.
import { type Env, berlinDate, nowIso, jobStart, jobEnd, parseTags } from './util.ts';
import { translatePending } from './translate.ts';
import { type EventRow, phase, linkedItems } from './events.ts';
import type { Section } from '../shared/sources.ts';

export interface Card {
  id: number; url: string; title: string; orig_title: string; dek: string; lang: string;
  mode: 'ai' | 'machine' | 'original' | 'untranslated'; source_name: string; source_id: string;
  published_at: string; fetched_at: string; section: Section; tags: string[]; relevance: number; verification: string;
  image_url: string | null; image_credit: string | null; image_source: string | null; author: string | null;
  others: { source_name: string; url: string; title: string }[];
}

export function toCard(r: any, others: Card['others'] = []): Card {
  const mode: Card['mode'] = r.ai_title ? 'ai' : r.lang === 'de' ? 'original' : r.title_de ? 'machine' : 'untranslated';
  const title = r.ai_title || (r.lang === 'de' ? r.title : r.title_de) || r.title;
  const dek = r.ai_dek || (r.lang === 'de' ? r.summary : r.summary_de) || (mode === 'untranslated' ? r.summary : '') || '';
  const distinct = new Set([r.source_id, ...others.map((o) => o.source_name)]).size;
  return {
    id: r.id, url: r.url, title, orig_title: r.title, dek, lang: r.lang, mode, source_name: r.source_name, source_id: r.source_id,
    published_at: r.published_at, fetched_at: r.fetched_at, section: r.section, tags: parseTags(r.tags), relevance: r.relevance,
    verification: r.verification === 'unconfirmed' ? 'unconfirmed' : distinct > 1 ? 'multi' : r.verification,
    image_url: r.image_url, image_credit: r.image_credit, image_source: r.image_source, author: r.author, others,
  };
}

/** Gruppiert Meldungen nach Story-Cluster; beste Meldung bleibt, weitere Quellen werden verlinkt (nicht vermischt). */
export function dedupe(rows: any[]): Card[] {
  const byCluster = new Map<number, any[]>();
  for (const r of rows) {
    const k = r.cluster_id ?? r.id;
    if (!byCluster.has(k)) byCluster.set(k, []);
    byCluster.get(k)!.push(r);
  }
  const out: Card[] = [];
  for (const group of byCluster.values()) {
    group.sort((a, b) => b.relevance + (b.image_url ? 3 : 0) - (a.relevance + (a.image_url ? 3 : 0)));
    const [lead, ...rest] = group;
    const others = rest.filter((o) => o.source_id !== lead.source_id || o.url !== lead.url).map((o) => ({ source_name: o.source_name, url: o.url, title: o.title }));
    const card = toCard(lead, others);
    card.relevance = lead.relevance + Math.min(rest.length, 3) * 4; // mehrfach berichtet = wichtiger
    out.push(card);
  }
  return out.sort((a, b) => b.relevance - a.relevance);
}

export interface EditionContent {
  date: string; number: number; published_at: string; window_from: string;
  cover: Card | null; top: Card[]; sections: Record<Section, Card[]>;
  calendar: { upcoming: EventRow[]; focus: { event: EventRow; phase: string; items: Card[] }[] };
  stats: { candidates: number; sources: number };
}

const QUOTA: Record<Section, number> = { gt: 8, china: 5, global: 5, tech: 5, products: 6 };
const MIN_REL = 6;

export async function publishEdition(env: Env, trigger: 'cron' | 'manual') {
  const date = berlinDate();
  const exists = await env.DB.prepare('SELECT id FROM editions WHERE edition_date = ?').bind(date).first();
  if (exists) return { status: 'exists', date };
  const job = await jobStart(env, 'publish');
  try {
    const prev = await env.DB.prepare('SELECT published_at FROM editions ORDER BY edition_date DESC LIMIT 1').first<{ published_at: string }>();
    const floor = Date.now() - 36 * 3600000;
    const from = new Date(Math.max(floor, Math.min(Date.now() - 24 * 3600000, prev ? Date.parse(prev.published_at) - 2 * 3600000 : floor))).toISOString();

    const load = () => env.DB.prepare('SELECT * FROM items WHERE (published_at >= ?1 OR fetched_at >= ?1) AND published_at >= ?2 ORDER BY relevance DESC LIMIT 400')
      .bind(from, new Date(Date.now() - 72 * 3600000).toISOString()).all<any>();
    let { results } = await load();
    const pending = results.filter((r) => r.translation === 'pending').slice(0, 45).map((r) => r.id);
    if (pending.length) { await translatePending(env, 45, pending); ({ results } = await load()); }

    const cards = dedupe(results).filter((c) => c.relevance >= MIN_REL);
    const used = new Set<number>();
    const coverPool = cards.filter((c) => c.image_url && c.verification !== 'unconfirmed');
    const cover = coverPool[0] ?? cards[0] ?? null;
    if (cover) used.add(cover.id);
    const top = cards.filter((c) => !used.has(c.id)).slice(0, 5);
    top.forEach((c) => used.add(c.id));
    const sections = {} as Record<Section, Card[]>;
    for (const s of Object.keys(QUOTA) as Section[]) {
      sections[s] = cards.filter((c) => c.section === s && !used.has(c.id)).slice(0, QUOTA[s]);
      sections[s].forEach((c) => used.add(c.id));
    }

    const { results: upcoming } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? ORDER BY starts_at LIMIT 10').bind(nowIso()).all<EventRow>();
    const { results: around } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? AND starts_at <= ? ORDER BY starts_at LIMIT 8')
      .bind(new Date(Date.now() - 1.5 * 86400000).toISOString(), new Date(Date.now() + 3 * 86400000).toISOString()).all<EventRow>();
    const focus = [];
    for (const e of around) focus.push({ event: e, phase: phase(e), items: dedupe(await linkedItems(env, e, 6)).slice(0, 4) });

    const n = await env.DB.prepare('SELECT COUNT(*) n FROM editions').first<{ n: number }>();
    const content: EditionContent = {
      date, number: (n?.n ?? 0) + 1, published_at: nowIso(), window_from: from, cover, top, sections,
      calendar: { upcoming, focus },
      stats: { candidates: results.length, sources: new Set(results.map((r) => r.source_id)).size },
    };
    const count = (cover ? 1 : 0) + top.length + Object.values(sections).reduce((a, b) => a + b.length, 0);
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO editions(edition_date, number, published_at, trigger, item_count, cover_title, content) VALUES (?,?,?,?,?,?,?)')
      .bind(date, content.number, content.published_at, trigger, count, cover?.title ?? null, JSON.stringify(content)).run();
    if (!ins.meta.changes) { await jobEnd(env, job, true, 'bereits vorhanden (Doppelveröffentlichung verhindert)'); return { status: 'exists', date }; }
    await jobEnd(env, job, true, `Ausgabe ${date} Nr. ${content.number}: ${count} Beiträge aus ${content.stats.sources} Quellen (${trigger})`);
    return { status: 'published', date, count };
  } catch (e: any) {
    await jobEnd(env, job, false, `Fehler: ${e?.message || e}`);
    throw e;
  }
}

export async function getEdition(env: Env, date?: string) {
  const r = date
    ? await env.DB.prepare('SELECT * FROM editions WHERE edition_date = ?').bind(date).first<any>()
    : await env.DB.prepare('SELECT * FROM editions ORDER BY edition_date DESC LIMIT 1').first<any>();
  if (!r) return null;
  return { ...r, content: JSON.parse(r.content) as EditionContent };
}
