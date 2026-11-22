# APEX online einrichten

Zeitaufwand etwa 30–45 Minuten, einmalig. Alles geht im Browser, ein Terminal auf dem Mac ist optional. Es entstehen **keine Kosten**: Cloudflare Free und GitHub Free verlangen keine Zahlungsmethode. Die verwendeten Dienste haben im Free-Plan harte Limits statt Überziehungsgebühren.

> Legen Sie die geheimen Werte (Passwort, Tokens) in einem Passwortmanager an, z. B. im iCloud-Schlüsselbund über „Passwort generieren“. Fügen Sie sie **niemals** in einen Chat ein.

## 1 · GitHub-Repository

1. Auf github.com ein **privates** Repository anlegen, z. B. `apex` (leer, ohne README).
2. Den Code hochladen. Am einfachsten: Repository-Namen an Claude nennen, Claude pusht den Code nach Ihrer Freigabe.

## 2 · Cloudflare-Konto und Datenbank

1. Kostenloses Konto auf dash.cloudflare.com anlegen (Free-Plan).
2. **Workers & Pages** öffnen. Beim ersten Mal eine `workers.dev`-Subdomain wählen. Daraus wird später Ihre Adresse `https://apex.<subdomain>.workers.dev`.
3. **Storage & Databases → D1 → Create database**, Name `apex`. Die angezeigte **Database ID** kopieren und in `wrangler.toml` bei `database_id` eintragen (oder Claude nennen).
4. **Account-ID** notieren (rechte Spalte auf der Workers-Übersicht).
5. **API-Token** anlegen: Profil → *API Tokens* → *Create Token* → Vorlage **„Edit Cloudflare Workers“** → bei *Permissions* zusätzlich **Account · D1 · Edit** hinzufügen (falls das Deployment wegen des AI-Bindings scheitert, außerdem **Account · Workers AI · Read**) → auf Ihr Konto beschränken → erstellen und kopieren.

## 3 · GitHub-Secrets (Repository → Settings → Secrets and variables → Actions)

| Art | Name | Wert |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Token aus 2.5 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Account-ID aus 2.4 |
| Secret | `PIPELINE_TOKEN` | zufälliger Wert, mind. 32 Zeichen (Passwortmanager) |
| Variable | `APEX_URL` | `https://apex.<subdomain>.workers.dev` |

Danach unter **Actions → deploy → Run workflow** starten. Der Workflow prüft den Code (Tests, Typen), legt die Datenbanktabellen an und veröffentlicht den Worker. Jede spätere Änderung auf `main` wird automatisch so veröffentlicht.

## 4 · Worker-Secrets (Cloudflare → Workers & Pages → apex → Settings → Variables and Secrets)

Als Typ **Secret** anlegen:

| Name | Wert |
|---|---|
| `APP_PASSWORD` | Ihr Login-Passwort, **mind. 16 Zeichen** empfohlen (mind. 12 erforderlich) |
| `SESSION_SECRET` | zufälliger Wert, mind. 32 Zeichen |
| `PIPELINE_TOKEN` | **derselbe** Wert wie in GitHub |
| `GITHUB_TOKEN` | Fine-grained Token (GitHub → Settings → Developer settings → Fine-grained tokens): nur Repository `apex`, Berechtigung **Actions: Read and write**, Ablauf z. B. 1 Jahr |
| `EDITORIAL_TOKEN` | *(optional, nur für die Claude-Routine)* zufälliger Wert, mind. 32 Zeichen |

Als Typ **Text** (Variable) anlegen: `GITHUB_REPO` = `<ihr-github-name>/apex`.

> `wrangler.toml` setzt `keep_vars = true`, deshalb bleiben im Dashboard gesetzte Variablen bei späteren Deployments erhalten. Secrets bleiben ohnehin erhalten.

## 5 · Erster Start

1. `https://apex.<subdomain>.workers.dev` öffnen → mit `APP_PASSWORD` anmelden.
2. **Status** (Zahnrad) → **„Nachrichten jetzt abrufen“**. Nach etwa 1–2 Minuten erscheinen die ersten Meldungen, und die Quellenliste zeigt, welche Feeds funktionieren.
3. Auf der Startseite **„Heutige Ausgabe jetzt erstellen“** wählen, oder bis 06:00 Uhr am nächsten Morgen warten.
4. **Kalender → Kalender verwalten**: Ihren Motorsport- und Messekalender als ICS-Datei importieren oder per URL abonnieren (Anleitung für Apple/Google/Outlook steht auf der Seite).

## 6 · Auf iPhone und iPad installieren

Safari → APEX öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**. Die App startet danach im Vollbild. Die Anmeldung gilt 90 Tage pro Gerät.

## 7 · Prüfen, ob die Automatik läuft

Unter `/status` erscheinen nach der Einrichtung:
- `dispatch` alle 60 Min. mit `HTTP 204` (Worker stößt GitHub an),
- `ingest` kurz danach mit Anzahl gespeicherter Meldungen,
- `publish` täglich nach 06:00 Uhr,
- `translate` mit übersetzten Titeln (Workers AI).

Der Status-Punkt im Kopf der Ausgabe wird gelb, wenn die letzte erfolgreiche Abfrage länger als 90 Min. zurückliegt, rot ab 3 Stunden.

## Optional: zusätzlicher Schutz mit Cloudflare Access

Cloudflare Zero Trust (Free bis 50 Nutzer) kann vor das Passwort zusätzlich eine E-Mail-Code-Anmeldung schalten. Bei der Anmeldung zu Zero Trust fragt Cloudflare teils eine Zahlungsmethode ab, auch im Free-Plan. Deshalb ist das optional. Wichtig: `/api/pipeline/*` und `/api/editorial/*` müssen dann per „Bypass“-Regel ausgenommen werden, weil sie eigene Tokens nutzen.

## Fehlerbehebung

| Symptom | Ursache / Lösung |
|---|---|
| Login: „noch nicht eingerichtet“ | `APP_PASSWORD` oder `SESSION_SECRET` fehlt bzw. ist zu kurz (Schritt 4). |
| Status: Pipeline-Anstoß „nicht konfiguriert“ | `GITHUB_TOKEN`/`GITHUB_REPO` fehlen. Bis dahin läuft nur das 6-Stunden-Sicherheitsnetz von GitHub. |
| `dispatch` mit HTTP 401/403/404 | Token abgelaufen oder ohne „Actions: write“, Repository-Name falsch, Workflow-Datei nicht auf `main`. |
| `ingest` mit HTTP 401 | `PIPELINE_TOKEN` stimmt in GitHub und Cloudflare nicht überein. |
| Quelle dauerhaft rot | Feed existiert nicht mehr oder blockiert Abrufe. Unter `/status` deaktivieren, `src/shared/sources.ts` anpassen. |
| Titel bleiben englisch | Workers-AI-Tageslimit erreicht (siehe `/status`) oder Übersetzung fehlgeschlagen. Der Originaltext bleibt dann sichtbar und gekennzeichnet. |
