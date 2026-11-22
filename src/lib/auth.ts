// Einzelbenutzer-Authentifizierung: Passwort (Worker-Secret) + HMAC-signiertes Session-Cookie.
import { type Env, nowIso } from './util.ts';

const COOKIE = '__Host-apex_session';
const SESSION_DAYS = 90; // lange gültig, damit die Home-Bildschirm-App nicht ständig neu anmeldet
const enc = new TextEncoder();

const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function safeEqual(a: string, b: string, secret: string) {
  // Vergleich über HMAC-Digests: konstante Länge, kein Timing-Leck über Länge/Inhalt
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function createSessionCookie(env: Env) {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const payload = `v1.${exp}.${b64url(crypto.getRandomValues(new Uint8Array(12)))}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function isAuthenticated(req: Request, env: Env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return false;
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp(`${COOKIE.replace(/[-]/g, '\\-')}=([^;]+)`));
  if (!m) return false;
  const parts = m[1].split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const payload = parts.slice(0, 3).join('.');
  if (+parts[1] < Date.now()) return false;
  return safeEqual(await hmac(env.SESSION_SECRET, payload), parts[3], env.SESSION_SECRET);
}

export async function bearerOk(req: Request, token: string | undefined, env: Env) {
  if (!token || token.length < 24) return false;
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) return false;
  return safeEqual(h.slice(7), token, env.SESSION_SECRET || token);
}

const WINDOW_MIN = 15, MAX_FAILS = 6;
export async function loginBlocked(env: Env, ip: string) {
  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const r = await env.DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE ip = ? AND at > ?').bind(ip, since).first<{ n: number }>();
  return (r?.n ?? 0) >= MAX_FAILS;
}
export async function recordFail(env: Env, ip: string) {
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_attempts(ip, at) VALUES (?, ?)').bind(ip, nowIso()),
    env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(new Date(Date.now() - 86400000).toISOString()),
  ]);
}

/** CSRF-Schutz für Formular-/API-POSTs mit Session: Origin muss zur eigenen Domain passen. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (!origin || origin === 'null') return site ? site === 'same-origin' : !origin;
  return origin === new URL(req.url).origin;
}
