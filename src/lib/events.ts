// Kalenderlogik: Kategorisierung, Stichworte für die Recherche, redaktionelle Phasen, Rennwochenend-Erkennung.
import { SERIES } from '../shared/classify.ts';
import { type Env, berlinDate, nowIso } from './util.ts';

export interface EventRow {
  id: number; calendar_id: number; uid: string; title: string; starts_at: string; ends_at: string; all_day: number;
  location: string | null; description: string | null; url: string | null; category: string; series: string | null; keywords: string;
}

const RACE = ['race', 'rennen', 'grand prix', ' gp', '24h', '24 h', 'hours', 'stunden', '6h', '8h', '10h', '12h', '1000', 'qualifying', 'test', 'prolog', 'round', 'lauf', 'sprint', 'endurance', 'nls', 'dtm', 'wec', 'imsa', 'elms', 'gtwc', 'gt world', 'igtc', 'gt masters', 'le mans', 'daytona', 'sebring', 'spa', 'nürburgring', 'nurburgring', 'monza', 'bathurst', 'motorsport', 'rally', 'rallye'];
const SHOW = ['motor show', 'auto show', 'autosalon', 'salon', 'automesse', 'messe', 'iaa', 'ces', 'auto china', 'auto shanghai', 'beijing', 'goodwood', 'festival', 'sema', 'mondial', 'geneva', 'genf', 'japan mobility', 'expo', 'essen motor', 'techno classica', 'pebble beach', 'monterey', 'concours'];
const PREMIERE = ['premiere', 'weltpremiere', 'reveal', 'launch', 'unveil', 'präsentation', 'vorstellung', 'debut'];
const GENERIC = new Set(['round', 'race', 'rennen', 'lauf', 'event', 'test', 'testing', 'tage', 'days', 'hours', 'stunden', 'world', 'challenge', 'series', 'serie', 'championship', 'meisterschaft', 'europe', 'europa', 'cup', 'motor', 'show', 'the', 'and', 'von', 'der', 'die', 'das', 'des', 'grand', 'prix', 'weekend', 'wochenende']);

const has = (t: string, w: string) => t.includes(w);

export function categorize(title: string, description = '') {
  const t = ` ${title.toLowerCase()} ${description.toLowerCase().slice(0, 300)} `;
  let series: string | null = null;
  for (const [k, ws] of Object.entries(SERIES)) {
    if (['gt3', 'gt4', 'gt2', 'bop'].includes(k)) continue;
    if (ws.some((w) => (w.trim().length <= 4 ? new RegExp(`(^|[^a-z0-9])${w.trim()}([^a-z0-9]|$)`).test(t) : t.includes(w)))) { series = k; break; }
  }
  let category = 'other';
  if (SHOW.some((w) => has(t, w))) category = 'show';
  else if (PREMIERE.some((w) => has(t, w))) category = 'premiere';
  else if (series || RACE.some((w) => has(t, w))) category = 'race';

  const words = title.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} -]+/gu, ' ').split(/[\s-]+/).filter((w) => w.length > 3 && !GENERIC.has(w) && !/^\d+$/.test(w));
  const kw = new Set<string>(words);
  if (series) for (const w of SERIES[series]) if (w.trim().length > 3) kw.add(w.trim());
  return { category, series, keywords: [...kw].slice(0, 12).join('|') };
}

export type Phase = 'research' | 'preview' | 'live' | 'review' | 'past' | 'future';
export function phase(e: EventRow, now = Date.now()): Phase {
  const s = Date.parse(e.starts_at), en = Date.parse(e.ends_at);
  if (now >= s && now <= en) return 'live';
  const dStart = (s - now) / 86400000;
  if (dStart > 0 && dStart <= 3) return 'preview';
  if (dStart > 3 && dStart <= 14) return 'research';
  const dEnd = (now - en) / 86400000;
  if (dEnd > 0 && dEnd <= 1.5) return 'review';
  return s > now ? 'future' : 'past';
}
export const PHASE_LABEL: Record<Phase, string> = {
  research: 'Recherchephase (≤ 14 Tage)', preview: 'Vorschau (≤ 3 Tage)', live: 'Heute / läuft', review: 'Nachbericht', past: 'Vergangen', future: 'Demnächst',
};

