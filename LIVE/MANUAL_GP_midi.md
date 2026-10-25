# Manual · GP_midi + GP_tools (Fase 3 · LIVE)

Base MIDI genérica para todas las canciones de Fase 3. Vive en `LIVE/arq/`.
Actualizado: 2026-10-23 · GP_midi v1.10 · GP_tools v1.14 · GP_estados v1.4 (ver su manual)

---

## 1. Cargar en un sketch

```js
const GP_SHA = 'main'   // 'main' = ensayo (último push, sin purgar) · hash completo = show

const cargarGP = async (ruta) => {
  if (GP_SHA !== 'main') { await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/${ruta}`); return }
  const res = await fetch(`https://raw.githubusercontent.com/agustincal/gordoypapu/main/${ruta}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`no encontré ${ruta} (${res.status})`)
  ;(0, eval)(await res.text())
}

await cargarGP('LIVE/arq/GP_midi.js')    // siempre (ensayo y show)
await cargarGP('LIVE/arq/GP_tools.js')   // sólo en ensayo: grabador, panel, reproductor

GP.tools.init({ cancion: '03_Vociferan' })
await GP.midi.start()
```

- Se puede reevaluar todo lo que quieras: hay **una sola conexión MIDI** por página; nada se duplica.
- Después de cambiar `GP_midi.js` o `GP_tools.js` de versión mayor, recargar Hydra (F5) una vez.
- Verificar en consola: `GP.midi.version`, `GP.tools._version`.

---

## 2. Mapa del Akai (igual en todas las canciones)

| Zona | Notas | Uso | LED |
|---|---|---|---|
| Filas 1–3 de la grilla | 0–23 | **pads de la canción**: toggle, piano o de 2 a 4 estados (`GP.midi.buttons`, ver 5) | verde = reposo · verde parpadeo = prendido / estado 1 · amarillo parpadeo = estado 2 · rojo parpadeo = estado 3 · piano: rojo fijo mientras lo apretás · apagado = sin uso |
| Filas 4–8 de la grilla | 24–63 | **disparo**: sólo muestran lo que entra, una fila por canal (`GP.midi.filas`) | **activa** = verde, y la nota que suena se apaga · **muteada** = apagada, y la nota que suena se prende en verde (ves que hay notas, pero no dispara) · **rojo** = lo tocás vos |
| Botones redondos de abajo (arriba de cada fader) | 64–71 | **versión** del efecto de F1..F8 (`GP.midi.versiones`) | apagado = v1 · prendido = v2 · parpadea = v3 |
| Columna derecha 82–86 | 82 (fila 8) … 86 (fila 4) | **mute** del canal de esa fila | prendido = recibiendo · parpadea = muteado · apagado = no llegó nada, o **la fila no tiene canal** (ahí no mutea) |
| 87 / 88 | | **estado anterior / siguiente** (GP_estados) | prendido = hay a dónde ir · medio segundo de parpadeo = cambió el estado · parpadeo continuo = estados suspendidos |
| 89 | | **grabador** (GP_tools): toque = grabar / detener+guardar | prendido = listo · parpadea = grabando · apagado = guardando |
| 98 (Shift) | | **ocultar / mostrar todo** al **soltarlo** (código, barras del mic y paneles), en cualquier canción y también en el show, sin GP_tools. **Shift + pad de estados** = estado anterior (y ahí no oculta) — **no tiene LED** | |
| Faders | CC 48–55 | `F1`..`F8` (0..127) | — |
| FMASTER | CC 56 | **fundido a negro** en todos los sketches (ver 3.1) | — |

La fila 1 es la de abajo, la 8 la de arriba. `N11` = fila 1 columna 1 (nota 0).

**Cuál es el Akai:** el aparato cuyo nombre tiene `APC` (o el puerto `akai_Ensayo`). Un teclado marca Akai (MPK, etc.) **no** se confunde con la consola: sus notas y CC no mueven pads ni faders.

---

## 3. Faders

Se usan o no; no hay que declararlos.

```js
F1                        // 0..127 (global, siempre disponible)
GP.midi.fader('F1')       // igual
GP.midi.onFader('F1', v => { ... })   // se limpia solo en cada evaluación
```

- F7 tiene zona muerta (0..60 se ignora y el resto se reescala), por ruido de la controladora.
- Los valores se guardan y se recuperan al recargar.
- `GP.midi.faders([...])` ya no hace nada (queda por compatibilidad).

### 3.1 FMASTER = fundido a negro

Viene armado en `GP_midi`: no hay que escribir nada en el sketch.

- Arriba = imagen completa · abajo = negro. Curva suave cerca del negro.
- Es una capa negra encima del canvas de Hydra: no toca la cadena, los feedbacks ni la GPU. El editor de código y los paneles quedan visibles por encima.
- **Seguridad:** hasta que movés el FMASTER en la sesión, la imagen se ve completa (un valor viejo guardado en 0 no te deja en negro al arrancar).
- **El video grabado por GP_tools no incluye el fundido** (graba el canvas, y la capa está por encima). La salida en pantalla / proyector sí.
- `GP.midi.fundido(false)` lo apaga (si un sketch quiere usar FMASTER para otra cosa). `GP.midi.fundidoCurva(1)` = lineal.

---

## 4. Versiones por fader (botones 64–71)

Cada fader puede tener hasta 3 versiones de su efecto. Cada toque del botón de arriba pasa a la siguiente: v1 → v2 → v3 → v1. Con 2 versiones funciona como toggle.

```js
GP.midi.versiones({ F1: 3, F2: 2, F5: 3 })   // los no nombrados: sin uso, LED apagado

V1                          // 0, 1 o 2 (global, como F1)
GP.midi.versionDe('F1')     // igual
GP.midi.fijarVersion({ F1: 0, F5: 2 })   // desde código (ej: al entrar a un estado)
GP.midi.alVersion((fader, v, origen) => { ... })   // origen: 'akai' | 'codigo'
```

- La versión elegida **se conserva al recargar**, y el LED la muestra al conectar.

### Dos formas de usar las versiones en Hydra

**A) Versiones como parámetros (recomendada).** La cadena es una sola; cada versión es otro juego de números. Es instantáneo y sin cortes.

