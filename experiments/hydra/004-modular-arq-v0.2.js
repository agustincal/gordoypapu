// G&P — MODULAR ARCHITECTURE
// by Agustín Calviño
// Gordo y Papu
// VERSION 02 — infraestructura MIDI/audio actualizada
//
// CONFIGURACIÓN
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@a24a0c13d7e12eb6034e1929a70a4ae4eb44a264/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'vociferan', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
GP.midi.buttons(['N11','N12','N13','N14','N15','N16','N17','N18'])
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()
// Los controles están activos para futuras asignaciones.


// ======================================================
// MOVIMIENTO GENERAL
// ======================================================

let r1 = () => bass.low()
let r2 = () => drums.mid()

let move = () =>
  Math.sin(time * 0.21) * (0.03 + F1 * 0.08 + r1() * 0.04)

let pulse = () =>
  1 + Math.sin(time * 0.43) * (0.05 + F2 * 0.08 + r2() * 0.12)


// ======================================================
// REJILLA PRINCIPAL
// ======================================================

let grid = shape(4, 0.5, 0.01)
  .repeatX(() => 4 + F1 * 4)
  .repeatY(8)
  .scale(
    () => 1.0 + 0.25 * pulse(),
    0.75
  )
  .scrollX(move)


// ======================================================
// BANDAS
// ======================================================

let bands = osc(
  () => 4 + r1() * 5,
  0.025,
  0.3
)
  .repeatY(8)
  .rotate(
    () => Math.sin(time * 0.16) * (0.03 + F2 * 0.07 + r2() * 0.05)
  )
  .modulate(
    noise(2, 0.12),
    () => 0.06 + N11 * (0.06 + r1() * 0.12)
  )


// ======================================================
// COLUMNAS
// ======================================================

let columns = osc(12, 0.015, 0.2)
  .repeatX(() => 3 + F2 * 4)
  .repeatY(2)
  .scrollX(() =>
    Math.sin(time * 0.31) * (0.02 + r2() * 0.05)
  )


// ======================================================
// COMPOSICIÓN FINAL
// ======================================================

grid
  .blend(bands, () => 0.2 + N11 * 0.3)
  .diff(columns, () => 0.15 + N12 * (0.2 + r1() * 0.2))
  .modulate(
    osc(2, 0.04, 0.5),
    () => 0.05 + r2() * 0.12
  )
  .contrast(() => 1.3 + F1 * 0.5 + r1() * 0.4)
  .brightness(-0.1)
  .out()
