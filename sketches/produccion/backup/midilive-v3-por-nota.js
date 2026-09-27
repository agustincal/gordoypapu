//
// G&P — BUSCANDO PLACER — v3 (duración por nota)
// CH0 → ARPEGIO   CH1 → BAJO   CH9 → BATERÍA
//
// Capas:
//   1) ESTADO   → una "voz" por canal melódico + estado de batería
//   2) ENTRADA  → onNote: ataque (color, altura, energía, batería)
//   3) TIEMPO   → update(): gate POR NOTA (_note(n, ch)) → duración real,
//                 suavizado, fase acumulada, decaimientos
//   4) VISUAL   → solo lee el estado
//
// Movimiento: sigue a la nota sostenida MÁS RECIENTE de cada voz.
//   - mientras se sostiene, su tiempo "held" va frenando el movimiento
//   - si sueltan esa nota y queda otra sonando, vuelve al ritmo de la otra
//   - si no queda ninguna, usa la duración de la última nota soltada
//
// Rate: 125 ms → 2 | 250 ms → 1 | 500 ms → 0.5 | 2000 ms → 0.125
//

await loadScript('https://cdn.jsdelivr.net/npm/hydra-midi@latest/dist/index.js')

await midi.start({ channel: "*", input: "*" })
midi.show()


// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const INPUT = '*'       // si no responde, índice que muestra midi.show()
const DEBUG = false     // true: loguea la duración de cada nota soltada


// --------------------------------------------------
// UTILIDADES
// --------------------------------------------------

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const vel = v => (v > 1 ? v / 127 : v)      // acepta velocity 0-1 o 0-127
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


// --------------------------------------------------
// 1) ESTADO
// --------------------------------------------------

// Una voz = un canal melódico. H guarda el note-on de cada nota que suena.
function makeVoice(name, ch, pitchLo, pitchHi) {
  return {
    name, ch, pitchLo, pitchHi,
    H: {},              // nota → instante del note-on (solo mientras suena)
    newest: null,       // nota sostenida más reciente
    lastDur: 250,       // duración de la última nota soltada (ms)
    pitch: 0.5,         // 0-1, altura del último ataque
    energy: 0,          // 0-1, decae
    rate: 1,            // suavizado
    phase: 0            // fase acumulada
  }
}

const S = {
  arp:  makeVoice('arp', 0, 36, 96),
  bass: makeVoice('bass', 1, 24, 60),
  drum: { kick: 0, snare: 0, hat: 0 },
  arpRGB: [1, 0, 0],
  arpTarget: [1, 0, 0]
}


// --------------------------------------------------
// 2) ENTRADA (ataques)
// --------------------------------------------------

// Mapeo explícito de batería (General MIDI)
const KICKS  = [35, 36]
const SNARES = [38, 40]
const HATS   = [42, 44, 46]

midi.input(INPUT).channel('*').onNote('*', ({ note, velocity, channel }) => {

  if (channel == 0) {                       // ARPEGIO
    S.arp.pitch = clamp((note - S.arp.pitchLo) / (S.arp.pitchHi - S.arp.pitchLo))
    S.arp.energy = vel(velocity)
    S.arpTarget = noteToRGB(note)
  }

  if (channel == 1) {                       // BAJO
    S.bass.pitch = clamp((note - S.bass.pitchLo) / (S.bass.pitchHi - S.bass.pitchLo))
    S.bass.energy = vel(velocity)
  }

  if (channel == 9) {                       // BATERÍA
    const v = vel(velocity)
    if (KICKS.includes(note))  S.drum.kick  = v
    if (SNARES.includes(note)) S.drum.snare = v
    if (HATS.includes(note))   S.drum.hat   = v
  }

})


// --------------------------------------------------
// 3) TIEMPO
// --------------------------------------------------

// Lee el gate de cada nota del canal: detecta note-on / note-off por nota.
function pollVoice(v, now) {
  let newest = null
  for (let n = 0; n <= 127; n++) {
    let on = false
    try { on = _note(n, v.ch) > 0 } catch (e) {}

    if (on && v.H[n] == null) v.H[n] = now                    // note-on
    if (!on && v.H[n] != null) {                              // note-off
      v.lastDur = now - v.H[n]
      if (DEBUG) console.log(v.name, 'nota', n, Math.round(v.lastDur), 'ms')
      delete v.H[n]
    }
    if (on && (newest === null || v.H[n] > v.H[newest])) newest = n
  }
  v.newest = newest
}

function stepVoice(v, k, now) {
  const ms = v.newest !== null ? now - v.H[v.newest] : v.lastDur
  v.rate += (msToRate(ms) - v.rate) * clamp(k * 3)            // suaviza el ritmo
  v.phase += k * v.rate                                       // fase acumulada: sin saltos
  v.energy *= Math.exp(-k / 0.35)                             // decae ~350 ms
}

update = (dt) => {
  const k = dt / 1000
  const now = performance.now()

  pollVoice(S.arp, now)
  pollVoice(S.bass, now)
  stepVoice(S.arp, k, now)
  stepVoice(S.bass, k, now)

  S.drum.kick  *= Math.exp(-k / 0.25)
  S.drum.snare *= Math.exp(-k / 0.20)
  S.drum.hat   *= Math.exp(-k / 0.10)

  for (let i = 0; i < 3; i++) {                               // color con glissando
    S.arpRGB[i] += (S.arpTarget[i] - S.arpRGB[i]) * clamp(k * 8)
  }
}


// --------------------------------------------------
// 4) VISUAL (solo lee el estado)
// sync = 0 en los osc: el movimiento viene de la fase acumulada
// --------------------------------------------------

osc(() => 3 + S.arp.pitch * 30, 0, 0)
  .scrollX(() => S.arp.phase * 0.2)
  .color(() => S.arpRGB[0], () => S.arpRGB[1], () => S.arpRGB[2])

  .diff(
    osc(() => 20 + S.arp.pitch * 40, 0, 0)
      .scrollX(() => -S.arp.phase * 0.1)
      .pixelate(() => 8 + S.arp.energy * 16 + S.drum.hat * 20)
      .kaleid(2)
  )

  .colorama(0.005)
  .luma()

  .modulate(
    osc(() => 2 + S.bass.pitch * 6, 0, 0)
      .scrollY(() => S.bass.phase * 0.1),
    () => 0.05 + S.bass.energy * 0.4
  )

  .brightness(() => S.drum.snare * 0.3)
  .scale(() => 1.5 + S.drum.kick * 0.3)
  .out()
