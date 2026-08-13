// G&P — FLUIDO VERTICAL
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

let movement = () =>
  Math.sin(time * 0.22) * 0.08

let pulse = () =>
  0.5 + Math.sin(time * 0.45) * 0.5

let base = osc(3, 0.04, 0.4)
  .rotate(movement)
  .repeatX(3)
  .repeatY(2)
  .modulate(
    noise(2, 0.18),
    () => 0.15 + pulse() * 0.18
  )
  .contrast(1.4)

let vertical = osc(7, 0.02, 0.5)
  .rotate(() => -movement())
  .repeatX(5)
  .modulate(
    noise(3, 0.12),
    () => 0.1 + pulse() * 0.15
  )
  .contrast(1.8)

let organic = noise(2, 0.2)
  .pixelate(35, 100)
  .modulate(
    osc(2, 0.05, 0.3),
    0.15
  )
  .contrast(1.5)

base
  .blend(vertical, 0.5)
  .diff(organic, 0.3)
  .modulate(
    noise(1.5, 0.15),
    () => 0.1 + pulse() * 0.12
  )
  .contrast(1.3)
  .out()
