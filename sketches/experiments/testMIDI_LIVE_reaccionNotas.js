//
// TEST 2 — seguimiento POR NOTA (cada nota con su color)
//
//   ┌────────────────┬────────────────┐
//   │ ATAQUE         │ SUENAN         │
//   │ color de la    │ mezcla (suma)  │
//   │ última nota    │ de los colores │
//   │ tocada, con    │ de TODAS las   │
//   │ fade out       │ notas sostenidas│
//   ├────────────────┼────────────────┤
//   │ CUADRADO       │ GATE GLOBAL    │
//   │ gira según la  │ blanco: hay    │
//   │ duración de la │ alguna nota    │
//   │ nota MÁS       │ sonando        │
//   │ RECIENTE que   │ (el método     │
//   │ sigue sonando  │ anterior)      │
//   └────────────────┴────────────────┘
//
// Cada nota se lee con su propio gate: _note(n, CH)
// Color = noteToRGB(nota): 12 notas → 12 hues (do, do#, re... todas distintas)
//

await loadScript('https://cdn.jsdelivr.net/npm/hydra-midi@latest/dist/index.js')

await midi.start({ channel: "*", input: "*" })
midi.show()
hush()


// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const CH = 0            // canal de las teclas de la Akai (0 = MIDI canal 1)
const INPUT = '*'       // si no responde, índice que muestra midi.show()
const LO = 21           // rango de notas que se vigila
const HI = 108
const DEBUG = true      // loguea ON / OFF por nota y el formato de playingNotes


// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const msToRate = ms => clamp(250 / Math.max(ms, 1), 0.1, 2)

function noteToRGB(note) {
  let hue = ((note % 12) * 30) / 360
  let i = Math.floor(hue * 6)
  let f = hue * 6 - i
  let q = 1 - f
  let t = f
  switch (i % 6) {
    case 0: return [1, t, 0]
    case 1: return [q, 1, 0]
    case 2: return [0, 1, t]
    case 3: return [0, q, 1]
    case 4: return [t, 0, 1]
    case 5: return [1, 0, q]
  }
}

const NAMES = ['do', 'do#', 're', 're#', 'mi', 'fa', 'fa#', 'sol', 'sol#', 'la', 'la#', 'si']
const noteName = n => NAMES[n % 12] + (Math.floor(n / 12) - 1)


// --------------------------------------------------
// ESTADO
// --------------------------------------------------

const H = {}            // nota → instante del note-on (solo mientras suena)

const S = {
  flash: 0,             // fade del ataque
  fc: [1, 1, 1],        // color del último ataque
  mix: [0, 0, 0],       // suma de colores de las notas sostenidas
  gate: 0,              // gate global (comparación)
  sq: [1, 1, 1],        // color del cuadrado (nota más reciente sostenida)
  lastDur: 250,         // duración de la última nota soltada
  rate: 1,
  phase: 0
}


// --------------------------------------------------
// ENTRADA: ataques (color + fade)
// --------------------------------------------------

midi.input(INPUT).channel('*').onNote('*', ({ note, velocity, channel }) => {
  if (channel != CH) return
  S.fc = noteToRGB(note)
  S.flash = 1

  if (DEBUG) {
    // Para averiguar cómo guarda hydra-midi las notas sonando
    setTimeout(() => {
      try { console.log('playingNotes', JSON.stringify([...midiState.playingNotes])) } catch (e) {}
    }, 30)
  }
})


// --------------------------------------------------
// TIEMPO: gate por nota
// --------------------------------------------------

update = (dt) => {
  const k = dt / 1000
  const now = performance.now()

  const mix = [0, 0, 0]
  let newest = null       // nota sostenida con note-on más reciente

  for (let n = LO; n <= HI; n++) {
    let on = false
    try { on = _note(n, CH) > 0 } catch (e) {}

    if (on && H[n] == null) {                        // note-on
      H[n] = now
      if (DEBUG) console.log('ON ', noteName(n))
    }
    if (!on && H[n] != null) {                       // note-off
      const dur = now - H[n]
      S.lastDur = dur
      if (DEBUG) console.log('OFF', noteName(n), Math.round(dur), 'ms')
      delete H[n]
    }

    if (on) {
      const c = noteToRGB(n)
      mix[0] += c[0]; mix[1] += c[1]; mix[2] += c[2]
      if (newest === null || H[n] > H[newest]) newest = n
    }
  }

  S.mix = [clamp(mix[0]), clamp(mix[1]), clamp(mix[2])]
  S.gate = newest === null ? 0 : 1

  // cuadrado: sigue a la nota sostenida más reciente
  // (si sueltan la segunda, vuelve al ritmo de la primera)
  let target
  if (newest !== null) {
    target = msToRate(now - H[newest])
    const c = noteToRGB(newest)
    for (let i = 0; i < 3; i++) S.sq[i] += (c[i] - S.sq[i]) * clamp(k * 10)
  } else {
    target = msToRate(S.lastDur)
  }
  S.rate += (target - S.rate) * clamp(k * 3)
  S.phase += k * S.rate

  S.flash *= Math.exp(-k / 0.35)
}


// --------------------------------------------------
// VISUAL (4 cuadrantes)
// --------------------------------------------------

solid(() => S.fc[0] * S.flash, () => S.fc[1] * S.flash, () => S.fc[2] * S.flash).out(o0)   // arriba-izq : ataque
solid(() => S.mix[0], () => S.mix[1], () => S.mix[2]).out(o2)                             // arriba-der : suenan
shape(4, 0.5, 0.01)
  .color(() => S.sq[0], () => S.sq[1], () => S.sq[2])
  .rotate(() => S.phase * 2)
  .out(o1)                                                                                // abajo-izq  : cuadrado
solid(() => S.gate, () => S.gate, () => S.gate).out(o3)                                   // abajo-der  : gate global

render()