// ============================================================
// 03_Vociferan_v02.js  ·  produccion/03_Vociferan/fase3/  (DESARROLLO)
// Canción: 03_Vociferan (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      Usa GP_midi / GP_tools / GP_estados de LIVE/arq y el motor de desarrollo
//      produccion/03_Vociferan/fase3/GP_03_Vociferan__visual_v3.js (círculos + escenas).
//      La versión de LIVE (03_Vociferan_v01 + visual v2.0) no se toca.
// Actualizado: 17/10/2026 (v02: escenas de James en el color de Vociferan; los 13
//              estados salen del análisis del audio — ver produccion/03_Vociferan/ensayo/)
// ============================================================
//
// Ensayo sin músicos: en el panel de GP_tools cargá
//   midi  → produccion/03_Vociferan/ensayo/03_Vociferan_ensayo_interpretado_midi.json
//   audio → Vociferan_-_MST_V3.wav
// y antes de dar ▶: GP.estados.reiniciar() en la consola.
// Cuando esté aprobada: el motor pasa a LIVE/arq como GP_03_Vociferan__visual_v3.js
// y este sketch a LIVE/sketches como 03_Vociferan_v02.js (cambiando la ruta de abajo).
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
await cargarGP('produccion/03_Vociferan/fase3/GP_03_Vociferan__visual_v3.js')  // motor de DESARROLLO: círculos + escenas

