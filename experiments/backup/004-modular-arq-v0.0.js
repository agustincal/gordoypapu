// G&P — MODULAR ARCHITECTURE
// by Agustín Calviño
// Gordo y Papu
// VERSION 00 — original
//
// SETUP
// await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@f7d5a93fab386560b1d82381276252af0066c279/architecture/gp/gp-base-v0.4.js')
// await GP.init({song:'vociferan', midi:true})
// await GP.audio.start()
// GP.midi.faders(['F1','F3','FMASTER'])
// GP.midi.buttons(['N11','N22','N33'])
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()


// ======================================================
// SKETCH
// ======================================================

let move = () =>
  Math.sin(time * 0.21) * 0.08

let pulse = () =>
  1 + Math.sin(time * 0.43) * 0.12

let grid = shape(4, 0.5, 0.01)
  .repeatX(6)
  .repeatY(8)
  .scale(
    () => 1.1 * pulse(),
    0.75
  )
  .scrollX(move)

let bands = osc(5, 0.025, 0.3)
  .repeatY(8)
  .rotate(
    () => Math.sin(time * 0.16) * 0.08
  )
  .modulate(
    noise(2, 0.12),
    0.12
  )

let columns = osc(12, 0.015, 0.2)
  .repeatX(5)
  .repeatY(2)
  .scrollX(() =>
    Math.sin(time * 0.31) * 0.05
  )

grid
  .blend(bands, 0.5)
  .diff(columns, 0.35)
  .modulate(
    osc(2, 0.04, 0.5),
    0.12
  )
  .contrast(1.6)
  .brightness(-0.1)
  .out()
