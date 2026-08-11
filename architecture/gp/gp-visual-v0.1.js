// ======================================================
// GP VISUAL v0.1
// FMASTER + fade visual
// No MIDI initialization. No audio.
// ======================================================

window.GP = window.GP || {}
window.GP.visual = window.GP.visual || {}

const visual = window.GP.visual

visual.fade = visual.fade || 'black'

visual.amount = function () {
  if (!window.GP.midi || typeof GP.midi.fader !== 'function') return 0
  return GP.midi.fader(56)
}

// Pass a Hydra buffer (o0, o1, etc.).
// GP.visual creates the Hydra source internally.
visual.apply = function (buffer) {
  const source = src(buffer)

  if (visual.fade === 'black')
    return source.blend(solid(0, 0, 0), () => visual.amount())

  return source
}