if (GP.tools) { GP.tools.init({ cancion: '03_Vociferan' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.vociferan


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Se puede cambiar en vivo: V.C.release = 2 + Ctrl+Enter
// (dura hasta el próximo estado que anote ese valor)
// ============================================================
V.init({
  escena: 'circulos',     // 'circulos' | 'morfo' | 'iris' | 'corte' | 'anidado' | 'lente'

  // ---- círculos (la Vociferan de siempre) ----
  // tamaño según la nota: grave = grande, agudo = chico (rango sacado del audio)
  notaGrave: 45, notaAguda: 84,
  radioGrave: 0.32, radioAgudo: 0.07,
  borde: 0.07,
  hue: 20, hueVar: 8, sat: 1,
  paleta: [20, 110, 200, 290],       // golpes de paleta: rojo-naranja, verde, azul, violeta
  entrada: 0.35, entradas: [0.15, 0.35, 0.8], radioAkai: 0.22,
  mantener: 0.5, release: 1.2, huecoAlIrse: 0.8,
  escapeProb: 0.12, escapeDir: 1,
  golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,
  fluct: 0.25, fluctVel: 3,
  micPos: 0.06, micLuz: 0.9, micTam: 0.25, micUmbral: 0.15,   // el mic sólo vibra
  barridoFuerza: 0.8, barridoVel: 4, multicolor: 0.7,
  mostrarMic: true,
  tamano: 0.35,                      // F1 · círculos y formas (0.5 = normal)
  direccion: 0,                      // F2 · de dónde entran los círculos
  tamanoMax: 1.15, giroMax: 180,
  strobe: false,                     // N11 · strobe rojo con cada bombo (ojo fotosensibilidad)
  flashDur: 0.045,

  // ---- escenas nuevas ----
  cambio: 'bombo',                   // quién pasa a la forma siguiente: 'bombo' | 'caja' | 'melodia' | 'ninguna'
  golpe: 'bombo',                    // quién hace latir las formas
  formas: 'todas',                   // 'todas' (triángulo, cuadrado, círculo) | 'circulo'
  separacion: 0.25,                  // segundos mínimos entre dos cambios
  tiempo: 0.5,                       // F3 · duración de las transiciones (0 = seco)
  giro: 0.5,                         // F4 · cuánto giran las formas
  latido: 0.5,                       // F5 · cuánto laten
  circulos: 0.5,                     // F6 · círculos del canal 1 por encima de las escenas nuevas
  quieto: false,                     // N12 · congela las formas
  golpeAlCambiar: true,              // un golpe central tapa cada cambio de escena
  derivaLente: 0.015, formaGrilla: 'circulo',

  demo: false,                       // true = notas falsas para probar sin MIDI
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// Mismo nombre que en V.init: los estados usan estos nombres.
// ============================================================
const CONTROLES = {
  tamano:    'F1',
  direccion: 'F2',
  tiempo:    'F3',
  giro:      'F4',
  latido:    'F5',
  circulos:  'F6',
  strobe:    'N11',
  quieto:    'N12',
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Salen del análisis del audio (cambios de sección, 103 BPM), con el tiempo
// en que llegan en el ensayo interpretado. BASE = inicio (círculos chicos).
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (si no se anota: 0.3)
// Las escenas cambian detrás de un golpe central.
// ============================================================
const ESTADOS = [
  /*  1 · 0:05 */ { nombre: 'intro',             tamano: 0.4, release: 2, fluct: 0.4 },
  /*  2 · 0:24 */ { nombre: 'entra el bombo',    tamano: 0.5, strobe: true },
  /*  3 · 0:33 */ { nombre: 'anillos',           escena: 'anidado', formas: 'circulo', tamano: 0.5 },
  /*  4 · 0:42 */ { nombre: 'formas',            escena: 'morfo', cambio: 'caja', tamano: 0.55, circulos: 0.4 },
  /*  5 · 1:04 */ { nombre: 'iris',              escena: 'iris', strobe: true },
  /*  6 · 1:20 */ { nombre: 'corte azul',        escena: 'corte', cambio: 'caja', hue: 200, tamano: 0.5 },
  /*  7 · 1:39 */ { nombre: 'lente',             escena: 'lente', tamano: 0.5, latido: 0.7 },
  /*  8 · 1:51 */ { nombre: 'anidado',           escena: 'anidado', tamano: 0.55, latido: 0.8, strobe: true },
  /*  9 · 2:17 */ { nombre: 'quiebre',           tamano: 0.35, release: 2.5, hue: 200, fluct: 0.5, fundido: 1.5 },   // sin bombo
  /* 10 · 2:26 */ { nombre: 'crece',             escena: 'morfo', formas: 'circulo', cambio: 'caja', tiempo: 0.8, hue: 200, tamano: 0.5, circulos: 0.6 },
  /* 11 · 2:45 */ { nombre: 'iris caja',         escena: 'iris', cambio: 'caja', giro: 0.7 },
  /* 12 · 3:08 */ { nombre: 'pico',              escena: 'anidado', tamano: 0.6, tiempo: 0.35, latido: 0.9, strobe: true, circulos: 0.7 },
  /* 13 · 3:22 */ { nombre: 'final',             tamano: 0.2, release: 2.5, fundido: 6 },
]


// ============================================================
// AKAI — mapa LIVE (una fila por canal)
//   fila 8 → canal 1, melodía: cada nota entra como círculo (en todas las escenas,
//            más o menos visible según F6). Tocás un pad = círculo de esa altura. Mute: 82
//   fila 7 → canal 10, batería (37 bombo · 38 caja). El bombo hace el strobe.
//            A mano: col 1-4 bombo (flash) · col 5-8 caja. Mute: 83
//   fila 6 → disparos a mano, en el color de la canción:
//            col 1 2 3 = entra por la izquierda rápido / medio / lento
//            col 4     = golpe central
//            col 5 6 7 = entra por la derecha lento / medio / rápido
//            col 8     = se escapa arriba o abajo al soltar
//   fila 5 → col 1-4 = golpe de paleta (rojo-naranja, verde, azul, violeta)
//            col 5 = vuelve a círculos · col 6 / 7 = escena anterior / siguiente
//            col 8 = pasa a la forma siguiente
//   F1 tamaño · F2 dirección · F3 tiempo · F4 giro · F5 latido · F6 círculos sobre las escenas
//   N11 strobe · N12 quieto (congela las formas)
//   86 / 87 = estado anterior / siguiente (ensayo o emergencia)
//   88 = calibrar mic (3 s de silencio, ¡sin voz!) · 98 (Shift) = ocultar código y paneles
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12'])
GP.midi.filas({
  8: { canal: 1, rango: [V.C.notaGrave, V.C.notaAguda] },
  7: { canal: 10, pulso: 'vuelta' },
  6: {},     // sólo a mano
  5: {},     // sólo a mano
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
  5: { lado: 1, velocidad: 2 },
  6: { lado: 1, velocidad: 1 },
  7: { lado: 1, velocidad: 0 },
  8: { escape: true, velocidad: 1 },
}
const otraEscena = paso => {
  const E = V.ESCENAS, i = E.indexOf(V.C.escena)
  V.escenaMano(E[(i + paso + E.length) % E.length])
}

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  // melodía: del Korg, o a mano con la altura de la columna
  if (fila === 8) {
    if (origen === 'canal') { if (on) V.notaOn(nota, vel); else V.notaOff(nota) }
    else { const id = 4000 + columna; if (on) V.notaOn(id, vel, { altura: nota }); else V.notaOff(id) }
    if (on) V.voz('melodia')
    return
  }
  // batería: el bombo hace el strobe (a mano siempre flashea) y cuenta como 'bombo'; la caja como 'caja'
  if (fila === 7) {
    if (!on) return
    const caja = origen === 'canal' ? (nota === 38 || nota === 40) : columna >= 4
    if (caja) { V.voz('caja'); return }
    if (origen === 'akai' || V.C.strobe) V.golpe()
    V.voz('bombo')
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
  // golpes de paleta y escenas a mano
  if (fila === 5) {
    if (columna < 4) { if (on) V.golpePaleta(columna); else V.notaOff(2000 + columna); return }
    if (!on) return
    if (columna === 4) V.escenaMano('circulos')
    if (columna === 5) otraEscena(-1)
    if (columna === 6) otraEscena(1)
    if (columna === 7) V.cambioMano()
  }
})

// botones sueltos del Akai
GP.midi.alMensaje((nombre, data) => {
  const [st, nota, vel] = data
  if ((st & 0xf0) !== 0x90 || vel === 0 || !/apc|akai/i.test(nombre)) return
  if (nota === 88) V.calibrarMic()
  if (nota === 98) V.toggleCodigo()
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0)
render(o0)
