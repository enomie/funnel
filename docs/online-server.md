# Server & Deployment Guide (PHP)

Dieses Dokument beschreibt das Setup und den Deployment-Prozess für das Hosten von **FUNNEL** auf einem reinen PHP-Webserver, inklusive eines interaktiven Besucherzählers.

---

## 1. Hosting-Konzept & Pfade

* **Reiner PHP-Server:** Das Spiel wird als statisches Frontend ausgeliefert. Zur Erfassung der Besucherzahlen wird ein minimales PHP-Skript (`counter.php`) verwendet.
* **Relative Pfade:** In der Datei [vite.config.ts](file:///Users/johann/MyBrew/funnel-real/vite.config.ts) ist `base: './'` konfiguriert. Dadurch sind alle Asset-Pfade in den HTML/JS-Dateien relativ. Das Spiel kann in jedem beliebigen Unterordner auf dem PHP-Server abgelegt werden.

---

## 2. Der interaktive Besucherzähler

Die Messung der Aufrufe erfolgt direkt im Ordner `online/`. Wenn ein Besucher den Homescreen aufruft, fragt der Client per `fetch` die Datei `counter.php` ab, welche den Zähler erhöht und den aktuellen Stand zurückgibt.

### Dateien im `online/` Ordner:

1. **`counter.php`**: Einziger öffentlicher Endpunkt — inkrementiert den Zähler **pro PHP-Session** und gibt JSON zurück.
2. **`_data/visits.txt`**: Speichert den Zählerstand **außerhalb des direkten Webzugriffs** (Ordner `_data/` ist per `.htaccess` gesperrt).
3. **`.htaccess`**: Blockiert direkten HTTP-Zugriff auf `visits.txt` (Legacy) und den gesamten `_data/`-Ordner.

> [!NOTE]
> Um künstliche Klicks durch einfaches Neuladen (F5) zu vermeiden, nutzt das PHP-Skript PHP-Sessions (`session_start()`). So wird pro Besucher und Browsersitzung nur einmal gezählt.

> [!IMPORTANT]
> **Sicherheit:** Lade `visits.txt` **nie** in den Webroot hoch und setze **kein** `chmod 777`. Der Webserver-User (z. B. `www-data`) braucht Schreibrechte nur auf `_data/visits.txt` — typisch `chmod 640` auf der Datei und `chmod 750` auf `_data/`. Ein direkter Aufruf von `https://deine-domain.de/_data/visits.txt` muss mit **403 Forbidden** antworten.

---

## 3. Client-Integration (Homescreen)

Auf dem Homescreen ([index.html](file:///Users/johann/MyBrew/funnel-real/index.html)) wird ein optisch ansprechender Indikator mit grünem Puls-Effekt eingebaut.

### UI-Element im HTML:
```html
<p class="visitor-counter-wrapper" style="margin-top: 12px; font-size: 0.9em; opacity: 0.85; display: inline-flex; align-items: center; gap: 8px; justify-content: center; width: 100%;">
  <span class="visitor-dot" style="width: 8px; height: 8px; background: #00ff66; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #00ff66; animation: pulse 1.5s infinite alternate;"></span>
  <span>Visitors: <strong id="visitor-count">Lade...</strong></span>
</p>
```

### TypeScript-Logik in [main.ts](file:///Users/johann/MyBrew/funnel-real/src/home/main.ts):
Der Client ruft das PHP-Skript ab. Schlägt der Aufruf fehl (z. B. in der lokalen Entwicklung ohne PHP-Server), wird elegant auf ein Fallback ("Bereit" / "Active") umgeschwenkt.

---

## 4. Deployment- & Update-Prozess

Das Deployment basiert auf dem Ordner `online/`. 

### Ordnerstruktur von `online/` nach dem Build:
```text
online/
├── index.html          <-- Aktualisieren bei Update (enthält neue JS-Hashes)
├── game.html           <-- Aktualisieren bei Update (enthält neue JS-Hashes)
├── counter.php         <-- Bleibt unverändert auf dem Server
├── .htaccess           <-- Einmalig hochladen (schützt Legacy visits.txt)
├── _data/
│   ├── .htaccess       <-- Einmalig hochladen (blockiert direkten Zugriff)
│   └── visits.txt      <-- Zählerstand (NIE überschreiben/hochladen!)
├── assets/             <-- Aktualisieren bei Update (enthält neue JS/CSS Chunks)
├── audio/              <-- Nur einmalig hochladen (statisch)
├── icons/              <-- Nur einmalig hochladen (statisch)
└── Shooter-Pack/       <-- Nur einmalig hochladen (statisch)
```

### Schritt-für-Schritt Anleitung:

#### A. Projekt bauen
Führe lokal im Projektverzeichnis Folgendes aus:
```bash
npm run build
```
Vite generiert die fertigen Dateien im Ordner `dist/`.

#### B. Dateien synchronisieren
Führe das neu hinzugefügte Export-Skript aus:
```bash
npm run export:online
```
Dieses Skript bereinigt alte Chunks aus `online/assets/` und synchronisiert alle neuen HTML- und Asset-Dateien aus `dist/`, während deine Server-Daten (`counter.php`, `_data/visits.txt`, `.htaccess`) sicher erhalten bleiben.

#### C. Erstes Deployment (Initialer Upload auf den Server)
Lade den **gesamten Inhalt** des Ordners `online/` auf deinen PHP-Webserver hoch:
* Stelle sicher, dass `_data/visits.txt` für den PHP/Webserver-User beschreibbar ist (`chmod 640`, Ordner `_data/` `chmod 750`).
* Teste nach dem Upload: `https://deine-domain.de/_data/visits.txt` → muss **403** sein; `counter.php` → JSON mit Zählerstand.

#### D. Updates einspielen (Wenn sich der Code ändert)
Da Vite bei Code-Änderungen neue Dateinamen in `assets/` generiert (z. B. `index-a9b8c7.js`) und diese in den HTML-Dateien verlinkt, musst du bei einem Update Folgendes hochladen:

> [!IMPORTANT]
> **Was hochgeladen werden MUSS:**
> 1. Der **`assets/`** Ordner (enthält den neuen Code/Styles).
> 2. Die Dateien **`index.html`** und **`game.html`** (damit der Server auf die neuen Dateinamen in `assets/` verweist).

> [!WARNING]
> **Was du NICHT erneut hochladen solltest:**
> * Die Ordner `audio/` und `Shooter-Pack/` (sind groß und ändern sich selten).
> * Den Ordner **`_data/`** (enthält den echten Zählerstand — nie überschreiben!).
> * **`counter.php`**, **`.htaccess`** und **`_data/.htaccess`** (nur beim ersten Deployment).

---

## 5. Sicherheit (Kurzüberblick)

| Risiko | Gegenmaßnahme |
|--------|----------------|
| Direkter Download von `visits.txt` | Datei liegt in `_data/`, `.htaccess` mit `Require all denied` |
| Manipulation der Zählerdatei | Kein öffentlicher Schreibzugriff; nur `counter.php` schreibt mit `LOCK_EX` |
| F5-Spam / künstliche Klicks | PHP-Session: ein Zähler-Inkrement pro Browser-Session |
| `chmod 777` | **Niemals** — gibt jedem Server-Nutzer Schreibzugriff |

### Migration von altem Setup (visits.txt im Webroot)

Beim ersten Aufruf von `counter.php` nach dem Update verschiebt das Skript eine legacy `visits.txt` aus dem Webroot automatisch nach `_data/visits.txt`. Danach kannst du die alte Datei im Root löschen.

### Nginx (falls kein Apache)

```nginx
location ^~ /_data/ {
    deny all;
    return 403;
}

location = /visits.txt {
    deny all;
    return 403;
}
```
