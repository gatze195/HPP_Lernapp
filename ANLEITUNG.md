# HP-Lernapp – Deployment-Anleitung (Railway.app)

## Was ist das?
Eine vollständige Web-Lernapp für die Heilpraktiker-Psychotherapie-Prüfung mit:
- Login-System (Registrierung + Anmeldung)
- 42 Lerntexte für alle Kapitel
- 36 Karteikarten mit Fortschrittsspeicherung
- 20 Multiple-Choice-Fragen
- KI-Tutor (Freier Chat + Prüfungssimulation)
- Persönliches Notizbuch
- Alles wird pro User in einer Datenbank gespeichert

---

## Schritt-für-Schritt: Kostenlos auf Railway.app hosten

### Schritt 1: GitHub-Account erstellen
1. Gehe zu https://github.com und klicke „Sign up"
2. Kostenlos registrieren

### Schritt 2: Neues Repository erstellen
1. Klicke auf „+" oben rechts → „New repository"
2. Name: `hp-lernapp`
3. „Private" auswählen (empfohlen)
4. Klicke „Create repository"

### Schritt 3: Dateien hochladen
1. Klicke im Repository auf „uploading an existing file"
2. Ziehe ALLE Dateien aus diesem Ordner hinein:
   - server.js
   - package.json
   - package-lock.json
   - .gitignore
   - Den Ordner `public/` (komplett)
3. Klicke „Commit changes"

### Schritt 4: Railway.app Konto erstellen
1. Gehe zu https://railway.app
2. Klicke „Login" → „Login with GitHub"
3. GitHub-Konto verknüpfen (kostenlos)

### Schritt 5: Neues Projekt auf Railway erstellen
1. Klicke „New Project"
2. Wähle „Deploy from GitHub repo"
3. Wähle dein `hp-lernapp` Repository
4. Railway erkennt Node.js automatisch

### Schritt 6: Umgebungsvariablen eintragen
1. Klicke auf deinen Deploy → „Variables"
2. Folgende Variablen hinzufügen:

| Variable | Wert |
|----------|------|
| `JWT_SECRET` | Ein langes Zufallswort (z.B. `MeinGeheimnis2026HPLernapp`) |
| `NODE_ENV` | `production` |

3. Klicke „Add" für jede Variable

### Schritt 7: Deploy starten
1. Railway startet automatisch
2. Klicke auf „Settings" → „Networking" → „Generate Domain"
3. Du erhältst eine URL wie: `hp-lernapp.up.railway.app`

### Fertig! 🎉
Deine App ist jetzt online. Du kannst:
- Die URL aufrufen
- Ein Konto erstellen
- Direkt anfangen zu lernen

---

## Kosten
- Railway: **Kostenlos** bis 500 Stunden/Monat (reicht für persönliche Nutzung)
- Keine Kreditkarte nötig für den Gratisplan

## Daten-Sicherheit
- Alle Passwörter sind verschlüsselt gespeichert (bcrypt)
- Login-Token läuft nach 30 Tagen ab
- Datenbank wird als Datei auf Railway gespeichert

## Bei Problemen
- Railway-Logs: Klicke auf dein Deployment → "View Logs"
- Häufigster Fehler: Umgebungsvariablen vergessen → nochmal Schritt 6 prüfen

