// ======================================================
// LUZ RÍTMICA — teclado de luz al estilo de Mary Hallock-Greenewalt
// Base: GP.midi AkaiMini v0.6 (APC Mini / Hydra)
//
// TECLADO (pads N11..N88):
//   fila (1..8)    → color (paleta, de abajo hacia arriba)
//   columna (1..8) → lámpara / forma (de la más chica a la más grande)
//   Cada pad da luz mientras está apretado.
//   Varios pads de la misma columna mezclan sus colores.
//
// PEDALES (faders): ver la tabla CALIBRACION más abajo.
// Para reafinar cualquier fader, tocás solo esa tabla — el resto
// del sketch no cambia.
// ======================================================

// TODO: una vez que subas gp-midi-base-AkaiMini-v0.7.js al repo,
// reemplazá @main por el hash del commit (como hacías con v0.6),
// para que este sketch quede fijo a esa versión.
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-base-AkaiMini-v0.7.js')
await GP.midi.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8','FMASTER'])


// --------------------------------------------------
// PALETA Y FORMAS (editables)
// --------------------------------------------------

// una fila = un color [R, G, B]
const PALETA = [
  [1, 0,  0 ],   // fila 1
  [1, .45,0 ],   // fila 2
  [1, .9, 0 ],   // fila 3
  [0, 1,  .2],   // fila 4
  [0, .9, .9],   // fila 5
  [0, .3, 1 ],   // fila 6
  [.5,0,  1 ],   // fila 7
  [1, 0,  .6]    // fila 8
]

// lados de la forma de cada columna (99 ≈ círculo)
const FORMAS = [3, 4, 5, 6, 8, 12, 32, 99]


// --------------------------------------------------
// CALIBRACIÓN DE FADERS
//
// Cada entrada describe UN uso de un fader dentro del sketch
// (un mismo fader físico puede tener más de una entrada, como
// F6_escala y F6_mezcla, cada una con su propio ajuste).
//
//   raw    → nombre del fader físico (F1..F8, FMASTER)
//   borde  → hasta qué posición del fader (0..1) llega el efecto
//            completo. 1 = usa todo el recorrido, sin comprimir.
//            0.15 = a partir del 15% del fader ya está al máximo.
//   curva  → opcional. 1 = lineal. <1 = responde rápido apenas
//            lo movés y después se aplana. >1 = arranca lento y
//            se acelera cerca del máximo.
//   min/max → valor de salida real que usa el sketch, en los
//            extremos del fader (en 0 da min, al llegar a "borde" da max).
// --------------------------------------------------

const CALIBRACION = {
  // tiempo de subida del reóstato (ya andaba bien, sin comprimir)
  F1:        { raw: 'F1', borde: 1,    curva: 1, min: 0.02,  max: 2.52 },

  // tiempo de bajada del reóstato
  F2:        { raw: 'F2', borde: 0.15, curva: 1, min: 0.05,  max: 6.05 },

  // velocidad de giro
  F3:        { raw: 'F3', borde: 0.3,  curva: 1, min: 0.02,  max: 0.52 },

  // tamaño de las formas
  F4:        { raw: 'F4', borde: 0.1,  curva: 1, min: 0.5,   max: 2.0  },

  // suavidad del borde
  F5:        { raw: 'F5', borde: 0.1,  curva: 1, min: 0.001, max: 0.401 },

  // estela: cuánto crece el feedback por frame
  F6_escala: { raw: 'F6', borde: 0.2,  curva: 1, min: 1.003, max: 1.013 },
  // estela: cuánto pesa el feedback contra la imagen nueva
  F6_mezcla: { raw: 'F6', borde: 0.2,  curva: 1, min: 0,     max: 0.94  },

  // deformación (todavía sin diferencia perceptible — pendiente)
  F7:        { raw: 'F7', borde: 1,    curva: 1, min: 0,     max: 0.15 },

  // intensidad general — nunca llega a 0 ni se satura del todo
  FMASTER:   { raw: 'FMASTER', borde: 1, curva: 1, min: 0.1, max: 0.8 }
}

