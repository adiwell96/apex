// Regelbasierte Klassifizierung, Relevanzbewertung und Dublettenerkennung.
// Läuft ohne KI und ohne kostenpflichtige Dienste.
import type { Section, SourceDef } from './sources.ts';

type Dict = Record<string, string[]>;

// Rennserien / Motorsport
export const SERIES: Dict = {
  'gtwc-europe': ['gt world challenge europe', 'gtwc europe', 'sprint cup', 'endurance cup', 'crowdstrike 24 hours of spa', '24 hours of spa', '24h spa', '24 stunden von spa'],
  'gtwc-america': ['gt world challenge america', 'gtwc america'],
  'gtwc-asia': ['gt world challenge asia', 'gtwc asia'],
  'gtwc-australia': ['gt world challenge australia', 'bathurst 12 hour', 'bathurst 12h'],
  'igtc': ['intercontinental gt challenge', 'igtc', 'indianapolis 8 hour', 'gulf 12 hours', 'suzuka 1000'],
  'dtm': ['dtm'],
  'adac-gt-masters': ['adac gt masters', 'gt masters'],
  'nls': ['nls', 'nürburgring langstrecken', 'nurburgring langstrecken', 'vln', 'nürburgring endurance series'],
  '24h-nuerburgring': ['24h nürburgring', '24 stunden nürburgring', 'nürburgring 24', 'nurburgring 24', '24 hours nurburgring', '24h-rennen'],
  'imsa': ['imsa', 'weathertech', 'rolex 24', 'daytona 24', 'sebring 12', 'petit le mans', 'gtd pro', 'gtd'],
  'wec': ['wec', 'world endurance championship', 'langstrecken-wm', 'hypercar', 'lmgt3', 'le mans', 'lmdh', 'lmh'],
  'elms': ['european le mans series', 'elms', 'lmp2', 'lmp3'],
  'alms': ['asian le mans series', 'asian le mans'],
  'gt3': ['gt3'],
  'gt4': ['gt4'],
  'gt2': ['gt2'],
  'bop': ['balance of performance', 'bop'],
  'fia-gt-world-cup': ['fia gt world cup', 'gt-weltcup', 'gt world cup', 'macau gp', 'macau'],
  'f1': ['formula 1', 'formel 1', ' f1 ', 'grand prix'],
  'super-gt': ['super gt'],
};

export const MAKERS: Dict = {
  porsche: ['porsche', '911 gt3', 'manthey'], bmw: ['bmw', 'm4 gt3', 'bmw m'], mercedes: ['mercedes', 'amg'], audi: ['audi'],
  ferrari: ['ferrari', '296 gt3', '499p'], lamborghini: ['lamborghini', 'huracan', 'temerario'], mclaren: ['mclaren'],
  aston: ['aston martin'], corvette: ['corvette'], ford: ['ford', 'mustang'], toyota: ['toyota', 'lexus'], honda: ['honda', 'acura'],
  cadillac: ['cadillac'], peugeot: ['peugeot'], alpine: ['alpine'], volkswagen: ['volkswagen', ' vw '], stellantis: ['stellantis', 'fiat', 'jeep', 'opel'],
  renault: ['renault'], hyundai: ['hyundai', 'genesis'], kia: ['kia'], nissan: ['nissan'], tesla: ['tesla'], gm: ['general motors', ' gm '],
  volvo: ['volvo', 'polestar'], jlr: ['jaguar', 'land rover', 'range rover'], bentley: ['bentley'], rollsroyce: ['rolls-royce'],
  byd: ['byd', '比亚迪', 'denza', 'yangwang', '仰望'], xiaomi: ['xiaomi', '小米汽车', '小米 su7', 'yu7', 'su7'], geely: ['geely', '吉利', 'lynk', 'smart'],
  zeekr: ['zeekr', '极氪'], nio: ['nio', '蔚来', 'onvo', 'firefly'], xpeng: ['xpeng', '小鹏'], liauto: ['li auto', '理想汽车'],
  catl: ['catl', '宁德时代'], saic: ['saic', '上汽', ' mg '], gwm: ['great wall', '长城汽车', 'haval', 'tank'], chery: ['chery', '奇瑞', 'omoda', 'jaecoo'],
  leapmotor: ['leapmotor', '零跑'], huawei: ['huawei', '华为', 'aito', '问界', 'harmonyos'], changan: ['changan', '长安', 'avatr', 'deepal'],
  gac: ['gac', '广汽', 'aion'], dongfeng: ['dongfeng', '东风', 'voyah'],
};