/** Aktive Ereignisse, die die Nachrichtenrecherche beeinflussen (−2 Tage … +14 Tage). */
export async function activeEvents(env: Env) {
  const from = new Date(Date.now() - 2 * 86400000).toISOString();
  const to = new Date(Date.now() + 14 * 86400000).toISOString();
  const { results } = await env.DB.prepare('SELECT * FROM events WHERE ends_at >= ? AND starts_at <= ? ORDER BY starts_at').bind(from, to).all<EventRow>();
  return results;
}

export async function eventKeywords(env: Env) {
  const ev = await activeEvents(env);
  return [...new Set(ev.flatMap((e) => e.keywords.split('|').filter(Boolean)))].slice(0, 80);
}

/** Rennwochenende: ein Rennereignis läuft, beginnt in < 2 h oder endete vor < 6 h (steuert die 15-Minuten-Abfrage). */
export async function raceWeekend(env: Env) {
  const now = Date.now();
  const { results } = await env.DB.prepare(`SELECT * FROM events WHERE category = 'race' AND starts_at <= ? AND ends_at >= ? ORDER BY starts_at LIMIT 5`)
    .bind(new Date(now + 2 * 3600000).toISOString(), new Date(now - 6 * 3600000).toISOString()).all<EventRow>();
  return results;
}

export async function linkedItems(env: Env, e: EventRow, limit = 12) {
  const kws = e.keywords.split('|').filter(Boolean).slice(0, 8);
  if (!kws.length) return [];
  const from = new Date(Date.parse(e.starts_at) - 14 * 86400000).toISOString();
  const to = new Date(Math.min(Date.now(), Date.parse(e.ends_at) + 3 * 86400000)).toISOString();
  const fts = kws.map((k) => `"${k.replace(/"/g, '')}"`).join(' OR ');
  try {
    const { results } = await env.DB.prepare(`SELECT i.* FROM items_fts f JOIN items i ON i.id = f.rowid WHERE items_fts MATCH ? AND i.published_at BETWEEN ? AND ? ORDER BY i.relevance DESC, i.published_at DESC LIMIT ?`)
      .bind(fts, from, to, limit).all<any>();
    return results;
  } catch { return []; }
}

export async function upsertEvents(env: Env, calendarId: number, events: any[]) {
  const stmts = [env.DB.prepare('DELETE FROM events WHERE calendar_id = ?').bind(calendarId)];
  for (const ev of events.slice(0, 2000)) {
    if (!ev?.title || !ev?.start) continue;
    const start = new Date(ev.start), end = new Date(ev.end || ev.start);
    if (isNaN(+start)) continue;
    const c = categorize(String(ev.title), String(ev.description || ''));
    stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO events(calendar_id, uid, title, starts_at, ends_at, all_day, location, description, url, category, series, keywords) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(calendarId, String(ev.uid || `${ev.title}-${ev.start}`).slice(0, 300), String(ev.title).slice(0, 300), start.toISOString(), (isNaN(+end) ? start : end).toISOString(),
        ev.allDay ? 1 : 0, ev.location || null, ev.description ? String(ev.description).slice(0, 2000) : null, /^https?:\/\//.test(ev.url || '') ? ev.url : null, c.category, c.series, c.keywords));
  }
  stmts.push(env.DB.prepare('UPDATE calendars SET last_sync_at = ?, last_status = ?, event_count = (SELECT COUNT(*) FROM events WHERE calendar_id = ?) WHERE id = ?').bind(nowIso(), 'ok', calendarId, calendarId));
  for (let i = 0; i < stmts.length; i += 90) await env.DB.batch(stmts.slice(i, i + 90));
}

export { berlinDate };
