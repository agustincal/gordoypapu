// G&P — PLEGADO
// by Agustín Calviño
// Gordo y Papu
// VERSION 03 — audio + controls activos
//
// SETUP
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@f7d5a93fab386560b1d82381276252af0066c279/architecture/gp/gp-base-v0.4.js')
await GP.init({song:'vociferan', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5'])
GP.midi.buttons(['N11','N12','N82'])
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()
//
// REACTIVE: bass.low() / drums.mid() | F1 / F2 / F3 / F4 | N11 / N12


// ======================================================
// SKETCH
// ======================================================

let r1 = () => bass.low()
let r2 = () => drums.mid()

let breathe = () =>
  1 + Math.sin(time * 0.31) * (0.04 + r1() * ((F3 * 100) + 1))

let angle = () =>
  Math.sin(time * 0.21) * (0.06 + F2 * 1 + r2() * 0.08)

let planes = shape(4, 0.5, 0.2)
  .scale(
    () => 1.05 + 0.3 * breathe() * (0.5 + F1),
    0.32
  )
  .repeatY(() => 5 + F2 * 80)
  .rotate(-0.12)
  .scrollY(
    () => Math.sin(time * 0.18) * (0.03 + r1() * 0.08)
  )

let planes2 = osc(
  () => 2 + F1 * 3 + r2() * 2,
  0,
  0.5
)
  .rotate(angle)
  .scale(0.4, 0.5)
  .repeatY(() => 1 + F4 * 99)
  .modulate(
    noise(2, 0.15),
    () => 0.06 + N11 * (0.08 + r1() * 0.16)
  )
  .contrast(2)

let folds = planes
  .modulateScale(
    noise(1.5, 0.25),
    () => 0.08 + N12 * (0.08 + r2() * 0.18)
  )
  .rotate(
    () => -0.15 + Math.sin(time * 0.27) * (0.03 + r1() * 0.08)
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
        () => Math.sin(time * 0.23) * (0.02 + F1 * 0.04 + r2() * 0.04)
      )
  )
  .modulate(
    osc(1.5, 0.03, 0.5),
    () => 0.08 + r2() * 0.12
  )
  .posterize(5, 0.6)
  .contrast(1.4)
  .out()
