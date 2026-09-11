// ======================================================
// G&P — GP STEMS — v1.0
// Carga los stems de UNA canción (carpeta stems/<song>/) y
// expone análisis FFT (.low() .mid() .high()) por stem.
//
// No sabe nada de MIDI ni de ninguna controladora — así se
// puede tocar/reemplazar el módulo de control sin afectar esto.
//
// Contrato público (GP.audio):
//   GP.audio.init({ song, stems? })  → carga los <Audio> + FFT
//   GP.audio.start()                  → play() de todos los stems
//   GP.audio.stop() / .pause()        → pausa todos los stems
//   GP.audio.stems[name]              → { player, low(), mid(), high(), volume(), mute() }
// ======================================================
;(function () {
  window.GP = window.GP || {}

  const VERSION = '1.0'
  if (window.GP.stemsVersion === VERSION) {
    console.info('[GP STEMS] v' + VERSION + ' ya está cargado')
    return
  }

  const STEMS_BASE_URL = 'https://agustincal.github.io/gordoypapu/stems'
  const DEFAULT_STEM_NAMES = ['bass', 'drums', 'synth', 'vocals']

  const audio = {}
  const state = {
    song: null,
    ctx: null,
    stems: {},
    started: false
  }

  function createStem(name, song) {
    if (state.stems[name]) return state.stems[name]

    const player = new Audio(`${STEMS_BASE_URL}/${song}/${name}.mp3`)
    player.crossOrigin = 'anonymous'
    player.loop = true

    const source = state.ctx.createMediaElementSource(player)
    const analyser = state.ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    source.connect(state.ctx.destination)

    const fft = new Uint8Array(analyser.frequencyBinCount)
    setInterval(() => analyser.getByteFrequencyData(fft), 1000 / 60)

    const stem = {
      player, analyser, fft,
      low()  { return this.fft[8]   / 255 },
      mid()  { return this.fft[40]  / 255 },
      high() { return this.fft[100] / 255 },
      volume(value) {
        if (value === undefined) return this.player.volume
        this.player.volume = Math.max(0, Math.min(1, value))
        return this
      },
      mute(value = true) {
        this.player.muted = !!value
        return this
      }
    }

    state.stems[name] = stem
    audio[name] = stem
    window[name] = stem   // acceso directo tipo `bass.low()`, igual que ya usás hoy
    return stem
  }

  // song: nombre de carpeta en /stems (ej: 'buscandoplacer')
  // stems: lista opcional de nombres de archivo sin .mp3.
  //        Default: bass/drums/synth/vocals. Usalo para casos
  //        como 'vociferan', que además tiene 'metronomo'.
  audio.init = function ({ song, stems = DEFAULT_STEM_NAMES } = {}) {
    if (!song) throw new Error('GP.audio.init: falta "song"')
    if (state.ctx && state.song === song) return audio

    if (state.ctx) {
      Object.values(state.stems).forEach(s => s.player.pause())
    }

    state.song = song
    state.ctx = state.ctx || new AudioContext()
    state.stems = {}

    stems.forEach(name => createStem(name, song))

    audio.stems = state.stems
    return audio
  }

  audio.start = async function () {
    if (!state.ctx) throw new Error('GP.audio.start: llamá a GP.audio.init() primero')
    await state.ctx.resume()
    await Promise.all(Object.values(state.stems).map(s => s.player.play()))
    state.started = true
    return audio
  }

  audio.stop = function () {
    Object.values(state.stems).forEach(s => s.player.pause())
    state.started = false
    return audio
  }

  audio.pause = audio.stop
  audio.state = state

  window.GP.audio = audio
  window.GP.stemsVersion = VERSION
  console.info('[GP STEMS] v' + VERSION + ' cargado')
})()
