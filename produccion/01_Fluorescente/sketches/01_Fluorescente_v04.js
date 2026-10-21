// ============================================================
// 01_Fluorescente_v04.js  ·  produccion/01_Fluorescente/sketches/  (COPIA DE TRABAJO)
// Canción: 01_Fluorescente (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      El motor de trabajo vive en produccion/01_Fluorescente/arq/GP_01_Fluorescente__visual.js
//      (midi, tools y estados siguen cargando de LIVE/arq). La versión que anda: LIVE/sketches/01_Fluorescente_v01.js
// Actualizado: 21/10/2026 (v04: copia de trabajo de LIVE v01 · motor v2.1: en silencio el movimiento frena ·
//              F1 pixelado de doble sentido (base 0.5) + V1 = textura / todo / tiras ·
//              V2 = kaleid textura / mandala / gira · V3 = colorama fijo / altura del bajo / viaja con el bajo ·
//              V4 = deformación ondas / ola / líquido)
//              16/10/2026 (v01: primera versión LIVE, con estados.
//              Parte de produccion/01_Fluorescente_v03 — mismo look)
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

await cargarGP('LIVE/arq/GP_midi.js')                     // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')                    // SÓLO ENSAYO: grabador (89), panel, reproductor → en el show, borrá esta línea
await cargarGP('LIVE/arq/GP_estados.js')                  // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/01_Fluorescente/arq/GP_01_Fluorescente__visual.js')  // motor de Fluorescente (COPIA DE TRABAJO)

