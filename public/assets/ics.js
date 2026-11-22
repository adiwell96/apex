// APEX ICS-Parser — läuft im Browser (Datei-Upload) und in Node (Kalender-Feeds der Pipeline).
// Unterstützt: Zeilenfaltung, UTC-/TZID-/Ganztagstermine, DURATION, einfache RRULE (YEARLY/WEEKLY mit COUNT/UNTIL, max. 60 Wiederholungen).

const WIN_TZ = {
  'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest', 'Romance Standard Time': 'Europe/Paris',
  'GMT Standard Time': 'Europe/London', 'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles', 'Tokyo Standard Time': 'Asia/Tokyo',
  'China Standard Time': 'Asia/Shanghai', 'AUS Eastern Standard Time': 'Australia/Sydney', 'Arabian Standard Time': 'Asia/Dubai',
  'Singapore Standard Time': 'Asia/Singapore', 'E. South America Standard Time': 'America/Sao_Paulo',
};

function tzOffset(ts, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}

export function zonedToUtc(y, mo, d, h, mi, s, tz) {
  let zone = WIN_TZ[tz] || tz || 'Europe/Berlin';
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); } catch { zone = 'Europe/Berlin'; }
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let ts = guess - tzOffset(guess, zone);
  ts = guess - tzOffset(ts, zone);
  return ts;
}

function parseDate(value, params) {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) { const t = Date.parse(v); return isNaN(t) ? null : { ts: t, allDay: false }; }
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined || params.VALUE === 'DATE') return { ts: Date.UTC(+y, +mo - 1, +d), allDay: true };
  if (z) return { ts: Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
  return { ts: zonedToUtc(+y, +mo, +d, +h, +mi, +(s || 0), params.TZID), allDay: false };
}

function parseDuration(v) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, sign, w, d, h, mi, s] = m;
  const ms = (((+(w || 0) * 7 + +(d || 0)) * 24 + +(h || 0)) * 60 + +(mi || 0)) * 60000 + +(s || 0) * 1000;
  return sign === '-' ? -ms : ms;
}

const unescape = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

export function parseICS(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const head = line.slice(0, idx), value = line.slice(idx + 1);
    const [name, ...ps] = head.split(';');
    const params = Object.fromEntries(ps.map((p) => { const [k, v = ''] = p.split('='); return [k.toUpperCase(), v.replace(/^"|"$/g, '')]; }));
    cur[name.toUpperCase()] = { value, params };
  }
  const out = [];
  for (const e of events) {
    if (!e.DTSTART || !e.SUMMARY) continue;
    if (e.STATUS && e.STATUS.value.toUpperCase() === 'CANCELLED') continue;
    const st = parseDate(e.DTSTART.value, e.DTSTART.params);
    if (!st) continue;
    let end = e.DTEND ? parseDate(e.DTEND.value, e.DTEND.params)?.ts : null;
    if (!end && e.DURATION) end = st.ts + parseDuration(e.DURATION.value);
    if (!end) end = st.ts + (st.allDay ? 86400000 : 3600000);
    const base = {
      uid: (e.UID?.value || `${e.SUMMARY.value}-${e.DTSTART.value}`).slice(0, 300),
      title: unescape(e.SUMMARY.value).trim().slice(0, 300),
      location: e.LOCATION ? unescape(e.LOCATION.value).slice(0, 300) : '',
      description: e.DESCRIPTION ? unescape(e.DESCRIPTION.value).slice(0, 2000) : '',
      url: e.URL ? e.URL.value.slice(0, 500) : '',
      allDay: st.allDay,
    };
    const dur = end - st.ts;
    const starts = [st.ts];
    if (e.RRULE) {
      const r = Object.fromEntries(e.RRULE.value.split(';').map((p) => p.split('=')));
      const step = { YEARLY: 'y', WEEKLY: 'w', DAILY: 'd', MONTHLY: 'm' }[r.FREQ];
      const interval = +(r.INTERVAL || 1);
      const until = r.UNTIL ? parseDate(r.UNTIL, {})?.ts : Infinity;
      const count = Math.min(+(r.COUNT || 60), 60);
      let t = st.ts;
      while (step && starts.length < count) {
        const d = new Date(t);
        if (step === 'y') d.setUTCFullYear(d.getUTCFullYear() + interval);
        if (step === 'm') d.setUTCMonth(d.getUTCMonth() + interval);
        if (step === 'w') d.setUTCDate(d.getUTCDate() + 7 * interval);
        if (step === 'd') d.setUTCDate(d.getUTCDate() + interval);
        t = d.getTime();
        if (t > until || t > Date.now() + 3 * 365 * 86400000) break;
        starts.push(t);
      }
    }
    starts.forEach((s, i) => out.push({ ...base, uid: i ? `${base.uid}#${i}` : base.uid, start: new Date(s).toISOString(), end: new Date(s + dur).toISOString() }));
  }
  return out;
}
