Hier sind die **5 goldenen Regeln** für dein Entwickler-Team. Diese Regeln sind absolut binär formuliert – entweder der Code hält sich daran, oder er fliegt beim Code-Review durch.

Wenn dein Developer diese Regeln konsequent umsetzt, holt ihr das absolute Maximum aus der Kombination von **Three.js, WebGPU, Rapier Physics und SIMD** heraus.

---

## 1. Zero Garbage Collection im Game Loop (Die Speicher-Regel)

**Das Prinzip:** Ein Shooter läuft mit 60–144 FPS. Jede Zuweisung von `new` (Vektoren, Matrizen, Quaternionen) innerhalb des `requestAnimationFrame`-Loops triggert den Garbage Collector (GC). Sobald der GC anspringt, framedroppt das Spiel.

* **Die Regel:** **Keine Instanziierung von Objekten im Render-Loop.** Alle mathematischen Operationen müssen *in-place* auf globalen, wiederverwendbaren Objekten (`Pools` oder `Staging Variables`) ausgeführt werden.
* **Der Prüf-Check:** * Suche im Code nach `new THREE.Vector3()`, `new THREE.Matrix4()` oder `{}` innerhalb des Loops.
* *Kompatibler Code:* `myVector.addVectors(a, b)` statt `const c = a.clone().add(b)`.



---

## 2. Instanced Rendering & Draw Call Minimierung (Die WebGPU-Regel)

**Das Prinzip:** WebGPU ist zwar verdammt schnell beim CPU-zu-GPU-Overhead, aber 1.000 einzelne 3D-Objekte (wie Patronenhülsen, Trümmer oder identische Gegner) bedeuten immer noch 1.000 Draw Calls.

* **Die Regel:** **Identische Geometrien und Materialien MÜSSEN in `THREE.InstancedMesh` gebündelt werden.** Für statische Level-Geometrie gilt: Zusammenfassen (*Mesh-Merging*), um die Anzahl der Bind Groups und Pipelines in WebGPU so gering wie möglich zu halten.
* **Der Prüf-Check:** * Gibt es für repetitive Objekte (Kugeln, Kisten, Lampen) separate `new THREE.Mesh()`-Aufrufe? Wenn ja -> Regelbruch.
* *Kompatibler Code:* Ein einziges `InstancedMesh` verwaltet die Transformationen aller 500 gegnerischen Soldaten via Matrizen-Array.



---

## 3. Singuläre Fixed-Timestep-Synchronisation (Die Rapier-Regel)

**Das Prinzip:** Die Physik (Rapier) und die Grafik (Three.js) laufen mit unterschiedlichen Geschwindigkeiten. Grafik ist variabel (FPS), Physik MUSS strikt deterministisch sein (z. B. exakt 60 Hz). Wenn man die Grafik-Frequenz einfach auf die Physik spiegelt, glitchen Charaktere durch Wände, sobald die FPS einbrechen.

* **Die Regel:** **Rapier läuft in einem eigenen, fixen `world.step()`-Intervall.** Die Three.js-Visuals extrahieren die Positionen *danach* und nutzen bei Bedarf Interpolation. Es wird niemals die Render-Delta-Zeit direkt in Rapier eingespeist.
* **Der Prüf-Check:**
* Steht im Code `world.step(deltaTime)`? -> **Sofortiger Regelbruch.**
* *Kompatibler Code:* `world.setTimeStep(1/60)` und ein Akkumulator-Loop, der die Physik-Schritte unabhängig von den Render-FPS konstant hält.



---

## 4. Konsequente Nutzung von Typisierten Arrays (Die SIMD-Regel)

**Das Prinzip:** Da ihr Rapier mit SIMD (Single Instruction, Multiple Data) nutzt, arbeitet die Physik-Engine intern auf WebAssembly-Ebene direkt im Speicher (Wasm Memory) mit flachen, fortlaufenden Datenstrukturen (`Float32Array`). Wenn dein Developer Daten zwischen JS und Wasm hin- und herkopiert oder "normale" JS-Arrays (`[]`) nutzt, verpufft der SIMD-Vorteil komplett.

* **Die Regel:** **Alle massenhaften mathematischen Daten (z. B. Partikelpositionen, Health-Werte der Gegner) werden in flachen `Float32Array`s oder `Int32Array`s gespeichert.** Datenübergaben an WebAssembly/Rapier geschehen direkt per Referenz-Pointer, nicht durch Schleifen.
* **Der Prüf-Check:**
* Nutzt der Entwickler Standard-Arrays (`[]`) für Positionsdaten oder konvertiert er ständig Arrays mit `Array.from()`? -> Regelbruch.
* *Kompatibler Code:* `const positions = new Float32Array(maxEnemies * 3);`



---

## 5. Async-Asynchronität & Web Worker Auslagerung (Die CPU-Regel)

**Das Prinzip:** Ein Shooter berechnet viel: Wegfindung (A*), Physik (Rapier), Netzwerk-Sockets und Audio. Wenn das alles auf dem Main-Thread (wo Three.js rendert) läuft, ruckelt das Spiel, sobald 30 Gegner gleichzeitig die Route berechnen.

* **Die Regel:** **Der Main-Thread ist NUR für Grafik (WebGPU) und Input-Erfassung da.** Die Rapier-Physik-Welt und komplexe Gameplay-Logik (KI, Netzwerk) laufen in einem separaten **Web Worker**. Die Kommunikation erfolgt asynchron via `Transferables` (ohne Kopier-Overhead).
* **Der Prüf-Check:**
* Läuft `world.step()` im selben Thread/Script wie `renderer.render()`? -> Regelbruch (sobald das Projekt skaliert).
* *Kompatibler Code:* Der Main-Thread schickt nur Input-Daten an den Worker und empfängt ein `SharedArrayBuffer` oder ein transferiertes `Float32Array` mit den neuen Positionen der RigidBodies zurück.



---

### Spickzettel für dein Code-Review (Die "Ausschluss-Liste")

Wenn du den Code deines Developers öffnest, darfst du **innerhalb des Game-Loops** (überall wo `requestAnimationFrame` oder `renderer.setAnimationLoop` drüber steht) folgende Dinge **NIEMALS** sehen:

1. `new` (Keine neuen Objekte)
2. `push()` oder `concat()` auf normalen Arrays (erzeugt GC-Instabilität)
3. `.clone()` ( Three.js-Klonen ist ein Performance-Killer)
4. `world.step(variableZeit)` (Zerstört die Physik-Stabilität)
5. `console.log()` (Verlangsamt WebGPU-Pipelines im Production-Build massiv)