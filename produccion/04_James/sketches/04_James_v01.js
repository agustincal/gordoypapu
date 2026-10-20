// ============================================================
// 04_James_v01.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      El motor vive en produccion/04_James/arq/GP_04_James__visual_v01.js (muro de monitores, v1.0)
// Actualizado: 17/10/2026 (v01: muro de monitores con los 13 estados del análisis del audio,
//              y los rangos de notas reales de James)
// ============================================================
//
// Ensayo sin músicos: en el panel de GP_tools cargá
//   midi  → produccion/04_James/ensayo/04_James_ensayo_interpretado_midi.json
//   audio → James_-_MST_V3.mp3
// y antes de dar ▶: GP.estados.reiniciar() en la consola.
// ============================================================
//
// Referencia: muro de monitores de tubo en una sala oscura. Blanco y negro puro.
// En cada monitor: un horizonte blanco y una aguja que cae desde arriba.
// Los monitores se prenden y apagan como interruptores con la música.

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

await cargarGP('LIVE/arq/GP_midi.js')               // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')              // SÓLO ENSAYO: grabador (89), panel, reproductor → en el show, borrá esta línea
await cargarGP('LIVE/arq/GP_estados.js')            // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/04_James/arq/GP_04_James__visual_v01.js')   // motor del muro de monitores (v1.0)

