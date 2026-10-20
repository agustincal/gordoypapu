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
// Se puede cambiar en vivo: V.C.curva = 8 + Ctrl+Enter
// ============================================================
V.init({
  bpm: 136,                     // reloj propio, sólo si no llega clock MIDI

  // ---- puertas ----
  alto: [0, 1],                 // franja de la pantalla donde viven los paneles (0 = arriba · 1 = abajo)
  // ---- duración del gesto (F3): de una negra a una redonda ----
  duracion: 1,                  // F3 · 0 = durMin · 1 = durMax
  durMin: 1,                    // negras con F3 abajo (una negra)
  durMax: 4,                    // negras con F3 arriba (una redonda)
  // proporciones del gesto (la duración real la da F3):
  abre: 4,                      // proporción que tarda en abrir
  sostiene: 1,                  // proporción que queda abierto
  cierra: 4,                    // proporción que tarda en plegarse hasta desaparecer
  curva: 6,                     // fuerza del ease in-out del pliegue (3 = suave · 6 = muy pronunciado · 10 = extremo)
  linea: 0.004,                 // ancho de la línea final antes de desaparecer
  prob: 0.6,                    // chance de que cada panel se prenda en cada ciclo
  // escalonado: el panel se parte en franjas horizontales y cada una arranca un poco tarde
  franjas: 3 / 7,               // F1 · 0 = 1 franja · 1 = 8 franjas (3/7 = 4)
  demora: 0.5,                  // proporción de demora máxima de una franja (al azar, distinta en cada ciclo)
  estela: 0.3,                  // F2 · degradado que deja el borde al moverse (0 = borde duro · 1 = muy largo)
  // la frase se arma sola a partir de la animación (nunca se corta):
  silencio: 0.5,                // proporción de negro al final de cada ciclo, antes del siguiente
  ciclos: 3,                    // ciclos de puertas por frase
  negro: 3,                     // negras de negro después de los ciclos
  golpe: 3,                     // negras que la sala entera queda prendida
  barrido: 1.5,                 // negras que tarda el barrido final en cerrar la sala
  // paneles: [x0, x1, dirección]
  //   1  = se abre desde el borde izquierdo hacia la derecha y se cierra también hacia la derecha
  //   -1 = lo mismo, de derecha a izquierda
  paneles: [
    [0, 1, 1],                  // pantalla completa
  ],
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción
// ============================================================
const CONTROLES = {
  franjas:  'F1',     // de 1 a 8 franjas
  estela:   'F2',     // de borde duro a degradado largo
  duracion: 'F3',     // duración del gesto: de una negra a una redonda
}


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
//   F1 = franjas (1 a 8) · F2 = estela · F3 = duración del gesto (negra → redonda)
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
