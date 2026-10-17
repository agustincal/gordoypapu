// ============================================================
// GP_02_Buscando_Placer__visual.js  ·  LIVE/arq/
// Canción: 02_Buscando_Placer (Gordo y Papu) · Fase 3
// Rol: motor visual — recuadros con imágenes/videos que se disparan con las
//      notas, barrido de entrada, aparición con zoom, imán con la voz,
//      mala señal de TV
// Lo carga el sketch (LIVE/sketches/02_Buscando_Placer_vXX.js); el sketch llama GP.buscandoPlacer.*
// Actualizado: 16/10/2026 (v3.0: versión LIVE — los estados, el takeover de
//              faders y el ruteo MIDI salen del motor; sin grilla de ritmo
//              ni multiplicador de velocidad)
// ============================================================
//
// Todo lo ajustable vive en GP.buscandoPlacer.C. Ahí escriben:
//   - el sketch, con V.init({ ... })            (la base de la canción)
//   - GP_estados, al cambiar de estado          (lo que anota cada estado)
//   - los faders y toggles, a través de GP_estados
//   - vos, en vivo:  V.C.colorBase = 0.3  + Ctrl+Enter
//
// El sketch llama:
//   GP.buscandoPlacer.init(config)                       una vez por evaluación
//   GP.buscandoPlacer.medios({ urls, modo, fuente, aspecto })   imágenes o videos (precarga)
//   GP.buscandoPlacer.update()                           dentro de update = () => {...}
//   GP.buscandoPlacer.salida(o0, o1)                     para dibujar (después render(o1))
//   GP.buscandoPlacer.disparar()                         un recuadro nuevo
//   GP.buscandoPlacer.soltar()                           corta el barrido (al soltar la nota)
//   GP.buscandoPlacer.rafaga()                           varios recuadros seguidos (ej: al cambiar de estado)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v3.0'

  if (GP.buscandoPlacer && GP.buscandoPlacer._version === VERSION) return
  GP.buscandoPlacer = { _version: VERSION }
  const V = GP.buscandoPlacer

  const clamp01 = v => Math.max(0, Math.min(1, v))

  // ---- valores por defecto (V.init vuelve a estos y aplica la config del sketch) ----
  // Faders: de 0 a 1.
  const DEFAULTS = {
    // faders
    jitter: 0,          // F1: distorsión / temblor del recuadro
    pixelado: 0,        // F2: pixelado (fuerte: usarlo poco)
    marco: 0,           // F3: tamaño del marco del recuadro
    tinte: 0,           // F4: cuánto tiñe el color de la paleta
    iman: 0,            // F5: imán (sólo con usaIman y voz en el mic)
    zoom: 0,            // F6: zoom del contenido adentro del marco
    malaSenal: 0,       // F7: mala señal de TV (banda + scroll + línea de costura)
    // toggles
    usaBarrido: false,  // N11: el recuadro entra barriendo desde afuera
    usaIman: true,      // N12: la voz deforma la imagen con el imán
    siguenRitmo: false, // N13: jitter y mala señal laten con los disparos (en vez de quedar parejos)
    // color
    colorBase: 0,       // 0 a 1 = un color de la rueda; cada recuadro toma uno de su tríada
    // recuadros
    rafagaCantidad: 3,  // recuadros de la ráfaga al cambiar de estado
    rafagaPausa: 30,    // ms entre recuadros de la ráfaga
    apareceDur: 0.45,   // segundos del zoom de aparición
    barridoDur: 0.6,    // segundos que tarda en entrar barriendo
    barridoDist: 1.3,   // desde qué tan lejos entra
    // micrófono (imán)
    micPiso: 0.5,       // por debajo de esto el mic no hace nada (0 a 1)
    mostrarMic: true,   // barras del mic en pantalla
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS

  // ============================================================
  // Imágenes / videos
  // ============================================================
  const medios = { urls: [], modo: 'imagen', fuente: null, aspecto: 1, ajuste: 1, precargados: [], activo: null }

  const crearMedio = (url, modo) => {
    if (modo === 'video') {
      const vid = document.createElement('video')
      vid.crossOrigin = 'anonymous'
      vid.muted = true
      vid.loop = true
      vid.playsInline = true
      vid.preload = 'auto'
      vid.src = url
      vid.load()
      return vid
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    return img
  }
  const liberar = () => {
    medios.precargados.forEach(m => {
      if (m && m.tagName === 'VIDEO') { m.pause(); m.removeAttribute('src'); m.load() }
    })
    medios.activo = null
  }
  const listo = (m) => medios.modo === 'video'
    ? !!m && m.readyState >= 3
    : !!m && m.complete && m.naturalWidth > 0

  // { urls, modo: 'imagen' | 'video', fuente: s1, aspecto: alto/ancho del material, ajuste }
  // Sólo vuelve a precargar si cambió la lista (reevaluar no recarga todo).
  V.medios = (op = {}) => {
    const urls = op.urls || []
    const modo = op.modo || 'imagen'
    const cambio = modo !== medios.modo || urls.join('|') !== medios.urls.join('|')
    Object.assign(medios, { fuente: op.fuente || medios.fuente, aspecto: op.aspecto ?? 1, ajuste: op.ajuste ?? 1 })
    if (!cambio && medios.precargados.length) return V
    liberar()
    medios.urls = urls.slice()
    medios.modo = modo
    medios.precargados = urls.map(u => crearMedio(u, modo))
    if (medios.fuente && urls.length) {
      if (modo === 'video') medios.fuente.initVideo(urls[0])
      else medios.fuente.initImage(urls[0])
    }
    return V
  }

  // ============================================================
  // Recuadro
  // ============================================================
  const rect = {
    rx: 0, ry: 0, rw: 1, rh: 1,
    rxIni: 0, ryIni: 0, rxFin: 0, ryFin: 0,
    imgScale: 1, imgX: 0, imgY: 0, imgXFin: 0, imgYFin: 0,
    tinteR: 1, tinteG: 1, tinteB: 1,
    escalaAparicion: 1,
    cargando: false, sueltaPendiente: false,
  }
  V.rect = rect

  let barriendo = false, barridoInicio = 0
  let apareciendo = false, apareceInicio = 0

  // latido: cuánto pasó desde el último recuadro, en relación al tiempo entre los dos últimos
  let tUltimoDisparo = 0, intervaloDisparos = 0
  const latido = () => {
    if (!intervaloDisparos) return 1
    return clamp01((performance.now() - tUltimoDisparo) / intervaloDisparos)
  }
  const segunRitmo = () => (C.siguenRitmo ? latido() : 1)

  const hslToRgb = (h, s, l) => {
    const k = n => (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return [f(0), f(8), f(4)]
  }
  const triadica = (hue, s = 0.8, l = 0.55) => [0, 1 / 3, 2 / 3].map(o => hslToRgb((hue + o) % 1, s, l))

  V.disparar = () => {
    if (rect.cargando || !medios.urls.length) return
    rect.cargando = true
    rect.sueltaPendiente = false

    const ahora = performance.now()
    if (tUltimoDisparo) {
      const dt = ahora - tUltimoDisparo
      if (dt > 60 && dt < 3000) intervaloDisparos = dt
    }
    tUltimoDisparo = ahora

    const aplicar = (m) => {
      if (medios.modo === 'video') {
        if (medios.activo && medios.activo !== m) medios.activo.pause()
        try { m.currentTime = 0 } catch (e) {}
        m.play().catch(() => {})
        medios.activo = m
      }
      if (medios.fuente) { medios.fuente.src = m; medios.fuente.dynamic = true }

      const paleta = triadica(((C.colorBase % 1) + 1) % 1)
      const color = paleta[Math.floor(Math.random() * paleta.length)]
      rect.tinteR = color[0]; rect.tinteG = color[1]; rect.tinteB = color[2]

      const rango = 0.15 + C.marco * 2
      rect.rw = 0.3 + Math.random() * rango
      rect.rh = 0.3 + Math.random() * rango
      rect.rxFin = (Math.random() - 0.5) * 0.7
      rect.ryFin = (Math.random() - 0.5) * 0.7
      rect.imgScale = (0.75 + Math.random() * 0.25) * (1 + C.marco)
      rect.imgXFin = (Math.random() - 0.5) * 0.2
      rect.imgYFin = (Math.random() - 0.5) * 0.2

      if (C.usaBarrido && !rect.sueltaPendiente) {
        const angulo = Math.random() * Math.PI * 2
        rect.rxIni = rect.rxFin + Math.cos(angulo) * C.barridoDist
        rect.ryIni = rect.ryFin + Math.sin(angulo) * C.barridoDist
        rect.rx = rect.rxIni; rect.ry = rect.ryIni
        barridoInicio = time
        barriendo = true
      } else {
        rect.rx = rect.rxFin; rect.ry = rect.ryFin
        rect.imgX = rect.imgXFin; rect.imgY = rect.imgYFin
        barriendo = false
      }

      apareceInicio = time
      apareciendo = true
      rect.escalaAparicion = 0
      rect.cargando = false
    }

    const i = Math.floor(Math.random() * medios.urls.length)
    const pre = medios.precargados[i]
    if (listo(pre)) { aplicar(pre); return }
    const m = crearMedio(medios.urls[i], medios.modo)
    const espera = setTimeout(() => { rect.cargando = false }, 4000)
    m.addEventListener('error', () => { clearTimeout(espera); rect.cargando = false }, { once: true })
    m.addEventListener(medios.modo === 'video' ? 'loadeddata' : 'load', () => { clearTimeout(espera); aplicar(m) }, { once: true })
  }

  // al soltar la nota: si estaba barriendo, el recuadro cae en su lugar
  V.soltar = () => {
    rect.sueltaPendiente = true
    if (!barriendo) return
    rect.rx = rect.rxFin; rect.ry = rect.ryFin
    rect.imgX = rect.imgXFin; rect.imgY = rect.imgYFin
    barriendo = false
  }

  V.rafaga = (cantidad = C.rafagaCantidad) => {
    let hechos = 0
    const intentar = () => {
      if (hechos >= cantidad) return
      if (rect.cargando) { setTimeout(intentar, C.rafagaPausa); return }
      V.disparar()
      hechos++
      setTimeout(intentar, C.rafagaPausa)
    }
    intentar()
  }

  // ============================================================
  // Cada cuadro
  // ============================================================
  V.update = () => {
    if (apareciendo) {
      const t = Math.min(1, (time - apareceInicio) / C.apareceDur)
      rect.escalaAparicion = 1 - Math.pow(1 - t, 3)
      if (t >= 1) apareciendo = false
    }
    if (!barriendo) return
    const t = Math.min(1, (time - barridoInicio) / C.barridoDur)
    const e = 1 - Math.pow(1 - t, 3)
    rect.rx = rect.rxIni + (rect.rxFin - rect.rxIni) * e
    rect.ry = rect.ryIni + (rect.ryFin - rect.ryIni) * e
    rect.imgX = rect.imgXFin + (rect.rx - rect.rxFin)
    rect.imgY = rect.imgYFin + (rect.ry - rect.ryFin)
    if (t >= 1) barriendo = false
  }

  // ============================================================
  // Visual
  // ============================================================
  const voz = () => {
    const v = Math.min(1, a.fft[0] || 0)
    return v < C.micPiso ? 0 : (v - C.micPiso) / (1 - C.micPiso)
  }

  const pixelSize = () => 600 - Math.pow(C.pixelado, 3) * 595
  const escalaExtra = () => 1 + Math.pow(C.zoom, 3) * 40 * rect.escalaAparicion
  const imanFuerza = () => (C.usaIman ? voz() * C.iman * C.iman : 0)

  const iman = () => shape(64, 0.2, 0.9)
    .scroll(() => 0.015 * Math.sin(time * 0.4), () => 0.015 * Math.cos(time * 0.3))
    .mult(noise(3, 0.3), 1)

  const recuadro = () => shape(4, 1, 0.001)
    .scale(() => rect.rw, () => rect.rh)
    .scrollX(() => rect.rx)
    .scrollY(() => rect.ry)
    .modulateScrollX(noise(3, 0.4).pixelate(1, 120), () => C.jitter * 0.5 * segunRitmo())

  // mala señal (F7)
  const lineaMalaSenal = () => solid(0, 0, 0)
    .mask(shape(4, 1, 0).scale(0.015, 0.2, 200))
    .scrollX(-0.5)
    .mult(solid(1, 1, 1), () => (C.malaSenal > 0.02 ? 1 : 0))

  // out = donde se acumulan los recuadros (o0) · final = con la mala señal encima (o1)
  V.salida = (out = o0, final = o1) => {
    src(out)
      .layer(
        src(medios.fuente)
          .scale(
            () => rect.imgScale * escalaExtra(),
            () => (rect.imgScale / ((width / height) / medios.aspecto) * medios.ajuste) * escalaExtra()
          )
          .scrollX(() => rect.imgX)
          .scrollY(() => rect.imgY)
          .pixelate(pixelSize, pixelSize)
          .modulateScrollX(noise(3, 0.1).pixelate(1, 120), () => C.jitter * 2)
          .mult(solid(() => rect.tinteR, () => rect.tinteG, () => rect.tinteB), () => C.tinte)
          .mask(recuadro())
      )
      .modulate(iman(), imanFuerza)
      .out(out)

    src(out)
      .layer(lineaMalaSenal())
      .modulateScrollX(noise(30, 10).pixelate(1, 100), () => C.malaSenal * 0.06 * segunRitmo())
      .scroll(() => 0.01 * C.malaSenal, 0, () => 0.1 * C.malaSenal * segunRitmo())
      .out(final)
  }

  // ---- init: valores por defecto + config del sketch ----
  V.init = (config = {}) => {
    // vuelve a los valores por defecto antes de aplicar la config: así un valor
    // que dejó un estado (o un ajuste a mano) no queda pegado al reevaluar
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)

    a.setBins(4)
    a.setSmooth(0.85)
    a.setScale(8)
    a.setCutoff(0.1)
    if (C.mostrarMic) a.show()
    else a.hide()
    return V
  }

  console.log('[GP] visual Buscando Placer ' + VERSION + ' (LIVE) cargado')
})()
