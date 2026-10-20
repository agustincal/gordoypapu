// ============================================================
// GP_04_James__visual.js  ·  LIVE/arq/
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: motor visual — formas puras (triángulo, cuadrado, círculo) en blanco y negro,
//      con 5 escenas que se transforman con las notas
// Lo carga el sketch (LIVE/sketches/04_James_vXX.js); el sketch llama GP.james.*
// Actualizado: 17/10/2026 (v2.0: rehecho desde cero a partir de los ejemplos de
//              diseño de produccion/04_James/sketches — morfo, iris, corte,
//              anidado y lente. Reemplaza al muro de monitores de la v1.0)
// ============================================================
//
// Escenas (C.escena):
//   'morfo'    una forma que se derrite en la siguiente
//   'iris'     formas que nacen en el centro y crecen invirtiendo todo (diff)
//   'corte'    la forma se corta en franjas que se separan y vuelve como la siguiente
//   'anidado'  formas una adentro de otra; cada cambio hace zoom un nivel
//   'lente'    una lente con forma agranda una grilla de cuadrados y la invierte
//
// Qué hace la música: cada voz ('bajo', 'melodia', 'bombo', 'caja') puede
// cumplir uno de tres papeles, y cada estado elige cuál:
//   C.cambio    la voz que hace pasar a la forma siguiente (la transición)
//   C.golpe     la voz que hace latir la forma
//   C.invierte  la voz que invierte toda la pantalla (blanco ↔ negro) con cada nota
//
// Todo lo ajustable vive en GP.james.C. Ahí escriben:
//   - el sketch, con V.init({ ... })            (la base de la canción)
//   - GP_estados, al cambiar de estado          (lo que anota cada estado)
//   - los faders y toggles, a través de GP_estados
//   - vos, en vivo:  V.C.durMorfo = 1  + Ctrl+Enter
//
// El sketch llama:
//   GP.james.init(config)                una vez por evaluación
//   GP.james.update()                    dentro de update = () => {...}
//   GP.james.salida(o0)                  para dibujar
//   GP.james.nota(voz, nota, vel, on)    desde su ruteo MIDI
//   GP.james.mano(accion)                pads a mano: una escena, o 'cambio' | 'golpe' | 'invierte'
//   GP.james.toggleCodigo()              oculta / muestra el código y los paneles
//   GP.james.alEntrarEstado()            desde GP.estados (alEntrar): limpia la inversión
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v2.0'

  if (GP.james && GP.james._version === VERSION) return
  GP.james = { _version: VERSION }
  const V = GP.james

  const clamp01 = v => Math.max(0, Math.min(1, v))
  const mod = (a, n) => ((a % n) + n) % n
  const frac = x => x - Math.floor(x)
  const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2
  const GRADOS = Math.PI / 180
  const ASP = () => (typeof width !== 'undefined' && width) ? height / width : 9 / 16
  const LADOS = [3, 4, 100]               // triángulo, cuadrado, círculo
  const PESO = [0.78, 0.89, 1]            // triángulo y cuadrado más chicos: mismo peso visual que el círculo
  const ESCENAS = ['morfo', 'iris', 'corte', 'anidado', 'lente']
  const MAX_CAPAS = 6                     // iris: formas creciendo a la vez

  // ---- valores por defecto (V.init vuelve a estos y aplica la config del sketch) ----
  const DEFAULTS = {
    escena: 'morfo',

    // papeles de cada voz: 'bajo' | 'melodia' | 'bombo' | 'caja' | 'ninguna'
    cambio: 'bajo',
    golpe: 'bombo',
    invierte: 'ninguna',

    // faders (de 0 a 1 · 0.5 = como en los ejemplos)
    tamano: 0.5,          // 0 = no se ve nada · 1 = el doble
    tiempo: 0.5,          // duración de las transiciones · 0 = corte seco · 1 = el doble de lento
    giro: 0.5,            // cuánto giran las formas en cada cambio · 0 = no giran
    latido: 0.5,          // cuánto laten con el golpe · 0 = nada

    // toggles
    negativo: false,      // todo invertido
    quieto: false,        // congela: las notas de 'cambio' no hacen nada

    separacion: 0.25,     // segundos mínimos entre dos cambios (notas más juntas cuentan como una)

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
    posLente: [[0.5, 0.5], [0.33, 0.58], [0.66, 0.42], [0.45, 0.38]],

    // pruebas sin hardware: bajo cada 2 negras, bombo en cada negra, caja en 2 y 4, melodía cada compás
    demo: false,
    demoBpm: 136,
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS
  V.ESCENAS = ESCENAS

  const f2 = v => 2 * clamp01(v)            // fader 0..1 → multiplicador 0..2 (0.5 = 1)
  const t = () => time

  // ============================================================
  // Estado de la música (se conserva al reevaluar)
  // ============================================================
  const S = window._jamesS || (window._jamesS = {
    n: 1, t0: -99,          // cambios que van · cuándo fue el último
    tg: -99,                // último golpe
    inv: 0,                 // inversión por la voz 'invierte'
    capas: [], fondoIris: 0,
    corte: { t0: -99, de: 0, a: 0, vertical: false },
  })
  V.S = S

  const dur = base => base * f2(C.tiempo)
  // sube de a 1 con cada cambio; la parte decimal es el avance de la transición
  const paso = base => {
    const d = dur(base)
    return S.n - 1 + (d <= 0.001 ? 1 : suave((t() - S.t0) / d))
  }
  const golpe = caida => Math.exp(-Math.max(0, t() - S.tg) / caida)
  const durIris = () => Math.max(0.3, dur(C.durIris))
  const durCorte = () => Math.max(0.05, dur(C.durCorte))

  // ============================================================
  // Acciones
  // ============================================================
  let ultimoCambio = -99
  const cambio = (aMano = false) => {
    if (C.quieto && !aMano) return
    if (!aMano && t() - ultimoCambio < C.separacion) return
    ultimoCambio = t()
    S.n++
    S.t0 = t()
    // iris: nace una forma (si ya hay demasiadas, la más vieja pasa al fondo)
    S.capas.push({ t0: t(), i: S.n, dir: S.n % 2 ? 1 : -1 })
    if (S.capas.length > MAX_CAPAS) { S.capas.shift(); S.fondoIris ^= 1 }
    // corte: arranca otro (si el anterior no llegó a la mitad, su forma nueva se saltea)
    const c = S.corte
    c.de = c.a
    c.a = c.a + 1
    c.t0 = t()
    c.vertical = !c.vertical
  }
  const latir = () => { S.tg = t() }
  const invertir = () => { S.inv ^= 1 }

  V.nota = (voz, nota, vel, on) => {
    if (!on) return
    if (C.cambio === voz) cambio()
    if (C.golpe === voz) latir()
    if (C.invierte === voz) invertir()
  }

  V.mano = (accion) => {
    if (ESCENAS.includes(accion)) { C.escena = accion; return }
    if (accion === 'cambio') cambio(true)
    else if (accion === 'golpe') latir()
    else if (accion === 'invierte') invertir()
  }

  // ============================================================
  // Escenas (cada una arma una cadena nueva de Hydra)
  // ============================================================

  // Morfo: mezcla de dos "campos" (blanco en el centro, se apaga hacia afuera)
  // cortada en la mitad = una forma de borde duro que se derrite en la otra
  const morfo = () => {
    const p = () => paso(C.durMorfo)
    const lados = k => () => LADOS[mod(Math.floor(p()) + k, 3)]
    const campo = k => () => 2 * C.tamMorfo * f2(C.tamano) * PESO[mod(Math.floor(p()) + k, 3)] + 1e-4
    return shape(lados(0), 0, campo(0))
      .blend(shape(lados(1), 0, campo(1)), () => frac(p()))
      .thresh(0.5, 0.004)
      .rotate(() => p() * C.giroMorfo * f2(C.giro) * GRADOS)
      .scale(() => 1 + C.popMorfo * f2(C.latido) * golpe(0.12))
      .scale(1, ASP, 1)
  }

  // Iris: cada cambio hace nacer una forma que crece hasta tapar todo; con diff
  // invierte lo que hay abajo. Al tapar la pantalla pasa al fondo (que se invierte).
  const iris = () => {
    let img = solid(() => S.fondoIris, () => S.fondoIris, () => S.fondoIris)
    for (let k = 0; k < MAX_CAPAS; k++) {
      const c = () => S.capas[k]
      const prog = () => c() ? Math.max(0, (t() - c().t0) / durIris()) : 0
      img = img.diff(
        shape(
          () => c() ? LADOS[mod(c().i, 3)] : 3,
          () => c() ? Math.pow(prog(), 1.4) * C.finalIris * PESO[mod(c().i, 3)] : -1,
          0.004)
          .rotate(() => c() ? prog() * C.giroIris * f2(C.giro) * GRADOS * c().dir : 0)
          .scale(1, ASP, 1))
    }
    return img
  }

  // Corte: la forma se corta en franjas que se separan (desplazamiento con un
  // mapa de franjas +0.5 / -0.5). En el medio del corte cambia de forma.
  // Un cambio corta en franjas horizontales, el siguiente en verticales.
  const corte = () => {
    const c = S.corte
    const x = () => (t() - c.t0) / durCorte()
    const abre = () => { const v = x(); return v >= 1 ? 0 : Math.sin(Math.PI * v) }
    const cual = () => mod(x() < 0.5 ? c.de : c.a, 3)
    const franjasH = shape(2, 0.5, 0.001).repeat(1, () => C.franjas).brightness(-0.5)
    const franjasV = shape(2, 0.5, 0.001).rotate(Math.PI / 2).repeat(() => C.franjas, 1).brightness(-0.5)
    return shape(() => LADOS[cual()], () => C.tamCorte * f2(C.tamano) * PESO[cual()], 0.004)
      .scale(() => 1 + C.popCorte * f2(C.latido) * golpe(0.12))
      .scale(1, ASP, 1)
      .modulateScrollX(franjasH, () => c.vertical ? 0 : 2 * C.separa * abre())
      .modulateScrollY(franjasV, () => c.vertical ? 2 * C.separa * abre() : 0)
  }

  // Anidado: formas una adentro de otra alternando con diff. Cada cambio hace
  // zoom un nivel: la de adentro crece hasta ocupar el lugar de la de afuera.
  const anidado = () => {
    const z = () => paso(C.durAnidado)
    const nivel = j => {
      const m = () => Math.floor(z()) - 3 + j
      return shape(
          () => LADOS[mod(m(), 3)],
          () => C.tamAnidado * f2(C.tamano) * PESO[mod(m(), 3)] * Math.pow(C.adentro, m() - z()),
          0.004)
        .rotate(() => (m() - z()) * C.giroAnidado * f2(C.giro) * GRADOS)
        .scale(() => 1 + C.popAnidado * f2(C.latido) * golpe(0.12))
        .scale(1, ASP, 1)
    }
    const fondo = () => mod(Math.floor(z()) - 3, 2)    // los niveles que ya quedaron afuera
    let img = solid(fondo, fondo, fondo)
    for (let j = 0; j < Math.min(14, C.niveles); j++) img = img.diff(nivel(j))
    return img
  }

  // Lente: una grilla de cuadrados desplazada por el campo de una lente (lupa;
  // el degradado está sólo en el desplazamiento). La lente con borde duro
  // invierte lo que tiene abajo. Con cada cambio se mueve y se transforma.
  const lente = () => {
    const p = () => paso(C.durLente)
    const lugar = eje => {
      const P = C.posLente, i = Math.floor(p()), f = frac(p())
      const a = P[mod(i, P.length)][eje], b = P[mod(i + 1, P.length)][eje]
      return a + (b - a) * f
    }
    const dx = () => 0.5 - lugar(0), dy = () => 0.5 - lugar(1)
    const lados = d => () => LADOS[mod(Math.floor(p()) + d, 3)]
    const campo = d => () => 2 * C.tamLente * f2(C.tamano) * PESO[mod(Math.floor(p()) + d, 3)] + 1e-4
    const campoLente = () => shape(lados(0), 0, campo(0)).blend(shape(lados(1), 0, campo(1)), () => frac(p())).scale(1, ASP, 1)
    const borde = campoLente().thresh(0.5, 0.004).scrollX(dx).scrollY(dy)
    return shape(4, 0.5, 0.02)
      .repeat(() => C.columnas, () => C.filasLente)
      .scrollX(() => -dx()).scrollY(() => -dy())                 // el centro de la lente al medio,
      .modulateScale(campoLente(), () => C.lupa + C.popLente * f2(C.latido) * golpe(0.2))   // agranda,
      .scrollX(dx).scrollY(dy)                                   // y vuelve a su lugar
      .diff(borde)
  }

  const ARMAR = { morfo, iris, corte, anidado, lente }

  // ============================================================
  // Salida: la escena actual + inversión global
  // ============================================================
  let salidaOut = null
  let armada = null
  const inversion = () => (C.negativo ? 1 : 0) ^ S.inv

  const armar = () => {
    if (!salidaOut) return
    const nombre = ARMAR[C.escena] ? C.escena : 'morfo'
    ARMAR[nombre]()
      .diff(solid(inversion, inversion, inversion))
      .out(salidaOut)
    armada = C.escena
  }

  V.salida = (out) => { salidaOut = out; armar() }

  V.update = () => {
    // iris: las formas que ya taparon la pantalla pasan al fondo
    const d = durIris()
    for (let k = S.capas.length - 1; k >= 0; k--) {
      if ((t() - S.capas[k].t0) / d >= 1) { S.capas.splice(k, 1); S.fondoIris ^= 1 }
    }
    // cambio de escena (por estado o a mano): se re-arma la cadena
    if (C.escena !== armada) armar()
  }

  // ============================================================
  // Ocultar código y paneles para el show
  // ============================================================
  let codigoVisible = true
  V.toggleCodigo = () => {
    codigoVisible = !codigoVisible
    const partes = ['.CodeMirror', '#editor-container', '#toolbar', '#menu', '#info-container', '#modal']
    document.querySelectorAll(partes.join(',')).forEach(el => {
      el.style.visibility = codigoVisible ? '' : 'hidden'
    })
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(codigoVisible)
  }

  // ============================================================
  // Demo sin hardware
  // ============================================================
  if (window._jamesDemo) clearInterval(window._jamesDemo)
  let demoProx = 0, demoPaso = 0
  window._jamesDemo = setInterval(() => {
    if (!C.demo) return
    const ahora = performance.now()
    if (ahora < demoProx) return
    const semi = 60000 / Math.max(30, C.demoBpm) / 4
    demoProx = ahora - demoProx < 200 ? demoProx + semi : ahora + semi
    const p = demoPaso++
    if (p % 4 === 0) V.nota('bombo', 36, 110, true)
    if (p % 16 === 4 || p % 16 === 12) V.nota('caja', 38, 110, true)
    if (p % 8 === 0) V.nota('bajo', 31 + Math.floor(Math.random() * 6), 100, true)
    if (p % 16 === 6) V.nota('melodia', 64 + Math.floor(Math.random() * 24), 100, true)
  }, 5)

  // ============================================================
  // init
  // ============================================================
  V.init = (config = {}) => {
    // vuelve a los valores por defecto antes de aplicar la config: así un valor
    // que dejó un estado (o un ajuste a mano) no queda pegado al reevaluar
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    armada = null
    return V
  }

  // al entrar a un estado: la inversión de la voz 'invierte' vuelve a cero,
  // así 'negativo' de cada estado se ve como fue anotado
  V.alEntrarEstado = () => { S.inv = 0 }

  // vuelve todo al principio (formas, capas, inversión)
  V.reiniciar = () => {
    Object.assign(S, { n: 1, t0: -99, tg: -99, inv: 0, capas: [], fondoIris: 0,
      corte: { t0: -99, de: 0, a: 0, vertical: false } })
  }

  console.log('[GP] visual James ' + VERSION + ' (LIVE) cargado')
})()
