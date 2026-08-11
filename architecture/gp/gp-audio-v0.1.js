// ======================================================
// GP AUDIO v0.1
// Solo audio + FFT
// Sin MIDI. Sin Hydra. Sin loadScript externo.
// ======================================================

window.GP = window.GP || {}

GP.audio = GP.audio || {}

GP.audio.ctx = GP.audio.ctx || new AudioContext()
GP.audio.stems = GP.audio.stems || {}

const GP_AUDIO_BASE = 'https://agustincal.github.io/gordoypapu/stems/vociferan/'

function createStem(name) {
  if (GP.audio.stems[name]) return GP.audio.stems[name]

  const player = new Audio(`${GP_AUDIO_BASE}${name}.mp3`)
  player.crossOrigin = 'anonymous'
  player.loop = true

  const source = GP.audio.ctx.createMediaElementSource(player)
  const analyser = GP.audio.ctx.createAnalyser()
  analyser.fftSize = 1024

  source.connect(analyser)
  analyser.connect(GP.audio.ctx.destination)

  const fft = new Uint8Array(analyser.frequencyBinCount)

  setInterval(() => analyser.getByteFrequencyData(fft), 1000 / 60)

  const stem = {
    player,
    analyser,
    fft,
    low() { return this.fft[8] / 255 },
    mid() { return this.fft[40] / 255 },
    high() { return this.fft[100] / 255 },
    volume(value) {
      if (value === undefined) return this.player.volume
      this.player.volume = Math.max(0, Math.min(1, value))
      return this
    },
    mute(value) {
      if (value === undefined) return this.player.muted
      this.player.muted = !!value
      return this
    }
  }

  GP.audio.stems[name] = stem
  GP.audio[name] = stem
  return stem
}

createStem('bass')
createStem('drums')
createStem('synth')
createStem('vocals')

GP.audio.start = async function () {
  await GP.audio.ctx.resume()

  const players = Object.values(GP.audio.stems).map(s => s.player)
  if (!players.length) return GP.audio

  const startTime = players[0].currentTime
  players.forEach(player => { player.currentTime = startTime })
  await Promise.all(players.map(player => player.play()))

  return GP.audio
}

GP.audio.pause = function () {
  Object.values(GP.audio.stems).forEach(s => s.player.pause())
  return GP.audio
}

GP.audio.stop = function () {
  Object.values(GP.audio.stems).forEach(s => {
    s.player.pause()
    s.player.currentTime = 0
  })
  return GP.audio
}

GP.audio.setVolume = function (name, value) {
  if (GP.audio.stems[name]) GP.audio.stems[name].volume(value)
  return GP.audio
}

GP.audio.mute = function (name, value = true) {
  if (GP.audio.stems[name]) GP.audio.stems[name].mute(value)
  return GP.audio
}

GP.audio.sync = function () {
  const players = Object.values(GP.audio.stems).map(s => s.player)
  if (!players.length) return GP.audio

  const time = Math.max(...players.map(player => player.currentTime))
  players.forEach(player => { player.currentTime = time })
  return GP.audio
}