const SECTION_WORDS: Record<Section, string[]> = {
  gt: ['race', 'rennen', 'qualifying', 'pole', 'podium', 'podest', 'championship', 'meisterschaft', 'grid', 'starterfeld', 'driver', 'fahrer', 'team', 'stint', 'endurance', 'langstrecke', 'motorsport', 'racing', 'customer racing', 'kundensport', 'factory', 'werks', 'lap', 'runde', 'safety car', 'penalty', 'strafe', 'victory', 'sieg', 'win'],
  china: ['china', 'chinese', 'chinesisch', 'beijing', 'shanghai', 'shenzhen', 'miit', 'yuan', '中国', '汽车', '新能源', '国产', 'cpca'],
  global: ['plant', 'werk', 'factory', 'fabrik', 'investment', 'investition', 'tariff', 'zoll', 'zölle', 'sales', 'absatz', 'profit', 'gewinn', 'quartal', 'quarter', 'ceo', 'jobs', 'stellen', 'merger', 'kooperation', 'partnership', 'supply chain', 'lieferkette', 'production', 'produktion', 'market share', 'marktanteil', 'recall', 'rückruf', 'restructuring', 'eu ', 'commission'],
  tech: ['battery', 'batterie', 'akku', 'solid-state', 'festkörper', 'charging', 'laden', 'ladeinfrastruktur', 'charger', 'software', 'autonomous', 'autonom', 'self-driving', 'adas', 'lidar', 'chip', 'ai ', ' ki ', 'artificial intelligence', 'platform', 'plattform', '800-volt', '800 v', 'sodium', 'natrium', 'lfp', 'megawatt', 'hydrogen', 'wasserstoff', 'efficiency', 'effizienz', 'robotaxi', 'over-the-air', '电池', '固态', '智驾', '自动驾驶', '充电'],
  products: ['unveil', 'debut', 'premiere', 'weltpremiere', 'reveal', 'revealed', 'enthüllt', 'vorgestellt', 'new ', 'neue', 'neuer', 'launch', 'markteinführung', 'concept', 'konzept', 'prototype', 'erlkönig', 'spy shot', 'spied', 'facelift', 'review', 'test', 'first drive', 'fahrbericht', 'price', 'preis', 'supercar', 'hypercar', 'sports car', 'sportwagen', 'suv', 'sedan', 'limousine', 'wagon', 'kombi', '上市', '发布', '新车'],
};

