# Optional: KI-Redaktion mit Ihrem Claude-Pro-Abo

**Status: vorbereitet, nicht aktiv.** Aktivierung nur mit Ihrer ausdrücklichen Zustimmung.

## Was geht und was nicht

- Claude Pro enthält **keine** API-Aufrufe. Die Anthropic-API wird nicht genutzt und nicht aktiviert.
- Claude Code kann **geplante Cloud-Sitzungen** („Routinen“ bzw. geplante Aufgaben) ausführen. Diese laufen bei Anthropic, nicht auf Ihrem Mac, und verbrauchen Kontingent Ihres Abos. Die Zahl der Läufe pro Tag ist je nach Abo begrenzt.
- Eine solche Sitzung kann jeden Morgen gegen 05:15 Uhr die wichtigsten Meldungen bei APEX abholen, deutsche Artikel schreiben und zurückgeben. Die 06:00-Ausgabe übernimmt sie automatisch, gekennzeichnet als **„KI-redaktionell“**.
- Schlägt die Routine fehl oder ist das Kontingent erschöpft, erscheint die Ausgabe im Basismodus (Originaltitel bzw. maschinelle Übersetzung). Es gibt keine Abhängigkeit.

## Schnittstelle

- `GET /api/editorial/candidates`: bis zu 20 Story-Cluster der letzten 30 Stunden ohne KI-Text, mit allen Quellen (Titel, Kurztext, URL, Sprache, Status).
- `POST /api/editorial/articles`: `{"articles":[{"item_id":123,"title_de":"…","dek_de":"…","body_de":"Markdown …","sources":["https://…"]}]}`
- Authentifizierung: `Authorization: Bearer <EDITORIAL_TOKEN>` (eigener Token, getrennt vom Pipeline-Token).

## Einrichtung (mit Ihrer Zustimmung)

1. Worker-Secret `EDITORIAL_TOKEN` setzen (siehe `SETUP.md`).
2. In der Cloud-Umgebung der Routine den Host `apex.<subdomain>.workers.dev` freigeben und `EDITORIAL_TOKEN` als Netzwerk-Secret für diesen Host hinterlegen. Der Token gelangt so nie in den Chat oder ins Repository.
3. Geplante Aufgabe täglich um 05:13 Uhr Europe/Berlin mit folgendem Auftrag anlegen:

```text
Du bist Redakteur von APEX, einer privaten deutschsprachigen Automobilzeitschrift.
1. Rufe GET https://apex.<subdomain>.workers.dev/api/editorial/candidates ab (Authorization-Header wird automatisch gesetzt).
2. Wähle die 6–10 wichtigsten Kandidaten, GT-Motorsport und internationale Industrie zuerst.
3. Schreibe zu jedem einen deutschen Beitrag: title_de (max. 90 Zeichen), dek_de (1–2 Sätze), body_de (150–400 Wörter, Markdown mit Absätzen, optional "## " Zwischenüberschriften).
   Regeln: Verwende ausschließlich Fakten aus den gelieferten Quellen (Titel und Kurztexte; du darfst die Original-URLs öffnen, sofern frei zugänglich, ohne Paywalls zu umgehen).
   Erfinde keine Zitate, Zahlen, Ergebnisse oder technischen Daten. Kennzeichne Unbestätigtes ausdrücklich ("Laut … soll …").
   Widersprechen sich Quellen, nenne die Aussagen getrennt mit Quellenangabe. Erkläre technische Hintergründe nur, wenn sie allgemein gesichert sind.
4. Sende die Beiträge per POST an /api/editorial/articles, mit "sources" = Liste der verwendeten URLs.
5. Antworte am Ende mit einer Zeile: Anzahl übernommener Artikel.
```

Ob die Routine gelaufen ist, zeigt `/status` → „KI-Artikel (Claude)“.
