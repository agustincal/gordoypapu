// ============================================================
// GP_03_Vociferan__visual.js
// Canción: 03_Vociferan (Gordo y Papu)
// Rol: motor visual — círculos de luz por nota (MIDI + micrófono + strobe)
// Depende de / lo carga: lo carga el loader; el sketch llama GP.vociferan.*
// Actualizado: 14/10/2026
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
// y las acciones (notaOn, notaOff, padAkai, golpePaleta, golpe,
// tickClock, reiniciarClock, toggleCodigo) desde su ruteo MIDI.
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1.0'

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
    padsAkai: [
      { lado: 1 },                        // 1: entra por la derecha
      { lado: -1 },                       // 2: entra por la izquierda
      { escapa: true, escapeDir: -1 },    // 3: se va para abajo
      { tipo: 'golpe' },                  // 4: gran golpe desde el centro
    ],
    // golpe central
    golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,
    // fluctuación de intensidad
    fluct: 0.25, fluctVel: 3,
    // micrófono
    micPos: 0.06, micLuz: 0.9, micTam: 0.25, micUmbral: 0.15,
    mostrarMic: true,
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
    rgb: [1, 0.33, 0], luzMult: 1, fase: 0, jx: 0, jy: 0, jl: 1, jr: 1
  }))
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

  const llegada = s => s.tipo === 'golpe' ? C.golpeDur : C.entrada
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

  const posX = s => {
    if (s.tipo === 'golpe') return 0.5
    const t = easeOut(clamp01((time - s.t0) / C.entrada))
    const inicio = 0.5 + s.lado * (0.5 + C.desdeX + s.radio)
    return inicio + (0.5 - inicio) * t
  }

  const posY = s => {
    if (!s.escapa || s.sostenida) return 0.5
    const t = clamp01((time - inicioCaida(s)) / C.escapeDur)
    return 0.5 + s.escapeDir * easeIn(t) * (0.6 + s.radio)
  }

  const radioActual = s => s.tipo === 'golpe'
    ? s.radio * easeOut(clamp01((time - s.t0) / C.golpeDur))
    : s.radio

  const fluct = s => 1 - C.fluct * (0.5 + 0.5 * Math.sin(time * C.fluctVel + s.fase) * Math.sin(time * C.fluctVel * 0.37 + s.fase * 2))

  // ---- acciones ----

  // op: lado (1 derecha / -1 izquierda), escapa, escapeDir, tipo ('normal' | 'golpe'), radio
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
    s.rgb = hsvARgb(C.hue + (Math.random() * 2 - 1) * C.hueVar, C.sat)
    s.fase = Math.random() * 6.28
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

  // pad de la fila de disparo (0..7). Se suelta con notaOff(1000 + pad)
  V.padAkai = (pad, vel = 110) => {
    const op = C.padsAkai[pad] ?? {}
    const base = op.tipo === 'golpe' ? {} : { radio: C.radioAkai }
    V.notaOn(1000 + pad, vel, { ...base, ...op })
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

  V.update = () => {
    const v = voz()
    for (const s of slots) {
      s.jx = (Math.random() - 0.5) * 2 * v * C.micPos
      s.jy = (Math.random() - 0.5) * 2 * v * C.micPos
      s.jl = 1 - Math.random() * v * C.micLuz
      s.jr = 1 + (Math.random() - 0.5) * 2 * v * C.micTam
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
      ],
      glsl: `
        float asp = resolution.x / resolution.y;
        vec2 p = vec2((_st.x - 0.5) * asp + 0.5, _st.y);
        vec2 c = vec2((cx - 0.5) * asp + 0.5, cy);
        float d = distance(p, c);
        float afuera  = smoothstep(radio - borde, radio, d);
        float adentro = smoothstep(hueco - 0.02, hueco, d);
        float v = clamp(adentro - afuera, 0.0, 1.0);
        return vec4(vec3(v), 1.0);
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
        () => s.radio * C.huecoAlIrse * (s.sostenida ? 0 : clamp01(1 - nivel(s) / Math.max(s.nivelSuelta, 0.001)))
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
