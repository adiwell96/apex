import { esc } from '../lib/util.ts';
import { icon } from './components.ts';

export interface LayoutOpts { title?: string; active?: string; body: string; desc?: string }

const NAV = [
  ['/', 'Ausgabe', 'home'], ['/updates', 'Latest', 'bolt'], ['/ressort/gt-racing', 'GT Racing', 'flag'], ['/ressort/china', 'China', ''], ['/ressort/global', 'Industrie', ''],
  ['/ressort/technologie', 'Technologie', ''], ['/ressort/neuheiten', 'Neuheiten', ''], ['/kalender', 'Kalender', 'cal'], ['/archiv', 'Archiv', ''],
] as const;

export function layout(o: LayoutOpts) {
  const cur = (p: string) => (o.active === p ? ' aria-current="page"' : '');
  return `<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title ? `${o.title} · APEX` : 'APEX — The Daily Automotive Journal')}</title>
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f4f0"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0d0e10">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="APEX">
<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="icon" href="/icons/icon-192.png">
<link rel="preload" href="/fonts/playfair-display-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/app.css"><script src="/assets/theme.js"></script>
</head><body>
<a class="skip" href="#main">Zum Inhalt springen</a>
<header class="topbar"><div class="wrap">
  <a class="logo" href="/" aria-label="APEX Startseite">APEX<i></i></a>
  <nav class="nav" aria-label="Ressorts">${NAV.filter((n) => n[0] !== '/').map(([h, l]) => `<a href="${h}"${cur(h)}>${l}</a>`).join('')}</nav>
  <div class="tools">
    <a class="iconbtn" href="/suche" aria-label="Suche">${icon('search')}</a>
    <a class="iconbtn" href="/merkliste" aria-label="Merkliste">${icon('star')}</a>
    <button class="iconbtn" id="theme-toggle" type="button" aria-label="Darstellung wechseln">${icon('theme')}</button>
    <a class="iconbtn" href="/status" aria-label="Systemstatus">${icon('gear')}</a>
  </div>
</div></header>
<main id="main">${o.body}</main>
<footer class="foot"><div class="wrap"><span><b>APEX</b> — The Daily Automotive Journal · Private Ausgabe, nicht zur Veröffentlichung</span>
<span><a href="/archiv">Archiv</a> · <a href="/status">Status &amp; Quellen</a> · <a href="/kalender/verwalten">Kalender</a> · <a href="/logout">Abmelden</a></span></div></footer>
<nav class="tabbar" aria-label="Hauptnavigation">
  <a href="/"${cur('/')}>${icon('home')}Ausgabe</a><a href="/updates"${cur('/updates')}>${icon('bolt')}Latest</a>
  <a href="/ressort/gt-racing"${cur('/ressort/gt-racing')}>${icon('flag')}Racing</a><a href="/kalender"${cur('/kalender')}>${icon('cal')}Kalender</a>
  <a href="/suche"${cur('/suche')}>${icon('search')}Suche</a>
</nav>
<script src="/assets/app.js" defer></script>
</body></html>`;
}
