// G&P — FLUORESCENTE
// por Agustín Calviño
// Gordo y Papu
// VERSIÓN 02 — base MIDI + spin N14

// CONFIGURACIÓN
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@a24a0c13d7e12eb6034e1929a70a4ae4eb44a264/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'fluorescente', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
GP.midi.buttons(['N11','N12','N14'])

// F1–F8 → controles MIDI
// N11 → reactivo vocals
// N12 → reactivo drums
// N14 → giro continuo

// AUDIO REACTIVO
let vocalReact = () => N11 ? vocals.high() : 0
let drumReact = () => N12 ? Math.max(0, drums.mid() - 0.35) : 0

// ROTACIÓN
// ROTACIÓN
let rotation = 0
let spinning = false
let manual = true
let lastTime = 0

GP.midi.on('N14', ({ active }) => {

  if (active) {
    rotation = F4 * 0.03
    spinning = true
    manual = false
    lastTime = time

  } else {
    spinning = false
  }
})

let rot = () => {

  if (spinning) {
    rotation += (time - lastTime) * (0.03 + F4 * 0.1)
    lastTime = time

  } else if (manual) {
    rotation = F4 * 0.03
  }

  return rotation
}

// VISUAL
osc(
  () => 2 + F1 * 0.3,
  () => 0.01 + F2 * 0.01 + drumReact() * 0.03,
  () => F3 * 0.01
)
  // F4 + N14
  .rotate(rot)

  // F5
  .kaleid(() => 1 + Math.floor(F5 * .1))

  // F6
  .scale(() => 0.5 + F6 * 0.2)

  // F7
  .pixelate(
    () => 1 + F7 * 1,
    () => 1 + F7 * 1
  )

  // F8
  .contrast(() => 1 + F8 * 0.66)

  .out()
