# Hoja de ruta · mapeo MIDI con el cableado nuevo

Para el próximo ensayo: llegan al menos 2 consolas (y quizás 2 teclados). Hay que volver a identificar qué entra por cada aparato y canal, y decidir qué hace cada cosa en cada canción.
Actualizado: 2026-10-20 · GP_midi v1.6 · GP_tools v1.9 · GP_estados v1.1

---

## 0. Antes del ensayo (en casa)

- [ ] Commit + push de `LIVE/arq` (GP_midi v1.6, GP_tools v1.9, GP_estados v1.1, GP_03_Vociferan__visual_v3) y de `LIVE/sketches/03_Vociferan_v03.js`.
- [ ] Abrir Hydra, F5, evaluar `LIVE/test_tools.js` y chequear en consola: `GP.midi.version` = `LIVE-v1.6` · `GP.tools._version` = `v1.9`.
- [ ] Probar el Akai con el mapa nuevo: mutes 82–86, estados 87 / 88 (en un sketch con estados), grabador 89.
- [ ] Si ya sabés qué aparatos llegan: crear en loopMIDI un puerto por aparato, `<palabra>_Ensayo` (ej `keystep_Ensayo` para "Arturia KeyStep 37"), y reiniciar Chrome entero. Si no, se crean después con los nombres que muestre el panel.

---

## 1. Al conectar todo (una sola vez, antes de tocar canciones)

Abrí `test_tools.js` (o cualquier sketch). El panel de arriba a la izquierda muestra una línea por aparato y canal.

- [ ] **Nombres:** anotá el nombre exacto de cada aparato tal como aparece en el panel.
- [ ] **Quién es quién:** tocá una nota en cada consola y teclado, y fijate qué línea se prende (aparato + canal).
- [ ] **El Akai:** tiene que aparecer como `APC MINI`. Si llega un teclado marca Akai, chequeá que sus CC no muevan los faders (no deberían).
- [ ] **Clock:** de qué aparato viene (línea con ♩) y a qué BPM. Si llegan dos clocks, anotarlo.
- [ ] **Estados:** de qué aparato viene el canal 16 (el panel lo marca `estados`). Si llega de dos aparatos, avisame: hay que fijar `GP.estados.config.fuente`.

| Nombre en el panel | Qué es (consola / teclado) | Canales que manda | `puerto` (regex) | Puerto de ensayo |
|---|---|---|---|---|
| padKONTROL … | consola Korg (la de siempre) | 1, 2, 10, 16 | `/padkontrol/i` | `korg_Ensayo` |
| APC MINI | Akai (consola de visuales) | — | — | `akai_Ensayo` |
| | | | | |
| | | | | |
| | | | | |

---

## 2. Por canción (repetir en cada una)

1. Abrí el sketch de la canción y evaluá.
2. Justo antes de arrancar: `GP.tools.limpiarPanel()` (así el informe junta sólo esta canción) y `GP.estados.reiniciar()`.
3. **Pad 89:** grabar. Tocan la canción entera.
4. Opcional, mientras suena: **Ctrl+Alt+N** muestra las notas de cada canal en el panel.
5. Al terminar: **pad 89** (detiene y guarda midi + audio + video) y **Ctrl+Alt+I** (descarga `<cancion>_mapa_midi_<fecha>.md`).
6. Preguntá a los músicos y anotá en la ficha de la canción (abajo) lo que el informe no dice: **qué instrumento es cada canal** y si alguno entra sólo en una parte.

Si no hay tiempo de tocar la canción entera, un pedazo con todos los instrumentos alcanza para los nombres y canales. Las notas completas salen después de la grabación.

El informe trae, por aparato y canal: cantidad de notas, rango, las más tocadas, CC, de qué minuto a qué minuto suena, a qué fila va hoy, los cambios del canal 16 con sus tiempos, y una **sugerencia de `GP.midi.filas`**.

---

## 3. Fichas por canción

En el Akai hay **5 filas de disparo**: de la 8 (arriba) a la 4. Las filas 1–3 son toggles y pads propios de la canción.

Hoy, todas las canciones usan el mismo orden: **8 = canal 1 · 7 = canal 10 · 6 = canal 2**. La fila 4 es nueva.

### 01 · Fluorescente

5 estados · F1–F8 · N11 rotar 90° · N12 rotar la mitad · N13 atrasar la mitad

| Fila | Hoy | Qué hace en el visual | Nuevo: aparato · canal | Notas / rango | Instrumento |
|---|---|---|---|---|---|
| 8 | canal 1 · rango 25–36 | arpegio; a mano, sostener frena el movimiento | | | |
| 7 | canal 10 · pulso | batería; a mano: col 1-3 bombo, 4-6 caja, 7-8 hat | | | |
| 6 | canal 2 · rango 24–60 | bajo (en el ensayo no llegó) | | | |
| 5 | libre | — | | | |
| 4 | — | — | | | |

Cambios del canal 16 medidos: ___ (el sketch tiene 5 estados)

### 02 · Buscando Placer

13 estados · F1–F7 · N11 barrido · N12 imán · N13 siguen ritmo · **los mutes de las filas 5–8 son parte de los estados** (`muteCanal1: 'M8'` …)

