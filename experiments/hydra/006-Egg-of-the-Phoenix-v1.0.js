// G&P — EGG OF THE PHOENIX — v1.0
// by Agu.Chino

// Original sketch:
// Alexandre Rangel — "egg of the phoenix"
// licensed with CC BY-NC-SA 4.0
// https://creativecommons.org/licenses/by-nc-sa/4.0/

// ======================================================
// SETUP
// ======================================================
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'vociferan', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])

// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()

// AUDIO — MUTE (true) / UNMUTE (false)========
// Object.values(GP.audio.stems).forEach(s => s.player.muted = true)

// ======================================================
// FADERS
// ======================================================
// F1 → velocidad global
// F2 → tamaño de la forma principal
// F3 → separación entre las capas
// F4 → velocidad de rotación
// F5 → cantidad de modulateScale
// F6 → escala X final
// F7 → escala Y final
// F8 → colorama final

speed = () => 0.8 + F1 * 0.8

let mainSize = () => 0.08 + F2 * 0.14
let layerStep = () => 0.05 + F3 * 0.20
let rotSpeed = () => 0.03 + F4 * 0.17
let modAmount = () => 0.05 + F5 * 0.35
let finalX = () => 1.1 + F6 * 1.0
let finalY = () => 0.4 + F7 * 0.5
let colorShift = () => F8 * 0.8

// ======================================================
// EGG OF THE PHOENIX
// ======================================================
shape(99, mainSize, .5)
  .color(0, 1, 2)

  .diff(
    shape(240, .5, 0)
      .scrollX(layerStep)
      .rotate(() => time * rotSpeed())
      .color(1, 0, .75)
  )

  .diff(
    shape(99, .4, .002)
      .scrollX(() => layerStep() * 2)
      .rotate(() => time * rotSpeed() * .5)
      .color(1, 0, .75)
  )

  .diff(
    shape(99, .3, .002)
      .scrollX(() => layerStep() * 3)
      .rotate(() => time * rotSpeed() * .333)
      .color(1, 0, .75)
  )

  .diff(
    shape(99, .2, .002)
      .scrollX(() => layerStep() * 4)
      .rotate(() => time * rotSpeed() * .25)
      .color(1, 0, .75)
  )

  .diff(
    shape(99, .1, .002)
      .scrollX(() => layerStep() * 5)
      .rotate(() => time * rotSpeed() * .2)
      .color(1, 0, .75)
  )

  .modulateScale(
    shape(240, .5, 0)
      .scrollX(() => layerStep())
      .rotate(() => time * rotSpeed()),
    () => Math.sin(time / 3) * modAmount() + modAmount()
  )

  .scale(finalX, finalY, 1)
  .colorama(colorShift)
  .out()
