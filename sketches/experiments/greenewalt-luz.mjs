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
// PEDALES (faders):
//   FMASTER → intensidad general (pedal de expresión; en 0 = oscuro)
//   F1 → tiempo de subida del reóstato
//   F2 → tiempo de bajada del reóstato
//   F3 → velocidad de giro
//   F4 → tamaño de las formas
//   F5 → suavidad del borde
//   F6 → estela / disolución (feedback)
//   F7 → deformación
//   F8 → sustain (pasando la mitad, las luces se quedan encendidas)
// ======================================================

await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@647e3a624aceda63aec1dd994d015f86fc222008/architecture/gp/gp-midi-base-AkaiMini-v0.6.js')
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

  const sostenido = F8 >= 0.5
  const kSube = 1 - Math.exp(-dt / (0.02 + F1 * 2.5))
  const kBaja = 1 - Math.exp(-dt / (0.05 + F2 * 6))

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
  return Math.min(1, v) * FMASTER
}

let luces = solid(0, 0, 0, 1)

for (let c = 0; c < 8; c++) {
  luces = luces.add(
    shape(
      FORMAS[c],
      () => (0.08 + c * 0.06) * (0.5 + F4 * 1.5),
      () => 0.001 + F5 * 0.4
    )
    .rotate(() => time * (0.02 + F3 * 0.5) * (c % 2 ? -1 : 1) * (1 + c * 0.2))
    .color(() => lampara(c, 0), () => lampara(c, 1), () => lampara(c, 2))
  )
}

luces
  .modulate(noise(3, 0.1), () => F7 * 0.15)
  .blend(
    src(o0).scale(() => 1.003 + F6 * 0.01),
    () => F6 * 0.94
  )
  .out()
