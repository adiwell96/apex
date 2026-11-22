// APEX Client: Theme-Umschalter, Bild-Fallbacks, Merkliste, Countdown, Kalender-Upload, Service Worker.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Bilder, die nicht geladen werden können (Hotlink-Schutz etc.) → typografische Gestaltung
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG') { const f = img.closest('.fig'); if (f) f.classList.add('failed'); const c = f && f.parentElement.querySelector('.credit'); if (c) c.hidden = true; }
  }, true);
  $$('.fig img').forEach((img) => { if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error')); });

  // Theme: System → Hell → Dunkel
  const tbtn = $('#theme-toggle');
  const label = () => { const t = document.documentElement.dataset.theme || 'system'; if (tbtn) tbtn.setAttribute('aria-label', `Darstellung: ${{ system: 'System', light: 'Hell', dark: 'Dunkel' }[t]}`); };
  label();
  tbtn && tbtn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'system';
    const next = { system: 'light', light: 'dark', dark: 'system' }[cur];
    if (next === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
    try { next === 'system' ? localStorage.removeItem('apex-theme') : localStorage.setItem('apex-theme', next); } catch (e) {}
    label();
  });

  // Merkliste (Formular per fetch, ohne Neuladen; funktioniert auch ohne JS als normales Formular)
  $$('form[data-fav]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', f);
    const r = await fetch(f.action, { method: 'POST', headers: { accept: 'application/json' } });
    if (r.ok) { const j = await r.json(); btn.setAttribute('aria-pressed', String(j.favorite)); btn.textContent = j.favorite ? '★ Gemerkt' : '☆ Merken'; }
  }));

  // Countdown
  const cd = $('[data-countdown]');
  if (cd) {
    const target = Date.parse(cd.dataset.countdown);
    const tick = () => {
      let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const m = Math.floor(s / 60);
      cd.innerHTML = `<div>${d}<small>Tage</small></div><div>${String(h).padStart(2, '0')}<small>Std.</small></div><div>${String(m).padStart(2, '0')}<small>Min.</small></div>`;
    };
    tick(); setInterval(tick, 30000);
  }

  // ICS-Datei: wird im Browser geparst, damit der Worker keine Rechenzeit verbraucht
  const up = $('#ics-upload');
  if (up) up.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = $('#ics-result');
    const file = $('input[type=file]', up).files[0];
    const name = $('input[name=name]', up).value.trim() || (file && file.name.replace(/\.ics$/i, '')) || 'Kalender';
    if (!file) { out.textContent = 'Bitte eine .ics-Datei auswählen.'; return; }
    out.textContent = 'Datei wird gelesen …';
    try {
      const { parseICS } = await import('/assets/ics.js');
      const events = parseICS(await file.text());
      if (!events.length) { out.textContent = 'In der Datei wurden keine Termine gefunden.'; return; }
      out.textContent = `${events.length} Termine gefunden, wird gespeichert …`;
      const r = await fetch('/actions/calendar/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, events }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      out.textContent = `✓ ${j.count} Termine importiert.`;
      setTimeout(() => location.reload(), 900);
    } catch (err) { out.textContent = 'Fehler beim Import: ' + err.message; }
  });

  // Kontrollierte Bestätigungen für folgenreiche Aktionen
  $$('form[data-confirm]').forEach((f) => f.addEventListener('submit', (e) => { if (!confirm(f.dataset.confirm)) e.preventDefault(); }));

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
