# APEX — The Daily Automotive Journal

Private, passwortgeschützte digitale Automobilzeitschrift. Jeden Morgen um **06:00 Uhr (Europe/Berlin)** erscheint automatisch eine neue Ausgabe. Tagsüber kommen neue Meldungen in **Latest Updates** hinzu. Schwerpunkt ist GT-Racing. Dazu kommen China, Global Automotive, Technologie & E-Mobilität, Neuheiten und Ihr Motorsport- und Messekalender.

Der Betrieb läuft vollständig in der Cloud, ausschließlich auf Free-Tier-Diensten. **Ihr Mac muss nicht eingeschaltet sein.**

## Architektur

```
                ┌──────────────────────── Cloudflare (Free) ─────────────────────────┐
 iPhone/iPad/   │  Worker "apex"  ── Login, Magazin-Seiten, API, PWA                 │
 Mac (PWA) ───► │     │  Cron alle 15 Min. → 06:00 Ausgabe · Pipeline anstoßen ·     │
                │     │                      Übersetzen · Aufräumen                  │
                │     ├── D1 (SQLite): Meldungen, Ausgaben, Kalender, Protokoll       │
                │     └── Workers AI: maschinelle Übersetzung EN/ZH → DE (Free-Tier)   │
                └─────▲───────────────────────────────┬──────────────────────────────┘
                      │ POST /api/pipeline/* (Token)   │ workflow_dispatch
                ┌─────┴───────────────────────────────▼──────────┐
                │ GitHub Actions (Free): pipeline/ingest.ts       │
                │ RSS/Atom-Feeds · og:image · ICS-Kalender ·      │
                │ Klassifizierung · Relevanz · Dubletten          │
                └─────────────────────────────────────────────────┘
       optional: Claude-Code-Routine (Ihr Pro-Abo) → /api/editorial/* → deutsche KI-Artikel
```

**Warum diese Aufteilung?** Workers dürfen im Free-Plan nur **10 ms CPU** pro Aufruf rechnen. Das Parsen von 25 Feeds passt da nicht zuverlässig hinein. Die rechenintensive Pipeline läuft deshalb in GitHub Actions. Der Worker übernimmt die zeitkritischen, leichten Aufgaben: Ausgabe um 06:00 Uhr, Anstoßen der Pipeline, Ausliefern der Seiten. Cloudflare-Cron ist pünktlich, GitHub-Cron kann sich verzögern. Deshalb gibt der Worker den Takt vor.

## Funktionen

