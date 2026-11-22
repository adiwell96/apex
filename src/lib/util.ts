export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI?: Ai;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
  PIPELINE_TOKEN: string;
  EDITORIAL_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  GITHUB_WORKFLOW?: string;
  AI_DAILY_LIMIT?: string;
  PUBLISH_HOUR?: string;
}

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const attr = esc;
export const nowIso = () => new Date().toISOString();

export const TZ = 'Europe/Berlin';

/** Teile eines Zeitpunkts in deutscher Ortszeit (inkl. Sommer-/Winterzeit). */
export function berlinParts(d: Date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, weekday: p.weekday };
}
export const berlinDate = (d: Date = new Date()) => berlinParts(d).date;

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, ...o });
export const fDateLong = (iso: string | Date) => fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
export const fDate = (iso: string | Date) => fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
export const fDayMonth = (iso: string | Date) => fmt({ day: 'numeric', month: 'short' }).format(new Date(iso));
export const fTime = (iso: string | Date) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const fDateTime = (iso: string | Date) => fmt({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const fWeekday = (iso: string | Date) => fmt({ weekday: 'short' }).format(new Date(iso));

/** Datum (Berlin) als ISO-Datum für ein UTC-Ereignis; Ganztagstermine sind im ICS als UTC-Mitternacht gespeichert. */
export const eventDay = (iso: string, allDay: number | boolean) => (allDay ? iso.slice(0, 10) : berlinDate(new Date(iso)));

export function relTime(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return d === 1 ? 'gestern' : `vor ${d} Tagen`;
}

export const SECURITY_HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

export function html(body: string, status = 200, extra: Record<string, string> = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', ...SECURITY_HEADERS, ...extra } });
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', ...SECURITY_HEADERS } });
}
export const redirect = (to: string, extra: Record<string, string> = {}) => new Response(null, { status: 303, headers: { location: to, ...SECURITY_HEADERS, ...extra } });

export async function bumpUsage(env: Env, metric: string, by = 1) {
  await env.DB.prepare('INSERT INTO usage_daily(day, metric, value) VALUES (?1, ?2, ?3) ON CONFLICT(day, metric) DO UPDATE SET value = value + ?3')
    .bind(berlinDate(), metric, by).run();
}
export async function getUsage(env: Env, metric: string, day = berlinDate()) {
  const r = await env.DB.prepare('SELECT value FROM usage_daily WHERE day = ? AND metric = ?').bind(day, metric).first<{ value: number }>();
  return r?.value ?? 0;
}

export async function jobStart(env: Env, job: string) {
  const r = await env.DB.prepare('INSERT INTO job_runs(job, started_at) VALUES (?, ?) RETURNING id').bind(job, nowIso()).first<{ id: number }>();
  return r!.id;
}
export async function jobEnd(env: Env, id: number, ok: boolean, detail: string) {
  await env.DB.prepare('UPDATE job_runs SET finished_at = ?, ok = ?, detail = ? WHERE id = ?').bind(nowIso(), ok ? 1 : 0, detail.slice(0, 1000), id).run();
}
export async function lastJob(env: Env, job: string, okOnly = false) {
  return env.DB.prepare(`SELECT * FROM job_runs WHERE job = ? ${okOnly ? 'AND ok = 1' : ''} ORDER BY id DESC LIMIT 1`).bind(job).first<{ id: number; started_at: string; finished_at: string; ok: number; detail: string }>();
}

export const parseTags = (t: string | null) => (t || '').split('|').filter(Boolean);