if (GP.tools) { GP.tools.init({ cancion: '01_Fluorescente' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.fluorescente


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Faders de 0 a 1: en 0 el visual es igual al original (sin fader).
// Se puede cambiar en vivo: V.C.delayMs = 400 + Ctrl+Enter
// ============================================================
V.init({
  // voces: rango de alturas que va de grave (0) a agudo (1).
  // Sacados del ensayo del 15/10: el canal 1 tocó entre 25 y 35.
  rangoArpegio: [25, 36],
  rangoBajo: [24, 60],

  // batería: qué notas son cada pieza. En el ensayo, el canal 10 sólo mandó la 37 (pulso)
  bateria: { bombo: [35, 36, 37], caja: [38, 40, 49], hat: [42, 44, 46] },

  // decaimientos (segundos)
  // silencio: sin notas durante `silencio` s, el movimiento frena en `caidaRitmo` s
  silencio: 0.6, caidaRitmo: 1.5,

  caidaEnergia: 0.35, caidaBombo: 0.25, caidaCaja: 0.2, caidaHat: 0.1,

  // faders
  pixelado: 0.5,     // F1 doble sentido: 0 = bloques enormes · 0.5 = como antes · 1 = pixel muy fino
  verPixelado: 0,    // V1 (botón arriba de F1): 0 = textura · 1 = todo · 2 = tiras
  kaleid: 0,         // F2: simetría extra
  verKaleid: 0,      // V2 (botón arriba de F2): 0 = textura · 1 = mandala · 2 = gira
  colorama: 0,       // F3: corrimiento de color (fuerte: subir con cuidado)
  verColorama: 0,    // V3 (botón arriba de F3): 0 = fijo · 1 = altura del bajo · 2 = viaja con el bajo
  deformacion: 0,    // F4: deformación del bajo (0 = recto)
  verDeformacion: 0, // V4 (botón arriba de F4): 0 = ondas · 1 = ola · 2 = líquido
  empujonBajo: 0.4,  // cuánto suma cada nota del bajo (si es demasiado, bajalo: 0 = sólo F4)
  flash: 0,          // F5: cuánto flashea cada golpe de caja
  pulso: 0,          // F6: cuánto pulsa cada golpe de bombo
  velocidad: 0,      // F7: velocidad del scroll de la capa principal
  contraste: 0,      // F8: realce general (antes estaba en FMASTER)

  // toggles
  rotar90: false,    // N11: toda la pantalla rotada 90°
  rotarMitad: false, // N12: la mitad derecha rotada 90° extra
  delayMitad: false, // N13: la mitad derecha atrasada
  delayMs: 200,      // cuánto atraso tiene la mitad derecha

  demo: false,       // true = notas falsas para probar sin MIDI
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// Mismo nombre que en V.init: los estados usan estos nombres.
// ============================================================
const CONTROLES = {
  pixelado:    'F1',
  verPixelado: 'V1',
  kaleid:      'F2',
  verKaleid:   'V2',
  colorama:    'F3',
  verColorama: 'V3',
  deformacion: 'F4',
  verDeformacion: 'V4',
  flash:       'F5',
  pulso:       'F6',
  velocidad:   'F7',
  contraste:   'F8',
  rotar90:     'N11',
  rotarMitad:  'N12',
  delayMitad:  'N13',
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (si no se anota: 0.3)
// ⚠ EJEMPLO para probar el sistema: hay que curarlos con la canción.
// ============================================================
const ESTADOS = [
  /* 1 */ { nombre: 'intro',              pulso: 0.3 },
  /* 2 */ { nombre: 'entra la batería',   pulso: 0.6, flash: 0.4, velocidad: 0.3 },
  /* 3 */ { nombre: 'partido',            pulso: 0.6, delayMitad: true, kaleid: 0.3 },
  /* 4 */ { nombre: 'giro',               rotarMitad: true, deformacion: 0.4, colorama: 0.2 },
  /* 5 */ { nombre: 'final',              como: 3, contraste: 0.5, fundido: 1 },
]


// ============================================================
// AKAI — mapa LIVE (mismo orden de canales que Vociferan)
//   fila 8 → canal 1, arpegio. Tocás un pad = nota de esa altura (grave a la izquierda),
//            sostenela para frenar el movimiento. Mute: botón 82
//   fila 7 → canal 10, batería. A mano: col 1-3 bombo · col 4-6 caja · col 7-8 hat. Mute: botón 83
//   fila 6 → canal 2, bajo (en el ensayo no llegó: se puede tocar a mano). Mute: botón 84
//   fila 5 → libre
//   Mutear una fila congela esa voz: deja de recibir notas pero no se apaga de golpe.
//   N11 / N12 / N13 = rotar todo 90° / rotar la mitad derecha / atrasar la mitad derecha
//   V1 (botón redondo arriba de F1) = pixelado: textura (apagado) / todo (prendido) / tiras (parpadea)
//   F1 doble sentido: al medio = como antes · abajo = bloques enormes · arriba = pixel fino
//   V2 (arriba de F2) = kaleid: textura (apagado) / mandala (prendido) / gira (parpadea)
//   V3 (arriba de F3) = colorama: fijo (apagado) / altura del bajo (prendido) / viaja con el bajo (parpadea)
//   V4 (arriba de F4) = deformación: ondas (apagado) / ola negro-blanco-negro que corre (prendido) / líquido quieto (parpadea)
//   86 / 87 = estado anterior / siguiente (ensayo o emergencia)
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12', 'N13'])
GP.midi.versiones({ F1: 3, F2: 3, F3: 3, F4: 3 })   // V1 pixelado: textura / todo / tiras · V2 kaleid: textura / mandala / gira · V3 colorama: fijo / altura / viaja · V4 deformación: ondas / ola / líquido
GP.midi.filas({
  8: { canal: 1, rango: V.C.rangoArpegio },
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2, rango: V.C.rangoBajo },
  5: null,
})
const VOZ_DE_FILA = { 8: 'arpegio', 6: 'bajo' }
const PIEZA_DE_COLUMNA = ['bombo', 'bombo', 'bombo', 'caja', 'caja', 'caja', 'hat', 'hat']

// los estados van después de V.init, de los botones y de las filas
GP.estados.init({
  cancion: '01_Fluorescente',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
})

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  if (VOZ_DE_FILA[fila]) { V.nota(VOZ_DE_FILA[fila], nota, vel, on); return }
  if (fila === 7) {
    if (origen === 'canal') V.nota('bateria', nota, vel, on)
    else if (on) V.golpe(PIEZA_DE_COLUMNA[columna], vel / 127)
  }
})


// ============================================================
// RENDER
// ============================================================
const muteAntes = {}
update = (dt) => {
  // al mutear una fila, lo que estaba sonando del Korg ya no recibe su note-off:
  // se suelta una vez acá para que no quede "sostenido" (lo que toques a mano después sigue normal)
  for (const [fila, voz] of Object.entries(VOZ_DE_FILA)) {
    const muteada = GP.midi.muteado(Number(fila))
    if (muteada && !muteAntes[fila]) V.soltar(voz)
    muteAntes[fila] = muteada
  }
  V.update(dt)
}

V.salida(o0)
render(o0)
