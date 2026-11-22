# Machbarkeit, Kontingente und Grenzen

Stand: November 2026. Die Free-Tier-Grenzen der Anbieter können sich ändern. Die tatsächliche Nutzung zeigt `/status`.

## Gewählte Architektur und Alternativen

| Option | Entscheidung |
|---|---|
| Cloudflare Workers + D1 + Cron | **gewählt**: kostenlos, weltweit schnell, Cron pünktlich, eine Codebasis für Seiten und API |
| Next.js auf Cloudflare Pages | verworfen: mehr Build-Komplexität ohne Mehrwert. Server-gerenderte Seiten direkt im Worker laden schneller. |
| Feeds direkt im Worker parsen | verworfen: Free-Plan erlaubt 10 ms CPU pro Aufruf, 25 XML-Feeds überschreiten das |
| GitHub Actions für die Pipeline | **gewählt**: keine CPU-Grenze, Node.js mit echtem XML-Parser; Anstoß durch den Worker statt durch den unzuverlässigeren GitHub-Cron |
| Übersetzung | Cloudflare Workers AI (`m2m100-1.2b`) im Free-Tier, mit eigenem Tageslimit |
| Claude | Pro-Abo enthält keine API. Optional per Claude-Code-Routine (siehe `CLAUDE-ROUTINE.md`) |

## Kontingente

| Dienst | Free-Grenze | Erwartete APEX-Nutzung |
|---|---|---|
| Workers Anfragen | 100.000 / Tag | ~100 Cron-Läufe + ~25 Pipeline-Aufrufe/Std. + Ihre Seitenaufrufe → wenige Tausend |
| Workers CPU | 10 ms / Aufruf | Seiten und Ausgabe sind auf wenige ms ausgelegt; Feed-Parsing läuft ausgelagert |
| Cron Trigger | 5 pro Konto | 1 (`*/15 * * * *`) |
| D1 Speicher | 500 MB pro Datenbank | ~0,5–1 MB/Tag inkl. Suchindex; Meldungen älter als 365 Tage werden gelöscht (gemerkte bleiben), Ausgaben-Snapshots bleiben dauerhaft |
| D1 Zeilen | 5 Mio. gelesen / 100.000 geschrieben pro Tag | einige Tausend Schreibvorgänge/Tag |
| Workers AI | 10.000 Neuronen / Tag | begrenzt über `AI_DAILY_LIMIT` (Standard 400 Aufrufe ≈ 200 Meldungen) |
| GitHub Actions (privat) | 2.000 Min. / Monat | ~22 Läufe/Tag ≈ 700 Min. + Sicherheitsnetz 120 Min. + Rennwochenenden (15-Min.-Takt nur während laufender Rennveranstaltungen) ≈ 1.100–1.500 Min. |

Wird eine Grenze erreicht, **entstehen keine Kosten**. Im Free-Plan schlagen die betroffenen Aufrufe einfach fehl. Die letzte Ausgabe bleibt lesbar, `/status` zeigt den Fehler.
Werden die GitHub-Minuten knapp, kann das Repository öffentlich gemacht werden (unbegrenzte Minuten). Der Code enthält keine Geheimnisse, Ihre Inhalte liegen in D1. Alternativ verlängert man den Rennwochenend-Takt in `runSchedule` auf 30 Minuten.

## Bekannte Einschränkungen

- **Keine echten Live-Daten.** Kostenlose, offiziell erlaubte Live-Timing-Schnittstellen für GTWC, IMSA, WEC oder NLS gibt es nicht. APEX zeigt ausschließlich veröffentlichte Meldungen und kennzeichnet das. Hat ein Kalendertermin eine URL, verlinkt die Detailseite die offizielle Veranstaltungsseite.
- **Offizielle Serienseiten** (SRO/GT World Challenge, DTM, ADAC, NLS, IMSA) bieten keine öffentlichen RSS-Feeds an. Ihre Meldungen kommen über Fachmedien und über Google-News-Suchfeeds. Letztere sind als „Aggregator“ gekennzeichnet und fließen mit geringerem Gewicht ein.
- **Reuters, Automotive News, Automobilwoche** stehen hinter Paywalls bzw. haben keine öffentlichen Feeds mehr und sind deshalb nicht eingebunden. **Auto Motor und Sport** bietet aktuell keinen erreichbaren Feed. **Gasgoo**: Feed-Adresse ungeklärt, nicht eingebunden.
- **Chinesischsprachige Quellen:** IT之家 und Google News (中文) sind eingebunden, aber in der Entwicklungsumgebung nicht prüfbar gewesen. Ihr Zustand zeigt sich nach dem ersten Lauf unter `/status`.
- **Bilder** werden von den Quellservern geladen (nicht kopiert). Manche Seiten blockieren das Einbetten, dann erscheint die typografische Gestaltung. Fotografen stehen nur dann im Nachweis, wenn der Feed sie nennt (`media:credit`). Sonst nennt APEX die Quelle.
- **Übersetzungsqualität:** `m2m100` liefert brauchbare, aber keine redaktionelle Qualität. Ausgefeilte deutsche Texte entstehen nur über die optionale Claude-Routine.
- **Wiederkehrende Kalendertermine (RRULE)** werden vereinfacht expandiert (YEARLY/MONTHLY/WEEKLY/DAILY, max. 60).
- **Apple-iCloud-Kalender** lassen sich nur als „öffentlicher Kalender“ per URL abonnieren. Wer das nicht möchte, exportiert eine ICS-Datei und importiert sie.

## Datensicherung und Wiederherstellung

- Wöchentlich (`.github/workflows/backup.yml`): vollständiger SQL-Export als privates Artefakt, 90 Tage aufbewahrt.
- Cloudflare D1 Time Travel: Wiederherstellung auf einen beliebigen Zeitpunkt der letzten 7 Tage (Free-Plan): `npx wrangler d1 time-travel restore apex --timestamp=…`.
- Wiederherstellen aus einem Export: `npx wrangler d1 execute apex --remote --file=apex-backup.sql`.
