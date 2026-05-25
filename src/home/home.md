# FUNNEL Home — Standalone Landing Page

Die Startseite ist **vollständig losgelöst** vom Spiel (`game.html`). Kein Three.js, kein Rapier, keine Team-CSS-Variablen aus dem Combat-Stack — nur HTML, schlankes CSS und ein kleines TypeScript-Modul für Daten + Interaktion.

Spielstart ausschließlich über **Start Match** → `./game.html` (Boot-Gate via `boot-gate.ts`).

---

## Layout (von oben nach unten)

| Bereich | Inhalt |
|---------|--------|
| **Navbar** | Links: **FUNNEL** (Logo) + darunter klein „Arena FPS Shooter“. Rechts: **Start Match** (eckig, `border-radius: 0`). Hintergrund grau, `border-bottom`. |
| **Hero** | Volle Breite, kariertes Raster wie bisher. Oben „ARENA FPS SHOOTER“, groß **FUNNEL**, darunter „Have fun in the tunnel.“ |
| **Slider** | Drei Infinity-Carousels (CSS-Animation, keine Bootstrap-Abhängigkeit): Waffen · Quick Tips · Pickups |
| **Keys** | Statisches Raster aus `src/texts/keys.json` |
| **Footer** | Lizenz, Version, Technik, Publisher — alles aus `src/texts/Information.json` |

---

## Datenquellen (`src/texts/`)

| Datei | Verwendung |
|-------|------------|
| `weapon-infos.json` | Waffen-Karten: Titel + Rahmen in `color` (Hex, gleiche Farben wie Ingame) |
| `quicktips.json` | Quick-Tip-Karten |
| `pickups.json` | Pickup-Karten |
| `keys.json` | Tastenkürzel-Referenz |
| `Information.json` | Footer: MIT-Lizenz, Version, Stack, Publisher, Besucherzähler-Hinweis |

---

## Slider-Technik

Kein Bootstrap — **reines CSS** (`@keyframes` + duplizierter Track) für nahtlose Infinite-Loops. JS rendert Karten aus JSON und klont den Track einmal für den Loop. So bleibt die Home-Bundle klein und unabhängig vom Game-Build.

Waffen-Karten: `--card-accent` aus `weapon-infos.json` → Titelfarbe + `border-color`.

---

## Besucherzähler & Deployment

Siehe [docs/online-server.md](../../docs/online-server.md):

- Produktion: `fetch('counter.php')` auf dem PHP-Host (Session-basiert, ein Zähler pro Besucher).
- Lokal (Vite `:3011`): Fallback „Active“, kein Fehler.
- Deploy: `npm run build` → `npm run export:online` → `online/index.html` + `assets/` hochladen; `_data/visits.txt` **nie** überschreiben.

Der grüne Puls-Punkt neben der Besucherzahl bleibt im Footer-Bereich (aus `Information.json` gesteuert).

---

## Dateien

```
index.html          Shell (Navbar, Hero, Slider-Container, Footer-Container)
src/home/main.ts    Boot, JSON laden, Slider + Keys rendern, Visitor fetch
src/home/home.css   Alles Home-spezifische Styling
src/home/boot-gate.ts  unverändert — Session-Flag für game.html
```
