// Maschinelle Übersetzung über Cloudflare Workers AI (Free-Tier: 10.000 Neuronen/Tag, auf dem Free-Plan ohne Überziehung).
// Ein eigenes Tageslimit (AI_DAILY_LIMIT) begrenzt die Aufrufe zusätzlich. Ohne AI-Binding bleibt der Originaltext stehen.
import { type Env, bumpUsage, getUsage, jobStart, jobEnd } from './util.ts';

const MODEL = '@cf/meta/m2m100-1.2b';
const LANG: Record<string, string> = { en: 'english', zh: 'chinese' };

async function tr(env: Env, text: string, lang: string): Promise<string | null> {
  if (!text) return '';
  const r: any = await env.AI!.run(MODEL as any, { text, source_lang: LANG[lang] ?? 'english', target_lang: 'german' } as any);
  const out = (r?.translated_text ?? '').trim();
  return out || null;
}

export async function translatePending(env: Env, max = 12, ids?: number[]) {
  if (!env.AI) return { done: 0, reason: 'kein AI-Binding' };
  const limit = +(env.AI_DAILY_LIMIT || 400);
  const used = await getUsage(env, 'ai_calls');
  const budget = Math.max(0, Math.floor((limit - used) / 2));
  if (!budget) return { done: 0, reason: 'Tageslimit erreicht' };
  const q = ids?.length
    ? env.DB.prepare(`SELECT id, title, summary, lang FROM items WHERE translation = 'pending' AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids)
    : env.DB.prepare(`SELECT id, title, summary, lang FROM items WHERE translation = 'pending' AND fetched_at > ? ORDER BY relevance DESC LIMIT ?`).bind(new Date(Date.now() - 2 * 86400000).toISOString(), Math.min(max, budget));
  const { results } = await q.all<{ id: number; title: string; summary: string; lang: string }>();
  if (!results.length) return { done: 0, reason: 'nichts offen' };
  const job = await jobStart(env, 'translate');
  let done = 0, failed = 0, calls = 0;
  for (const it of results.slice(0, budget)) {
    try {
      const t = await tr(env, it.title, it.lang); calls++;
      const s = it.summary ? await tr(env, it.summary, it.lang) : ''; if (it.summary) calls++;
      if (t) {
        await env.DB.prepare(`UPDATE items SET title_de = ?, summary_de = ?, translation = 'machine' WHERE id = ?`).bind(t, s || null, it.id).run();
        done++;
      } else throw new Error('leer');
    } catch (e) {
      failed++;
      await env.DB.prepare(`UPDATE items SET translation = 'failed' WHERE id = ?`).bind(it.id).run();
      if (String(e).includes('limit') || String(e).includes('4006')) break; // Kontingent erschöpft
    }
  }
  await bumpUsage(env, 'ai_calls', calls);
  await jobEnd(env, job, failed === 0 || done > 0, `${done} übersetzt, ${failed} fehlgeschlagen, ${calls} KI-Aufrufe`);
  return { done, failed };
}
