// ============================================================
// GP_02_Buscando_Placer__visual
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: motor visual — estados, ritmo por grilla de pasos, precarga de imágenes,
//      disparo de recuadros, ráfaga, barrido (distancia según nota), iman
// Faders: cada estado define un valor 0-1 directo; tocar el fader físico lo
//         toma en vivo (takeover) hasta el próximo cambio de estado
// Expone GP.zapping.* · Cargado por: GP_02_Buscando_Placer__loader
// Actualizado: 2026-09-28
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.zapping && GP.zapping._version === 'v1.5') return
  GP.zapping = { _version: 'v1.5' }

  // Figuras musicales en pulsos de clock real (24 pulsos = 1 negra, estándar MIDI 24ppqn)
  const FIGURAS = {
    redonda: 96,
    blanca: 48,
    negra: 24,
    corchea: 12,
    semicorchea: 6,
    fusa: 3,
  }
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

  // multiplicador de velocidad del ritmo — obsoleto desde la grilla de pasos, se deja sin usar por ahora
  let velocidad = 1
  const VELOCIDAD_MIN = 0.25
  const VELOCIDAD_MAX = 8
  GP.zapping.multiplicarVelocidad = (factor) => {
    velocidad = Math.max(VELOCIDAD_MIN, Math.min(VELOCIDAD_MAX, velocidad * factor))
  }
  GP.zapping.velocidad = () => velocidad

  // precarga de imágenes: se llenan al hacer init(), disparar() las usa directo de memoria
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
    // color por nota sacado (27/9) — nueva lógica de color pendiente de diseñar
    tinteR: 1, tinteG: 1, tinteB: 1,
    cargando: false, sueltaPendiente: false,
  }
  GP.zapping.rect = rect

  let f1s = 0, f2s = 0, f3s = 0, f4s = 0, f5s = 0, f6s = 0
  const SUAVIZADO = 0.15
  const clamp01 = v => Math.max(0, Math.min(1, v))

  // Sistema de "takeover": cada estado arranca usando su valor curado (0-1 directo, sin blend).
  // En cuanto tocás un fader (se aleja de dónde estaba al entrar al estado), ese parámetro
  // pasa a estar 100% controlado por el fader hasta el próximo cambio de estado.
  const UMBRAL_TOQUE = 3 // en unidades MIDI crudas (0-127) — margen para no disparar por ruido
  let faderBase = [0, 0, 0, 0, 0, 0]      // dónde estaba físicamente cada fader al entrar al estado actual
  let faderTocado = [false, false, false, false, false, false]

  const valorParam = (idx, baseEstado, suavizado) => clamp01(faderTocado[idx] ? suavizado : baseEstado)

  const estado = () => cfg.estados[Math.max(0, estadoActual)]

  const f1 = () => valorParam(0, estado().f1, f1s)
  const f2 = () => valorParam(1, estado().f2, f2s)
  const f3 = () => valorParam(2, estado().f3, f3s)
  const f4 = () => valorParam(3, estado().f4, f4s)
  const f5 = () => valorParam(4, estado().f5, f5s)
  const f6 = () => valorParam(5, estado().f6, f6s)
  GP.zapping.f = { f1, f2, f3, f4, f5, f6 }

  GP.zapping.pixelSize = () => 600 - (f2() ** 3) * 595
  GP.zapping.escalaExtra = () => 1 + (f6() ** 3) * 40
  GP.zapping.imanIntensidad = (voz) => estado().usaIman ? voz * f5() * f5() : 0
  GP.zapping.colorAlpha = () => colorPantallaActivo ? 1 : 0
  GP.zapping.colorPantalla = () => colorPantalla
  GP.zapping.estadoNombre = () => estado().nombre || `estado ${estadoActual}`

  GP.zapping.iman = (px, py, fase) => shape(64, 0.2, 0.9)
    .scroll(() => px + 0.015 * Math.sin(time * 0.4 + fase), () => py + 0.015 * Math.cos(time * 0.3 + fase))
    .mult(noise(3, .3), 1)

  GP.zapping.rectShape = () => shape(4, 1, 0.001)
    .scale(() => rect.rw, () => rect.rh)
    .scrollX(() => rect.rx)
    .scrollY(() => rect.ry)
    .modulateScrollX(noise(3, .4).pixelate(1, 120), () => f1() * .5)

  GP.zapping.init = (config) => {
    cfg = Object.assign({ rafagaCantidad: 3, rafagaPoll: 30 }, config)
    estadoActual = -1 // todavía no arrancó ningún estado — el primer toque de pad activa el estado 1
    contadorPulsos = 0
    pasoRitmo = 0
    velocidad = 1
    faderBase = [F1, F2, F3, F4, F5, F6]
    faderTocado = [false, false, false, false, false, false]
    precargarImagenes(cfg.videos)
  }

  GP.zapping.update = () => {
    const raw = [F1, F2, F3, F4, F5, F6]
    for (let i = 0; i < 6; i++) {
      if (!faderTocado[i] && Math.abs(raw[i] - faderBase[i]) > UMBRAL_TOQUE) faderTocado[i] = true
    }

    f1s += (F1 / 127 - f1s) * SUAVIZADO
    f2s += (F2 / 127 - f2s) * SUAVIZADO
    f3s += (F3 / 127 - f3s) * SUAVIZADO
    f4s += (F4 / 127 - f4s) * SUAVIZADO
    f5s += (F5 / 127 - f5s) * SUAVIZADO
    f6s += (F6 / 127 - f6s) * SUAVIZADO

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
    rect.rx = rect.rxFin
    rect.ry = rect.ryFin
    rect.imgX = rect.imgXFin
    rect.imgY = rect.imgYFin
    barriendoActivo = false
  }

  GP.zapping.toggleBarrido = () => { ATAQUE_ACTIVO = !ATAQUE_ACTIVO }

  // duracionTicks: cuántos pulsos de clock dura el paso que disparó este recuadro
  // (negra = referencia 1x). Determina qué tan lejos y qué tan lento entra el barrido.
  GP.zapping.disparar = (nota = 60, duracionTicks = FIGURAS.negra) => {
    if (rect.cargando) return
    rect.cargando = true
    rect.sueltaPendiente = false

    const aplicar = (img) => {
      cfg.fuente.src = img
      cfg.fuente.dynamic = true

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
        rect.rx = rect.rxIni
        rect.ry = rect.ryIni
        ataqueInicio = time
        ataqueDur = ATAQUE_MAX * factor
        barriendoActivo = true
      } else {
        rect.rx = rect.rxFin
        rect.ry = rect.ryFin
        rect.imgX = rect.imgXFin
        rect.imgY = rect.imgYFin
        barriendoActivo = false
      }
      rect.cargando = false
    }

    const i = Math.floor(Math.random() * cfg.videos.length)
    const precargada = imagenesPrecargadas[i]

    if (precargada && precargada.complete && precargada.naturalWidth > 0) {
      aplicar(precargada)  // ya está en memoria — cambio instantáneo, sin jitter de carga
      return
    }

    // todavía no terminó de precargar (recién arrancó el sketch) o falló: cargar ahora como respaldo
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
    estadoActual = Math.min(estadoActual + 1, cfg.estados.length - 1) // ya no da la vuelta con %
    const e = estado()
    colorPantallaActivo = e.usaColorPantalla
    if (colorPantallaActivo) colorPantalla = [Math.random(), Math.random(), Math.random()]
    ATAQUE_ACTIVO = e.usaBarrido
    contadorPulsos = 0
    pasoRitmo = 0
    faderBase = [F1, F2, F3, F4, F5, F6]                        // dónde está cada fader AHORA (para detectar movimiento)
    faderTocado = [false, false, false, false, false, false]   // vuelve a usar los valores curados del estado
    GP.zapping.rafaga(60)
    return estadoActual
  }

  // llamado en cada pulso de clock real (0xF8) del padKONTROL
  GP.zapping.pulso = () => {
    if (estadoActual < 0) return // todavía no arrancó el primer estado
    const patron = estado().ritmo || 'X...'
    const resolucion = FIGURAS[estado().resolucion] || FIGURAS.semicorchea

    contadorPulsos++
    if (contadorPulsos >= resolucion) {
      contadorPulsos = 0
      const paso = patron[pasoRitmo % patron.length]
      pasoRitmo = (pasoRitmo + 1) % patron.length
      if (paso === 'X' || paso === 'x') GP.zapping.disparar(60, resolucion)
    }
  }
})()