if (GP.tools) { GP.tools.init({ cancion: '04_James' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.james


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Se puede cambiar en vivo: V.C.apagado = 0.4 + Ctrl+Enter
// (dura hasta el próximo estado que anote ese valor)
// ============================================================
V.init({
  // ---- el muro ----
  grilla: 0,              // F2 · 0 = un monitor · 0.25 = 2x2 · 0.5 = 3x3 · 0.75 = 4x4
  escala: 0.4,            // F3 · 1 = el muro ocupa toda la pantalla · más chico = muro en la sala
  formato: 4 / 3,         // forma de cada monitor (4/3 = tubo · 0 = forma de la pantalla)
  muroY: 0.58,            // altura del muro (0.5 = centrado)
  marco: 0.06, curva: 0.06, esquinas: 0.06, vineta: 0.25,
  desfase: 0.4,           // diferencias chicas entre monitores (0 = idénticos)
  vidrio: 0.05,           // gris del negro de un monitor prendido
  carcasa: 0.03,          // carcasa de cada monitor, apenas iluminada
  piso: 0.35,             // luz de los monitores sobre el piso
  tinte: [1, 1, 1],       // blanco puro · más frío: [0.9, 0.95, 1]

  // ---- la señal (igual en todos los monitores) ----
  horizonte: 0.45,        // F1 · alto del bloque blanco (0 = no hay · 1 = todo blanco)
  aguja: 1,               // F4 · largo de la aguja central (1 = llega al horizonte)
  grosor: 0.012,
  persiana: 0,            // F5 · luz de las bandas que bajan con el pulso
  circulo: 0,             // F6 · tamaño del círculo que nace en el horizonte

  // ---- versiones: botón redondo arriba del fader (cada toque pasa a la siguiente) ----
  modoAguja: 0,           // arriba de F4 · 0 = fija · 1 = cae con el pulso · 2 = cae con cada nota del canal 1
  formaPersiana: 0,       // arriba de F5 · 0 = una banda que barre · 1 = persiana · 2 = persiana fina
  formaCirculo: 0,        // arriba de F6 · 0 = disco · 1 = aro · 2 = elipse que gira

  // ---- monitores (canal 1) ----
  reposo: 0,              // F8 · brillo de los monitores sin nota (0 = apagados · 1 = todos prendidos)
  invertirNota: false,    // N14 · la nota pone su monitor en negativo en vez de prenderlo
  rangoMonitores: [31, 37],   // el bajo de James (casi todo 35 y 36: caen en monitores vecinos)
  apagado: 0.12,          // segundos en apagarse al soltar la nota (0 = corte seco)

  // ---- agujas (canal 2) ----
  rangoAgujas: [64, 88],      // la melodía de James
  caidaAguja: 0.12, subeAguja: 0.2,

  // ---- pulso (canal 10) ----
  barridoDur: 0.45,       // segundos que tarda la banda en bajar
  strobe: false,          // N11 · flash blanco con cada pulso (ojo fotosensibilidad: avisar al público)
  alternar: false,        // N12 · cada pulso invierte todo
  invertir: false,        // N13 · todo en negativo

  demo: false,            // true = notas falsas a demoBpm para probar sin MIDI
  demoBpm: 136,
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// Mismo nombre que en V.init: los estados usan estos nombres.
// F7 queda libre (tiene zona muerta por ruido de la controladora).
// ============================================================
const CONTROLES = {
  horizonte:     'F1',
  grilla:        'F2',
  escala:        'F3',
  aguja:         'F4',
  persiana:      'F5',
  circulo:       'F6',
  reposo:        'F8',
  modoAguja:     'V4',
  formaPersiana: 'V5',
  formaCirculo:  'V6',
  strobe:        'N11',
  alternar:      'N12',
  invertir:      'N13',
  invertirNota:  'N14',
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Salen del análisis del audio (cambios de sección), con el tiempo en que
// llegan en el ensayo interpretado. 136 BPM.
// BASE = inicio: un monitor apagado (pantalla negra hasta que arranca el tema).
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (en James, 0 = corte seco)
// ============================================================
const ESTADOS = [
  /*  1 · 0:03 */ { nombre: 'arranca',        apagado: 0.4 },                                   // un monitor: lo prende el bajo
  /*  2 · 0:10 */ { nombre: 'muro',           grilla: 0.3, escala: 0.6, reposo: 0.2, modoAguja: 1 },
  /*  3 · 0:33 */ { nombre: 'persiana',       grilla: 0.3, escala: 0.6, reposo: 1, invertirNota: true, persiana: 1, formaPersiana: 1 },
  /*  4 · 0:47 */ { nombre: 'sol',            grilla: 0.3, escala: 0.6, reposo: 1, horizonte: 0.3, aguja: 0, circulo: 0.5, formaCirculo: 2, alternar: true },
  /*  5 · 1:02 */ { nombre: 'muro 3x3',       grilla: 0.55, escala: 0.8, reposo: 0.15, modoAguja: 2 },
  /*  6 · 1:23 */ { nombre: 'persiana fina',  como: 5, reposo: 0.5, persiana: 0.6, formaPersiana: 2, alternar: true },
  /*  7 · 1:37 */ { nombre: 'muro grande',    grilla: 0.8, escala: 1, modoAguja: 2, persiana: 0.6, formaPersiana: 2 },
  /*  8 · 1:59 */ { nombre: 'respira',        grilla: 0.3, escala: 0.5, reposo: 0.6, horizonte: 0.2, circulo: 0.35, formaCirculo: 1, apagado: 0.6 },   // sin bombo
  /*  9 · 2:18 */ { nombre: 'pico',           grilla: 0.8, escala: 1, invertirNota: true, circulo: 0.7, formaCirculo: 1, modoAguja: 1, strobe: true },  // ojo strobe
  /* 10 · 2:52 */ { nombre: 'quiebre',        escala: 0.5, reposo: 0.5, horizonte: 0.25, apagado: 0.8 },   // un monitor: las agujas de la melodía
  /* 11 · 3:10 */ { nombre: 'quiebre muro',   grilla: 0.3, escala: 0.6, reposo: 0.4, horizonte: 0.25, circulo: 0.3, formaCirculo: 2 },
  /* 12 · 3:24 */ { nombre: 'caja',           grilla: 0.55, escala: 0.8, reposo: 1, persiana: 1, formaPersiana: 1, alternar: true },
  /* 13 · 3:38 */ { nombre: 'final',          escala: 0.3, reposo: 0.25, apagado: 1, fundido: 6 },
]


// ============================================================
// AKAI — mapa LIVE (mismo orden de canales que las otras canciones)
//   fila 8 → canal 1, monitores. Tocás un pad = prende su monitor (grave a la izquierda). Mute: 82
//   fila 7 → canal 10, batería (bombo 36 y caja 38: los dos son pulso). Tocás un pad = un pulso. Mute: 83
//   fila 6 → canal 2, agujas. Tocás un pad = cae una aguja en esa posición. Mute: 84
//   fila 5 → a mano, mientras apretás:
//            col 1 = barrido      col 2 = cae la aguja    col 3 = círculo crece
//            col 4 = negativo     col 5 = blanco total    col 6 = negro total
//            col 7-8 = libres
//   N11 strobe · N12 alternar positivo/negativo · N13 todo en negativo · N14 la nota invierte
//   botones arriba de F4 / F5 / F6 = versión de aguja / persiana / círculo
//   86 / 87 = estado anterior / siguiente (ensayo o emergencia)
//   98 (Shift) = ocultar código y paneles · 89 = grabador · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12', 'N13', 'N14'])
GP.midi.versiones({ F4: 3, F5: 3, F6: 3 })
GP.midi.filas({
  8: { canal: 1,  rango: V.C.rangoMonitores },
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2,  rango: V.C.rangoAgujas },
  5: {},      // sólo a mano
})
const FILA5 = ['barrido', 'aguja', 'circulo', 'invertir', 'blanco', 'negro', null, null]

// los estados van después de V.init, de los botones, versiones y filas
GP.estados.init({
  cancion: '04_James',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
  fundido: 0,         // cambios de estado secos, como interruptores
})

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  // lo que viene del Korg usa la nota; lo tocado a mano, el pad (así no se pisan)
  const clave = origen === 'canal' ? nota : `mano${columna}`
  if (fila === 8) { V.monitor(clave, nota, on); return }
  if (fila === 7) { if (on) V.pulso(); return }
  if (fila === 6) { V.agujaNota(clave, nota, on); return }
  if (fila === 5 && FILA5[columna]) V.mano(FILA5[columna], on)
})

// botones sueltos del Akai
GP.midi.alMensaje((nombre, data) => {
  const [st, nota, vel] = data
  if ((st & 0xf0) !== 0x90 || vel === 0 || !/apc|akai/i.test(nombre)) return
  if (nota === 98) V.toggleCodigo()
})


// ============================================================
// RENDER
// ============================================================
const VOZ_DE_FILA = { 8: 'monitor', 6: 'aguja' }
const muteAntes = {}
update = () => {
  // al mutear una fila, lo que estaba sonando del Korg ya no recibe su note-off:
  // se suelta una vez acá para que no quede prendido
  for (const [fila, voz] of Object.entries(VOZ_DE_FILA)) {
    const muteada = GP.midi.muteado(Number(fila))
    if (muteada && !muteAntes[fila]) V.soltar(voz)
    muteAntes[fila] = muteada
  }
  V.update()
}

V.salida(o0)
render(o0)
