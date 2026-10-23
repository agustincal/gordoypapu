// ============================================================
// GP_02_Buscando_Placer__visual_v4.js  ·  LIVE/arq/
// Canción: 02_Buscando_Placer (Gordo y Papu) · Fase 3
// Rol: motor visual — recuadros con imágenes/videos que se disparan con las
//      notas, barrido de entrada, aparición con zoom, imán con la voz,
//      mala señal de TV, versiones por fader, invertir (canal 2), color (canal 9),
//      feedback sobre el collage (F8)
// Lo carga LIVE/sketches/02_Buscando_Placer_v04.js. Los sketches LIVE v01 y v02 siguen con
// LIVE/arq/GP_02_Buscando_Placer__visual.js (v3.0), que no se tocó.
// Copia de trabajo: produccion/02_Buscando_Placer/arq/GP_02_Buscando_Placer__visual.js (v3.3).
// Actualizado: 23/10/2026 (v4.0: pasa a LIVE — mismo código que produccion v3.3)
//              23/10/2026 (v3.3: F3 V2 = mosaico — el fader elige cuántas caras: 0 nada · 2 espejo … 6 hexágono)
//              23/10/2026 (v3.2: el imán es sólo el fader F7, siempre activo — sin el toggle usaIman / N12)
//              23/10/2026 (v3.1: versiones por fader con los botones 64-71, tomadas de los
//              efectos de Perdido · curva pareja de pixelado · invertir con el canal 2 / fila 6 ·
//              color con el canal 9 / fila 5 · F8 feedback · recompila al cambiar de versión)
//              16/10/2026 (v3.0: versión LIVE — los estados, el takeover de faders y el ruteo
//              MIDI salen del motor; sin grilla de ritmo ni multiplicador de velocidad)
// ============================================================
//
// Todo lo ajustable vive en GP.buscandoPlacer.C. Ahí escriben:
//   - el sketch, con V.init({ ... })            (la base de la canción)
//   - GP_estados, al cambiar de estado          (lo que anota cada estado)
//   - los faders, toggles y botones de versión, a través de GP_estados
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
//   GP.buscandoPlacer.invertir(on, origen)               canal 2 (golpe) o pad a mano (mientras lo apretás)
//   GP.buscandoPlacer.color9(columna)                    canal 9 o pad a mano: gira el color de toda la imagen
//
// Versiones (0 = V1, 1 = V2, 2 = V3). V1 es siempre el efecto de la v3.0
// (salvo el pixelado, que tiene la curva nueva):
//   verJitter     0 temblor · 1 rasgado (con cada recuadro) · 2 franjas
//   verPixelado   0 pixelado · 1 bloques (con cada recuadro) · 2 poster
//   verMarco      0 marco del recuadro · 1 + mosaico en toda la pantalla (fader: 0 nada → 1 hexágono)
//   verTinte      0 tríada · 1 tono · 2 canales (RGB corrido)
//   verMalaSenal  0 banda + costura · 1 vhs · 2 rueda (rolling vertical)
//   verFeedback   0 túnel · 1 giro · 2 sandin (cambia de color)
// Cambiar de versión recompila la cadena de Hydra (puede haber un salto chico).
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v4.0'

  if (GP.buscandoPlacer && GP.buscandoPlacer._version === VERSION) return
  GP.buscandoPlacer = { _version: VERSION }
  const V = GP.buscandoPlacer

  const clamp01 = v => Math.max(0, Math.min(1, v))
  const PI = Math.PI

  // ---- valores por defecto (V.init vuelve a estos y aplica la config del sketch) ----
  // Faders: de 0 a 1. Los números de fader son los del sketch v04.
  const DEFAULTS = {
    // faders
    jitter: 0,          // F1: distorsión / temblor del recuadro
    pixelado: 0,        // F2: pixelado (fuerte: usarlo poco)
    marco: 0,           // F3: tamaño del marco del recuadro (en V2, además, mosaico)
    tinte: 0,           // F4: cuánto tiñe el color de la paleta
    malaSenal: 0,       // F5: mala señal de TV
    zoom: 0,            // F6: zoom del contenido adentro del marco
    iman: 0,            // F7: imán con la voz del mic (siempre activo: en 0 no hace nada)
    feedback: 0,        // F8: feedback sobre el collage (0 = nada)
    // versiones (botones 64-71, a través de GP_estados)
    verJitter: 0,
    verPixelado: 0,
    verMarco: 0,
    verTinte: 0,
    verMalaSenal: 0,
    verFeedback: 0,
    // toggles
    usaBarrido: false,  // N11: el recuadro entra barriendo desde afuera
    siguenRitmo: false, // N13: jitter y mala señal laten con los disparos (en vez de quedar parejos)
    // color
    colorBase: 0,       // 0 a 1 = un color de la rueda; cada recuadro toma uno de su tríada
    // recuadros
    rafagaCantidad: 3,  // recuadros de la ráfaga al cambiar de estado
    rafagaPausa: 30,    // ms entre recuadros de la ráfaga
    apareceDur: 0.45,   // segundos del zoom de aparición
    barridoDur: 0.6,    // segundos que tarda en entrar barriendo
    barridoDist: 1.3,   // desde qué tan lejos entra
    // golpe de cada recuadro (lo usan rasgado, franjas, bloques, tono, canales, vhs, rueda)
    golpeCaida: 0.3,    // segundos que tarda en apagarse
    // pixelado: cuántos bloques hay con el fader abajo y arriba (curva pareja entre los dos)
    pixelMax: 600,
    pixelMin: 12,
    // invertir (canal 2 / fila 6)
    invertir: 1,        // cuánto invierte (0 a 1)
    invertirCaida: 0.25,// segundos que tarda en volver después de cada nota (o al soltar el pad)
    // color con el canal 9 / fila 5
    color9: 0.6,        // cuánto gira el color (1 = media vuelta entre el primer pad y el último)
    color9Vel: 0.15,    // segundos para llegar al color de cada nota
    color9Suelta: 1.5,  // segundos sin notas para que el color vuelva al original
    // micrófono (imán)
    micPiso: 0.5,       // por debajo de esto el mic no hace nada (0 a 1)
    mostrarMic: true,   // barras del mic en pantalla
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS

  // cuántas versiones tiene cada efecto (el sketch las declara igual en GP.midi.versiones)
  const CUANTAS = { verJitter: 3, verPixelado: 3, verMarco: 2, verTinte: 3, verMalaSenal: 3, verFeedback: 3 }
  V.CUANTAS = CUANTAS
  const ver = k => {
    const n = CUANTAS[k]
    const v = Math.round(Number(C[k]) || 0)
    return ((v % n) + n) % n
  }

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

  // golpe: salta a 1 con cada recuadro y se apaga solo (más un azar por golpe, como en Perdido)
  const golpe = { t: -1e9, r: 0.5, s: 1 }
  const g = () => {
    const dt = (performance.now() - golpe.t) / 1000
    return dt < 0 ? 0 : Math.exp(-dt / Math.max(0.01, C.golpeCaida))
  }
  V.golpe = g

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

      golpe.t = performance.now()
      golpe.r = Math.random()
      golpe.s = Math.random() * 2 - 1

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
  // Invertir (canal 2 / fila 6)
  //   nota del canal → un golpe de invertido que vuelve en invertirCaida
  //   pad a mano     → invertido mientras lo apretás; al soltar vuelve igual que un golpe
  // ============================================================
  const inv = { mano: new Set(), t: -1e9 }
  V.invertir = (on, origen = 'canal', columna = 0) => {
    const ahora = performance.now()
    if (origen === 'akai') {
      if (on) inv.mano.add(columna)
      else { inv.mano.delete(columna); if (!inv.mano.size) inv.t = ahora }
    } else if (on) inv.t = ahora
  }
  const invNivel = () => {
    if (inv.mano.size) return 1
    const dt = (performance.now() - inv.t) / 1000
    return dt < 0 ? 0 : clamp01(1 - dt / Math.max(0.01, C.invertirCaida))
  }

  // ============================================================
  // Color con el canal 9 / fila 5: cada pad (columna 0..7) es un color
  // ============================================================
  const col9 = { objetivo: 0, actual: 0, ult: -1e9 }
  V.color9 = (columna) => {
    col9.objetivo = (Number(columna) || 0) / 7 * 0.5
    col9.ult = performance.now()
  }

  // ============================================================
  // Cada cuadro
  // ============================================================
  let tPrev = performance.now()
  let rueda = 0
  let salidaArgs = null, firmaArmada = ''

  V.update = () => {
    const ahora = performance.now()
    const dt = Math.min(0.1, Math.max(0, (ahora - tPrev) / 1000))
    tPrev = ahora

    // color del canal 9: llega suave a cada nota y vuelve cuando deja de sonar
    if (ahora - col9.ult > C.color9Suelta * 1000) col9.objetivo = 0
    col9.actual += (col9.objetivo - col9.actual) * (1 - Math.exp(-dt / Math.max(0.01, C.color9Vel)))

    // rueda (mala señal V3): avanza con el fader; con el fader abajo vuelve a la vuelta entera más cercana
    if (ver('verMalaSenal') === 2 && C.malaSenal > 0.02) rueda += dt * C.malaSenal * 0.6 * segunRitmo()
    else rueda += (Math.round(rueda) - rueda) * (1 - Math.exp(-dt / 0.3))

    // cambió una versión → recompilar
    if (salidaArgs && firma() !== firmaArmada) armar()

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

  // pixelado: curva pareja (cada tramo del fader multiplica igual) entre pixelMax y pixelMin bloques
  const pixV1 = () => C.pixelMax * Math.pow(C.pixelMin / C.pixelMax, clamp01(C.pixelado))
  const pixBloques = () => {
    const base = pixV1()
    const destino = 6 + golpe.r * 34
    return base + (destino - base) * g() * Math.min(1, C.pixelado * 2)
  }
  const escalaExtra = () => 1 + Math.pow(C.zoom, 3) * 40 * rect.escalaAparicion
  const imanFuerza = () => voz() * C.iman * C.iman

  const iman = () => shape(64, 0.2, 0.9)
    .scroll(() => 0.015 * Math.sin(time * 0.4), () => 0.015 * Math.cos(time * 0.3))
    .mult(noise(3, 0.3), 1)

  const recuadro = (conJitter) => {
    const r = shape(4, 1, 0.001)
      .scale(() => rect.rw, () => rect.rh)
      .scrollX(() => rect.rx)
      .scrollY(() => rect.ry)
    return conJitter ? r.modulateScrollX(noise(3, 0.4).pixelate(1, 120), () => C.jitter * 0.5 * segunRitmo()) : r
  }

  // mala señal V1
  const lineaMalaSenal = () => solid(0, 0, 0)
    .mask(shape(4, 1, 0).scale(0.015, 0.2, 200))
    .scrollX(-0.5)
    .mult(solid(1, 1, 1), () => (C.malaSenal > 0.02 ? 1 : 0))
  const ms = () => C.malaSenal * segunRitmo()

  // F8: el cuadro anterior del collage, transformado (con feedback en 0 queda igual)
  const baseFeedback = (out, v) => {
    const f = () => C.feedback
    if (v === 1) return src(out).scale(() => 1 + 0.01 * f()).rotate(() => 0.03 * f())
    if (v === 2) return src(out).scale(() => 1 + 0.015 * f()).hue(() => 0.04 * f())
    return src(out).scale(() => 1 + 0.04 * f())
  }

  // F3 V2, mosaico: con el fader en 0 no hace nada; al subir, 2 caras (espejo), 3, 4, 5 y arriba 6 (hexágono)
  const mosaicoLados = () => 2 + Math.round(clamp01(C.marco) * 4)
  const mosaicoMezcla = () => clamp01(C.marco / 0.05)

  const firma = () => Object.keys(CUANTAS).map(ver).join('')

  const armar = () => {
    const [out, final] = salidaArgs
    const vJ = ver('verJitter'), vP = ver('verPixelado'), vM = ver('verMarco')
    const vT = ver('verTinte'), vS = ver('verMalaSenal'), vF = ver('verFeedback')
    firmaArmada = firma()

    // --- 1. el recuadro nuevo sobre el collage (o0) ---
    let img = src(medios.fuente)
      .scale(
        () => rect.imgScale * escalaExtra(),
        () => (rect.imgScale / ((width / height) / medios.aspecto) * medios.ajuste) * escalaExtra()
      )
      .scrollX(() => rect.imgX)
      .scrollY(() => rect.imgY)

    // F2 pixelado
    if (vP === 1) img = img.pixelate(pixBloques, pixBloques)
    else if (vP === 2) img = img.posterize(() => 2 + (1 - C.pixelado) * 14, 0.6)
    else img = img.pixelate(pixV1, pixV1)

    // F1 jitter
    if (vJ === 1) img = img.modulateScrollX(
      osc(() => 8 + golpe.r * 40, 0, 0).rotate(PI / 2).thresh(0.6, 0.01),
      () => C.jitter * (0.05 + 0.4 * g()) * golpe.s)
    else if (vJ === 2) img = img.modulateScrollX(
      osc(() => 6 + Math.floor(golpe.r * 24), 0, 0).rotate(PI / 2).thresh(0.5, 0.01),
      () => C.jitter * (0.2 + 0.2 * g() * golpe.s))
    else img = img.modulateScrollX(noise(3, 0.1).pixelate(1, 120), () => C.jitter * 2)

    // F4 tinte
    if (vT === 1) img = img.hue(() => C.tinte * (0.5 + 0.5 * Math.sin(time * 0.2)) + g() * 0.25 * C.tinte)
    else if (vT === 2) img = img.shift(() => C.tinte * 0.4, () => C.tinte * 0.2 * golpe.s, () => g() * 0.3 * C.tinte, 0)
    else img = img.mult(solid(() => rect.tinteR, () => rect.tinteG, () => rect.tinteB), () => C.tinte)

    baseFeedback(out, vF)
      .layer(img.mask(recuadro(vJ === 0)))
      .modulate(iman(), imanFuerza)
      .out(out)

    // --- 2. salida final (o1): mosaico, mala señal, color del canal 9, invertir ---
    let fin = vM === 1
      ? src(out).blend(src(out).kaleid(mosaicoLados).rotate(() => time * 0.03), mosaicoMezcla)
      : src(out)

    // F5 mala señal
    if (vS === 1) fin = fin
      .modulateScrollX(noise(() => 30 + golpe.r * 30, 0.5), () => ms() * 0.015 + g() * 0.05 * C.malaSenal)
      .mult(osc(300, 0, 0).rotate(PI / 2), () => ms() * 0.6)
      .saturate(() => 1 + ms() * 0.5)
    else if (vS === 2) fin = fin
      .scrollY(() => rueda % 1)
      .modulateScrollX(noise(30, 10).pixelate(1, 100), () => g() * 0.03 * C.malaSenal)
    else fin = fin
      .layer(lineaMalaSenal())
      .modulateScrollX(noise(30, 10).pixelate(1, 100), () => ms() * 0.06)
      .scroll(() => 0.01 * C.malaSenal, 0, () => 0.1 * ms())

    fin
      .hue(() => col9.actual * C.color9)
      .invert(() => invNivel() * C.invertir)
      .out(final)
  }

  // out = donde se acumulan los recuadros (o0) · final = lo que se ve (o1)
  V.salida = (out = o0, final = o1) => {
    salidaArgs = [out, final]
    armar()
    return V
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
