// ============================================================
// 04_James_v03.js  ·  produccion/04_James/sketches/  (DESARROLLO)
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      Usa GP_midi / GP_tools / GP_estados de LIVE/arq y el motor de desarrollo
//      produccion/04_James/arq/GP_04_James__visual_v03.js
// Actualizado: 20/10/2026 (v03: arranca con Puertas; el pulso sale del clock del ensayo)
// ============================================================
//
// Ensayo sin músicos: en el panel de GP_tools cargá
//   midi  → produccion/04_James/ensayo/04_James_ensayo_interpretado_midi.json
//   audio → produccion/04_James/ensayo/James - MST V3.mp3
// y antes de dar ▶: GP.estados.reiniciar() en la consola.
// El ensayo manda clock: las puertas siguen el pulso de la canción.

// ---- carga de scripts ----
// 'main' = ensayo: trae lo último que subiste, directo de GitHub (sin purgar).
//          Después de cada push: recargá Hydra y volvé a evaluar.
const GP_SHA = 'main'

const cargarGP = async (ruta) => {
  if (GP_SHA !== 'main') {
    await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/${ruta}`)
    return
  }
  const url = `https://raw.githubusercontent.com/agustincal/gordoypapu/main/${ruta}?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`no encontré ${ruta} (${res.status})`)
  ;(0, eval)(await res.text())
}

await cargarGP('LIVE/arq/GP_midi.js')                                // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')                               // SÓLO ENSAYO: grabador (89), panel, reproductor
await cargarGP('LIVE/arq/GP_estados.js')                             // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/04_James/arq/GP_04_James__visual_v03.js') // motor de DESARROLLO

if (GP.tools) { GP.tools.init({ cancion: '04_James' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.james


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Se puede cambiar en vivo: V.C.cierra = 1 + Ctrl+Enter
// ============================================================
V.init({
  bpm: 136,                     // reloj propio, sólo si no llega clock MIDI

  // ---- puertas ----
  alto: [0.22, 0.78],           // franja de la pantalla donde viven los paneles (de arriba a abajo)
  abre: 0.12,                   // negras que tarda en abrir (casi seco)
  sostiene: 1,                  // negras que queda abierto
  cierra: 0.6,                  // negras que tarda en plegarse hasta la línea
  linea: 0.004,                 // ancho de la línea final antes de desaparecer
  prob: 0.6,                    // chance de que cada panel se prenda en cada ciclo
  // paneles: [x0, x1, hacia dónde se pliega (0 = izquierda · 0.5 = centro · 1 = derecha)]
  paneles: [
    [0.03, 0.10, 1],
    [0.12, 0.33, 0],
    [0.42, 0.58, 0.5],          // la puerta del centro (siempre se prende)
    [0.64, 0.67, 1],
    [0.67, 0.86, 0],
    [0.89, 0.98, 0],
  ],
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción (por ahora nada)
// ============================================================
const CONTROLES = {}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Los 13 cortes del análisis del audio (136 BPM), por ahora sólo con nombre:
// el cartel muestra en qué parte de la canción estás. Se llenan a medida que trabajamos.
// ============================================================
const ESTADOS = [
  /*  1 · 0:03 */ { nombre: 'arranca' },
  /*  2 · 0:10 */ { nombre: 'entra todo' },
  /*  3 · 0:33 */ { nombre: 'sección 3' },
  /*  4 · 0:47 */ { nombre: 'sección 4' },
  /*  5 · 1:02 */ { nombre: 'sección 5' },
  /*  6 · 1:23 */ { nombre: 'sección 6' },
  /*  7 · 1:37 */ { nombre: 'sección 7' },
  /*  8 · 1:59 */ { nombre: 'sin bombo' },
  /*  9 · 2:18 */ { nombre: 'pico' },
  /* 10 · 2:52 */ { nombre: 'quiebre' },
  /* 11 · 3:10 */ { nombre: 'quiebre 2' },
  /* 12 · 3:24 */ { nombre: 'caja' },
  /* 13 · 3:38 */ { nombre: 'final' },
]


// ============================================================
// AKAI — mapa LIVE (una fila por canal). Por ahora sólo muestran lo que llega.
//   fila 8 → canal 1, bajo (31–38) · fila 7 → canal 10, batería · fila 6 → canal 2, melodía (64–88)
//   86 / 87 = estado anterior / siguiente · 98 (Shift) = ocultar código y paneles
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.filas({
  8: { canal: 1,  rango: [31, 38] },
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2,  rango: [64, 88] },
  5: {},
})

// los estados van después de V.init y de las filas
GP.estados.init({
  cancion: '04_James',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
})

GP.midi.alDisparo(() => {})     // las notas todavía no mueven nada

// todo lo que entra: el clock mueve las puertas; 98 oculta el código
GP.midi.alMensaje((nombre, data) => {
  V.midi(nombre, data)
  const [st, nota, vel] = data
  if ((st & 0xf0) === 0x90 && vel > 0 && /apc|akai/i.test(nombre) && nota === 98) V.toggleCodigo()
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0)
render(o0)
