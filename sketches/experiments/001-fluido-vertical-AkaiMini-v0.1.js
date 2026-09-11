// G&P — FLUIDO VERTICAL
// by Agustín Calviño
// Gordo y Papu
// VERSION 01 — prueba AkaiMini sin MIDI
//
// CONFIGURACIÓN
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@a24a0c13d7e12eb6034e1929a70a4ae4eb44a264/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'vociferan', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2'])
GP.midi.buttons(['N11','N12'])
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()
//
// REACTIVO: bass.low() / drums.mid() | F1 / F2 | N11 / N12


// ======================================================
// MOVIMIENTO GENERAL
// ======================================================

let r1 = () => bass.low()
let r2 = () => drums.mid()

let movement = () =>
  Math.sin(time * 0.22) * (0.03 + F1 * 0.08 + r1() * 0.04)

let pulse = () =>
  0.5 + Math.sin(time * 0.45) * (0.25 + r2() * 0.35)


// ======================================================
// ESTRUCTURA BASE
// ======================================================

let base = osc(3, 0.04, 0.4)
  .rotate(movement)
  .repeatX(() => 2 + F2 * 3)
  .repeatY(2)
  .modulate(
    noise(2, 0.18),
    () => 0.08 + pulse() * 0.18
  )
  .contrast(1.4)


// ======================================================
// ESTRUCTURA VERTICAL
// ======================================================

let vertical = osc(7, 0.02, 0.5)
  .rotate(() => -movement())
  .repeatX(5)
  .modulate(
    noise(3, 0.12),
    () => 0.06 + r1() * 0.16
  )
  .contrast(1.8)


// ======================================================
// TEXTURA ORGÁNICA
// ======================================================

let organic = noise(2, 0.2)
  .pixelate(
    () => 25 + F2 * 35,
    100
  )
  .modulate(
    osc(2, 0.05, 0.3),
    () => 0.08 + r2() * 0.12
  )
  .contrast(1.5)


// ======================================================
// COMPOSICIÓN FINAL
// ======================================================

base
  .blend(vertical, 0.5)
  .diff(organic, () => N11 * (0.15 + r1() * 0.25))
  .modulate(
    noise(1.5, 0.15),
    () => 0.05 + N12 * (0.06 + r2() * 0.14)
  )
  .contrast(1.3)
  .out()