```js
const DISTORSION = [          // F1: una fila por versión
  { escala: 4,  vel: 0.1 },   // V1 = 0
  { escala: 20, vel: 0.5 },   // V1 = 1
  { escala: 60, vel: 2.0 },   // V1 = 2
]
src(s0).modulate(noise(() => DISTORSION[V1].escala, () => DISTORSION[V1].vel), () => F1 / 127 * 0.3).out()
```

**B) Versiones como cadenas distintas.** Para cuando la versión cambia el *tipo* de efecto. Se re-arma la escena al cambiar (recompila: puede haber un mínimo salto).

```js
const armar = () => {
  let c = src(s0)
  c = [ c.modulate(noise(4), () => F1 / 400),
        c.kaleid(() => 2 + F1 / 20),
        c.pixelate(() => 200 - F1, () => 200 - F1) ][V1]
  c.out()
}
armar()
GP.midi.alVersion(f => { if (f === 'F1') armar() })
```

### Versiones en estados (canciones con TABLA de estados)

Sumar columnas `v1`..`v8` a `CAMPOS`/`TABLA` y, al entrar a cada estado:

```js
GP.midi.fijarVersion({ F1: e.v1, F2: e.v2, /* … */ })
```

El botón en vivo cambia la versión hasta el próximo cambio de estado (mismo criterio que el takeover de faders). Si un estado no debe tocar un fader, no lo incluyas en el objeto.

---

## 5. Pads de las filas 1–3: toggle, piano o estados

```js
GP.midi.buttons(['N11', 'N12', 'N21'])     // como siempre: todos toggle

GP.midi.buttons({
  N11: 'toggle',   // un toque prende, otro apaga
  N12: 'piano',    // prendido sólo mientras lo apretás
  N13: 3,          // 3 estados: cada toque pasa al siguiente (0 → 1 → 2 → 0)
  N14: 4,          // hasta 4 estados
})

N11 ? 1 : 0                            // toggle y piano: true / false (global)
[0.1, 0.5, 1][N13]                     // estados: 0, 1, 2… (como V1 con las versiones)
GP.midi.on('N13', ({ valor, active }) => { ... })   // valor = true/false o el número
GP.midi.setButton('N13', 2)            // fijar desde código (toggle: true / false)
```

