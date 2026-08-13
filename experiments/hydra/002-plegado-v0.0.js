// G&P — PLEGADO
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

let breathe = () =>
  1 + Math.sin(time * 0.31) * 0.08

let angle = () =>
  Math.sin(time * 0.21) * 0.12

let planes = shape(4, 0.5, 0)
  .scale(
    () => 1.2 * breathe(),
    0.32
  )
  .repeatY(7)
  .rotate(-0.12)
  .scrollY(
    () => Math.sin(time * 0.18) * 0.08
  )

let planes2 = osc(
  2,
  0,
  0.5
)
  .rotate(angle)
  .scale(1.4, 0.5)
  .repeatY(5)
  .modulate(
    noise(2, 0.15),
    0.12
  )
  .contrast(2)

let folds = planes
  .modulateScale(
    noise(1.5, 0.25),
    () => 0.15 + Math.sin(time * 0.4) * 0.08
  )
  .rotate(
    () => -0.15 + Math.sin(time * 0.27) * 0.08
  )

planes2
  .layer(
    folds
      .invert()
      .luma(0.45)
  )
  .diff(
    planes
      .rotate(0.08)
      .scrollX(
        () => Math.sin(time * 0.23) * 0.04
      )
  )
  .modulate(
    osc(1.5, 0.03, 0.5),
    0.18
  )
  .posterize(5, 0.6)
  .contrast(1.4)
  .out()
