// G&P — SIGNAL BLOCKS
// by Agustín Calviño
// Gordo y Papu
// VERSION 01 — audio + controls
//
// SETUP
// await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@f7d5a93fab386560b1d82381276252af0066c279/architecture/gp/gp-base-v0.4.js')
// await GP.init({song:'vociferan', midi:true})
// await GP.audio.start()
// GP.midi.faders(['F1','F2'])
// GP.midi.buttons(['N11','N12'])
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()
//
// REACTIVE: bass.low() / drums.mid() | F1 / F2 | N11 / N12


// ======================================================
// SKETCH
// ======================================================

let r1 = () => bass.low()
let r2 = () => drums.mid()

let jx = () =>
  Math.sin(time * 9) * (0.008 + F1 * 0.015 + r1() * 0.015)

let jy = () =>
  Math.sin(time * 13) * (0.004 + F2 * 0.008 + r2() * 0.01)

let vertical = osc(
  () => 14 + F1 * 10 + r1() * 8,
  0.02,
  0.5
)
  .repeatX(2)
  .repeatY(3)
  .rotate(() =>
    Math.sin(time * 0.17) * (0.02 + F2 * 0.05 + r2() * 0.04)
  )

let horizontal = osc(7, 0.03, 0.4)
  .rotate(Math.PI / 2)
  .repeatX(3)
  .repeatY(2)

let blocks = shape(4, 0.7, 0.01)
  .repeatX(() => 4 + F2 * 4)
  .repeatY(7)
  .scrollX(() =>
    Math.sin(time * 0.37) * (0.02 + r1() * 0.05)
  )
  .scrollY(() =>
    Math.cos(time * 0.29) * (0.015 + r2() * 0.04)
  )

let structure = vertical
  .blend(horizontal, () => 0.2 + N11 * 0.3)
  .diff(blocks, () => 0.15 + N12 * (0.2 + r2() * 0.2))

structure
  .scrollX(jx)
  .scrollY(jy)
  .modulate(
    noise(5, 0.1),
    () => 0.04 + r1() * 0.12
  )
  .contrast(() => 1.4 + F1 * 0.8 + r2() * 0.4)
  .brightness(-0.05)
  .out()
