// G&P — BUSCANDO PLACER — v1.2
// by Agu.Chino

// ======================================================
// 01 — SETUP
// ======================================================
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'buscandoplacer', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
GP.midi.buttons(['N11','N12','N13','N14','N15','N16','N17','N18'])

// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()

// AUDIO — MUTE (true) / UNMUTE (false)========
// Object.values(GP.audio.stems).forEach(s => s.player.muted = true)

// ======================================================
// 02 — ESTADOS DE LOS BOTONES
// ======================================================
let mode = 0
let pulse = 0
let rotation = 0

GP.midi.on('N11', ({active}) => { if (active) mode = (mode + 1) % 3 })
GP.midi.on('N12', ({active}) => { if (active) pulse = active ? 1 : 0 })
GP.midi.on('N13', ({active}) => { if (active) rotation += 0.2 })
GP.midi.on('N14', ({active}) => { if (active) mode = 0 })
GP.midi.on('N15', ({active}) => { if (active) mode = 1 })
GP.midi.on('N16', ({active}) => { if (active) mode = 2 })

// ======================================================
// 03 — REACTIVOS
// ======================================================
let bass = () => bassReact()
let bassReact = () => GP.audio.stems.bass?.analyser?.low?.() || 0
let drumReact = () => GP.audio.stems.drums?.analyser?.mid?.() || 0
let synthReact = () => GP.audio.stems.synth?.analyser?.mid?.() || 0
let vocalReact = () => GP.audio.stems.vocals?.analyser?.high?.() || 0

// ======================================================
// 04 — MOTOR DE MODULACIÓN
// ======================================================
// Cada modo cambia la relación entre los mismos controles.
let freq = () => {
  if (mode === 0) return 1 + F1 * 10 + drumReact() * F2 * 8
  if (mode === 1) return 3 + F1 * 30 + synthReact() * 20
  return 0.5 + F1 * 4 + vocalReact() * 25
}

let speed = () => {
  if (mode === 0) return 0.15 + F2 * 0.8
  if (mode === 1) return 0.4 + F3 * 2 + bassReact() * 0.8
  return 0.05 + F2 * 0.3 + vocalReact() * 0.5
}

let shape = () => 80 + F3 * 320 + bassReact() * F4 * 300
let colorShift = () => F5 * 0.2 + synthReact() * F6 * 0.8
let pixel = () => Math.max(2, 200 - F7 * 198 - drumReact() * 80)
let scale = () => 1 + F8 * 1.8 + vocalReact() * F8 * 1.5

// ======================================================
// 05 — ROTACIÓN
// ======================================================
let rot = () => {
  rotation += speed() * 0.002
  return rotation
}

// ======================================================
// 06 — CAPA A: CAMPO BASE
// ======================================================
let layerA = () => osc(freq, speed, shape)
  .color(
    () => 0.25 + F1 * 0.75,
    () => 0.15 + bassReact() * 0.85,
    () => 0.35 + F2 * 0.65
  )
  .rotate(rot)

// ======================================================
// 07 — CAPA B: RASTER / INTERFERENCIA
// ======================================================
let layerB = () => osc(
  () => 20 + F4 * 80 + synthReact() * 60,
  () => 0.1 + F5 * 0.8,
  () => 100 + F6 * 500
)
  .pixelate(pixel, pixel)
  .kaleid(() => 2 + Math.floor(F3 * 6))
  .rotate(() => -rot())

// ======================================================
// 08 — CAPA C: VOCAL DISTURBANCE
// ======================================================
let layerC = () => osc(
  () => 2 + vocalReact() * 35,
  () => 0.2 + vocalReact() * 2,
  () => 40 + F7 * 500
)
  .colorama(() => vocalReact() * 0.8)
  .scale(() => 0.8 + vocalReact() * F8 * 2)

// ======================================================
// 09 — MEZCLA PRINCIPAL
// ======================================================
layerA()
  .diff(layerB())
  .diff(layerC())
  .modulate(
    osc(
      () => 1 + F4 * 12 + drumReact() * 20,
      () => 0.1 + F5,
      () => 80 + F6 * 300
    ),
    () => 0.05 + F7 * 0.7 + (pulse ? drumReact() * 0.8 : 0)
  )
  .scrollX(() => (F5 - 0.5) * 4 + bassReact() * F6)
  .scrollY(() => (F6 - 0.5) * 3 + vocalReact() * 0.5)
  .scale(scale)
  .contrast(() => 1 + F8 * 0.7 + drumReact() * 0.5)
  .luma(() => 0.2 + F1 * 0.35)
  .out()
