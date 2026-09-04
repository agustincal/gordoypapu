// G&P — BUSCANDO PLACER — v1.23
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
// 02 — BOTONES — PRUEBA DIRECTA
// ======================================================
// En esta versión NO usamos GP.midi.on().
// Los botones se leen directamente como N11–N18.
// Así podemos comprobar si el estado del botón llega al sketch.
//
// N11 → contraste extra
// N12 → pulso de modulación
// N13 → giro continuo
// N14 → raster fuerte
// N15 → raster suave
// N16 → luma/inversión
// N17 → escala extra
// N18 → colorama

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
let freq = () => 1 + F1 * 8 + drumReact() * 4
let speed = () => 0.15 + F2 * 0.8
let amp = () => 100 + F3 * 250 + bassReact() * F4 * 200

// N12 — pulso visible en la modulación
let modAmount = () => 0.05 + F6 * 0.35 + (N12 ? drumReact() * 0.8 : 0)

// N13 — giro continuo, sin estado interno
let rot = () => N13 ? time * (0.08 + F4 * 0.25) : 0

// N17 — escala extra
let finalScale = () => 1 + F8 * 1.5 + (N17 ? 1 : 0) + vocalReact() * 0.5

// ======================================================
// 05 — CAMPO BASE
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
// 06 — RASTER / INTERFERENCIA
// ======================================================
let raster = osc(
  () => N14 ? 80 + F4 * 50 + synthReact() * 40 : 25 + F4 * 25 + synthReact() * 30,
  () => 0.3 + F5 * 0.5,
  () => N15 ? 60 + F6 * 180 : 100 + F6 * 250
)
  .color(0.9, 0.9, 0.9)
  .rotate(rot)
  .pixelate(
    () => N14 ? Math.max(2, 4 + F7 * 30) : Math.max(2, 12 + F7 * 100),
    () => N14 ? Math.max(2, 4 + F7 * 30) : Math.max(2, 12 + F7 * 100)
  )
  .kaleid(() => N15 ? 2 : 2 + Math.floor(F3 * 5))

// ======================================================
// 07 — MEZCLA
// ======================================================
base
  .diff(raster)
  .scrollX(() => 2 + F5 * 8 + bassReact() * 2)
  .colorama(() => N18 ? 0.4 + synthReact() * 0.5 : synthReact() * F6 * 0.4)
  .luma(() => N16 ? 0.35 : 0.05 + F1 * 0.15)
  .repeatX(() => N16 ? 2 : 1)
  .repeatY(() => N16 ? 2 : 1)
  .modulate(
    osc(
      () => 1 + F4 * 8 + drumReact() * 12,
      () => 0.1 + F5 * 0.5,
      () => 100 + F6 * 200
    ),
    modAmount
  )
  .scale(finalScale)
  .contrast(() => N11 ? 2.5 + F8 * 0.8 : 1 + F8 * 0.5 + drumReact() * 0.4)
  .out()
