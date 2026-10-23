// ============================================================
// 01_Fluorescente_v05.js  ·  produccion/01_Fluorescente/sketches/  (COPIA DE TRABAJO)
// Canción: 01_Fluorescente (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      Motor: produccion/01_Fluorescente/arq/GP_01_Fluorescente__visual.js (v2.17)
//      (midi, tools y estados cargan de LIVE/arq)
// Actualizado: 22/10/2026 (v05: une la v03 de producción con las mejoras de LIVE.
//              De la v03 se conserva tal cual: cómo influyen las notas (movimiento parejo, sin freno en
//              silencio, arpegio repartido entre 36 y 96, bombo sólo 35/36) y los pads de la fila 1
//              (N11 rotar 90 · N12/N13/N14 voces arpegio/bajo/batería · N15 rotar mitad · N16 atraso).
//              De LIVE: versiones V1–V8, F1 doble sentido, F5/F6 strobo e inversos, F7 cómo avanza,
//              F8 hacia dónde, bandas N21/N31, atrasos largos N26/N36, borde duro, estados y tools.
//              Las v03 y v04 quedan como estaban.)
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
await cargarGP('produccion/01_Fluorescente/arq/GP_01_Fluorescente__visual.js')  // motor de Fluorescente v2.17 (COPIA DE TRABAJO)

