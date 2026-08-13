// G&P — PLEGADO
// by Agustín Calviño
// Gordo y Papu
// VERSION 05 — overlapping stages
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
// REACTIVE: bass.low() / drums.mid() | F1 / F2 / F3 / F4 | N11 / N12 / N82


// ======================================================
// SKETCH — overlapping staircase
// ======================================================

let r1 = () => bass.low()
let r2 = () => drums.mid()

// The movement is deliberately slow and wide, but the copies
// stay close to the original and can collapse back into it.
let driftX = () =>
  Math.sin(time * 0.10) * (0.10 + F5 * 0.18 + r2() * 0.04)

let driftY = () =>
  Math.cos(time * 0.075) * (0.08 + F5 * 0.14 + r1() * 0.04)

let breathe = () =>
  1 + Math.sin(time * 0.31) * (0.04 + r1() * ((F3 * 100) + 1))

let angle = () =>
  Math.sin(time * 0.21) * (0.06 + F2 + r2() * 0.08)

let density = () =>
  5 + F4 * 30 + r2() * 8

// Main staircase
let planes = shape(4, 0.5, 0.2)
  .scale(
    () => 1.05 + 0.3 * breathe() * (0.5 + F1),
    0.32
  )
  .repeatY(density)
  .rotate(-0.12)
  .scrollX(driftX)
  .scrollY(() =>
    driftY() + Math.sin(time * 0.18) * (0.03 + r1() * 0.08)
  )

let planes2 = osc(
  () => 2 + F1 * 3 + r2() * 2,
  0,
  0.5
)
  .rotate(angle)
  .scale(0.4, 0.5)
  .repeatY(() => 1 + F4 * 30)
  .scrollX(driftX)
  .scrollY(driftY)
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

let core = planes2
  .layer(
    folds
      .invert()
      .luma(0.45)
  )
  .diff(
    planes
      .rotate(0.08)
      .scrollX(() => driftX() * 0.5)
  )

// Copies orbit only a little around the core. They are never
// pushed far enough away to become separate rectangular frames.
let spread = () =>
  (0.025 + r2() * 0.08 + N82 * 0.08) * (0.7 + 0.3 * Math.sin(time * 0.06))

let copyA = core
  .scrollX(() => spread())
  .scrollY(() => -spread() * 0.7)
  .rotate(() => 0.012 + Math.sin(time * 0.11) * 0.018)

let copyB = core
  .scrollX(() => -spread() * 0.85)
  .scrollY(() => spread() * 0.55)
  .rotate(() => -0.012 + Math.cos(time * 0.09) * 0.018)

// N82 makes the doubled state stronger; otherwise the copies
// naturally drift in and out of the main staircase.
core
  .add(copyA, () => 0.16 + N82 * 0.22 + r1() * 0.08)
  .add(copyB, () => 0.16 + N82 * 0.22 + r2() * 0.08)
  .modulate(
    osc(1.5, 0.03, 0.5),
    () => 0.05 + r2() * 0.12
  )
  .posterize(5, 0.6)
  .contrast(1.4)
  .out()
