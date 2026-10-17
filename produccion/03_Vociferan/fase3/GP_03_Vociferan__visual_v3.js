// ============================================================
// GP_03_Vociferan__visual_v3.js  ·  produccion/03_Vociferan/fase3/  (DESARROLLO)
// Canción: 03_Vociferan (Gordo y Papu) · Fase 3
// Rol: motor visual — círculos de luz (la Vociferan de siempre) + escenas de
//      formas que se transforman (morfo, iris, corte, anidado, lente), todo en
//      el color de la canción, con la vibración del mic y el strobe del bombo.
// Lo carga el sketch de desarrollo (produccion/03_Vociferan/fase3/03_Vociferan_v02.js).
// La versión de LIVE (LIVE/arq/GP_03_Vociferan__visual.js v2.0) queda intacta.
// Actualizado: 17/10/2026 (v3.0: escenas tomadas de James v02, adaptadas a Vociferan)
// ============================================================
//
// Escenas (C.escena):
//   'circulos'  la Vociferan de siempre: cada nota del canal 1 entra como círculo
//   'morfo'     una forma que se derrite en la siguiente
//   'iris'      formas que nacen en el centro y crecen hasta tapar todo (diff)
//   'corte'     la forma se corta en franjas que se separan y vuelve como la siguiente
//   'anidado'   formas una adentro de otra; cada cambio hace zoom un nivel
//   'lente'     una lente con forma agranda una grilla que se mueve
// En las escenas nuevas, los círculos del canal 1 pueden seguir entrando por
// encima (C.circulos, de 0 a 1). Los golpes de paleta se ven siempre.
// Al cambiar de escena se dispara un golpe central que tapa el corte.
//
// Música → escenas (cada estado elige):
//   C.cambio   voz que hace pasar a la forma siguiente: 'bombo' | 'caja' | 'melodia' | 'ninguna'
//   C.golpe    voz que hace latir las formas
//   C.formas   'todas' (triángulo, cuadrado, círculo) | 'circulo' (sólo círculos)
// El mic sólo hace vibrar (posición, tamaño y luz), en todas las escenas.
// El strobe rojo sigue al bombo (C.strobe), en todas las escenas.
//
// El sketch llama:
//   GP.vociferan.init(config) · .update() · .salida(o0)
//   .notaOn(nota, vel, op) · .notaOff(nota) · .disparo(id, vel, op) · .golpePaleta(i)
//   .golpe()                     flash de strobe
//   .voz(nombre)                 'bombo' | 'caja' | 'melodia': cuenta para cambio y golpe
//   .escenaMano(nombre)          cambia de escena a mano (hasta el próximo estado)
//   .cambioMano()                pasa a la forma siguiente a mano
//   .toggleCodigo() · .calibrarMic() · .alEntrarEstado()
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v3.0'

  if (GP.vociferan && GP.vociferan._version === VERSION) return
  GP.vociferan = { _version: VERSION }
  const V = GP.vociferan

  const clamp01 = v => Math.max(0, Math.min(1, v))
  const easeOut = t => 1 - Math.pow(1 - t, 3)
  const easeIn = t => t * t * t
  const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2
  const mod = (a, n) => ((a % n) + n) % n
  const frac = x => x - Math.floor(x)
  const GRADOS = Math.PI / 180
  const ASP = () => (typeof width !== 'undefined' && width) ? height / width : 9 / 16
  const ESCENAS = ['circulos', 'morfo', 'iris', 'corte', 'anidado', 'lente']
  const MAX_CAPAS = 6

  // ---- valores por defecto (V.init vuelve a estos y aplica la config del sketch) ----
  const DEFAULTS = {
    escena: 'circulos',

    // ---- círculos (igual que la v2.0) ----
    notaGrave: 36, notaAguda: 84,
    radioGrave: 0.32, radioAgudo: 0.07,
    borde: 0.07,
    hue: 20, hueVar: 8, sat: 1,
    paleta: [20, 110, 200, 290],
    entrada: 0.35, desdeX: 0.35,
    ataque: 0.02, mantener: 0.5, release: 1.2,
    huecoAlIrse: 0.8,
    escapeProb: 0.12, escapeDur: 0.6, escapeDir: 1,
    radioAkai: 0.22,
    entradas: [0.15, 0.35, 0.8],
    golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,
    fluct: 0.25, fluctVel: 3,
    micPos: 0.06, micLuz: 0.9, micTam: 0.25, micUmbral: 0.15,
    mostrarMic: true,
    barridoFuerza: 0.8, barridoVel: 4, multicolor: 0.7,
    vozAtaque: 0.3, vozCaida: 0.05,
    calibrarSeg: 3, calibrarMargen: 1.2,
    tamano: 0.5,            // F1 · círculos y formas · 0 = nada · 0.5 = normal · 1 = enormes
    direccion: 0,           // F2 · de dónde entran los círculos
    tamanoMax: 1.15, giroMax: 180,
    strobe: true,
    flashDur: 0.045, flashColor: [1, 0, 0], flashFuerza: 1,

    // ---- escenas nuevas ----
    cambio: 'bombo',        // voz que pasa a la forma siguiente
    golpe: 'bombo',         // voz que hace latir las formas
    formas: 'todas',        // 'todas' | 'circulo'
    separacion: 0.25,       // segundos mínimos entre dos cambios
    tiempo: 0.5,            // F3 · duración de las transiciones (0 = seco · 1 = el doble)
    giro: 0.5,              // F4 · cuánto giran las formas en cada cambio
    latido: 0.5,            // F5 · cuánto laten con el golpe
    circulos: 0,            // F6 · círculos del canal 1 por encima de las escenas nuevas (0 a 1)
    quieto: false,          // N12 · congela las formas
    golpeAlCambiar: true,   // golpe central al cambiar de escena (tapa el corte)
    luzFormas: 1,           // brillo de las formas
    // morfo
    tamMorfo: 0.42, durMorfo: 0.6, giroMorfo: 90, popMorfo: 0.12,
    // iris
    durIris: 2.4, giroIris: 90, finalIris: 3.5,
    // corte
    tamCorte: 0.45, durCorte: 0.7, franjas: 8, separa: 0.25, popCorte: 0.08,
    // anidado
    tamAnidado: 0.8, durAnidado: 0.8, giroAnidado: 30, adentro: 0.55, niveles: 10, popAnidado: 0.06,
    // lente
    tamLente: 0.38, durLente: 0.6, lupa: 1.2, popLente: 1.5, columnas: 16, filasLente: 9,
    derivaLente: 0.015,     // la grilla se desliza despacio (por pantalla por segundo)
    formaGrilla: 'circulo', // 'circulo' | 'cuadrado'
    posLente: [[0.5, 0.5], [0.33, 0.58], [0.66, 0.42], [0.45, 0.38]],

    demo: false,
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS
  V.ESCENAS = ESCENAS

  const f2 = v => 2 * clamp01(v)
  const t = () => time

  const hsvARgb = (h, sat) => {
    h = ((h % 360) + 360) % 360 / 60
    const i = Math.floor(h), f = h - i
    const p = 1 - sat, q = 1 - sat * f, tt = 1 - sat * (1 - f)
    return [[1, tt, p], [q, 1, p], [p, 1, tt], [p, q, 1], [tt, p, 1], [1, p, q]][i % 6]
  }

  // ============================================================
  // CÍRCULOS (la v2.0 sin cambios de comportamiento)
  // ============================================================
  const N = 8
  const slots = Array.from({ length: N }, () => ({
    activo: false, lado: 1, t0: -99, sostenida: false, tSuelta: 0, nivelSuelta: 0,
    vel: 1, nota: -1, radio: 0.2, escapa: false, escapeDir: 1, tipo: 'normal',
    rgb: [1, 0.33, 0], luzMult: 1, fase: 0, entrada: 0.35, barrido: 0, angulo: 0, jx: 0, jy: 0, jl: 1, jr: 1
  }))
  const tamano = r => {
    const k0 = clamp01(C.tamano)
    if (k0 <= 0.5) return r * (k0 / 0.5)
    const k = (k0 - 0.5) / 0.5
    return r + (Math.max(r, C.tamanoMax) - r) * k * k
  }
  const anguloActual = () => clamp01(C.direccion) * C.giroMax * GRADOS
  let proximo = 0

  const radioDeNota = nota => {
    const k = clamp01((nota - C.notaGrave) / (C.notaAguda - C.notaGrave))
    return C.radioGrave + (C.radioAgudo - C.radioGrave) * k
  }
  const llegada = s => s.tipo === 'golpe' ? C.golpeDur : s.entrada
  const inicioCaida = s => Math.max(s.tSuelta, s.t0 + llegada(s)) + C.mantener
  const nivel = s => {
    if (!s.activo) return 0
    const subida = clamp01((t() - s.t0) / C.ataque) * s.vel
    if (s.sostenida) return subida
    const t0c = inicioCaida(s)
    if (t() < t0c) return s.nivelSuelta
    if (s.escapa) {
      if (t() - t0c > C.escapeDur) s.activo = false
      return s.nivelSuelta
    }
    const n = s.nivelSuelta * Math.exp(-(t() - t0c) / (C.release / 3))
    if (n < 0.005) s.activo = false
    return n
  }
  const asp = () => (typeof width !== 'undefined' && height) ? width / height : 16 / 9
  const viaje = s => s.tipo === 'golpe' ? 0 : 1 - easeOut(clamp01((t() - s.t0) / s.entrada))
  const distanciaEntrada = s => {
    const c = Math.abs(Math.cos(s.angulo)), sn = Math.abs(Math.sin(s.angulo))
    return 0.5 * asp() * c + 0.5 * sn + C.desdeX + tamano(s.radio)
  }
  const posX = s => 0.5 + s.lado * distanciaEntrada(s) * viaje(s) * Math.cos(s.angulo) / asp()
  const posY = s => {
    let y = 0.5 + s.lado * distanciaEntrada(s) * viaje(s) * Math.sin(s.angulo)
    if (s.escapa && !s.sostenida) {
      const k = clamp01((t() - inicioCaida(s)) / C.escapeDur)
      y += s.escapeDir * easeIn(k) * (0.6 + tamano(s.radio))
    }
    return y
  }
  const radioActual = s => s.tipo === 'golpe'
    ? s.radio * easeOut(clamp01((t() - s.t0) / C.golpeDur))
    : tamano(s.radio)
  const fluct = s => 1 - C.fluct * (0.5 + 0.5 * Math.sin(t() * C.fluctVel + s.fase) * Math.sin(t() * C.fluctVel * 0.37 + s.fase * 2))

  V.notaOn = (nota = 60, vel = 100, op = {}) => {
    const s = slots[proximo]
    proximo = (proximo + 1) % N
    s.activo = true
    s.lado = op.lado ?? (Math.random() < 0.5 ? -1 : 1)
    s.t0 = t()
    s.sostenida = true
    s.vel = vel / 127
    s.nota = nota
    s.tipo = op.tipo ?? 'normal'
    s.radio = op.radio ?? (s.tipo === 'golpe' ? C.golpeRadio : radioDeNota(op.altura ?? nota))
    s.escapa = op.escapa ?? (s.tipo === 'normal' && Math.random() < C.escapeProb)
    s.escapeDir = op.escapeDir ?? C.escapeDir
    s.luzMult = s.tipo === 'golpe' ? C.golpeLuz : 1
    s.entrada = op.entrada ?? C.entrada
    s.rgb = hsvARgb((op.hue ?? C.hue) + (Math.random() * 2 - 1) * C.hueVar, C.sat)
    s.fase = Math.random() * 6.28
    s.barrido = Math.random() * 6.28
    s.angulo = anguloActual()
  }
  V.notaOff = (nota = 60) => {
    for (let k = 1; k <= N; k++) {
      const s = slots[(proximo - k + N) % N]
      if (s.activo && s.sostenida && s.nota === nota) {
        s.nivelSuelta = nivel(s)
        s.sostenida = false
        s.tSuelta = t()
        return
      }
    }
  }
  V.disparo = (id, vel = 110, op = {}) => {
    const o = { radio: C.radioAkai }
    if (op.lado != null) o.lado = op.lado
    if (op.velocidad != null) o.entrada = C.entradas[op.velocidad]
    if (op.color != null) o.hue = C.paleta[op.color]
    if (op.escape) { o.escapa = true; o.escapeDir = Math.random() < 0.5 ? -1 : 1 }
    V.notaOn(id, vel, o)
  }
  V.golpePaleta = (indice, vel = 110) => {
    C.hue = C.paleta[indice]
    V.notaOn(2000 + indice, vel, { tipo: 'golpe' })
  }

  // ---- strobe ----
  let tFlash = -99
  V.golpe = () => { tFlash = t() }
  const flash = () => Math.exp(-(t() - tFlash) / (C.flashDur / 3)) * C.flashFuerza

  // ---- ocultar código ----
  let codigoVisible = true
  V.toggleCodigo = () => {
    codigoVisible = !codigoVisible
    const partes = ['.CodeMirror', '#editor-container', '#toolbar', '#menu', '#info-container', '#modal']
    document.querySelectorAll(partes.join(',')).forEach(el => {
      el.style.visibility = codigoVisible ? '' : 'hidden'
    })
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(codigoVisible)
    if (typeof a === 'undefined') return
    if (codigoVisible && C.mostrarMic) a.show()
    else a.hide()
  }

  // ---- micrófono ----
  const voz = () => {
    if (typeof a === 'undefined' || !a.fft) return 0
    const v = Math.min(1, Math.max(...a.fft))
    return v < C.micUmbral ? 0 : (v - C.micUmbral) / (1 - C.micUmbral)
  }
  let calibrando = false
  V.calibrarMic = () => {
    if (calibrando) return
    calibrando = true
    const max = a.bins.map(() => 0)
    console.log('[Vociferan] calibrando mic: silencio ' + C.calibrarSeg + ' s...')
    const id = setInterval(() => { a.bins.forEach((b, i) => { if (b > max[i]) max[i] = b }) }, 20)
    setTimeout(() => {
      clearInterval(id)
      a.settings.forEach((st, i) => { st.cutoff = max[i] * C.calibrarMargen })
      calibrando = false
      console.log('[Vociferan] mic calibrado. Piso por banda:', a.settings.map(st => st.cutoff.toFixed(2)).join(' / '))
    }, C.calibrarSeg * 1000)
  }
  V.pisoMic = () => a.settings.map(st => st.cutoff)
  let vozEnv = 0
  let ultimo = 0

  // vibración global para las escenas nuevas (la misma idea que en cada círculo)
  const J = { x: 0, y: 0, l: 1, r: 1 }

  // ============================================================
  // ESCENAS NUEVAS (de James v02, en el color de Vociferan)
  // ============================================================
  const S = window._vociferanS || (window._vociferanS = {
    n: 1, t0: -99, tg: -99, capas: [], fondoIris: 0,
    corte: { t0: -99, de: 0, a: 0, vertical: false },
  })
  V.S = S

  const LADOS_TODAS = [3, 4, 100]
  const PESO_TODAS = [0.78, 0.89, 1]
  const lados = i => C.formas === 'circulo' ? 100 : LADOS_TODAS[mod(i, 3)]
  const peso = i => C.formas === 'circulo' ? 1 : PESO_TODAS[mod(i, 3)]

  const dur = base => base * f2(C.tiempo)
  const paso = base => {
    const d = dur(base)
    return S.n - 1 + (d <= 0.001 ? 1 : suave((t() - S.t0) / d))
  }
  const latido = caida => Math.exp(-Math.max(0, t() - S.tg) / caida)
  const durIris = () => Math.max(0.3, dur(C.durIris))
  const durCorte = () => Math.max(0.05, dur(C.durCorte))

  let ultimoCambio = -99
  const cambio = (aMano = false) => {
    if (C.quieto && !aMano) return
    if (!aMano && t() - ultimoCambio < C.separacion) return
    ultimoCambio = t()
    S.n++
    S.t0 = t()
    S.capas.push({ t0: t(), i: S.n, dir: S.n % 2 ? 1 : -1 })
    if (S.capas.length > MAX_CAPAS) { S.capas.shift(); S.fondoIris ^= 1 }
    const c = S.corte
    c.de = c.a; c.a = c.a + 1; c.t0 = t(); c.vertical = !c.vertical
  }

  // una voz de la música: cuenta para el cambio de forma y el latido
  V.voz = (nombre) => {
    if (C.cambio === nombre) cambio()
    if (C.golpe === nombre) S.tg = t()
  }
  V.cambioMano = () => cambio(true)
  V.escenaMano = (nombre) => { if (ESCENAS.includes(nombre)) C.escena = nombre }
  V.alEntrarEstado = () => {}

  const morfo = () => {
    const p = () => paso(C.durMorfo)
    const ld = k => () => lados(Math.floor(p()) + k)
    const campo = k => () => 2 * C.tamMorfo * f2(C.tamano) * peso(Math.floor(p()) + k) + 1e-4
    return shape(ld(0), 0, campo(0))
      .blend(shape(ld(1), 0, campo(1)), () => frac(p()))
      .thresh(0.5, 0.004)
      .rotate(() => p() * C.giroMorfo * f2(C.giro) * GRADOS)
      .scale(() => 1 + C.popMorfo * f2(C.latido) * latido(0.12))
      .scale(1, ASP, 1)
  }

  const iris = () => {
    let img = solid(() => S.fondoIris, () => S.fondoIris, () => S.fondoIris)
    for (let k = 0; k < MAX_CAPAS; k++) {
      const c = () => S.capas[k]
      const prog = () => c() ? Math.max(0, (t() - c().t0) / durIris()) : 0
      img = img.diff(
        shape(
          () => c() ? lados(c().i) : 3,
          () => c() ? Math.pow(prog(), 1.4) * C.finalIris * peso(c().i) : -1,
          0.004)
          .rotate(() => c() ? prog() * C.giroIris * f2(C.giro) * GRADOS * c().dir : 0)
          .scale(1, ASP, 1))
    }
    return img
  }

  const corte = () => {
    const c = S.corte
    const x = () => (t() - c.t0) / durCorte()
    const abre = () => { const v = x(); return v >= 1 ? 0 : Math.sin(Math.PI * v) }
    const cual = () => x() < 0.5 ? c.de : c.a
    const franjasH = shape(2, 0.5, 0.001).repeat(1, () => C.franjas).brightness(-0.5)
    const franjasV = shape(2, 0.5, 0.001).rotate(Math.PI / 2).repeat(() => C.franjas, 1).brightness(-0.5)
    return shape(() => lados(cual()), () => C.tamCorte * f2(C.tamano) * peso(cual()), 0.004)
      .scale(() => 1 + C.popCorte * f2(C.latido) * latido(0.12))
      .scale(1, ASP, 1)
      .modulateScrollX(franjasH, () => c.vertical ? 0 : 2 * C.separa * abre())
      .modulateScrollY(franjasV, () => c.vertical ? 2 * C.separa * abre() : 0)
  }

  const anidado = () => {
    const z = () => paso(C.durAnidado)
    const nivelA = j => {
      const m = () => Math.floor(z()) - 3 + j
      return shape(
          () => lados(m()),
          () => C.tamAnidado * f2(C.tamano) * peso(m()) * Math.pow(C.adentro, m() - z()),
          0.004)
        .rotate(() => (m() - z()) * C.giroAnidado * f2(C.giro) * GRADOS)
        .scale(() => 1 + C.popAnidado * f2(C.latido) * latido(0.12))
        .scale(1, ASP, 1)
    }
    const fondo = () => mod(Math.floor(z()) - 3, 2)
    let img = solid(fondo, fondo, fondo)
    for (let j = 0; j < Math.min(14, C.niveles); j++) img = img.diff(nivelA(j))
    return img
  }

  const lente = () => {
    const p = () => paso(C.durLente)
    const lugar = eje => {
      const P = C.posLente, i = Math.floor(p()), f = frac(p())
      const a0 = P[mod(i, P.length)][eje], b0 = P[mod(i + 1, P.length)][eje]
      return a0 + (b0 - a0) * f
    }
    const dx = () => 0.5 - lugar(0), dy = () => 0.5 - lugar(1)
    const ld = d => () => lados(Math.floor(p()) + d)
    const campo = d => () => 2 * C.tamLente * f2(C.tamano) * peso(Math.floor(p()) + d) + 1e-4
    const campoLente = () => shape(ld(0), 0, campo(0)).blend(shape(ld(1), 0, campo(1)), () => frac(p())).scale(1, ASP, 1)
    const borde = campoLente().thresh(0.5, 0.004).scrollX(dx).scrollY(dy)
    return shape(() => C.formaGrilla === 'cuadrado' ? 4 : 100, 0.5, 0.03)
      .repeat(() => C.columnas, () => C.filasLente)
      .scrollX(() => t() * C.derivaLente, 0)                     // la grilla se desliza
      .scrollX(() => -dx()).scrollY(() => -dy())
      .modulateScale(campoLente(), () => C.lupa + C.popLente * f2(C.latido) * latido(0.2))
      .scrollX(dx).scrollY(dy)
      .diff(borde)
  }

  const ARMAR = { morfo, iris, corte, anidado, lente }

  // ============================================================
  // DIBUJO
  // ============================================================
  // aro: círculo con centro movible y corregido para pantalla ancha (v2.0)
  const definirAro = () => setFunction({
    name: 'aro',
    type: 'src',
    inputs: [
      { type: 'float', name: 'cx', default: 0.5 },
      { type: 'float', name: 'cy', default: 0.5 },
      { type: 'float', name: 'radio', default: 0.2 },
      { type: 'float', name: 'borde', default: 0.06 },
      { type: 'float', name: 'hueco', default: 0.0 },
      { type: 'float', name: 'barrido', default: 0.0 },
      { type: 'float', name: 'sombra', default: 0.0 },
      { type: 'float', name: 'multi', default: 0.0 },
    ],
    glsl: `
      float asp = resolution.x / resolution.y;
      vec2 p = vec2((_st.x - 0.5) * asp + 0.5, _st.y);
      vec2 c = vec2((cx - 0.5) * asp + 0.5, cy);
      float d = distance(p, c);
      float afuera  = smoothstep(radio - borde, radio, d);
      float adentro = smoothstep(hueco - 0.02, hueco, d);
      float v = clamp(adentro - afuera, 0.0, 1.0);
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

  // en la escena de círculos se ven todos; en las otras, los de la canción
  // según C.circulos y los golpes siempre
  const capaCirculos = s => (C.escena === 'circulos' || s.tipo === 'golpe') ? 1 : clamp01(C.circulos)

  const circulo = i => {
    const s = slots[i]
    const luz = () => nivel(s) * s.jl * fluct(s) * s.luzMult * capaCirculos(s)
    return aro(
        () => posX(s) + s.jx,
        () => posY(s) + s.jy,
        () => radioActual(s) * s.jr,
        () => C.borde,
        () => radioActual(s) * C.huecoAlIrse * (s.sostenida ? 0 : clamp01(1 - nivel(s) / Math.max(s.nivelSuelta, 0.001))),
        () => s.barrido,
        () => C.barridoFuerza * vozEnv,
        () => C.multicolor
      )
      .color(() => s.rgb[0] * luz(), () => s.rgb[1] * luz(), () => s.rgb[2] * luz())
  }
  const todosLosCirculos = () => {
    let img = solid(0, 0, 0)
    for (let i = 0; i < N; i++) img = img.add(circulo(i))
    return img
  }

  let salidaOut = null
  let armada = null
  let pendiente = null, tPendiente = 0
  const colorFormas = () => hsvARgb(C.hue, C.sat)

  const armar = () => {
    if (!salidaOut) return
    let img
    if (ARMAR[C.escena]) {
      // forma blanco/negro → color de la canción, con la vibración del mic
      const luz = () => C.luzFormas * J.l
      img = ARMAR[C.escena]()
        .scrollX(() => J.x).scrollY(() => J.y)
        .scale(() => J.r)
        .color(() => colorFormas()[0] * luz(), () => colorFormas()[1] * luz(), () => colorFormas()[2] * luz())
        .add(todosLosCirculos())
    } else {
      img = todosLosCirculos()
    }
    img
      .add(solid(() => C.flashColor[0], () => C.flashColor[1], () => C.flashColor[2]), flash)
      .out(salidaOut)
    armada = C.escena
  }

  V.salida = (out) => { salidaOut = out; armar() }

  V.update = () => {
    const v = voz()
    const dt = Math.min(0.1, Math.max(0, t() - ultimo))
    ultimo = t()
    vozEnv += (v - vozEnv) * (v > vozEnv ? C.vozAtaque : C.vozCaida)
    for (const s of slots) {
      s.jx = (Math.random() - 0.5) * 2 * v * C.micPos
      s.jy = (Math.random() - 0.5) * 2 * v * C.micPos
      s.jl = 1 - Math.random() * v * C.micLuz
      s.jr = 1 + (Math.random() - 0.5) * 2 * v * C.micTam
      s.barrido += dt * C.barridoVel * v
    }
    J.x = (Math.random() - 0.5) * 2 * v * C.micPos * 0.5
    J.y = (Math.random() - 0.5) * 2 * v * C.micPos * 0.5
    J.l = 1 - Math.random() * v * C.micLuz * 0.6
    J.r = 1 + (Math.random() - 0.5) * 2 * v * C.micTam * 0.4

    // iris: las formas que ya taparon la pantalla pasan al fondo
    const d = durIris()
    for (let k = S.capas.length - 1; k >= 0; k--) {
      if ((t() - S.capas[k].t0) / d >= 1) { S.capas.splice(k, 1); S.fondoIris ^= 1 }
    }
    // cambio de escena: primero nace un golpe central y, cuando ya tapa la
    // pantalla, se re-arma la escena (así no se ve el salto de Hydra al recompilar)
    if (C.escena !== armada && C.escena !== pendiente) {
      if (armada !== null && C.golpeAlCambiar) {
        pendiente = C.escena
        tPendiente = t() + C.golpeDur * 0.7
        V.notaOn(2999, 110, { tipo: 'golpe' })
        setTimeout(() => V.notaOff(2999), 150)
      } else armar()
    }
    if (pendiente !== null && t() >= tPendiente) { pendiente = null; armar() }
  }

  // ---- demo sin hardware (~103 BPM) ----
  if (window._vociferanDemo) window._vociferanDemo.forEach(clearInterval)
  window._vociferanDemo = [
    setInterval(() => {
      if (!C.demo) return
      const nota = C.notaGrave + Math.floor(Math.random() * (C.notaAguda - C.notaGrave))
      V.notaOn(nota, 100); V.voz('melodia')
      setTimeout(() => V.notaOff(nota), 120)
    }, 290),
    setInterval(() => { if (!C.demo) return; if (C.strobe) V.golpe(); V.voz('bombo') }, 580),
    setInterval(() => { if (C.demo) V.voz('caja') }, 1160),
  ]

  // ---- init ----
  V.init = (config = {}) => {
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    definirAro()
    if (typeof a !== 'undefined' && a.setBins) {
      a.setBins(4)
      a.setSmooth(0.4)
      a.setScale(8)
      a.setCutoff(0.1)
      if (C.mostrarMic && codigoVisible) a.show()
      else a.hide()
    }
    armada = null
    pendiente = null
    return V
  }

  V.reiniciar = () => {
    Object.assign(S, { n: 1, t0: -99, tg: -99, capas: [], fondoIris: 0,
      corte: { t0: -99, de: 0, a: 0, vertical: false } })
  }

  console.log('[GP] visual Vociferan ' + VERSION + ' (DESARROLLO, produccion/03_Vociferan/fase3) cargado')
})()
