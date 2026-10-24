// ============================================================
// GP_02_Buscando_Placer__visual.js  ·  produccion/02_Buscando_Placer/arq/
// Canción: 02_Buscando_Placer (Gordo y Papu) · Fase 3 · COPIA DE TRABAJO
// Rol: motor visual — recuadros con imágenes/videos que se disparan con las
//      notas, barrido de entrada, aparición con zoom, imán con la voz,
//      mala señal de TV, versiones por fader, tirón de glitch (canal 2), color (canal 9),
//      feedback sobre el collage (F8)
// Lo carga el sketch de producción (produccion/02_Buscando_Placer/sketches/02_Buscando_Placer_v04.js).
// LIVE sigue con su motor v3.0 (LIVE/arq): esta copia pasa a LIVE cuando esté aprobada.
// Actualizado: 24/10/2026 (v3.7: F5 ajustes — V1 saltos de toda la pantalla en X, más seguidos cuanto más
//              fader (reemplaza al scroll continuo, que saltaba al mover el fader) · V2 ondas que bajan
//              constantes, desparejas, con bandas más finas · V3 rueda a la mitad de velocidad y ondulación
//              quieta que baja despacio, al revés de la rueda)
//              24/10/2026 (v3.6: F5 rehecho con referencias — vhs: colores corridos, ondas horizontales,
//              líneas de barrido y franja de tracking · rueda: además de rodar, interferencia con líneas
//              rasgadas en franjas, ondulación y nieve)
//              24/10/2026 (v3.5: el canal 2 / fila 6 da un tirón de glitch en toda la pantalla (reemplaza
//              al invertir) · la mala señal (vhs y rueda) ya no reacciona a los disparos del bajo)
//              24/10/2026 (v3.4: duración por nota, idea de Fluorescente — la aparición sigue a la nota
//              sostenida y termina según el ritmo · barrido según el ritmo · F6 con versiones de aparición
//              (zoom / abre / tele) · el golpe dura mientras suena la nota · F8 frena en silencio)
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
//   GP.buscandoPlacer.disparar(clave)                    un recuadro nuevo (clave = la nota o el pad que lo disparó)
//   GP.buscandoPlacer.soltar(clave)                      se soltó esa nota: termina la aparición y corta el barrido
//                                                        (sin clave: como antes, no espera a la nota)
//   GP.buscandoPlacer.rafaga()                           varios recuadros seguidos (ej: al cambiar de estado)
//   GP.buscandoPlacer.tiron(on, clave)                   canal 2 o pad a mano: tirón de glitch (mientras suena + caída)
//   GP.buscandoPlacer.color9(columna)                    canal 9 o pad a mano: gira el color de toda la imagen
//
// Versiones (0 = V1, 1 = V2, 2 = V3). V1 es siempre el efecto de la v3.0
// (salvo el pixelado, que tiene la curva nueva):
//   verJitter     0 temblor · 1 rasgado (con cada recuadro) · 2 franjas
//   verPixelado   0 pixelado · 1 bloques (con cada recuadro) · 2 poster
//   verMarco      0 marco del recuadro · 1 + mosaico en toda la pantalla (fader: 0 nada → 1 hexágono)
//   verTinte      0 tríada · 1 tono · 2 canales (RGB corrido)
//   verMalaSenal  0 saltos + banda + costura · 1 vhs (colores corridos, ondas, tracking) · 2 rueda (rueda + interferencia)
//   verFeedback   0 túnel · 1 giro · 2 sandin (cambia de color)
//   verAparicion  0 zoom del contenido (F6) · 1 el marco se abre · 2 se abre desde una línea, como una tele
//
// Duración por nota (como en Fluorescente):
//   - la aparición avanza lenta mientras la nota del recuadro se sostiene (se abre del todo en
//     aparicionLarga s); al soltar, termina en aparicionRitmo × el tiempo entre disparos
//   - el barrido dura barridoRitmo × el tiempo entre disparos (como mucho barridoDur)
//   - el golpe queda arriba mientras suena la nota y se apaga al soltarla
//   - en silencio (sin notas durante `silencio` s) el feedback de F8 frena en caidaSilencio s
// Cambiar de versión recompila la cadena de Hydra (puede haber un salto chico).
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v3.7'

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
    zoom: 0,            // F6: zoom del contenido adentro del marco (en V1 crece con la aparición)
    iman: 0,            // F7: imán con la voz del mic (siempre activo: en 0 no hace nada)
    feedback: 0,        // F8: feedback sobre el collage (0 = nada)
    // versiones (botones 64-71, a través de GP_estados)
    verJitter: 0,
    verPixelado: 0,
    verMarco: 0,
    verTinte: 0,
    verMalaSenal: 0,
    verFeedback: 0,
    verAparicion: 0,
    // toggles
    usaBarrido: false,  // N11: el recuadro entra barriendo desde afuera
    siguenRitmo: false, // N13: jitter y mala señal laten con los disparos (en vez de quedar parejos)
    // color
    colorBase: 0,       // 0 a 1 = un color de la rueda; cada recuadro toma uno de su tríada
    // recuadros
    rafagaCantidad: 3,  // recuadros de la ráfaga al cambiar de estado
    rafagaPausa: 30,    // ms entre recuadros de la ráfaga
    // duración por nota
    aparicionLarga: 1.8, // segundos que tarda en abrirse del todo mientras la nota se sostiene
    aparicionRitmo: 0.25, // al soltar, la aparición termina en esta fracción del tiempo entre disparos
    aparicionMin: 0.06,  // límites (s) de ese final
    aparicionMax: 1,
    maxSostenida: 8,     // segundos: una nota sostenida más que esto se da por suelta
    barridoRitmo: 0.8,   // el barrido dura esta fracción del tiempo entre disparos…
    barridoDur: 0.6,     // …y como mucho esto (segundos)
    silencio: 0.6,       // segundos sin notas para considerar silencio
    caidaSilencio: 1.5,  // segundos que tarda el feedback (F8) en frenar en silencio
    barridoDist: 1.3,   // desde qué tan lejos entra
    // golpe de cada recuadro (lo usan rasgado, franjas, bloques, tono, canales, vhs, rueda)
    golpeCaida: 0.3,    // segundos que tarda en apagarse después de soltar la nota
    // pixelado: cuántos bloques hay con el fader abajo y arriba (curva pareja entre los dos)
    pixelMax: 600,
    pixelMin: 12,
    // tirón de glitch (canal 2 / fila 6): bandas de ruido que corren las líneas de toda la pantalla
    tiron: 0.02,        // fuerza (anda en cualquier versión de F5, aunque el fader esté en 0)
    tironCaida: 0.3,    // segundos que tarda en apagarse después de soltar la nota (o el pad)
    // mala señal F5
    saltosMin: 0.7,     // V1: saltos por segundo con el fader apenas arriba…
    saltosMax: 12,      // …y con el fader al máximo
    saltoMin: 0.8,      // V1: tamaño de cada salto, en anchos de canvas (0.8 a 1.5 ≈ 1500 a 2800 px)
    saltoMax: 1.5,
    saltoMuerto: 0.07,  // V1: se descartan los saltos a menos de esto de 1 (darían la vuelta sin notarse)
    vhsBaja: 0.2,       // V2: velocidad con que bajan las ondas (fracción de pantalla por segundo)
    ruedaVel: 0.3,      // V3: vueltas por segundo de la rueda con el fader al máximo
    ruedaOndaBaja: 0.04, // V3: velocidad con que baja la ondulación (lenta, al revés de la rueda)
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
  const CUANTAS = { verJitter: 3, verPixelado: 3, verMarco: 2, verTinte: 3, verMalaSenal: 3, verFeedback: 3, verAparicion: 3 }
  // las que cambian la cadena de Hydra (recompilan); la aparición sólo cambia números
  const RECOMPILAN = ['verJitter', 'verPixelado', 'verMarco', 'verTinte', 'verMalaSenal', 'verFeedback']
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

  let barriendo = false, barridoInicio = 0, barridoDurActual = 0.6

  // notas sostenidas que dispararon recuadros: clave → instante del note-on
  const sostenidas = new Map()
  let ultimaActividad = -1e9          // último disparo o suelta (para el silencio)
  // aparición del recuadro actual: p va de 0 a 1 (en pantalla, con salida suave)
  const ap = { p: 1, clave: null, vel: 0 }
  const sostiene = clave => clave != null && sostenidas.has(clave)

  // latido: cuánto pasó desde el último recuadro, en relación al tiempo entre los dos últimos
  let tUltimoDisparo = 0, intervaloDisparos = 0
  const latido = () => {
    if (!intervaloDisparos) return 1
    return clamp01((performance.now() - tUltimoDisparo) / intervaloDisparos)
  }
  const segunRitmo = () => (C.siguenRitmo ? latido() : 1)

  // golpe: salta a 1 con cada recuadro, queda arriba mientras suena su nota y se apaga al soltarla
  // (más un azar por golpe, como en Perdido)
  const golpe = { t: -1e9, r: 0.5, s: 1, clave: null, suelta: -1e9 }
  const g = () => {
    if (golpe.suelta == null && sostiene(golpe.clave)) return 1
    const dt = (performance.now() - (golpe.suelta ?? golpe.t)) / 1000
    return dt < 0 ? 0 : Math.exp(-dt / Math.max(0.01, C.golpeCaida))
  }

  // tiempo (s) en que termina la aparición después de soltar: una fracción del tiempo entre disparos
  const durRitmo = () => {
    const base = intervaloDisparos ? intervaloDisparos / 1000 : 0.5
    return Math.max(C.aparicionMin, Math.min(C.aparicionMax, C.aparicionRitmo * base))
  }
  const durBarrido = () => intervaloDisparos
    ? Math.max(0.08, Math.min(C.barridoDur, C.barridoRitmo * intervaloDisparos / 1000))
    : C.barridoDur
  const soltarAparicion = () => { ap.vel = (1 - ap.p) / Math.max(0.01, durRitmo()) }
  V.golpe = g

  const hslToRgb = (h, s, l) => {
    const k = n => (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return [f(0), f(8), f(4)]
  }
  const triadica = (hue, s = 0.8, l = 0.55) => [0, 1 / 3, 2 / 3].map(o => hslToRgb((hue + o) % 1, s, l))

  V.disparar = (clave = null) => {
    const ahoraNota = performance.now()
    if (clave != null) sostenidas.set(clave, ahoraNota)
    ultimaActividad = ahoraNota
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
        barridoDurActual = durBarrido()
        barriendo = true
      } else {
        rect.rx = rect.rxFin; rect.ry = rect.ryFin
        rect.imgX = rect.imgXFin; rect.imgY = rect.imgYFin
        barriendo = false
      }

      const t0 = performance.now()
      golpe.t = t0
      golpe.r = Math.random()
      golpe.s = Math.random() * 2 - 1
      golpe.clave = clave
      golpe.suelta = sostiene(clave) ? null : t0

      ap.p = 0
      ap.vel = 0
      ap.clave = clave
      if (!sostiene(clave)) soltarAparicion()   // sin nota sostenida (ráfaga, o ya la soltaron): termina según el ritmo
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

  // al soltar la nota: termina la aparición según el ritmo, se apaga el golpe y,
  // si estaba barriendo, el recuadro cae en su lugar. Sin clave: como antes.
  V.soltar = (clave = null) => {
    const ahora = performance.now()
    ultimaActividad = ahora
    if (clave != null) {
      sostenidas.delete(clave)
      if (clave !== ap.clave) return          // una nota vieja: el recuadro actual sigue como está
      if (golpe.clave === clave && golpe.suelta == null) golpe.suelta = ahora
      if (ap.p < 1) soltarAparicion()
    }
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
  // Tirón de glitch (canal 2 / fila 6)
  //   cada nota (o pad) lo prende al máximo, queda arriba mientras suena y se apaga en tironCaida
  //   después de soltar. Cada nota cambia un poco el dibujo de las bandas.
  // ============================================================
  const tir = { sostenidas: new Map(), t: -1e9, suelta: -1e9, r: 0.5 }
  V.tiron = (on, clave = 'mano') => {
    const ahora = performance.now()
    if (on) { tir.sostenidas.set(clave, ahora); tir.t = ahora; tir.suelta = null; tir.r = Math.random() }
    else { tir.sostenidas.delete(clave); if (!tir.sostenidas.size && tir.suelta == null) tir.suelta = ahora }
  }
  const nivelTiron = () => {
    if (tir.sostenidas.size) return 1
    const dt = (performance.now() - (tir.suelta ?? tir.t)) / 1000
    return dt < 0 ? 0 : Math.exp(-dt / Math.max(0.01, C.tironCaida))
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
  const salto = { x: 0, reloj: 0 }    // mala señal V1: posición en X de toda la pantalla y reloj hasta el próximo salto
  let fbVel = 1                        // F8: 1 = normal · 0 = frenado (silencio)
  let salidaArgs = null, firmaArmada = ''

  V.update = () => {
    const ahora = performance.now()
    const dt = Math.min(0.1, Math.max(0, (ahora - tPrev) / 1000))
    tPrev = ahora

    // color del canal 9: llega suave a cada nota y vuelve cuando deja de sonar
    if (ahora - col9.ult > C.color9Suelta * 1000) col9.objetivo = 0
    col9.actual += (col9.objetivo - col9.actual) * (1 - Math.exp(-dt / Math.max(0.01, C.color9Vel)))

    // rueda (mala señal V3): avanza con el fader; con el fader abajo vuelve a la vuelta entera más cercana
    if (ver('verMalaSenal') === 2 && C.malaSenal > 0.02) rueda += dt * C.malaSenal * C.ruedaVel * segunRitmo()
    else rueda += (Math.round(rueda) - rueda) * (1 - Math.exp(-dt / 0.3))

    // saltos (mala señal V1): toda la pantalla salta en X; con el fader abajo salta pocas veces por segundo
    // (saltosMin), arriba muchas (saltosMax). Cada salto mide entre saltoMin y saltoMax canvas, sin la franja
    // muerta alrededor de 1 (un canvas entero da la vuelta y no se nota). Con el fader en 0 vuelve al centro.
    if (ver('verMalaSenal') === 0 && C.malaSenal > 0.02) {
      salto.reloj += dt * C.saltosMin * Math.pow(C.saltosMax / C.saltosMin, C.malaSenal)
      if (salto.reloj >= 1) {
        salto.reloj = 0
        let d
        do d = C.saltoMin + Math.random() * (C.saltoMax - C.saltoMin)
        while (Math.abs(d - 1) < C.saltoMuerto)
        salto.x = (salto.x + (Math.random() < 0.5 ? -d : d)) % 1
      }
    } else { salto.x = 0; salto.reloj = 1 }   // reloj en 1: al subir el fader, el primer salto es inmediato

    // cambió una versión → recompilar
    if (salidaArgs && firma() !== firmaArmada) armar()

    // notas sostenidas de más (se perdió el note-off): se dan por sueltas
    for (const [k, t0] of sostenidas) if (ahora - t0 > C.maxSostenida * 1000) V.soltar(k)
    for (const [k, t0] of tir.sostenidas) if (ahora - t0 > C.maxSostenida * 1000) V.tiron(false, k)

    // silencio: sin notas sostenidas ni actividad reciente → el feedback frena (y vuelve rápido con la próxima)
    const activo = sostenidas.size > 0 || ahora - ultimaActividad < C.silencio * 1000
    fbVel += ((activo ? 1 : 0) - fbVel) * (1 - Math.exp(-dt / (activo ? 0.15 : Math.max(0.05, C.caidaSilencio / 3))))

    // aparición: lenta mientras la nota se sostiene; al soltar, termina según el ritmo
    if (ap.p < 1) {
      if (ap.vel === 0 && sostiene(ap.clave)) ap.p += dt / Math.max(0.05, C.aparicionLarga)
      else { if (ap.vel === 0) soltarAparicion(); ap.p += dt * ap.vel }
      if (ap.p >= 1) { ap.p = 1; ap.vel = 0 }
    }
    rect.escalaAparicion = 1 - Math.pow(1 - ap.p, 3)

    if (!barriendo) return
    const t = Math.min(1, (time - barridoInicio) / Math.max(0.01, barridoDurActual))
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
  // F6: en V1 el zoom del contenido crece con la aparición; en V2 y V3 el zoom queda fijo y lo que aparece es el marco
  const escalaExtra = () => 1 + Math.pow(C.zoom, 3) * 40 * (ver('verAparicion') === 0 ? rect.escalaAparicion : 1)
  const anchoAparicion = () => (ver('verAparicion') === 1 ? Math.max(0.001, rect.escalaAparicion) : 1)
  const altoAparicion = () => (ver('verAparicion') === 0 ? 1 : Math.max(0.001, rect.escalaAparicion))
  const imanFuerza = () => voz() * C.iman * C.iman

  const iman = () => shape(64, 0.2, 0.9)
    .scroll(() => 0.015 * Math.sin(time * 0.4), () => 0.015 * Math.cos(time * 0.3))
    .mult(noise(3, 0.3), 1)

  const recuadro = (conJitter) => {
    const r = shape(4, 1, 0.001)
      .scale(() => rect.rw * anchoAparicion(), () => rect.rh * altoAparicion())
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
    const f = () => C.feedback * fbVel
    if (v === 1) return src(out).scale(() => 1 + 0.01 * f()).rotate(() => 0.03 * f())
    if (v === 2) return src(out).scale(() => 1 + 0.015 * f()).hue(() => 0.04 * f())
    return src(out).scale(() => 1 + 0.04 * f())
  }

  // F3 V2, mosaico: con el fader en 0 no hace nada; al subir, 2 caras (espejo), 3, 4, 5 y arriba 6 (hexágono)
  const mosaicoLados = () => 2 + Math.round(clamp01(C.marco) * 4)
  const mosaicoMezcla = () => clamp01(C.marco / 0.05)

  const firma = () => RECOMPILAN.map(ver).join('')

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

    // --- 2. salida final (o1): mosaico, mala señal, tirón del canal 2, color del canal 9 ---
    // cada llamada da una copia nueva (en Hydra una cadena se usa una sola vez)
    const base = () => vM === 1
      ? src(out).blend(src(out).kaleid(mosaicoLados).rotate(() => time * 0.03), mosaicoMezcla)
      : src(out)

    // F5 mala señal (con el fader en 0, ninguna versión cambia la imagen)
    let fin
    if (vS === 1) {
      // vhs: ondas horizontales suaves y corrimientos lentos por bandas, colores corridos (rojo para un lado,
      // verde-azul para el otro), color lavado, líneas de barrido y una franja de tracking que baja despacio
      const corrida = () => ms() * 0.008
      // ondas que bajan constantes (sync negativo = hacia abajo en pantalla); una segunda onda más fina las
      // deforma para que no queden parejas, y otra suma bandas finitas
      const ondaVhs = () => osc(5, () => -C.vhsBaja, 0).rotate(PI / 2)
        .modulate(osc(17, () => -C.vhsBaja * 1.7, 0).rotate(PI / 2), 0.08)
        .add(osc(40, () => -C.vhsBaja * 1.3, 0).rotate(PI / 2), 0.3)
      const ondas = (c) => c
        .modulateScrollX(ondaVhs(), () => ms() * 0.012)
        .modulateScrollX(noise(3, 0.15).scale(1, 200, 1), () => ms() * 0.04)
      fin = ondas(base()).color(1, 0, 0).scrollX(corrida)
        .add(ondas(base()).color(0, 1, 1).scrollX(() => -corrida()))
        .saturate(() => 1 - ms() * 0.3)
        .mult(osc(300, 0, 0).rotate(PI / 2), () => ms() * 0.12)
        .add(noise(200, 6).mult(shape(4, 1, 0.4).scale(1, 4, 0.05).scrollY(() => (time * 0.06) % 1)), () => ms() * 0.5)
    } else if (vS === 2) {
      // rueda: la imagen rueda hacia arriba y se rompe como una tele con interferencia — líneas rasgadas
      // en franjas sueltas, ondulación de sincronismo (quieta, baja despacio, al revés de la rueda) y nieve
      const fuerza = () => C.malaSenal * segunRitmo()
      fin = base()
        .scrollY(() => rueda % 1)
        .modulateScrollX(noise(8, 0.6).scale(1, 300, 1).thresh(0.6, 0.2), () => fuerza() * 0.12)
        .modulateScrollX(osc(18, () => -C.ruedaOndaBaja, 0).rotate(PI / 2), () => C.malaSenal * 0.01)
        .add(noise(350, 12), () => fuerza() * 0.3)
    } else fin = base()
      .layer(lineaMalaSenal())
      .modulateScrollX(noise(30, 10).pixelate(1, 100), () => ms() * 0.06)
      .scrollX(() => salto.x)

    fin
      .modulateScrollX(noise(() => 30 + tir.r * 30, 10).pixelate(1, 100), () => nivelTiron() * C.tiron)
      .hue(() => col9.actual * C.color9)
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

  // para mirar desde la consola
  V.estadoNotas = () => ({ sostenidas: [...sostenidas.keys()], aparicion: ap.p, golpe: g(), tiron: nivelTiron(), feedback: fbVel, entreDisparos: intervaloDisparos })

  console.log('[GP] visual Buscando Placer ' + VERSION + ' (produccion) cargado')
})()