const AUTO_MATCH = ['auto', 'car', 'vehicle', 'fahrzeug', 'ev', 'electric', 'battery', 'motor', 'racing', '汽车', '车', '电池', '新能源', '充电', '驾驶'];
const UNCONFIRMED = ['reportedly', 'rumor', 'rumour', 'gerücht', 'could ', 'may ', 'might ', 'set to', 'sources say', 'according to sources', 'has learned', 'erfahren hat', 'berichten zufolge', 'angeblich', 'spekul', 'speculation', 'leak', 'spy shot', 'erlkönig', 'tipped', 'expected to', '传闻', '曝光', '据悉', '或将'];
const HIGH_IMPACT = ['champion', 'meister', 'title', 'titel', 'wins', 'gewinnt', 'victory', 'sieg', 'pole', 'crash', 'unfall', 'disqualif', 'penalty', 'withdraw', 'rückzug', 'ends', 'quits', 'announces', 'kündigt', 'record', 'rekord', 'billion', 'milliard', 'plant', 'werk', 'tariff', 'zoll', 'recall', 'solid-state', 'festkörper', 'world premiere', 'weltpremiere', 'bop', 'balance of performance', 'calendar', 'kalender', 'entry list', 'starterliste', 'line-up', 'program', 'programm'];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')} `;
const RX = new Map<string, RegExp>();
const has = (text: string, w: string) => {
  const k = w.trim();
  if (k.length > 5 || !/^[a-z0-9 ]+$/.test(k)) return text.includes(w);
  let r = RX.get(k);
  if (!r) { r = new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`); RX.set(k, r); }
  return r.test(text);
};
const hit = (text: string, words: string[]) => words.reduce((n, w) => (has(text, w) ? n + 1 : n), 0);

export interface Classified {
  section: Section;
  tags: string[];
  relevance: number;
  verification: 'official' | 'media' | 'unconfirmed' | 'aggregator';
  drop: boolean;
}

export function classify(title: string, summary: string, src: SourceDef, ageHours: number, eventKeywords: string[] = []): Classified {
  const t = norm(title);
  const all = norm(`${title} ${summary}`);
  const tags: string[] = [];
  for (const [k, ws] of Object.entries(SERIES)) if (hit(all, ws)) tags.push(k);
  for (const [k, ws] of Object.entries(MAKERS)) if (hit(all, ws)) tags.push(k);

  const scores: Record<Section, number> = { gt: 0, china: 0, global: 0, tech: 0, products: 0 };
  for (const s of Object.keys(scores) as Section[]) scores[s] = hit(all, SECTION_WORDS[s]) + 2 * hit(t, SECTION_WORDS[s]);
  const motorsportTags = tags.filter((x) => x in SERIES && x !== 'f1');
  scores.gt += motorsportTags.length * 4 + (src.motorsport ? 4 : 0);
  const chinaMakers = ['byd', 'xiaomi', 'geely', 'zeekr', 'nio', 'xpeng', 'liauto', 'catl', 'saic', 'gwm', 'chery', 'leapmotor', 'huawei', 'changan', 'gac', 'dongfeng'];
  scores.china += tags.filter((x) => chinaMakers.includes(x)).length * 5 + (src.lang === 'zh' ? 3 : 0);
  if (src.section) scores[src.section] += 3;

  let section = (Object.keys(scores) as Section[]).reduce((a, b) => (scores[b] > scores[a] ? b : a), src.section ?? 'global');
  if (src.motorsport && section !== 'gt') section = 'gt';

  const drop = !!src.requireMatch && hit(all, AUTO_MATCH) === 0;

  // Relevanz 0–100
  let rel = 30 * src.weight;
  rel += Math.min(hit(all, HIGH_IMPACT), 3) * 7;
  if (section === 'gt') rel += 12;                                      // Motorsport-Priorität
  if (motorsportTags.some((x) => x.startsWith('gtwc') || ['igtc', 'gt3', 'nls', '24h-nuerburgring', 'dtm', 'adac-gt-masters', 'bop'].includes(x))) rel += 10;
  if (section === 'global' || section === 'china') rel += 5;
  if (tags.includes('f1') && motorsportTags.length === 0) rel -= 15;    // F1 ist nicht Kernthema
  if (eventKeywords.length && hit(all, eventKeywords)) rel += 12;       // Kalenderbezug
  rel -= Math.min(ageHours, 72) * 0.35;                                 // Aktualität
  if (src.kind === 'aggregator') rel -= 6;

  let verification: Classified['verification'] = src.kind === 'official' ? 'official' : src.kind === 'aggregator' ? 'aggregator' : 'media';
  if (hit(all, UNCONFIRMED) || /\?\s*$/.test(title)) verification = 'unconfirmed';

  return { section, tags: [...new Set(tags)], relevance: Math.max(0, Math.min(100, Math.round(rel * 10) / 10)), verification, drop };
}

// ── Dubletten ──────────────────────────────────────────────────────────
const STOP = new Set('the a an of to in on for and with at by from is are as after into over its new his her their der die das ein eine und mit für von im am zum zur auf bei nach den dem des ist sind wird'.split(' '));

export function titleTokens(title: string): string[] {
  // Rubrik-Präfixe ("FIA-GT-Weltcup Macau 2026: …", "Endlich offiziell: …") tragen keine Ereignis-Information
  const m = title.match(/^([^:]{3,60}):\s+(.{20,})$/);
  const core = m ? m[2] : title;
  const t = core.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const latin = t.replace(/[^a-z0-9一-鿿 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^(19|20)\d\d$/.test(w) && !/[一-鿿]/.test(w));
  const cjk = [...t.matchAll(/[一-鿿]{2}/g)].map((m) => m[0]);
  return [...new Set([...latin, ...cjk])];
}

/** Gewichtete Überlappung: seltene Wörter (Namen, Modelle) zählen mehr als häufige (Serien, Jahreszahlen). */
export function similarity(a: string[], b: string[], idf?: (t: string) => number): number {
  if (!a.length || !b.length) return 0;
  const w = idf ?? (() => 1);
  const sb = new Set(b);
  const shared = a.filter((x) => sb.has(x));
  if (shared.length < 2) return 0;
  const sum = (xs: string[]) => xs.reduce((n, x) => n + w(x), 0);
  return sum(shared) / Math.min(sum(a), sum(b));
}

export function idfFrom(docs: string[][]) {
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) ?? 0) + 1);
  const n = Math.max(docs.length, 1);
  return (t: string) => Math.log(1 + n / (df.get(t) ?? 1));
}

export function canonicalUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|cmp)/i.test(k)) url.searchParams.delete(k);
    url.hostname = url.hostname.replace(/^www\./, '');
    return url.toString().replace(/\/$/, '');
  } catch { return u; }
}