| Fila | Hoy | Qué hace en el visual | Nuevo: aparato · canal | Notas / rango | Instrumento |
|---|---|---|---|---|---|
| 8 | canal 1 · rango 26–61 | línea principal: un recuadro por nota (de base, muteada) | | | |
| 7 | canal 10 · pulso | pulso: recuadros | | | |
| 6 | canal 2 · rango 60–72 | melodía: recuadros | | | |
| 5 | canal 3 | recuadros | | | |
| 4 | — | — | | | |

Cambios del canal 16 medidos: ___ (el sketch tiene 13 estados)
Ojo: si un canal cambia de fila, también hay que mover su mute en `CONTROLES` (`muteCanal1: 'M8'` → la fila nueva).

### 03 · Vociferan

LIVE **`03_Vociferan_v03`** (motor v3.6, círculos + escenas): 13 estados · F1–F8 · V1 anillos · N11 strobe · N12 quieto · N13 blanco y negro · **N38 calibrar mic** (antes 88)
(`v01` / `v02` = motor v2.0, sólo círculos, 5 estados: quedan de respaldo)

| Fila | Hoy | Qué hace en el visual | Nuevo: aparato · canal | Notas / rango | Instrumento |
|---|---|---|---|---|---|
| 8 | canal 1 · rango 45–84 | melodía → círculos (en todas las escenas); a mano, círculo de esa altura | | | |
| 7 | canal 10 · pulso | batería: 37 bombo (strobe, cambia de forma), 38 caja; a mano 1-4 bombo, 5-8 caja | | | |
| 6 | sólo a mano | disparos (izquierda / centro / derecha / escape) | | | |
| 5 | sólo a mano | golpes de paleta (col 1-4) · círculos / escena anterior / siguiente / forma siguiente (col 5-8) | | | |
| 4 | — | — | | | |

Cambios del canal 16 medidos: ___ (el sketch v03 tiene 13 estados)
Ojo: en Vociferan, `cambio` y `golpe` eligen **qué voz** (bombo / caja / melodía) cambia y hace latir las formas. Si cambia el instrumento de un canal, revisar también los estados.

### 04 · James

13 estados · F1–F4 · V1–V4 · N11 por altura · N12 partida · N13 tótem · N14 respira · 98 ocultar código

| Fila | Hoy | Qué hace en el visual | Nuevo: aparato · canal | Notas / rango | Instrumento |
|---|---|---|---|---|---|
| 8 | canal 1 · rango 31–38 | bajo: abre puertas (se sostienen) | | | |
| 7 | canal 10 · pulso | batería: 36 bombo, 38 caja; a mano 1-4 bombo, 5-8 caja | | | |
| 6 | canal 2 · rango 64–88 | melodía | | | |
| 5 | sólo a mano | golpe · puerta · partida · strobo | | | |
| 4 | — | — | | | |

Cambios del canal 16 medidos: ___ (el sketch tiene 13 estados)
Ojo: en James cada estado elige **qué voz** dispara (`disparo: 'bajo'`, `cruce: 'caja'`…). Si cambia el instrumento de un canal, hay que revisar los estados, no sólo las filas.

### 05 · (por diseñar)

| Fila | Nuevo: aparato · canal | Notas / rango | Instrumento | Idea para el visual |
|---|---|---|---|---|
| 8 | | | | |
| 7 | | | | |
| 6 | | | | |
| 5 | | | | |
| 4 | | | | |

---

## 4. Cómo decidir las filas

- **Mantener el orden de siempre si se puede:** 8 = línea principal · 7 = pulso / batería · 6 = segunda voz. Así no hay que reaprender la consola ni tocar el código de cada canción.
- **Los canales nuevos van a la fila 5 y a la 4.** Si hay más de 5 canales con notas, quedan afuera los que menos se usan (el informe lo dice).
- **Cómo se reparte cada fila:** 1–2 notas → `pulso: 'vuelta'` · hasta 8 notas → `notas: [...]` (cada nota su pad) · más de 8 → `rango: [min, max]`.
- **Mismo canal desde dos aparatos** (casi todos vienen en canal 1) → separarlos con `puerto`.
- **El canal 16 nunca va a una fila** (los estados no se muestran en el Akai).
- **Lo que hace cada fila en el visual está en el código de la canción** (`alDisparo` pregunta por el número de fila). Si una voz cambia de fila, la canción necesita una versión nueva del sketch.

---

## 5. Después del ensayo (con Claude)

Pasame por canción: el **informe** (`_mapa_midi_….md`), el **`_midi.json`** y, si querés que revise la sincronía, el **`_audio.webm`**.

Con eso:

1. Armo `GP.midi.filas` de cada canción con aparato, canal y reparto.
2. Reviso en cada sketch que cada fila siga disparando el instrumento correcto (y en James y Buscando Placer, los estados que eligen voces o mutes).
3. Comparo los cambios del canal 16 con los estados de cada canción.
4. Te digo qué puertos de loopMIDI faltan para el reproductor (`GP.tools.rutaEnsayo()` lo muestra).
5. Guardo cada sketch cambiado como **versión nueva** (`_v02`, `_v03`…). Vociferan LIVE ya está en v03 (la próxima es v04).

Para probar sin músicos: cargá en el reproductor el `_midi.json` y el `_audio.webm` de la canción, `GP.estados.reiniciar()` y ▶.
