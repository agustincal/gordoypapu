// G&P — BUSCANDO PLACER — v1.22
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
// 02 — BOTONES
// ======================================================
// N11 → CAMBIA MODO (0 / 1 / 2)
// N12 → PULSE ON/OFF
// N13 → SPIN ON/OFF
// N14 → MODO 0
// N15 → MODO 1
// N16 → MODO 2
// N17 → RESET ROTACIÓN
// N18 → PULSE ON/OFF

let mode = 0
let pulse = 0
let spin = false
let rotation = 0

GP.midi.on('N11', ({active}) => {
  if (active) mode = (mode + 1) % 3
})

GP.midi.on('N12', ({active}) => {
  pulse = active ? 1 : 0
})

GP.midi.on('N13', ({active}) => {
  if (active) spin = !spin
})

GP.midi.on('N14', ({active}) => {
  if (active) mode = 0
})

GP.midi.on('N15', ({active}) => {
  if (active) mode = 1
})

GP.midi.on('N16', ({active}) => {
  if (active) mode = 2
})

GP.midi.on('N17', ({active}) => {
  if (active) rotation = 0
})

GP.midi.on('N18', ({active}) => {
  if (active) pulse = 1 - pulse
})

// ======================================================
// 03 — REACTIVOS DE AUDIO
// ======================================================
let bassReact = () => bass.low()
let drumReact = () => Math.max(0, drums.mid() - 0.25)
let synthReact = () => synth.mid()
let vocalReact = () => vocals.high()

// ======================================================
// 04 — CONTROLES DERIVADOS
// ======================================================
let freq = () => {
  if (mode === 0) return 1 + F1 * 8 + drumReact() * 4
  if (mode === 1) return 4 + F1 * 22 + synthReact() * 18
  return 1 + F1 * 5 + vocalReact() * 18
}

let speed = () => {
  if (mode === 0) return 0.15 + F2 * 0.8
  if (mode === 1) return 0.2 + F3 * 1.5 + bassReact() * 0.5
  return 0.05 + F2 * 0.4 + vocalReact() * 0.7
}

let amp = () => 100 + F3 * 250 + bassReact() * F4 * 200
let pixels = () => Math.max(2, 12 + F7 * 100 + drumReact() * 80)
let modAmount = () => 0.05 + F6 * 0.35 + (pulse ? drumReact() * 0.45 : 0)
let finalScale = () => 1 + F8 * 1.5 + vocalReact() * 0.5

// ======================================================
// 05 — ROTACIÓN
// ======================================================
let rot = () => {
  if (spin) rotation += 0.002 + F4 * 0.006
  return rotation
}

// ======================================================
// 06 — CAMPO BASE
// ======================================================
let base = osc(
  freq,
  speed,
  amp
)
  .color(
    () => 0.9,
    () => 0.7 + bassReact() * 0.25,
    () => 0.8
  )

// ======================================================
// 07 — RASTER / INTERFERENCIA
// ======================================================
let raster = osc(
  () => 45 + F4 * 35 + synthReact() * 40,
  () => 0.3 + F5 * 0.5,
  () => 100 + F6 * 250
)
  .color(0.9, 0.9, 0.9)
  .rotate(() => rot())
  .pixelate(pixels, pixels)
  .kaleid(() => 2 + Math.floor(F3 * 5))

// ======================================================
// 08 — MEZCLA
// ======================================================
base
  .diff(raster)
  .scrollX(() => 2 + F5 * 8 + bassReact() * 2)
  .colorama(() => synthReact() * F6 * 0.4)
  .luma(() => 0.05 + F1 * 0.15)
  .repeatX(1)
  .repeatY(1)
  .modulate(
    osc(
      () => 1 + F4 * 8 + drumReact() * 12,
      () => 0.1 + F5 * 0.5,
      () => 100 + F6 * 200
    ),
    modAmount
  )
  .scale(finalScale)
  .contrast(() => 1 + F8 * 0.5 + drumReact() * 0.4)
  .out()
