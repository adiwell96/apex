// Erzeugt die PWA-/Home-Bildschirm-Icons aus HTML (Playwright/Chromium).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
const font = readFileSync(new URL('../public/fonts/playfair-display-latin-wght-normal.woff2', import.meta.url)).toString('base64');
const page = (size, pad) => `<html><head><style>@font-face{font-family:P;src:url(data:font/woff2;base64,${font})}
html,body{margin:0;width:${size}px;height:${size}px;background:#0b0c0e;display:grid;place-items:center;overflow:hidden}
div{font:900 ${Math.round(size * (pad ? .52 : .66))}px/1 P;color:#f2f1ed;letter-spacing:-.04em;position:relative;transform:translateY(${size * .02}px)}
i{position:absolute;width:${size * .1}px;height:${size * .1}px;border-radius:50%;background:#d2111e;right:-${size * .12}px;bottom:${size * .1}px}</style></head><body><div>A<i></i></div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-512-maskable.png', 512, true], ['apple-touch-icon.png', 180, false]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(page(size, pad));
  await p.waitForTimeout(150);
  await p.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname });
}
await b.close();
