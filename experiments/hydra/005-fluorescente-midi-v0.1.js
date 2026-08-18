// G&P — FLUORESCENTE
// por Agustín Calviño
// Gordo y Papu
// VERSIÓN 01 — base MIDI
//
// CONFIGURACIÓN
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@a24a0c13d7e12eb6034e1929a70a4ae4eb44a264/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'fluorescente', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
//
// F1–F8 → controles MIDI
// bass / drums / synth / vocals → audio reactivo


// ================================
// VISUAL
// ================================

osc(
  () => 2 + F1 * 30,
  () => 0.01 + F2 * 0.3,
  () => F3
)

  // F4
  .rotate(() => F4 * 3)

  // F5
  .kaleid(() => 1 + Math.floor(F5 * 7))

  // F6
  .scale(() => 0.5 + F6 * 2)

  // F7
  .pixelate(
    () => 10 + F7 * 100,
    () => 10 + F7 * 100
  )

  // F8
  .contrast(() => 0.5 + F8 * 3)

  .out()
