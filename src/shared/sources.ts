// Quellenverzeichnis. "verified" = in der Entwicklungsumgebung am 22.11.2026 als gültiger RSS-Feed abgerufen.
// Nicht verifizierte Quellen werden im Betrieb geprüft; ihr Status ist auf /status sichtbar.
// Paywalls werden nicht umgangen: es werden nur die vom Anbieter selbst im Feed veröffentlichten Teaser genutzt.

export type Section = 'gt' | 'china' | 'global' | 'tech' | 'products';

export interface SourceDef {
  id: string;
  name: string;
  url: string;
  homepage: string;
  lang: 'de' | 'en' | 'zh';
  kind: 'official' | 'media' | 'aggregator';
  section?: Section;          // Standard-Ressort, falls die Klassifizierung nichts findet
  motorsport?: boolean;       // wird an Rennwochenenden häufiger abgefragt
  requireMatch?: boolean;     // nur Meldungen mit Automobil-/Motorsportbezug übernehmen
  weight: number;             // Quellengewicht für die Relevanz
  verified: boolean;
}

const gnews = (q: string, lang: 'de' | 'en' | 'zh') => {
  const p = lang === 'zh' ? 'hl=zh-CN&gl=CN&ceid=CN:zh-Hans' : lang === 'de' ? 'hl=de&gl=DE&ceid=DE:de' : 'hl=en-US&gl=US&ceid=US:en';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:2d&${p}`;
};

export const SOURCES: SourceDef[] = [
  // ── GT Racing & Motorsport ───────────────────────────────────────────
  { id: 'sportscar365', name: 'Sportscar365', url: 'https://sportscar365.com/feed/', homepage: 'https://sportscar365.com', lang: 'en', kind: 'media', section: 'gt', motorsport: true, weight: 1.35, verified: true },
  { id: 'msport-gt', name: 'Motorsport.com · GT', url: 'https://www.motorsport.com/rss/gt/news/', homepage: 'https://www.motorsport.com', lang: 'en', kind: 'media', section: 'gt', motorsport: true, weight: 1.25, verified: true },
  { id: 'msport-wec', name: 'Motorsport.com · WEC', url: 'https://www.motorsport.com/rss/wec/news/', homepage: 'https://www.motorsport.com', lang: 'en', kind: 'media', section: 'gt', motorsport: true, weight: 1.2, verified: true },
  { id: 'msport-imsa', name: 'Motorsport.com · IMSA', url: 'https://www.motorsport.com/rss/imsa/news/', homepage: 'https://www.motorsport.com', lang: 'en', kind: 'media', section: 'gt', motorsport: true, weight: 1.2, verified: true },
  { id: 'msport-elms', name: 'Motorsport.com · ELMS', url: 'https://www.motorsport.com/rss/elms/news/', homepage: 'https://www.motorsport.com', lang: 'en', kind: 'media', section: 'gt', motorsport: true, weight: 1.1, verified: true },
  { id: 'msport-de-gt', name: 'Motorsport.com Deutschland · GT', url: 'https://de.motorsport.com/rss/gt/news/', homepage: 'https://de.motorsport.com', lang: 'de', kind: 'media', section: 'gt', motorsport: true, weight: 1.2, verified: true },
  { id: 'msport-de-dtm', name: 'Motorsport.com Deutschland · DTM', url: 'https://de.motorsport.com/rss/dtm/news/', homepage: 'https://de.motorsport.com', lang: 'de', kind: 'media', section: 'gt', motorsport: true, weight: 1.2, verified: true },
  { id: 'msport-de-wec', name: 'Motorsport.com Deutschland · WEC', url: 'https://de.motorsport.com/rss/wec/news/', homepage: 'https://de.motorsport.com', lang: 'de', kind: 'media', section: 'gt', motorsport: true, weight: 1.1, verified: true },
  { id: 'dailysportscar', name: 'DailySportsCar', url: 'https://www.dailysportscar.com/feed', homepage: 'https://www.dailysportscar.com', lang: 'en', kind: 'media', section: 'gt', motorsport: true, weight: 1.2, verified: false },
  // SRO, DTM, ADAC, NLS und IMSA bieten keine öffentlich dokumentierten RSS-Feeds an.
  // Deren offizielle Meldungen werden über Google-News-Suchfeeds gefunden (als Aggregator gekennzeichnet).
  { id: 'gn-gtwc', name: 'Google News · GT World Challenge', url: gnews('"GT World Challenge" OR "Intercontinental GT Challenge"', 'en'), homepage: 'https://www.gt-world-challenge-europe.com', lang: 'en', kind: 'aggregator', section: 'gt', motorsport: true, weight: 0.9, verified: false },
  { id: 'gn-nls', name: 'Google News · Nürburgring Langstrecke', url: gnews('NLS Nürburgring OR "24h Nürburgring" OR "ADAC GT Masters"', 'de'), homepage: 'https://www.vln.de', lang: 'de', kind: 'aggregator', section: 'gt', motorsport: true, weight: 0.9, verified: false },

  // ── China Automotive ─────────────────────────────────────────────────
  { id: 'cnevpost', name: 'CnEVPost', url: 'https://cnevpost.com/feed/', homepage: 'https://cnevpost.com', lang: 'en', kind: 'media', section: 'china', weight: 1.25, verified: true },
  { id: 'carnewschina', name: 'CarNewsChina', url: 'https://carnewschina.com/feed/', homepage: 'https://carnewschina.com', lang: 'en', kind: 'media', section: 'china', weight: 1.15, verified: true },
  { id: 'ithome', name: 'IT之家 (ithome.com)', url: 'https://www.ithome.com/rss/', homepage: 'https://www.ithome.com', lang: 'zh', kind: 'media', section: 'china', requireMatch: true, weight: 1.0, verified: false },
  { id: 'gn-zh-nev', name: 'Google News 中文 · 新能源汽车', url: gnews('新能源汽车 OR 比亚迪 OR 小米汽车 OR 宁德时代', 'zh'), homepage: 'https://news.google.com', lang: 'zh', kind: 'aggregator', section: 'china', weight: 0.85, verified: false },

  // ── Global Automotive ────────────────────────────────────────────────
  { id: 'automotiveworld', name: 'Automotive World', url: 'https://www.automotiveworld.com/feed/', homepage: 'https://www.automotiveworld.com', lang: 'en', kind: 'media', section: 'global', weight: 1.15, verified: false },
  { id: 'gn-de-industrie', name: 'Google News · Automobilindustrie', url: gnews('Autoindustrie OR Automobilindustrie OR Autohersteller', 'de'), homepage: 'https://news.google.com', lang: 'de', kind: 'aggregator', section: 'global', weight: 0.85, verified: false },
  { id: 'gn-en-industry', name: 'Google News · Auto Industry', url: gnews('automaker OR "auto industry" plant OR tariffs', 'en'), homepage: 'https://news.google.com', lang: 'en', kind: 'aggregator', section: 'global', weight: 0.8, verified: false },

  // ── Technology & Electromobility ─────────────────────────────────────
  { id: 'electrive-de', name: 'electrive.net', url: 'https://www.electrive.net/feed/', homepage: 'https://www.electrive.net', lang: 'de', kind: 'media', section: 'tech', weight: 1.25, verified: true },
  { id: 'electrive-en', name: 'electrive.com', url: 'https://www.electrive.com/feed/', homepage: 'https://www.electrive.com', lang: 'en', kind: 'media', section: 'tech', weight: 1.1, verified: false },
  { id: 'electrek', name: 'Electrek', url: 'https://electrek.co/feed/', homepage: 'https://electrek.co', lang: 'en', kind: 'media', section: 'tech', requireMatch: true, weight: 1.0, verified: true },
  { id: 'insideevs', name: 'InsideEVs', url: 'https://insideevs.com/rss/articles/all/', homepage: 'https://insideevs.com', lang: 'en', kind: 'media', section: 'tech', weight: 1.05, verified: false },

  // ── New Products ─────────────────────────────────────────────────────
  { id: 'carscoops', name: 'Carscoops', url: 'https://www.carscoops.com/feed/', homepage: 'https://www.carscoops.com', lang: 'en', kind: 'media', section: 'products', weight: 1.1, verified: true },
  { id: 'motor1', name: 'Motor1', url: 'https://www.motor1.com/rss/news/all/', homepage: 'https://www.motor1.com', lang: 'en', kind: 'media', section: 'products', weight: 1.1, verified: false },
  { id: 'autocar', name: 'Autocar', url: 'https://www.autocar.co.uk/rss', homepage: 'https://www.autocar.co.uk', lang: 'en', kind: 'media', section: 'products', weight: 1.1, verified: false },
];

export const SECTIONS: { id: Section; slug: string; name: string; kicker: string }[] = [
  { id: 'gt', slug: 'gt-racing', name: 'GT Racing & Motorsport', kicker: 'GT Racing' },
  { id: 'china', slug: 'china', name: 'China Automotive', kicker: 'China' },
  { id: 'global', slug: 'global', name: 'Global Automotive', kicker: 'Industrie' },
  { id: 'tech', slug: 'technologie', name: 'Technology & Electromobility', kicker: 'Technologie' },
  { id: 'products', slug: 'neuheiten', name: 'New Products', kicker: 'Neuheiten' },
];