| Bereich | Umsetzung |
|---|---|
| Morgenausgabe | Cron alle 15 Min. prüft Berliner Ortszeit (inkl. Sommer-/Winterzeit). Ab 06:00 Uhr wird genau eine Ausgabe pro Tag veröffentlicht (`UNIQUE`-Sperre). Verpasste Läufe werden nachgeholt. Die Ausgabe ist ein unveränderlicher JSON-Snapshot im Archiv. |
| Aufbau | Cover/Titelgeschichte → Top-Nachrichten → GT Racing (dunkles Band) → China → Global → Technologie → Fotostrecke Neuheiten → Kalender mit Vorschau/Nachbericht. Ressorts werden nur mit echten Meldungen oberhalb einer Relevanzschwelle befüllt, Füllartikel gibt es nicht. |
| Latest Updates | Stündliche Abfrage. An Rennwochenenden (laut Ihrem Kalender) alle 15 Min. die Motorsportquellen. Ausdrücklich als „regelmäßig abgefragt – keine Live-Daten“ gekennzeichnet, mit Zeitpunkt der letzten erfolgreichen Abfrage. |
| Quellen | 25 Quellen, davon 13 in der Entwicklung als funktionierende Feeds geprüft (Sportscar365, Motorsport.com GT/WEC/IMSA/ELMS/DTM, CnEVPost, CarNewsChina, electrive.net, Electrek, Carscoops). Die übrigen prüft die Pipeline im Betrieb; ihr Status steht unter `/status`. Paywalls werden nicht umgangen. |
| Dubletten | URL-Normalisierung und gewichtete Titelähnlichkeit (auch EN↔DE). Gleiche Ereignisse werden verknüpft, die Quellen bleiben aber getrennt aufgeführt („Weitere Quellen zum Thema“). |
| Kennzeichnung | Pro Meldung: Quelle, Original-URL, Veröffentlichungs- und Erfassungszeit, Ressort, Relevanz, Verifizierungsstatus (Fachmedium / mehrere Quellen / **unbestätigt** / Aggregator), Bearbeitungsart (Original / maschinell übersetzt / KI-redaktionell), Bildquelle. |
| Bilder | Originalbilder aus Feed bzw. `og:image` der Quellseite, eingebunden mit `referrerpolicy="no-referrer"`. Lädt ein Bild nicht, greift automatisch eine typografische Gestaltung. |
| Kalender | ICS-Datei-Import (wird im Browser gelesen) oder ICS-/Webcal-Abo (Apple iCloud, Google, Outlook). Ansichten: Übersicht, Monat, Woche, Detail mit Countdown. Redaktionelle Phasen: 14 Tage vorher Relevanzbonus für passende Meldungen, 3 Tage vorher Vorschau, am Veranstaltungstag aktuelle Meldungen, danach Nachbericht. Export als privater ICS-Feed. |
| Archiv & Suche | Alle Ausgaben nach Datum. Volltextsuche (SQLite FTS5) über Titel, Übersetzungen, Kurztexte, Hersteller- und Serien-Schlagworte. Filter nach Ressort, Rennserie und Hersteller. Merkliste, Gelesen-Markierung. |
| Sicherheit | Alle Seiten, APIs und statischen Ausgaben liegen hinter dem Login. Öffentlich sind nur Login-CSS, Schriften, Icons, Manifest und Service Worker. HMAC-signiertes `__Host-`-Cookie (HttpOnly, Secure, SameSite=Lax), Sperre nach 6 Fehlversuchen in 15 Min., CSRF-Prüfung, strenge CSP, `noindex` überall, `robots.txt` sperrt alles. Pipeline- und Claude-API nutzen getrennte Bearer-Tokens. |
| PWA | Zum Home-Bildschirm hinzufügbar (iPhone/iPad), Offline-Lesen zuletzt geöffneter Seiten, Dark/Light/System-Modus. |
| Betrieb | `/status`: letzte Läufe aller Jobs, Quellenzustand, Kontingente, Protokoll. Wöchentliches D1-Backup als GitHub-Artefakt. Fällt die Pipeline aus, bleibt die letzte Ausgabe lesbar. |

## Claude-Integration – ehrliche Einordnung

- **Claude Pro enthält keine API-Aufrufe.** Die Anthropic-API ist ein separates, kostenpflichtiges Produkt und wird **nicht** verwendet.
- **Basismodus (aktiv, kostenlos):** Regelbasierte Bewertung und Kategorisierung, Originalüberschriften und Feed-Kurzbeschreibungen, maschinelle Übersetzung über Workers AI (Free-Tier). So funktioniert APEX vollständig ohne KI-Abo.
- **KI-Redaktion (optional, Ihr Pro-Abo):** Eine Claude-Code-Routine (geplante Cloud-Sitzung) kann täglich vor 06:00 Uhr die wichtigsten Meldungen abholen und deutsche Artikel schreiben, siehe [`docs/CLAUDE-ROUTINE.md`](docs/CLAUDE-ROUTINE.md). Das verbraucht Kontingent Ihres Pro-Abos, die Zahl der Läufe pro Tag ist begrenzt. Solche Artikel tragen das Label **„KI-redaktionell“**. **Noch nicht eingerichtet:** Dafür braucht es Ihre Zustimmung und die laufende Cloud-Instanz.

## Entwicklung

```bash
npm install
cp .dev.vars.example .dev.vars        # lokale Test-Zugangsdaten eintragen
npm run db:migrate:local
npm run dev                            # http://localhost:8787 (ohne Workers AI)
APEX_URL=http://127.0.0.1:8787 PIPELINE_TOKEN=… npm run ingest
curl "http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*"   # Cron auslösen
npm test && npm run typecheck
```

Einrichtung des Online-Betriebs: [`docs/SETUP.md`](docs/SETUP.md) · Grenzen und Kontingente: [`docs/BETRIEB.md`](docs/BETRIEB.md)
