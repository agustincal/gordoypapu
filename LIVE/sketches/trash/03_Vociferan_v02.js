// ============================================================
// 03_Vociferan_v02.js  ·  LIVE/sketches/
// Canción: 03_Vociferan (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      El motor vive en LIVE/arq/GP_03_Vociferan__visual.js
// Actualizado: 20/10/2026 (v02: mapa Akai nuevo — filas 4-8 de disparo, estados en 87/88,
//                         calibrar mic pasa del 88 al pad N38)
//              16/10/2026 (v01: primera versión LIVE, con estados)
// ============================================================

// ---- carga de scripts ----
// 'main' = ensayo: trae lo último que subiste, directo de GitHub (sin purgar).
//          Después de cada push: recargá Hydra y volvé a evaluar.
// Para el show: pegá el hash completo del commit probado
//          (GitHub Desktop → History → clic derecho → Copy SHA).
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

await cargarGP('LIVE/arq/GP_midi.js')                  // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')                 // SÓLO ENSAYO: grabador (89), panel, reproductor → en el show, borrá esta línea
await cargarGP('LIVE/arq/GP_estados.js')               // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('LIVE/arq/GP_03_Vociferan__visual.js')  // motor de los círculos

if (GP.tools) { GP.tools.init({ cancion: '03_Vociferan' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.vociferan


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Se puede cambiar en vivo: V.C.release = 2 + Ctrl+Enter
// (dura hasta el próximo estado que anote ese valor)
// ============================================================
V.init({
  // tamaño según la nota: grave = grande, agudo = chico
  notaGrave: 36, notaAguda: 84,
  radioGrave: 0.32, radioAgudo: 0.07,
  borde: 0.07,

  // color: cada disparo toma un tono cerca de 'hue' (+/- hueVar grados)
  hue: 20, hueVar: 8, sat: 1,
  paleta: [20, 110, 200, 290],       // los 4 golpes de paleta: rojo-naranja, verde, azul, violeta

  // vida de cada círculo
  entrada: 0.35,                     // segundos en llegar del borde al centro (notas de la canción)
  entradas: [0.15, 0.35, 0.8],       // disparos a mano: rápido, medio, lento
  radioAkai: 0.22,                   // tamaño de los disparos a mano
  mantener: 0.5,                     // segundos que se queda entero en el centro
  release: 1.2,                      // segundos en desvanecerse
  huecoAlIrse: 0.8,                  // al irse se ahueca como aro
  escapeProb: 0.12,                  // chance de que se escape en vez de apagarse
  escapeDir: 1,                      // 1 = arriba, -1 = abajo

  // golpe central
  golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,

  // fluctuación suave de intensidad
  fluct: 0.25, fluctVel: 3,

  // micrófono: temblor de la luz
  micPos: 0.06, micLuz: 0.9, micTam: 0.25, micUmbral: 0.15,

  // voz: franja de luz que recorre cada círculo, sólo mientras hay voz
  barridoFuerza: 0.8, barridoVel: 4, multicolor: 0.7,
  mostrarMic: true,                  // barras del mic en pantalla para calibrar

  // faders (de 0 a 1)
  tamano: 0.5,                       // F1: 0 = sin círculos · 0.5 = normal · 1 = tapan la pantalla
  direccion: 0,                      // F2: 0 = por los costados · 0.5 = arriba/abajo · 1 = costados invertidos
  tamanoMax: 1.15, giroMax: 180,

  // strobe rojo con cada bombo (ojo fotosensibilidad en vivo)
  strobe: true,
  flashDur: 0.045,

  demo: false,                       // true = notas falsas para probar sin MIDI
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// Mismo nombre que en V.init: los estados usan estos nombres.
// ============================================================
const CONTROLES = {
  tamano:    'F1',
  direccion: 'F2',
  strobe:    'N11',    // toggle: rojo parpadeando = strobe prendido
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (si no se anota: 0.3)
// ⚠ EJEMPLO para probar el sistema: hay que curarlos con la canción.
// ============================================================
const ESTADOS = [
  /* 1 */ { nombre: 'intro',            tamano: 0.35, strobe: false, release: 2, fluct: 0.4 },
  /* 2 */ { nombre: 'entra la voz',     tamano: 0.5 },
  /* 3 */ { nombre: 'estribillo',       tamano: 0.7, hue: 0, entrada: 0.2, escapeProb: 0.3 },
  /* 4 */ { nombre: 'puente',           direccion: 0.5, strobe: false, hue: 200, release: 2.5 },
  /* 5 */ { nombre: 'estribillo final', como: 3, tamano: 0.85, fundido: 1 },
]


// ============================================================
// AKAI — mapa LIVE (igual en todas las canciones)
//   fila 8 → canal 1, melodía: cada nota entra como círculo.
//            Tocás un pad = círculo de esa altura (grave a la izquierda). Mute: botón 82
//   fila 7 → canal 10, bombo: flash de strobe. Tocás un pad = flash. Mute: botón 83
//   fila 6 → disparos a mano, en el color de la canción:
//            col 1 2 3 = entra por la izquierda rápido / medio / lento
//            col 4     = golpe central
//            col 5 6 7 = entra por la derecha lento / medio / rápido
//            col 8     = se escapa arriba o abajo al soltar
//   fila 5 → col 1-4 = golpe de paleta: cambia el color de la canción
//            (rojo-naranja, verde, azul, violeta) hasta el próximo estado que anote hue
//            col 5-8 = libres
//   fila 4 → libre (mute: botón 86)
//   N11 (fila 1) = strobe sí / no
//   N38 (fila 3, col 8, amarillo) = calibrar mic (3 s de silencio, ¡sin voz!; parpadea mientras mide)
//   87 / 88 = estado anterior / siguiente (ensayo o emergencia)
//   98 (Shift) = ocultar código y paneles
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11'])
GP.midi.filas({
  8: { canal: 1, rango: [V.C.notaGrave, V.C.notaAguda] },
  7: { canal: 10, pulso: 'vuelta' },
  6: {},     // sólo a mano
  5: {},     // sólo a mano
  4: null,   // libre
})

// los estados van después de V.init, de los botones y de las filas
GP.estados.init({
  cancion: '03_Vociferan',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
})

const FILA6 = {
  1: { lado: -1, velocidad: 0 },
  2: { lado: -1, velocidad: 1 },
  3: { lado: -1, velocidad: 2 },
  4: { golpe: true },
  5: { lado: 1, velocidad: 2 },    // espejo de la izquierda: 5 lento,
  6: { lado: 1, velocidad: 1 },    //                         6 medio,
  7: { lado: 1, velocidad: 0 },    //                         7 rápido
  8: { escape: true, velocidad: 1 },
}

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  // melodía: del Korg, o a mano con la altura de la columna
  if (fila === 8) {
    if (origen === 'canal') { if (on) V.notaOn(nota, vel); else V.notaOff(nota) }
    else { const id = 4000 + columna; if (on) V.notaOn(id, vel, { altura: nota }); else V.notaOff(id) }
    return
  }
  // bombo → strobe (a mano siempre flashea)
  if (fila === 7) {
    if (on && (origen === 'akai' || V.C.strobe)) V.golpe()
    return
  }
  // disparos a mano en el color de la canción
  if (fila === 6) {
    const id = 3000 + columna
    const accion = FILA6[columna + 1]
    if (!on) { V.notaOff(id); return }
    if (accion.golpe) V.notaOn(id, vel, { tipo: 'golpe' })
    else V.disparo(id, vel, accion)
    return
  }
  // golpes de paleta
  if (fila === 5 && columna < 4) {
    if (on) V.golpePaleta(columna)
    else V.notaOff(2000 + columna)
  }
})

// botones sueltos del Akai
// (/apc|akai_?ensayo/: el APC o su puerto de ensayo, no un teclado Akai)
const PAD_CALIBRAR = 23   // N38: fila 3, columna 8
GP.midi.luz(PAD_CALIBRAR, GP.midi.COLOR.amarillo)
GP.midi.alMensaje((nombre, data) => {
  const [st, nota, vel] = data
  if ((st & 0xf0) !== 0x90 || vel === 0 || !/apc|akai_?ensayo/i.test(nombre)) return
  if (nota === PAD_CALIBRAR) {
    V.calibrarMic()
    GP.midi.luz(PAD_CALIBRAR, GP.midi.COLOR.amarilloParpadeo)
    setTimeout(() => GP.midi.luz(PAD_CALIBRAR, GP.midi.COLOR.amarillo), (V.C.calibrarSeg || 3) * 1000)
  }
  if (nota === 98) V.toggleCodigo()
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0)
render(o0)
