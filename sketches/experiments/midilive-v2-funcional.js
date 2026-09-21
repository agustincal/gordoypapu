//
// G&P — BUSCANDO PLACER — v2.1 (arquitectura por capas + duración real)
// CH0 → ARPEGIO   CH1 → BAJO   CH9 → BATERÍA
//
// Capas:
//   1) ESTADO   → un objeto S con lo que "sabemos" de cada voz
//   2) ENTRADA  → onNote solo escribe en S (no toca el visual)
//   3) TIEMPO   → update() lee el gate, decae energías, suaviza, acumula fase
//   4) VISUAL   → solo lee S
//
// Dos formas de medir "lento/rápido" (cambiá TIME_MODE y re-evaluá con
// Ctrl+Shift+Enter para compararlas):
//   'ioi'  → tiempo ENTRE ataques (funciona aunque haya legato)
//   'dur'  → duración REAL de la nota (gate de hydra-midi: note-on → note-off)
//   'both' → promedio de las dos
//

await loadScript('https://cdn.jsdelivr.net/npm/hydra-midi@latest/dist/index.js')

await midi.start({ channel: "*", input: "*" })
midi.show()


// --------------------------------------------------
// CONFIG
// --------------------------------------------------

const TIME_MODE = 'both'      // 'ioi' | 'dur' | 'both'
const DEBUG = true            // loguea duración e intervalo de cada nota (consola)


// --------------------------------------------------
// 1) ESTADO
// --------------------------------------------------

const S = {
  arp:  { pitch: 0.5, energy: 0, rate: 1, rateIOI: 1, rateDur: 1,
          phase: 0, last: 0, t0: 0, dur: 250, wasOn: false, ch: 0,
          rgb: [1, 0, 0], target: [1, 0, 0] },
  bass: { pitch: 0.3, energy: 0, rate: 1, rateIOI: 1, rateDur: 1,
          phase: 0, last: 0, t0: 0, dur: 250, wasOn: false, ch: 1 },
  drum: { kick: 0, snare: 0, hat: 0 }
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const vel = v => (v > 1 ? v / 127 : v)      // acepta velocity 0-1 o 0-127

// ms → rate.   125 ms → 2 | 250 ms → 1 | 500 ms → 0.5 | 2000 ms → 0.125
const msToRate = ms => clamp(250 / Math.max(ms, 1), 0.1, 2)


// --------------------------------------------------
// NOTA → COLOR (12 notas = 12 hues)
// --------------------------------------------------

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
// 2) ENTRADA
// --------------------------------------------------

// Ataque de una voz melódica: mide el intervalo entre ataques (ioi).
function attack(voice, name, note, velocity, lo, hi) {
  const now = performance.now()
  const ioi = now - voice.last
  voice.last = now
  if (ioi < 4000) {
    voice.rateIOI = msToRate(ioi)
    if (DEBUG) console.log(name, 'ioi', Math.round(ioi), 'ms')
  }
  voice.pitch = clamp((note - lo) / (hi - lo))
  voice.energy = vel(velocity)
}

// Mapeo explícito de batería (General MIDI) en vez de note % 12
const KICKS  = [35, 36]
const SNARES = [38, 40]
const HATS   = [42, 44, 46]

let live = midi.input(0).channel("*")

live.onNote("*", ({ note, velocity, channel }) => {

  if (channel == 0) {                       // ARPEGIO
    attack(S.arp, 'arp', note, velocity, 36, 96)
    S.arp.target = noteToRGB(note)
  }

  if (channel == 1) {                       // BAJO
    attack(S.bass, 'bass', note, velocity, 24, 60)
  }

  if (channel == 9) {                       // BATERÍA
    const v = vel(velocity)
    if (KICKS.includes(note))  S.drum.kick  = v
    if (SNARES.includes(note)) S.drum.snare = v
    if (HATS.includes(note))   S.drum.hat   = v
  }

})


// --------------------------------------------------
// 3) TIEMPO (corre en cada frame, dt en ms)
// --------------------------------------------------

// Gate de la voz: ¿hay alguna nota sonando en su canal? (flancos = note-on / note-off)
function readGate(voice, name) {
  let on = false
  try { on = _note('*', voice.ch) > 0 } catch (e) { return }

  const now = performance.now()
  if (on && !voice.wasOn) voice.t0 = now                       // note-on
  if (!on && voice.wasOn) {                                    // note-off
    voice.dur = now - voice.t0
    if (DEBUG) console.log(name, 'dur', Math.round(voice.dur), 'ms')
  }
  voice.wasOn = on

  // Mientras la nota se sostiene, el tiempo "held" ya cuenta:
  // una redonda va frenando el movimiento antes de soltarse.
  const held = on ? now - voice.t0 : 0
  voice.rateDur = msToRate(Math.max(voice.dur, held))
}

update = (dt) => {
  const k = dt / 1000

  readGate(S.arp, 'arp')
  readGate(S.bass, 'bass')

  for (const v of [S.arp, S.bass]) {
    const target =
      TIME_MODE === 'ioi' ? v.rateIOI :
      TIME_MODE === 'dur' ? v.rateDur :
      (v.rateIOI + v.rateDur) / 2

    v.rate += (target - v.rate) * clamp(k * 3)         // suaviza cambios de ritmo
    v.phase += k * v.rate                              // fase acumulada: sin saltos
    v.energy *= Math.exp(-k / 0.35)                    // decae ~350 ms
  }

  S.drum.kick  *= Math.exp(-k / 0.25)
  S.drum.snare *= Math.exp(-k / 0.20)
  S.drum.hat   *= Math.exp(-k / 0.10)

  for (let i = 0; i < 3; i++) {                        // color con glissando
    S.arp.rgb[i] += (S.arp.target[i] - S.arp.rgb[i]) * clamp(k * 8)
  }
}


// --------------------------------------------------
// 4) VISUAL (solo lee S)
// sync = 0 en los osc: el movimiento viene de la fase acumulada
// --------------------------------------------------

osc(() => 3 + S.arp.pitch * 30, 0, 0)
  .scrollX(() => S.arp.phase * 0.2)
  .color(() => S.arp.rgb[0], () => S.arp.rgb[1], () => S.arp.rgb[2])

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
