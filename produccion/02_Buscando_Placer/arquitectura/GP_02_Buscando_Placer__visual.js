// ============================================================
// GP_02_Buscando_Placer__visual
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: motor visual — estados, ritmo por grilla de pasos, precarga de imágenes,
//      disparo de recuadros, ráfaga, barrido (distancia según nota), iman,
//      efectos de escena en F7/F8 (mala señal, y un slot libre)
// Faders: F1-F4 = efectos recuadro, F5-F8 = efectos escena. Cada estado define
//         un valor 0-1 directo; tocar el fader físico lo toma en vivo (takeover,
//         con transición suave) hasta el próximo cambio de estado.
// Expone GP.zapping.* · Cargado por: GP_02_Buscando_Placer__loader
// Actualizado: 2026-10-01
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.zapping && GP.zapping._version === 'v1.9.3') return
  GP.zapping = { _version: 'v1.9.3' }

  const FIGURAS = { redonda: 96, blanca: 48, negra: 24, corchea: 12, semicorchea: 6, fusa: 3 }
  GP.zapping.FIGURAS = FIGURAS

  let cfg = null
  let estadoActual = 0
  let contadorPulsos = 0
  let pasoRitmo = 0
  let colorPantallaActivo = false
  let colorPantalla = [1, 1, 1]
  let ATAQUE_ACTIVO = false
  const ATAQUE_MAX = 0.6
  let ataqueInicio = 0
  let ataqueDur = ATAQUE_MAX
  let barriendoActivo = false

  let ultimoTickReal = 0
  let duracionTickMs = 0
  let ultimoGolpeRitmo = 0
  let duracionPasoActual = 0

  let velocidad = 1
  const VELOCIDAD_MIN = 0.25
  const VELOCIDAD_MAX = 8
  GP.zapping.multiplicarVelocidad = (factor) => {
    velocidad = Math.max(VELOCIDAD_MIN, Math.min(VELOCIDAD_MAX, velocidad * factor))
  }
  GP.zapping.velocidad = () => velocidad

  let imagenesPrecargadas = []
  const precargarImagenes = (urls) => {
    imagenesPrecargadas = urls.map(url => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      return img
    })
  }

  const rect = {
    rx: 0, ry: 0, rw: 1, rh: 1,
    rxIni: 0, ryIni: 0, rxFin: 0, ryFin: 0,
    imgScale: 1, imgX: 0, imgY: 0, imgXFin: 0, imgYFin: 0,
    tinteR: 1, tinteG: 1, tinteB: 1,
    cargando: false, sueltaPendiente: false,
  }
  GP.zapping.rect = rect

  const NUM_FADERS = 8
  let f1s = 0, f2s = 0, f3s = 0, f4s = 0, f5s = 0, f6s = 0, f7s = 0, f8s = 0
  const SUAVIZADO = 0.15
  const clamp01 = v => Math.max(0, Math.min(1, v))
  const RAW_FADERS = () => [F1, F2, F3, F4, F5, F6, F7, F8]
  const hslToRgb = (h, s, l) => {
  const k = n => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

const generarTriadica = (hueBase, s = 0.8, l = 0.55) =>
  [0, 1 / 3, 2 / 3].map(offset => hslToRgb((hueBase + offset) % 1, s, l))

  const UMBRAL_TOQUE = 3
  const VELOCIDAD_MEZCLA = 0.08
  let faderBase = new Array(NUM_FADERS).fill(0)
  let faderTocado = new Array(NUM_FADERS).fill(false)
  let mezclaFader = new Array(NUM_FADERS).fill(0)

  const valorParam = (idx, baseEstado, suavizado) =>
    clamp01(baseEstado + (suavizado - baseEstado) * mezclaFader[idx])

  const estado = () => cfg.estados[Math.max(0, estadoActual)]

  const f1 = () => valorParam(0, estado().f1 ?? 0, f1s)
  const f2 = () => valorParam(1, estado().f2 ?? 0, f2s)
  const f3 = () => valorParam(2, estado().f3 ?? 0, f3s)
  const f4 = () => valorParam(3, estado().f4 ?? 0, f4s)
  const f5 = () => valorParam(4, estado().f5 ?? 0, f5s)
  const f6 = () => valorParam(5, estado().f6 ?? 0, f6s)
  const f7 = () => valorParam(6, estado().f7 ?? 0, f7s)
  const f8 = () => valorParam(7, estado().f8 ?? 0, f8s)
  GP.zapping.f = { f1, f2, f3, f4, f5, f6, f7, f8 }

  GP.zapping.pixelSize = () => 600 - (f2() ** 3) * 595
  GP.zapping.escalaExtra = () => 1 + (f6() ** 3) * 40
  GP.zapping.imanIntensidad = (voz) => estado().usaIman ? voz * f5() * f5() : 0
  GP.zapping.colorAlpha = () => colorPantallaActivo ? 1 : 0
  GP.zapping.colorPantalla = () => colorPantalla
  GP.zapping.estadoNombre = () => estado().nombre || `estado ${estadoActual}`

  GP.zapping.envolventeRitmo = () => {
    if (!duracionPasoActual) return 0
    const t = (performance.now() - ultimoGolpeRitmo) / duracionPasoActual
    return t < 1 ? 1 - t : 0
  }

  GP.zapping.iman = (px, py, fase) => shape(64, 0.2, 0.9)
    .scroll(() => px + 0.015 * Math.sin(time * 0.4 + fase), () => py + 0.015 * Math.cos(time * 0.3 + fase))
    .mult(noise(3, .3), 1)

  GP.zapping.usaMalaSenalF7 = () => !!estado().usaGlitchF7
  GP.zapping.texturaF7 = () => noise(30, 10).pixelate(1, 100)
  GP.zapping.intensidadF7 = () => f7() * 0.06
  GP.zapping.scrollXF7 = () => 0.01 * f7()
  GP.zapping.scrollVelocidadF7 = () => 0.1 * f7()
  GP.zapping.lineaF7 = () => solid(0, 0, 0)
    .mask(shape(4, 1, 0).scale(0.015, .2, 200))
    .scrollX(-0.5)
    .mult(solid(1, 1, 1), () => f7() > 0.02 ? 1 : 0)

  GP.zapping.intensidadF1 = () => f1() * .5 * (estado().siguenRitmo ? GP.zapping.envolventeRitmo() : 1)

  GP.zapping.rectShape = () => shape(4, 1, 0.001)
    .scale(() => rect.rw, () => rect.rh)
    .scrollX(() => rect.rx)
    .scrollY(() => rect.ry)
    .modulateScrollX(noise(3, .4).pixelate(1, 120), GP.zapping.intensidadF1)

  GP.zapping.init = (config) => {
    cfg = Object.assign({ rafagaCantidad: 3, rafagaPoll: 30 }, config)
    estadoActual = -1
    contadorPulsos = 0
    pasoRitmo = 0
    velocidad = 1
    faderBase = RAW_FADERS()
    faderTocado = new Array(NUM_FADERS).fill(false)
    mezclaFader = new Array(NUM_FADERS).fill(0)
    precargarImagenes(cfg.videos)
  }

  GP.zapping.update = () => {
    const raw = RAW_FADERS()
    for (let i = 0; i < NUM_FADERS; i++) {
      if (!faderTocado[i] && Math.abs(raw[i] - faderBase[i]) > UMBRAL_TOQUE) faderTocado[i] = true
      const objetivo = faderTocado[i] ? 1 : 0
      mezclaFader[i] += (objetivo - mezclaFader[i]) * VELOCIDAD_MEZCLA
    }
    f1s += (F1 / 127 - f1s) * SUAVIZADO
    f2s += (F2 / 127 - f2s) * SUAVIZADO
    f3s += (F3 / 127 - f3s) * SUAVIZADO
    f4s += (F4 / 127 - f4s) * SUAVIZADO
    f5s += (F5 / 127 - f5s) * SUAVIZADO
    f6s += (F6 / 127 - f6s) * SUAVIZADO
    f7s += (F7 / 127 - f7s) * SUAVIZADO
    f8s += (F8 / 127 - f8s) * SUAVIZADO
    if (!barriendoActivo) return
    const t = Math.min(1, (time - ataqueInicio) / ataqueDur)
    const e = 1 - Math.pow(1 - t, 3)
    rect.rx = rect.rxIni + (rect.rxFin - rect.rxIni) * e
    rect.ry = rect.ryIni + (rect.ryFin - rect.ryIni) * e
    rect.imgX = rect.imgXFin + (rect.rx - rect.rxFin)
    rect.imgY = rect.imgYFin + (rect.ry - rect.ryFin)
    if (t >= 1) barriendoActivo = false
  }

  GP.zapping.cortarBarrido = () => {
    rect.sueltaPendiente = true
    if (!barriendoActivo) return
    rect.rx = rect.rxFin; rect.ry = rect.ryFin
    rect.imgX = rect.imgXFin; rect.imgY = rect.imgYFin
    barriendoActivo = false
  }

  GP.zapping.toggleBarrido = () => { ATAQUE_ACTIVO = !ATAQUE_ACTIVO }

  GP.zapping.disparar = (nota = 60, duracionTicks = FIGURAS.negra) => {
    if (rect.cargando) return
    rect.cargando = true
    rect.sueltaPendiente = false

    const aplicar = (img) => {
      cfg.fuente.src = img
      cfg.fuente.dynamic = true

      const paleta = generarTriadica(estado().colorBase ?? 0)
      const color = paleta[Math.floor(Math.random() * paleta.length)]
      rect.tinteR = color[0]; rect.tinteG = color[1]; rect.tinteB = color[2]

      const rango3 = 0.15 + f3() * 2
      rect.rw = 0.3 + Math.random() * rango3
      rect.rh = 0.3 + Math.random() * rango3
      rect.rxFin = (Math.random() - 0.5) * 0.7
      rect.ryFin = (Math.random() - 0.5) * 0.7
      const factorZoom = 1 + f3()
      const escalaBase = 0.75 + Math.random() * 0.25
      rect.imgScale = escalaBase * factorZoom
      rect.imgXFin = (Math.random() - 0.5) * 0.2
      rect.imgYFin = (Math.random() - 0.5) * 0.2
      if (ATAQUE_ACTIVO && !rect.sueltaPendiente) {
        const factor = duracionTicks / FIGURAS.negra
        const angulo = Math.random() * Math.PI * 2
        const distancia = 1.3 * factor
        rect.rxIni = rect.rxFin + Math.cos(angulo) * distancia
        rect.ryIni = rect.ryFin + Math.sin(angulo) * distancia
        rect.rx = rect.rxIni; rect.ry = rect.ryIni
        ataqueInicio = time
        ataqueDur = ATAQUE_MAX * factor
        barriendoActivo = true
      } else {
        rect.rx = rect.rxFin; rect.ry = rect.ryFin
        rect.imgX = rect.imgXFin; rect.imgY = rect.imgYFin
        barriendoActivo = false
      }
      rect.cargando = false
    }

    const i = Math.floor(Math.random() * cfg.videos.length)
    const precargada = imagenesPrecargadas[i]
    if (precargada && precargada.complete && precargada.naturalWidth > 0) {
      aplicar(precargada)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = cfg.videos[i]
    const timeoutId = setTimeout(() => {
      console.warn('imagen tardó demasiado en cargar, se libera el disparo:', cfg.videos[i])
      rect.cargando = false
    }, 4000)
    img.addEventListener('error', () => {
      console.warn('error al cargar la imagen, se libera el disparo:', cfg.videos[i])
      clearTimeout(timeoutId)
      rect.cargando = false
    }, { once: true })
    img.addEventListener('load', () => {
      clearTimeout(timeoutId)
      aplicar(img)
    }, { once: true })
  }

  GP.zapping.rafaga = (nota = 60, cantidad = cfg.rafagaCantidad) => {
    let disparados = 0
    const intentar = () => {
      if (disparados >= cantidad) return
      if (rect.cargando) { setTimeout(intentar, cfg.rafagaPoll); return }
      GP.zapping.disparar(nota)
      disparados++
      setTimeout(intentar, cfg.rafagaPoll)
    }
    intentar()
  }

  GP.zapping.avanzarEstado = () => {
    estadoActual = Math.min(estadoActual + 1, cfg.estados.length - 1)
    const e = estado()
    colorPantallaActivo = e.usaColorPantalla
    if (colorPantallaActivo) colorPantalla = [Math.random(), Math.random(), Math.random()]
    ATAQUE_ACTIVO = e.usaBarrido
    contadorPulsos = 0
    pasoRitmo = 0
    faderBase = RAW_FADERS()
    faderTocado = new Array(NUM_FADERS).fill(false)
    mezclaFader = new Array(NUM_FADERS).fill(0)
    GP.zapping.rafaga(60)
    return estadoActual
  }

  GP.zapping.pulso = () => {
    if (estadoActual < 0) return
    const ahora = performance.now()
    if (ultimoTickReal) duracionTickMs = ahora - ultimoTickReal
    ultimoTickReal = ahora

    const patron = estado().ritmo || 'X...'
    const resolucion = FIGURAS[estado().resolucion] || FIGURAS.semicorchea
    contadorPulsos++
    if (contadorPulsos >= resolucion) {
      contadorPulsos = 0
      const paso = patron[pasoRitmo % patron.length]
      pasoRitmo = (pasoRitmo + 1) % patron.length
      if (paso === 'X' || paso === 'x') {
        GP.zapping.disparar(60, resolucion)
        ultimoGolpeRitmo = ahora
        duracionPasoActual = duracionTickMs * resolucion
      }
    }
  }
})()