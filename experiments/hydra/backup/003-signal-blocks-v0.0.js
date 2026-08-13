// G&P — SIGNAL BLOCKS
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

let jx = () =>
  Math.sin(time * 9) * 0.015

let jy = () =>
  Math.sin(time * 13) * 0.008

let vertical = osc(18, 0.02, 0.5)
  .repeatX(2)
  .repeatY(3)
  .rotate(() =>
    Math.sin(time * 0.17) * 0.05
  )

let horizontal = osc(7, 0.03, 0.4)
  .rotate(Math.PI / 2)
  .repeatX(3)
  .repeatY(2)

let blocks = shape(4, 0.7, 0.01)
  .repeatX(5)
  .repeatY(7)
  .scrollX(() =>
    Math.sin(time * 0.37) * 0.04
  )
  .scrollY(() =>
    Math.cos(time * 0.29) * 0.03
  )

let structure = vertical
  .blend(horizontal, 0.45)
  .diff(blocks, 0.35)

structure
  .scrollX(jx)
  .scrollY(jy)
  .modulate(
    noise(5, 0.1),
    () => 0.08 + Math.sin(time * 1.7) * 0.04
  )
  .contrast(1.8)
  .brightness(-0.05)
  .out()
