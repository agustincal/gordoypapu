// ============================================================
// GP_03_Vociferan__visual.js
// Canción: 03_Vociferan (Gordo y Papu)
// Rol: motor visual — círculos de luz por nota (MIDI + micrófono + strobe)
// Depende de / lo carga: lo carga el loader; el sketch llama GP.vociferan.*
// Actualizado: 15/10/2026 (v1.4: faders de tamaño y de dirección de entrada)
// ============================================================
//
// Qué hace: cada nota hace entrar un círculo desde un costado hasta el
// centro, se queda, y se desvanece ahuecándose (o cada tanto se escapa).
// Los golpes de paleta nacen en el centro y crecen hasta cubrir todo.
// El micrófono hace temblar posición, tamaño e intensidad de la luz.
// Strobe rojo por bombo y/o por patrón sobre el clock MIDI.
//
// El sketch NO toca nada de acá adentro: sólo llama
//   GP.vociferan.init(config)      una vez por evaluación
//   GP.vociferan.update()          dentro de update = () => {...}
//   GP.vociferan.salida(o0)        para dibujar
// y las acciones (notaOn, notaOff, disparo, golpePaleta, golpe,
// tickClock, reiniciarClock, toggleCodigo, calibrarMic) desde su ruteo MIDI.
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1.4'

  if (GP.vociferan && GP.vociferan._version === VERSION) return
  GP.vociferan = { _version: VERSION }
  const V = GP.vociferan

  const clamp01 = v => Math.max(0, Math.min(1, v))
  const easeOut = t => 1 - Math.pow(1 - t, 3)
  const easeIn = t => t * t * t

  // ---- valores por defecto (el sketch los pisa con init(config)) ----
  const C = {
    // tamaño según la nota: grave = grande, agudo = chico
    notaGrave: 36, notaAguda: 84,
    radioGrave: 0.32, radioAgudo: 0.07,
    borde: 0.07,
    // color
    hue: 20, hueVar: 8, sat: 1,
    paleta: [20, 110, 200, 290],
    // movimiento y vida de cada círculo
    entrada: 0.35, desdeX: 0.35,
    ataque: 0.02, mantener: 0.5, release: 1.2,
    huecoAlIrse: 0.8,
    escapeProb: 0.12, escapeDur: 0.6, escapeDir: 1,
    // Akai
    radioAkai: 0.22,
    entradas: [0.15, 0.35, 0.8],          // velocidades de llegada: rápido, medio, lento (segundos)
    // golpe central
    golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,
    // fluctuación de intensidad
    fluct: 0.25, fluctVel: 3,
    // micrófono
    micPos: 0.06, micLuz: 0.9, micTam: 0.25, micUmbral: 0.15,
    mostrarMic: true,
    // voz: barrido de luz (de m_ring) y multicolor (de mc_ring).
    // Sólo existen mientras hay voz: en silencio el círculo queda liso y quieto.
    barridoFuerza: 0.8,     // cuánto oscurece la franja que recorre el círculo (0 = nada)
    barridoVel: 4,          // qué tan rápido corre la franja cuando hay voz
    multicolor: 0.7,        // 0 = franja de un solo color, 1 = tres franjas separadas por canal
    vozAtaque: 0.3,         // qué tan rápido aparece el efecto al empezar la voz (0..1)
    vozCaida: 0.05,         // qué tan rápido se va al callarse (más chico = más lento)
    // faders (F1 tamaño, F2 dirección). Hasta que movés el fader físico
    // no hacen nada: los círculos quedan como siempre.
    tamanoMax: 1.15,        // radio con el fader de tamaño arriba de todo (1.15 = tapa la pantalla)
    giroMax: 180,           // grados que gira la dirección de entrada con el fader al tope
    suavizadoFader: 0.15,   // más chico = el fader responde más suave/lento
    calibrarSeg: 3,         // segundos que escucha el ambiente al calibrar
    calibrarMargen: 1.2,    // el piso queda un 20% arriba del ruido medido
    // strobe
    strobeClock: false, strobePatron: 'X.X.X...........', strobeRes: 3,
    strobeBombo: true,
    flashDur: 0.045, flashColor: [1, 0, 0], flashFuerza: 1,
    // pruebas sin hardware
    demo: false,
  }
  V.C = C

  // ---- círculos (se reciclan) ----
  const N = 8
  const slots = Array.from({ length: N }, () => ({
    activo: false, lado: 1, t0: -99, sostenida: false, tSuelta: 0, nivelSuelta: 0,
    vel: 1, nota: -1, radio: 0.2, escapa: false, escapeDir: 1, tipo: 'normal',
    rgb: [1, 0.33, 0], luzMult: 1, fase: 0, entrada: 0.35, barrido: 0, angulo: 0, jx: 0, jy: 0, jl: 1, jr: 1
  }))

  // ---- faders ----
  // null = todavía no se tocó el fader físico → valor neutro (no cambia nada)
  const fader = { tamano: null, giro: null }
  const faderSuave = { tamano: 0.5, giro: 0 }
  V.faderTamano = v01 => { fader.tamano = v01 }
  V.faderGiro = v01 => { fader.giro = v01 }

  // tamaño: fader en 0 = círculo de tamaño 0, en el medio = tamaño normal,
  // arriba = cada círculo crece hasta tapar la pantalla
  const tamano = r => {
    const t = faderSuave.tamano
    if (t <= 0.5) return r * (t / 0.5)
    const k = (t - 0.5) / 0.5
    return r + (Math.max(r, C.tamanoMax) - r) * k * k
  }
  // dirección de entrada en radianes (0 = horizontal, como siempre)
  const anguloActual = () => faderSuave.giro * C.giroMax * Math.PI / 180
  let proximo = 0

  const hsvARgb = (h, sat) => {
    h = ((h % 360) + 360) % 360 / 60
    const i = Math.floor(h), f = h - i
    const p = 1 - sat, q = 1 - sat * f, t = 1 - sat * (1 - f)
    return [[1, t, p], [q, 1, p], [p, 1, t], [p, q, 1], [t, p, 1], [1, p, q]][i % 6]
  }

  const radioDeNota = nota => {
    const t = clamp01((nota - C.notaGrave) / (C.notaAguda - C.notaGrave))
    return C.radioGrave + (C.radioAgudo - C.radioGrave) * t
  }

  const llegada = s => s.tipo === 'golpe' ? C.golpeDur : s.entrada
  const inicioCaida = s => Math.max(s.tSuelta, s.t0 + llegada(s)) + C.mantener

  const nivel = s => {
    if (!s.activo) return 0
    const subida = clamp01((time - s.t0) / C.ataque) * s.vel
    if (s.sostenida) return subida
    const t0c = inicioCaida(s)
    if (time < t0c) return s.nivelSuelta
    if (s.escapa) {
      if (time - t0c > C.escapeDur) s.activo = false
      return s.nivelSuelta
    }
    const n = s.nivelSuelta * Math.exp(-(time - t0c) / (C.release / 3))
    if (n < 0.005) s.activo = false
    return n
  }

  // posición: entra desde afuera de la pantalla hasta el centro, en la
  // dirección del círculo (horizontal, o girada con el fader de dirección).
  // La cuenta se hace en el espacio corregido por el ancho de pantalla.
  const asp = () => (typeof width !== 'undefined' && height) ? width / height : 16 / 9
  const viaje = s => {
    if (s.tipo === 'golpe') return 0
    const e = easeOut(clamp01((time - s.t0) / s.entrada))
    return 1 - e
  }
  const distanciaEntrada = s => {
    const c = Math.abs(Math.cos(s.angulo)), sn = Math.abs(Math.sin(s.angulo))
    return 0.5 * asp() * c + 0.5 * sn + C.desdeX + tamano(s.radio)
  }
  const posX = s => {
    const o = s.lado * distanciaEntrada(s) * viaje(s)
    return 0.5 + o * Math.cos(s.angulo) / asp()
  }
  const posY = s => {
    const o = s.lado * distanciaEntrada(s) * viaje(s)
    let y = 0.5 + o * Math.sin(s.angulo)
    if (s.escapa && !s.sostenida) {
      const t = clamp01((time - inicioCaida(s)) / C.escapeDur)
      y += s.escapeDir * easeIn(t) * (0.6 + tamano(s.radio))
    }
    return y
  }

  const radioActual = s => s.tipo === 'golpe'
    ? s.radio * easeOut(clamp01((time - s.t0) / C.golpeDur))
    : tamano(s.radio)

  const fluct = s => 1 - C.fluct * (0.5 + 0.5 * Math.sin(time * C.fluctVel + s.fase) * Math.sin(time * C.fluctVel * 0.37 + s.fase * 2))

  // ---- acciones ----

  // op: lado (1 derecha / -1 izquierda), escapa, escapeDir, tipo ('normal' | 'golpe'),
  //     radio, entrada (segundos en llegar), hue (tono propio en grados)
  // Sin op (como dispara la canción): usa C.entrada y C.hue.
  V.notaOn = (nota = 60, vel = 100, op = {}) => {
    const s = slots[proximo]
    proximo = (proximo + 1) % N
    s.activo = true
    s.lado = op.lado ?? (Math.random() < 0.5 ? -1 : 1)
    s.t0 = time
    s.sostenida = true
    s.vel = vel / 127
    s.nota = nota
    s.tipo = op.tipo ?? 'normal'
    s.radio = op.radio ?? (s.tipo === 'golpe' ? C.golpeRadio : radioDeNota(nota))
    s.escapa = op.escapa ?? (s.tipo === 'normal' && Math.random() < C.escapeProb)
    s.escapeDir = op.escapeDir ?? C.escapeDir
    s.luzMult = s.tipo === 'golpe' ? C.golpeLuz : 1
    s.entrada = op.entrada ?? C.entrada
    s.rgb = hsvARgb((op.hue ?? C.hue) + (Math.random() * 2 - 1) * C.hueVar, C.sat)
    s.fase = Math.random() * 6.28
    s.barrido = Math.random() * 6.28
    s.angulo = anguloActual()     // la dirección queda fija para este círculo
  }

  V.notaOff = (nota = 60) => {
    for (let k = 1; k <= N; k++) {
      const s = slots[(proximo - k + N) % N]
      if (s.activo && s.sostenida && s.nota === nota) {
        s.nivelSuelta = nivel(s)
        s.sostenida = false
        s.tSuelta = time
        return
      }
    }
  }

  // disparo lateral del Akai. NO cambia la paleta de la canción: el color
  // es sólo para este círculo. Se suelta con notaOff(id).
  // op: lado (-1 izquierda / 1 derecha), velocidad (0 rápido, 1 medio, 2 lento),
  //     color (índice 0..3 de C.paleta), escape (true = se escapa arriba o abajo al azar)
  V.disparo = (id, vel = 110, op = {}) => {
    const o = { radio: C.radioAkai }
    if (op.lado != null) o.lado = op.lado
    if (op.velocidad != null) o.entrada = C.entradas[op.velocidad]
    if (op.color != null) o.hue = C.paleta[op.color]
    if (op.escape) { o.escapa = true; o.escapeDir = Math.random() < 0.5 ? -1 : 1 }
    V.notaOn(id, vel, o)
  }

  // golpe central que además cambia la paleta (indice 0..3 de C.paleta).
  // Se suelta con notaOff(2000 + indice)
  V.golpePaleta = (indice, vel = 110) => {
    C.hue = C.paleta[indice]
    V.notaOn(2000 + indice, vel, { tipo: 'golpe' })
  }

  // ---- strobe ----
  let tFlash = -99
  V.golpe = () => { tFlash = time }
  const flash = () => Math.exp(-(time - tFlash) / (C.flashDur / 3)) * C.flashFuerza

  let ticks = 0
  V.tickClock = () => {
    if (C.strobeClock && ticks % C.strobeRes === 0) {
      const paso = Math.floor(ticks / C.strobeRes) % C.strobePatron.length
      if (C.strobePatron[paso] === 'X') V.golpe()
    }
    ticks++
  }
  V.reiniciarClock = () => { ticks = 0 }

  // ---- ocultar código y paneles para el show ----
  let codigoVisible = true
  V.toggleCodigo = () => {
    codigoVisible = !codigoVisible
    const partes = ['.CodeMirror', '#editor-container', '#toolbar', '#menu', '#info-container', '#modal',
      '#gpMidiPanel', '#gpEnsayoPanel', '#gpOverlayEstado']
    document.querySelectorAll(partes.join(',')).forEach(el => {
      el.style.visibility = codigoVisible ? '' : 'hidden'
    })
    if (codigoVisible && C.mostrarMic) a.show()
    else a.hide()
  }

  // ---- micrófono ----
  const voz = () => {
    const v = Math.min(1, Math.max(...a.fft))
    return v < C.micUmbral ? 0 : (v - C.micUmbral) / (1 - C.micUmbral)
  }

  // limpieza del ruido de sala: escucha el ambiente unos segundos (SIN voz)
  // y pone el piso de cada banda del mic justo arriba de ese ruido.
  // Hydra resta ese piso a cada banda (a.settings[i].cutoff).
  let calibrando = false
  V.calibrarMic = () => {
    if (calibrando) return
    calibrando = true
    const max = a.bins.map(() => 0)
    console.log('[Vociferan] calibrando mic: silencio ' + C.calibrarSeg + ' s...')
    const id = setInterval(() => {
      a.bins.forEach((b, i) => { if (b > max[i]) max[i] = b })
    }, 20)
    setTimeout(() => {
      clearInterval(id)
      a.settings.forEach((st, i) => { st.cutoff = max[i] * C.calibrarMargen })
      calibrando = false
      console.log('[Vociferan] mic calibrado. Piso por banda:', a.settings.map(st => st.cutoff.toFixed(2)).join(' / '))
    }, C.calibrarSeg * 1000)
  }
  V.pisoMic = () => a.settings.map(st => st.cutoff)

  // envolvente de la voz: sube rápido al hablar, baja suave al callar
  let vozEnv = 0
  let ultimo = 0
  const efectoVoz = () => vozEnv

  V.update = () => {
    const v = voz()
    const dt = Math.min(0.1, Math.max(0, time - ultimo))
    ultimo = time
    vozEnv += (v - vozEnv) * (v > vozEnv ? C.vozAtaque : C.vozCaida)
    const objTam = fader.tamano ?? 0.5
    const objGiro = fader.giro ?? 0
    faderSuave.tamano += (objTam - faderSuave.tamano) * C.suavizadoFader
    faderSuave.giro += (objGiro - faderSuave.giro) * C.suavizadoFader
    for (const s of slots) {
      s.jx = (Math.random() - 0.5) * 2 * v * C.micPos
      s.jy = (Math.random() - 0.5) * 2 * v * C.micPos
      s.jl = 1 - Math.random() * v * C.micLuz
      s.jr = 1 + (Math.random() - 0.5) * 2 * v * C.micTam
      // la franja sólo avanza mientras hay voz
      s.barrido += dt * C.barridoVel * v
    }
  }

  // ---- demo sin hardware (notas, clock y bombo falsos a ~102 BPM) ----
  if (window._vociferanDemo) window._vociferanDemo.forEach(clearInterval)
  window._vociferanDemo = [
    setInterval(() => {
      if (!C.demo) return
      const nota = C.notaGrave + Math.floor(Math.random() * (C.notaAguda - C.notaGrave))
      V.notaOn(nota, 100)
      setTimeout(() => V.notaOff(nota), 72)
    }, 147),
    setInterval(() => { if (C.demo) V.tickClock() }, 24.5),
    setInterval(() => { if (C.demo && C.strobeBombo) V.golpe() }, 588),
  ]

  // ---- init: config del sketch + shader + micrófono ----
  V.init = (config = {}) => {
    Object.assign(C, config)

    // aro: tu ring con centro movible y corregido para pantalla ancha
    setFunction({
      name: 'aro',
      type: 'src',
      inputs: [
        { type: 'float', name: 'cx',    default: 0.5 },
        { type: 'float', name: 'cy',    default: 0.5 },
        { type: 'float', name: 'radio', default: 0.2 },
        { type: 'float', name: 'borde', default: 0.06 },
        { type: 'float', name: 'hueco', default: 0.0 },
        { type: 'float', name: 'barrido', default: 0.0 },
        { type: 'float', name: 'sombra',  default: 0.0 },
        { type: 'float', name: 'multi',   default: 0.0 },
      ],
      glsl: `
        float asp = resolution.x / resolution.y;
        vec2 p = vec2((_st.x - 0.5) * asp + 0.5, _st.y);
        vec2 c = vec2((cx - 0.5) * asp + 0.5, cy);
        float d = distance(p, c);
        float afuera  = smoothstep(radio - borde, radio, d);
        float adentro = smoothstep(hueco - 0.02, hueco, d);
        float v = clamp(adentro - afuera, 0.0, 1.0);
        // franja de luz que recorre el círculo de lado a lado (de m_ring),
        // y la versión de tres franjas, una por canal (de mc_ring)
        float u = (p.x - c.x) / max(radio, 0.01);
        float una = 1.0 - sombra * abs(sin(u * 3.14 + barrido));
        vec3 tres = vec3(
          1.0 - sombra * abs(sin(u * 1.57 + barrido)),
          1.0 - sombra * abs(sin(u * 3.14 + barrido * 1.3)),
          1.0 - sombra * abs(sin(u * 6.28 + barrido * 1.7)));
        vec3 k = clamp(mix(vec3(una), tres, multi), 0.0, 1.0);
        return vec4(v * k, 1.0);
      `
    })

    a.setBins(4)
    a.setSmooth(0.4)
    a.setScale(8)
    a.setCutoff(0.1)
    if (C.mostrarMic && codigoVisible) a.show()
    else a.hide()
    return V
  }

  // ---- dibujo ----
  const circulo = i => {
    const s = slots[i]
    const luz = () => nivel(s) * s.jl * fluct(s) * s.luzMult
    return aro(
        () => posX(s) + s.jx,
        () => posY(s) + s.jy,
        () => radioActual(s) * s.jr,
        () => C.borde,
        () => radioActual(s) * C.huecoAlIrse * (s.sostenida ? 0 : clamp01(1 - nivel(s) / Math.max(s.nivelSuelta, 0.001))),
        () => s.barrido,
        () => C.barridoFuerza * efectoVoz(),
        () => C.multicolor
      )
      .color(
        () => s.rgb[0] * luz(),
        () => s.rgb[1] * luz(),
        () => s.rgb[2] * luz()
      )
  }

  V.salida = (out) => {
    let circulos = solid(0, 0, 0)
    for (let i = 0; i < N; i++) circulos = circulos.add(circulo(i))
    circulos
      .add(solid(() => C.flashColor[0], () => C.flashColor[1], () => C.flashColor[2]), flash)
      .out(out)
  }

  console.log('[GP] visual Vociferan ' + VERSION + ' cargado')
})()