| Modo | Reposo | Activo |
|---|---|---|
| toggle | verde | verde parpadeo |
| piano | verde | rojo fijo mientras lo apretás |
| estados | 0 = verde | 1 = verde parpadeo · 2 = amarillo parpadeo · 3 = rojo parpadeo |

- **Shift + pad de estados** = vuelve al estado anterior. El Shift solo (sin tocar pads) oculta todo al soltarlo.
- Al reevaluar, cada pad que sigue con el mismo modo conserva cómo lo dejaste. Si le cambiás el modo, arranca en 0.
- En GP_estados un pad de estados se anota con su número (`brillo: 'N13'` → `brillo: 2`). Los piano no van en los estados.
- Si ponés un pad en una fila que es de disparo (4–8), la consola avisa: gana el disparo.

---

## 6. Filas de disparo (4–8) y mute por canal

Cada fila representa **un aparato + un canal**. Tocando los pads, disparás a mano (rojo). El botón de la derecha mutea el canal: la fila deja de disparar lo que viene del aparato, y queda sólo tu mano.

De un vistazo ves qué filas están activas en cada parte:

| Fila | En reposo | Nota que suena | La tocás vos |
|---|---|---|---|
| activa | verde | se apaga | rojo |
| muteada | apagada | verde | rojo |

Una fila sin canal (sólo a mano) no se mutea: siempre está activa (verde). Una fila `null` queda apagada y libre.

Con varias consolas y teclados, dos aparatos pueden mandar por el mismo canal (casi todos vienen en canal 1). Para separarlos se usa `puerto`.

```js
GP.midi.filas({
  8: { puerto: /padkontrol/i, canal: 10, pulso: 'vuelta' },  // cada golpe marca el pad siguiente
  7: { puerto: /padkontrol/i, canal: 1,  rango: [25, 48] },  // mini-teclado: grave a la izquierda
  6: { puerto: /keystep/i,    canal: 1,  rango: [48, 72] },  // otro aparato, mismo canal
  5: { canal: 2, notas: [36, 38, 42, 46] },                  // sin puerto: cualquier aparato menos el Akai
  4: null,                                                   // apagada
})
```

Opciones de cada fila:

| Campo | Qué hace |
|---|---|
| `canal` | 1..16, como lo muestra el panel MIDI |
| `puerto` | regex del aparato, como aparece en el panel (ej `/padkontrol/i`, `/keystep/i`). **Sin puerto = cualquier aparato menos el Akai.** El puerto de ensayo tiene que contener esa palabra (ej `keystep_Ensayo`) |
| `rango: [min, max]` | reparte esas notas en las 8 columnas |
| `notas: [37, 49, …]` | cada nota en su columna fija (las que no están caen por `rango` o `nota % 8`) |
| `pulso: true` | cualquier nota prende toda la fila |
| `pulso: 'vuelta'` | cada golpe marca el pad siguiente mientras suena (como cualquier nota: se apaga si la fila está activa, verde si está muteada); después del 8 vuelve al 1 (`columna` del evento = posición) |
| `{}` sin canal | fila sólo para disparo a mano |

Un solo evento para todo disparo:

```js
GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  // origen: 'canal' (vino del Korg) | 'akai' (lo tocaste vos)
  // con la fila muteada sólo llegan los 'akai' (la luz igual muestra las notas del canal)
})
```

- `GP.midi.mute(7)` / `GP.midi.mute(7, true)` / `GP.midi.muteado(7)` desde código.
- El mute y el "ya llegó" se conservan al reevaluar (mientras la fila siga con el mismo aparato y canal).
- El canal de estados (16) no se pone en una fila: lo maneja GP_estados (si lo ponés, la consola avisa).
- El mute corta **notas**, no el **clock** (el ritmo por clock sigue).
- Tiempo ajustable: `GP.midi.tiempos.minSuenaMs` (lo mínimo que se marca una nota muy corta, 90 ms).

