// G&P — BUSCANDO PLACER — v1.0
// by Agu.Chino

//
// SETUP
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'buscandoplacer', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
// GP.midi.buttons(['N11'])

// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()

// AUDIO — MUTE (true) / UNMUTE (false)========
// Object.values(GP.audio.stems).forEach(s => s.player.muted = true)
//


// ======================================================
// EXPERIMENTO
// ======================================================

osc(1, 0.9, 300)
.color(0.9, 0.7, 0.8)
.diff(
  osc(45, 0.3, 100)
  .color(0.9, 0.9, 0.9)
  .rotate(0.0)
  .pixelate(12)
  .kaleid(2)
)
.scrollX(10)
.colorama()
.luma()
.repeatX(1)
.repeatY(1)
.modulate(
  osc(1, -0.9, 300)
)
.scale(2)
.out()