if (GP.tools) { GP.tools.init({ cancion: '01_Fluorescente' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.fluorescente


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Faders de 0 a 1: en 0 el visual es igual al original (sin fader).
// Se puede cambiar en vivo: V.C.delayMs = 400 + Ctrl+Enter
// ============================================================
V.init({
  // ---- cómo influyen las notas: igual que la v03 ----
  // voces: rango de alturas que va de grave (0) a agudo (1). Como la v03: 36–96
  // (las notas del ensayo, 25–35, quedan abajo: pocas franjas, estables)
  rangoArpegio: [36, 96],
  rangoBajo: [24, 60],
  // batería: como la v03 (la 37 del ensayo no pulsa)
  bateria: { bombo: [35, 36], caja: [38, 40], hat: [42, 44, 46] },
  ritmoPorDuracion: false,  // movimiento parejo: no depende de la duración de las notas
  frenoSilencio: false,     // no frena en silencio
  // voces activas (N12 / N13 / N14): apagada = esa voz no recibe notas
  vozArpegio: true,
  vozBajo: true,
  vozBateria: true,

  // decaimientos (segundos)

  caidaEnergia: 0.35, caidaBombo: 0.25, caidaCaja: 0.2, caidaHat: 0.1,

  // faders
  pixelado: 0.5,     // F1 doble sentido: 0 = bloques enormes · 0.5 = como antes · 1 = pixel muy fino
  verPixelado: 0,    // V1 (botón arriba de F1): 0 = textura · 1 = todo · 2 = tiras
  kaleid: 0,         // F2: simetría extra
  verKaleid: 0,      // V2 (botón arriba de F2): 0 = textura · 1 = mandala · 2 = gira
  colorama: 0,       // F3: corrimiento de color (fuerte: subir con cuidado)
  verColorama: 0,    // V3 (botón arriba de F3): 0 = fijo · 1 = altura del bajo · 2 = viaja con el bajo
  deformacion: 0,    // F4: deformación del bajo (0 = recto)
  verDeformacion: 0, // V4 (botón arriba de F4): 0 = ola · 1 = ondas · 2 = líquido
  empujonBajo: 0.4,  // cuánto suma cada nota del bajo (si es demasiado, bajalo: 0 = sólo F4)
  flash: 0,          // F5: cuánto flashea cada golpe de caja
  verFlash: 0,       // V5 (botón arriba de F5): 0 = flash · 1 = strobo · 2 = golpe a negro
  pulso: 0,          // F6: cuánto pulsa cada golpe de bombo
  verPulso: 0,       // V6 (botón arriba de F6): 0 = agranda · 1 = strobo · 2 = achica
  stroboGolpes: 4,   // strobo: destellos por golpe
  stroboMs: 60,      // strobo: ms de cada destello + pausa
  velocidad: 0,      // F7: cómo avanzan las franjas (el fader es la velocidad)
  verVelocidad: 0,   // V7 (botón arriba de F7): 0 = continuo · 1 = a saltos · 2 = empuje del bombo
  direccion: 0,      // F8: hacia dónde (en 0 no cambia nada)
  verDireccion: 0,   // V8 (botón arriba de F8): 0 = ida y vuelta · 1 = choque en el centro · 2 = vertical
  reaccionRitmo: 0.1, // s: qué tan rápido el movimiento sigue al ritmo de las notas (más alto = más suave)
  pasoSalto: 0.025,   // F7 V2: s de cada paso (más alto = más suave)
  caidaEmpuje: 0.15,  // F7 V3: s de caída del acelerón del bombo

  // toggles
  rotar90: false,    // N11: toda la pantalla rotada 90°
  rotarMitad: false, // N15: la mitad derecha rotada 90° extra
  delayMitad: false,  // N16: la mitad derecha atrasada
  delayMs: 200,       // cuánto atraso con N16
  delayMitad2: false, // N26: más atraso
  delayMs2: 500,
  delayMitad3: false, // N36: mucho atraso (si hay varios prendidos, manda el más largo)
  delayMs3: 1000,
  bandas: false,        // N21: bandas horizontales que se desalinean; al apagar convergen
  bandasRespira: false, // N31: bandas que se separan y se alinean solas (cíclico)
  desalineo: 0.4,       // cuánto se corre cada banda
  derivaBandas: 0.05,   // N21: cuánto siguen separándose con la fase del arpegio
  fundidoBandas: 0.6,   // segundos para separarse / alinearse
  respiraVel: 0.5,      // N31: más alto = se alinean más seguido

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
  verFlash:    'V5',
  pulso:       'F6',
  verPulso:    'V6',
  velocidad:   'F7',
  verVelocidad: 'V7',
  direccion:   'F8',
  verDireccion: 'V8',
  rotar90:       'N11',
  vozArpegio:    'N12',
  vozBajo:       'N13',
  vozBateria:    'N14',
  rotarMitad:    'N15',
  delayMitad:    'N16',
  bandas:        'N21',
  delayMitad2:   'N26',
  bandasRespira: 'N31',
  delayMitad3:   'N36',
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
  /* 5 */ { nombre: 'final',              como: 3, fundido: 1 },
]


// ============================================================
// AKAI — mapa LIVE (mismo orden de canales que Vociferan)
//   fila 8 → canal 1, arpegio. Tocás un pad = una nota de arpegio (grave a la izquierda). Mute: botón 82
//   fila 7 → canal 10, batería. A mano: col 1-3 bombo · col 4-6 caja · col 7-8 hat. Mute: botón 83
//   fila 6 → canal 2, bajo (en el ensayo no llegó: se puede tocar a mano). Mute: botón 84
//   fila 5 → libre
//   Mutear una fila congela esa voz: deja de recibir notas pero no se apaga de golpe.
//   Fila 1 (como la v03):
//     N11 = rotar todo 90° · N12 / N13 / N14 = voz arpegio / bajo / batería (prendido = recibe notas;
//     apagado = esa voz no recibe) · N15 = rotar la mitad derecha · N16 = atrasar la mitad derecha (200 ms)
//   Debajo de su pariente:
//     N21 / N31 (bajo N11) = bandas que se desalinean (al apagar se alinean) / bandas que respiran
//     N26 / N36 (bajo N16) = atrasar la mitad derecha más: 500 ms / 1 s (si hay varios, manda el más largo)
//   V1 (botón redondo arriba de F1) = pixelado: textura (apagado) / todo (prendido) / tiras (parpadea)
//   F1 doble sentido: al medio = como antes · abajo = bloques enormes · arriba = pixel fino
//   V2 (arriba de F2) = kaleid: textura (apagado) / mandala (prendido) / gira (parpadea)
//   V3 (arriba de F3) = colorama: fijo (apagado) / altura del bajo (prendido) / viaja con el bajo (parpadea)
//   V4 (arriba de F4) = deformación: ola negro-blanco-negro que corre (apagado) / ondas (prendido) / líquido quieto (parpadea)
//   V5 (arriba de F5) = flash de caja: flash (apagado) / strobo (prendido) / golpe a negro (parpadea)
//   V6 (arriba de F6) = pulso de bombo: agranda (apagado) / strobo (prendido) / achica (parpadea)
//   F7 = cómo avanzan las franjas · V7: continuo (apagado) / a saltos con el arpegio (prendido) / empuje del bombo (parpadea)
//   F8 = hacia dónde (0 = nada) · V8: ida y vuelta con el bajo (apagado) / choque en el centro (prendido) / vertical (parpadea)
//   87 / 88 = estado anterior / siguiente (ensayo o emergencia)
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N21', 'N26', 'N31', 'N36'])
GP.midi.versiones({ F1: 3, F2: 3, F3: 3, F4: 3, F5: 3, F6: 3, F7: 3, F8: 3 })   // V1 pixelado: textura / todo / tiras · V2 kaleid: textura / mandala / gira · V3 colorama: fijo / altura / viaja · V4 deformación: ola / ondas / líquido
//   V5 flash: flash / strobo / a negro · V6 pulso: agranda / strobo / achica
//   V7 avance: continuo / a saltos / bombo · V8 dirección: ida y vuelta / choque / vertical
GP.midi.filas({
  8: { canal: 1, rango: [25, 36] },   // pads: las notas del ensayo (25–35) repartidas en la fila
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

// voces activas (N12 / N13 / N14): como la v03, una voz apagada no recibe notas
const VOZ_ACTIVA = { 8: 'vozArpegio', 6: 'vozBajo', 7: 'vozBateria' }

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  if (VOZ_ACTIVA[fila] && !V.C[VOZ_ACTIVA[fila]] && on) return
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
    const muteada = GP.midi.muteado(Number(fila)) || !V.C[VOZ_ACTIVA[fila]]   // fila muteada o voz apagada (N12/N13)
    if (muteada && !muteAntes[fila]) V.soltar(voz)
    muteAntes[fila] = muteada
  }
  V.update(dt)
}

V.salida(o0)
render(o0)