### Datos de los ensayos (16/10, una sola consola — antes del cableado nuevo)

| Canal Korg | Qué es | Notas |
|---|---|---|
| 1 | línea principal (todas las canciones) | 8–12 distintas, rango cambia por canción (25–48) |
| 2 | melodía aguda, ocasional | 57–86 |
| 10 | pulso | casi siempre sólo la 37 (a veces 49) |

Con el cableado nuevo (varias consolas y teclados) hay que volver a mapear: ver `HOJA_DE_RUTA_mapeo_midi.md`.

---

## 7. Todo lo que entra (si el sketch necesita algo propio)

```js
GP.midi.alMensaje((nombre, data, info) => {
  // recibe TODO: korg, akai, clock. info.muteado = ese canal está muteado
})
```

Sketch sin GP_midi (sólo GP_tools): `GP.tools.conectarMidi({ alMensaje: (nombre, data) => {...} })`.

**Ocultar todo desde código:** `GP.midi.ocultarTodo()` alterna (lo mismo que soltar el Shift 98) · `GP.midi.ocultarTodo(true)` oculta · `(false)` muestra · `GP.midi.oculto()` dice cómo está.
Si el motor de la canción ya maneja el 98 (Vociferan, James: su `toggleCodigo`), GP_midi no lo repite: se pone al día y oculta lo que falte (barras del mic, paneles).
Otro módulo con cosas en pantalla se anota con `GP.midi.alOcultar('id', visible => {...})` (así lo hace GP_tools con sus cajas).

---

## 8. LEDs libres

Un solo dueño de los LEDs: **nadie más le manda notas al Akai**. Para efectos propios:

```js
GP.midi.luz('N33', GP.midi.COLOR.verde)   // capa "luces" (pierde contra botones/filas/versiones)
GP.midi.luz('N33', 0)                      // apagar
GP.midi.apagarLuces()
GP.midi.repintar()                         // si algo quedó raro
```

Colores (APC mini, grilla): `apagado 0 · verde 1 · verdeParpadeo 2 · rojo 3 · rojoParpadeo 4 · amarillo 5 · amarilloParpadeo 6`.
Botones redondos: `0` apagado · `1` prendido · `2` parpadeo.

Prioridad: sistema (grabador) > botones / filas / versiones / mute > luces.

---

## 9. Grabador y ensayo (GP_tools)

- **Pad 89** o **Ctrl+Alt+R**: grabar / detener+guardar. Ctrl+Alt+S: detener+guardar. Ctrl+Alt+P: ocultar/mostrar paneles. Ctrl+Alt+N: lista de notas en el panel.
- **Ocultar todo:** **Shift (98)** del Akai (lo maneja GP_midi, ver sección 7): las cajas de GP_tools se ocultan y vuelven con él. **Ctrl+Shift+H** de Hydra también: las cajas se ocultan y vuelven junto con el código (antes Hydra se las llevaba y no volvían).
- Graba MIDI + audio + video de Hydra. Archivos: `<cancion>_ensayo_<fecha>_midi.json / _audio.webm / _video.mp4`.
- **Video en MP4** (H.264 en Chrome). Si el navegador no puede, sale `.webm` como antes. `GP.tools.init({ formatoVideo: 'webm' })` para forzar WebM.
- **De dónde sale el audio** (el `_audio.webm` y el sonido del video), automático:
  - **hay un audio cargado en el reproductor de ensayo** → graba esa canción directo, a volumen completo (no pasa por el aire ni por el mic);
  - **no hay audio cargado** (ensayo real con la banda) → graba el **micrófono**.
  - El indicador lo dice: `midi+canción+video mp4` o `midi+mic+video mp4`.
  - Para elegirlo a mano: `GP.tools.init({ audio: 'mic' })` · `'ensayo'` · `'ambos'` (canción + mic mezclados) · `'auto'` (el de siempre).
  - Si querés grabar un ensayo real después de haber usado el reproductor, recargá la página (F5) para que no quede la canción cargada, o usá `audio: 'mic'`.