// F8 no pasa por la tabla de arriba porque es un interruptor
// (sustain on/off), no un valor continuo — pero el umbral también
// se puede reafinar acá.
const UMBRAL_SUSTAIN = 0.5

function fader(nombre) {
  const c = CALIBRACION[nombre]
  const crudo = window[c.raw] ?? 0
  let t = c.borde ? Math.min(1, crudo / c.borde) : crudo
  if (c.curva && c.curva !== 1) t = Math.pow(t, c.curva)
  return c.min + t * (c.max - c.min)
}


// --------------------------------------------------
// ESTADO: 64 pads, índice = nota MIDI (N11 = 0 ... N88 = 63)
// --------------------------------------------------

const apretada = Array(64).fill(0)   // velocidad si el pad está apretado
const objetivo = Array(64).fill(0)   // lo que se pide
const nivel    = Array(64).fill(0)   // lo que realmente se ve (reóstato)
let ultimo = 0


// --------------------------------------------------
// REÓSTATO: cada pad sube y baja con inercia, sin saltos
// --------------------------------------------------

update = () => {
  const dt = Math.min(time - ultimo, 0.1)
  ultimo = time

  const sostenido = F8 >= UMBRAL_SUSTAIN
  const kSube = 1 - Math.exp(-dt / fader('F1'))
  const kBaja = 1 - Math.exp(-dt / fader('F2'))

  for (let n = 0; n < 64; n++) {
    if (apretada[n] > 0) objetivo[n] = apretada[n]
    else if (!sostenido) objetivo[n] = 0
    nivel[n] += (objetivo[n] - nivel[n]) * (objetivo[n] > nivel[n] ? kSube : kBaja)
  }
}


// --------------------------------------------------
// MIDI: pads con nota on / off (mantenidos, no toggle)
// --------------------------------------------------

function luz(nota, color) {
  const salida = GP.midi.state.output
  if (salida) salida.send([0x90, nota, color])
}

if (window._luzMidi) window._luzMidi.forEach(([e, h]) => e.removeEventListener('midimessage', h))
window._luzMidi = []

const acceso = GP.midi.state.access
if (acceso) {
  acceso.inputs.forEach(entrada => {
    const manejador = ({ data: [estado, nota, vel] }) => {
      const cmd = estado & 0xf0
      if (nota > 63) return
      if (cmd === 0x90 && vel > 0) {
        apretada[nota] = vel / 127
        luz(nota, 5)
      } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
        apretada[nota] = 0
        luz(nota, 0)
      }
    }
    entrada.addEventListener('midimessage', manejador)
    if (entrada.open) entrada.open()
    window._luzMidi.push([entrada, manejador])
  })
}


// --------------------------------------------------
// VISUAL: 8 lámparas (una por columna), color = mezcla de sus filas
// --------------------------------------------------

function lampara(c, canal) {
  let v = 0
  for (let f = 0; f < 8; f++) v += PALETA[f][canal] * nivel[f * 8 + c]
  return Math.min(1, v) * fader('FMASTER')
}

let luces = solid(0, 0, 0, 1)

for (let c = 0; c < 8; c++) {
  luces = luces.add(
    shape(
      FORMAS[c],
      () => (0.08 + c * 0.06) * fader('F4'),
      () => fader('F5')
    )
    .rotate(() => time * fader('F3') * (c % 2 ? -1 : 1) * (1 + c * 0.2))
    .color(() => lampara(c, 0), () => lampara(c, 1), () => lampara(c, 2))
  )
}

luces
  .modulate(noise(3, 0.1), () => fader('F7'))
  .blend(
    src(o0).scale(() => fader('F6_escala')),
    () => fader('F6_mezcla')
  )
  .out()
