// ======================================================
// STEMS BASE v1
// Solo audio + FFT
// Sin MIDI. Sin Hydra. Sin loadScript externo.
// ======================================================

window.stemCtx = window.stemCtx || new AudioContext()
window.stems = window.stems || {}

function stem(name) {
  if (window.stems[name]) {
    window[name] = window.stems[name]
    return window.stems[name]
  }

  const player = new Audio(
    `https://agustincal.github.io/gordoypapu/stems/vociferan/${name}.mp3`
  )

  player.crossOrigin = 'anonymous'
  player.loop = true

  const source = window.stemCtx.createMediaElementSource(player)
  const analyser = window.stemCtx.createAnalyser()
  analyser.fftSize = 1024

  source.connect(analyser)
  source.connect(window.stemCtx.destination)

  const fft = new Uint8Array(analyser.frequencyBinCount)
  setInterval(() => analyser.getByteFrequencyData(fft), 1000 / 60)

  const obj = {
    player,
    analyser,
    fft,
    low() { return this.fft[8] / 255 },
    mid() { return this.fft[40] / 255 },
    high() { return this.fft[100] / 255 }
  }

  window.stems[name] = obj
  window[name] = obj
  return obj
}

stem('bass')
stem('drums')
stem('synth')
stem('vocals')

window.STEM_AUDIO = {
  ctx: window.stemCtx,
  stems: window.stems,
  start() {
    window.stemCtx.resume()
    return Promise.all(
      Object.values(window.stems).map(s => s.player.play())
    )
  }
}