- El MIDI se graba con la hora real de llegada (no se corre si el navegador se traba).
- **Pantalla de ensayo** (todo fuera del canvas: no sale en la proyección ni en el video):
  - arriba a la izquierda: panel MIDI · arriba a la derecha: estado actual + botonera de estados;
  - abajo, a lo ancho: **línea de tiempo** y, debajo, el **reproductor** y el **REC**;
  - abajo a la derecha quedan libres 100 × 80 px para las barras del mic de Hydra (`a.show()`).
- **Reproductor:** `midi` / `audio` (verde = cargado, rojo = error) · ▶ / ⏸ (pausa) · ■ (todo al principio: canción y estados) · 🔁 (bucle) · reloj `1:23 / 3:40 · estado 5/13`. Limpia solos los duplicados de grabaciones viejas.
- **Línea de tiempo:** una marca numerada por cada cambio de estado (canal 16) del `.json`. **Clic en la línea** = ir a ese momento (canción, MIDI y estado juntos); **clic cerca de una marca** = justo al comienzo de ese estado. ▶ desde el principio hace `GP.estados.reiniciar()` solo.
- **🔁 Bucle:** repite la parte del estado en el que está la canción (de su cambio de estado al siguiente), sin pasar al próximo estado. Para diseñar un estado escuchándolo en loop; combinado con ⏸ de estados y ⧉ copiar. Clic en otra parte de la línea con el bucle prendido = el bucle pasa a ese estado.
- Consola: `GP.tools.ensayo.irEstado(5)` · `.ir(83000)` (ms) · `.bucle()` · `.pausar()` · `.reproducir()` · `.pos` · `.marcas`.
- **Puertos loopMIDI:** uno por aparato grabado, llamado `<palabra>_Ensayo`, donde la palabra está en el nombre del aparato. Ya existen `korg_Ensayo` (padKONTROL) y `akai_Ensayo` (APC). Para un aparato nuevo, ej "Arturia KeyStep 37" → `keystep_Ensayo`. Después de crearlos, reiniciar Chrome entero.
- `GP.tools.rutaEnsayo()` muestra a qué puerto va cada aparato del .json cargado (o `GP.tools.rutaEnsayo(['Arturia KeyStep 37'])`). Al dar ▶, si un aparato no tiene puerto, el panel dice `sin puerto: …` y la consola explica cómo crearlo.
- `GP.tools.init({ grabarVideo: false })` para sólo MIDI + audio; `videoBitrate: 4e6` para archivos más livianos.

### Panel MIDI (arriba a la izquierda)

- Una línea por aparato + canal: punto amarillo = actividad, último mensaje, cantidad de notas, fila asignada y `MUTE`. El clock va aparte con su BPM.
- **Ctrl+Alt+N** (o `GP.tools.notas()`): muestra debajo de cada canal la lista de notas que fueron entrando, ordenadas, con el `rango` sugerido. La última nota tocada se marca en amarillo.
- `GP.tools.listaNotas()` en consola: imprime `notas: [...]` y `rango: [...]` de cada canal listos para copiar a `GP.midi.filas`.
- `GP.tools.limpiarPanel()` vacía todo (ej: antes de empezar una canción, para juntar sólo sus notas).
- El canal de estados aparece marcado como `estados`.

### Informe de canción (Ctrl+Alt+I)

`GP.tools.informe()` (o **Ctrl+Alt+I**) descarga `<cancion>_mapa_midi_<fecha>.md` con todo lo que entró desde el último `limpiarPanel()`:

- tabla por aparato y canal: cantidad de notas, distintas, rango, las más tocadas, CC, de qué minuto a qué minuto, y a qué fila va hoy;
- el canal de estados: cuántos cambios hubo y en qué momento (para comparar con los estados del sketch);
- la lista completa de notas de cada canal;
- una **sugerencia de `GP.midi.filas`** (los canales más tocados arriba; `pulso` si tiene 1–2 notas, `notas` si tiene hasta 8, `rango` si tiene más).

Los atajos leen la tecla física: con AltGr (teclado español) no se confunden con €, @, etc.
