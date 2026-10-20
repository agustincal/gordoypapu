// ============================================================
// GP_04_James__visual_v04.js  ·  produccion/04_James/arq/  (DESARROLLO)
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: motor visual v04 — las puertas de la v03, ahora tocadas por la música.
//      Rectángulos de luz, blanco puro, pantalla completa.
// Lo carga el sketch produccion/04_James/sketches/04_James_v04.js; el sketch llama GP.james.*
// Actualizado: 20/10/2026 (v4.0: las notas abren y cierran las puertas — el bajo y la melodía
//              las sostienen mientras suena la nota, como una tecla; la batería las toca cortas.
//              Cada estado elige qué voz dispara, cuál cruza y cuál golpea.
//              La v03 (reloj fijo) queda intacta en GP_04_James__visual_v03.js)
// ============================================================
//
// QUÉ SE VE
//   La pantalla, partida en franjas horizontales (F1: de 1 a 8). Cada franja es una puerta:
//   se abre desde un borde, se sostiene y se va hacia el otro borde, con un ease in-out
//   pronunciado (curva). El borde que se mueve deja una estela adentro de su recuadro (F2).
//   F3 da la duración del gesto (de una negra a una redonda) sin cambiar su forma.
//
// QUÉ HACE LA MÚSICA (cada estado elige)
//   C.disparo   la voz que abre las puertas: 'bajo' | 'melodia' | 'bombo' | 'caja' | 'reloj' | 'ninguna'
//                 bajo y melodía: la puerta queda abierta mientras suena la nota (tecla de piano)
//                 bombo y caja:   la puerta se abre, se sostiene un instante (sostiene) y se va
//                 reloj:          sin música, una puerta cada tanto (como la v03)
//   C.cruce     la voz que dispara una segunda capa en sentido contrario; donde se pisan, diff
//   C.golpe     la voz que prende la pantalla entera y la cierra en barrido
//   C.porAltura cada nota prende SÓLO su franja (grave abajo, agudo arriba);
//               la batería, una franja al azar. Si no, cada nota abre todas, escalonadas.
//   C.golpeAlCambiar  cada cambio de estado (canal 16) se marca con un golpe
//
// Todo lo ajustable vive en GP.james.C (V.init, GP_estados, faders, o en vivo con Ctrl+Enter).
//
// El sketch llama:
//   GP.james.init(config) · .salida(o0) · .update()
//   GP.james.midi(nombre, data)        todo lo que entra (para el clock)
//   GP.james.nota(voz, nota, vel, on)  'bajo' | 'melodia' | 'bombo' | 'caja'
//   GP.james.mano(accion)              'golpe' | 'gesto' (pads a mano)
//   GP.james.soltarVoz(voz)            suelta lo que dejó sonando esa voz (ej: al mutear su fila)
//   GP.james.alEntrarEstado()          desde GP.estados (marca el corte)
//   GP.james.toggleCodigo() · .negras() · .reiniciar()
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v4.0'

  if (GP.james && GP.james._version === VERSION) return
  GP.james = { _version: VERSION }
  const V = GP.james

  // ease in-out con la fuerza que quieras: p = 3 suave · p = 6 muy pronunciada
  const inOut = (x, p) => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2 * x, p) / 2 : 1 - Math.pow(2 - 2 * x, p) / 2
  const frac = x => x - Math.floor(x)
  const azar = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453)
  const clamp01 = v => Math.max(0, Math.min(1, v))

  // ---- valores por defecto ----
  const DEFAULTS = {
    bpm: 136,                    // reloj propio, sólo si no llega clock MIDI

    // ---- quién hace qué ----
    disparo: 'bajo',             // voz que abre las puertas
    cruce: 'ninguna',            // voz que dispara la capa que cruza en sentido contrario (diff)
    golpe: 'ninguna',            // voz que prende la pantalla entera
    porAltura: false,            // cada nota prende sólo su franja (grave abajo)
    golpeAlCambiar: true,        // cada cambio de estado se marca con un golpe
    rangos: { bajo: [31, 38], melodia: [64, 88] },   // notas que se reparten en las franjas
    separacion: 0.25,            // negras: una nota que llega antes de esto sobre la misma franja
                                 // la alarga (legato) en vez de cortarla y empezar otra
    maxSostenida: 16,            // negras: una nota colgada (sin note-off) se suelta sola
    direccion: 1,                // 1 = se abren desde la izquierda · -1 = desde la derecha

    // ---- faders ----
    franjas: 3 / 7,              // F1 · 0 = 1 franja · 1 = 8 franjas
    estela: 0.3,                 // F2 · 0 = borde duro · 1 = estela muy larga
    duracion: 0.5,               // F3 · duración del gesto: 0 = durMin · 1 = durMax
    durMin: 1,                   // negras con F3 abajo (una negra)
    durMax: 4,                   // negras con F3 arriba (una redonda)

    // ---- forma del gesto (proporciones: la duración real la da F3) ----
    abre: 4,                     // lo que tarda en abrir
    sostiene: 1,                 // lo que queda abierto (sólo batería y reloj: bajo y melodía lo sostienen con la nota)
    sostieneMax: 4,              // lo máximo que una nota larga deja la puerta abierta (0 = sin límite):
                                 // el bajo de James sostiene notas de varios segundos y la pantalla quedaría quieta
    cierra: 4,                   // lo que tarda en irse
    demora: 0.5,                 // demora máxima de cada franja cuando se abren todas juntas (escalonado)
    curva: 6,                    // fuerza del ease in-out (3 suave · 6 pronunciado · 10 extremo)
    linea: 0.004,                // la puerta nunca es más fina que esta línea

    // ---- versiones (botón redondo arriba de cada fader: v1 → v2 → v3) ----
    verFranjas: 0,               // V1 · 0 parejas · 1 desparejas (alto al azar, cambia en cada estado) · 2 persiana
    verEstela: 0,                // V2 · 0 degradado · 1 eco (en escalones) · 2 agujas
    verGesto: 0,                 // V3 · 0 desplazamiento · 1 ida y vuelta · 2 cruzado (cada disparo cruza también)
    hueco: 0.35,                 // persiana: parte negra de cada franja
    escalones: 4,                // eco: escalones del degradado
    agujas: 7,                   // agujas: líneas que deja el borde

    // ---- golpe: la pantalla entera ----
    golpeSostiene: 0.25,         // negras que queda toda blanca
    golpeCierra: 1.5,            // negras que tarda el barrido en llevársela

    // ---- reloj (disparo: 'reloj') ----
    ciclo: 0,                    // negras entre puertas (0 = lo que dura el gesto, redondeado)
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS
  const MAX_FRANJAS = 8

  // ============================================================
  // Pulso: clock MIDI (o reloj propio)
  // ============================================================
  const R = window._jamesReloj || (window._jamesReloj = { ticks: 0, tUltimo: -1e9, periodo: 1000 / (136 / 60 * 24) })
  V.midi = (nombre, data) => {
    const st = data[0]
    if (st === 0xfa) { R.ticks = 0; R.tUltimo = performance.now(); return }        // Start
    if (st !== 0xf8) return                                                          // sólo clock
    const ahora = performance.now()
    const d = ahora - R.tUltimo
    if (d > 5 && d < 200) R.periodo += (d - R.periodo) * 0.1                         // tempo suavizado
    R.tUltimo = ahora
    R.ticks++
  }
  const hayClock = () => performance.now() - R.tUltimo < 1000
  const nb = () => {
    if (hayClock()) {
      const entre = Math.min(1, (performance.now() - R.tUltimo) / R.periodo)
      return (R.ticks + entre) / 24
    }
    return time * C.bpm / 60
  }
  V.negras = nb

  // ============================================================
  // Tiempos del gesto (F3)
  // ============================================================
  const escala = () => {
    const dur = C.durMin * Math.pow(C.durMax / C.durMin, clamp01(C.duracion))   // de negra a redonda
    return dur / Math.max(0.001, C.abre + C.sostiene + C.cierra)
  }
  const T = k => C[k] * escala()               // abre, sostiene, cierra, demora en negras
  const nFranjas = () => 1 + Math.round(clamp01(C.franjas) * (MAX_FRANJAS - 1))

  // ============================================================
  // Gestos: cada franja de cada capa tiene el suyo
  //   capa 0 = la de siempre · capa 1 = la que cruza en sentido contrario (diff)
  // Un gesto: { inicio, suelta (null = la nota sigue sonando), notas que lo sostienen, prev }
  // prev = el gesto anterior de esa franja: se sigue dibujando mientras se va, así una nota
  // nueva entra mientras la anterior sale (no la corta)
  // ============================================================
  const nuevoGesto = () => ({ inicio: -1e9, suelta: -1e9, notas: new Set(), prev: null })
  const S = window._jamesV4 || (window._jamesV4 = {
    g: [Array.from({ length: MAX_FRANJAS }, nuevoGesto), Array.from({ length: MAX_FRANJAS }, nuevoGesto)],
    golpe: -1e9,
    semilla: 0,
    cuenta: 0,
    reloj: -1,
  })
  V.S = S

  // cuándo empieza a irse: al soltar la nota, nunca antes de terminar de abrir,
  // y nunca después de sostieneMax (aunque la nota siga sonando)
  const cierreDe = g => {
    const abierta = g.inicio + T('abre')
    const tope = C.sostieneMax > 0 ? abierta + T('sostieneMax') : Infinity
    return Math.max(abierta, Math.min(g.suelta === null ? Infinity : g.suelta, tope))
  }

  // en qué momento está un gesto en la negra n: { desde, hasta } (0 = borde de entrada) o null
  const momentoDe = (g, n) => {
    if (!g || n < g.inicio) return null
    const ab = T('abre'), ci = T('cierra')
    const t = n - g.inicio
    if (t < ab) return { desde: 0, hasta: inOut(t / ab, C.curva) }
    const cierre = cierreDe(g)
    if (n < cierre) return { desde: 0, hasta: 1 }
    const c = (n - cierre) / ci
    if (c >= 1) return null
    if ((C.verGesto | 0) === 1) return { desde: 0, hasta: 1 - inOut(c, C.curva) }   // ida y vuelta
    return { desde: inOut(c, C.curva), hasta: 1 }                                    // se desplaza
  }

  // empieza un gesto en la franja j de la capa
  //   clave: la nota que lo sostiene (null = gesto corto, se suelta solo)
  const tocarFranja = (capa, j, clave, atraso) => {
    const g = S.g[capa][j], n = nb()
    // legato: una nota que llega muy pegada a la anterior la alarga en vez de cortarla
    if (clave && n - (g.inicio - (g.atraso || 0)) < C.separacion && n < cierreDe(g)) {
      g.suelta = null
      g.notas.add(clave)
      return
    }
    const inicio = n + atraso
    // el que estaba sonando se suelta: la nota nueva lo reemplaza, pero se va con su animación
    const anterior = { inicio: g.inicio, atraso: g.atraso || 0, suelta: g.suelta === null ? inicio : g.suelta, notas: new Set(), prev: null }
    S.g[capa][j] = {
      inicio,
      atraso,
      suelta: clave ? null : inicio + T('sostiene'),
      notas: new Set(clave ? [clave] : []),
      prev: anterior,
    }
  }
  const soltarClave = clave => {
    for (const capa of S.g) for (const g of capa) {
      if (!g.notas.has(clave)) continue
      g.notas.delete(clave)
      if (g.notas.size === 0 && g.suelta === null) g.suelta = nb() + (g.atraso || 0)
    }
  }

  // qué franjas toca una nota
  const franjasDe = (voz, nota) => {
    const n = nFranjas()
    if (!C.porAltura) return Array.from({ length: n }, (_, j) => j)
    const r = C.rangos[voz]
    if (!r) return [Math.floor(azar(nota * 1.3 + S.cuenta, 7.7) * n)]    // batería: una al azar
    const k = Math.floor((nota - r[0]) / Math.max(1, r[1] - r[0] + 1) * n)
    return [n - 1 - Math.max(0, Math.min(n - 1, k))]                       // grave abajo
  }
  const sostenida = voz => voz === 'bajo' || voz === 'melodia'

  const disparar = (capa, voz, nota, clave) => {
    S.cuenta++
    const js = franjasDe(voz, nota)
    js.forEach(j => {
      const atraso = js.length > 1 ? T('demora') * azar(j * 7.31 + capa * 5.3 + 1.7, S.cuenta * 3.1 + 0.5) : 0
      tocarFranja(capa, j, sostenida(voz) ? clave : null, atraso)
    })
  }

  // ---- golpe: la pantalla entera blanca, se va en barrido ----
  V.golpe = () => { S.golpe = nb() }

  // ---- lo que entra ----
  V.nota = (voz, nota, vel, on) => {
    const clave = voz + ':' + nota
    if (!on) { soltarClave(clave); soltarClave(clave + ':x'); soltarClave(clave + ':c'); return }
    if (C.disparo === voz) {
      disparar(0, voz, nota, clave)
      if ((C.verGesto | 0) === 2) disparar(1, voz, nota, clave + ':x')   // cruzado: cruza también
    }
    if (C.cruce === voz) disparar(1, voz, nota, clave + ':c')
    if (C.golpe === voz) V.golpe()
  }
  V.soltarVoz = voz => {
    for (const capa of S.g) for (const g of capa) {
      for (const k of [...g.notas]) if (k.startsWith(voz + ':')) g.notas.delete(k)
      if (g.notas.size === 0 && g.suelta === null) g.suelta = nb()
    }
  }
  V.mano = accion => {
    if (accion === 'golpe') V.golpe()
    if (accion === 'gesto') { disparar(0, 'mano', 0, null); if ((C.verGesto | 0) === 2) disparar(1, 'mano', 0, null) }
  }
  V.alEntrarEstado = () => {
    S.semilla++                                   // desparejas: otros altos en cada estado
    if (C.golpeAlCambiar) V.golpe()               // el corte de la canción se marca con un golpe
  }
  V.reiniciar = () => {
    S.g = [Array.from({ length: MAX_FRANJAS }, nuevoGesto), Array.from({ length: MAX_FRANJAS }, nuevoGesto)]
    S.golpe = -1e9; S.reloj = -1
  }

  // ============================================================
  // Dibujo
  // ============================================================
  // dónde está la franja j de la capa en la negra n: [x0, x1] o null
  //   cual: 0 = el gesto actual · 1 = el anterior (que se está yendo)
  const posicion = (capa, j, n, cual = 0) => {
    if (j >= nFranjas()) return null
    const g = cual ? S.g[capa][j].prev : S.g[capa][j]
    const m = momentoDe(g, n)
    if (!m) return null
    let d = m.desde, h = m.hasta
    if (h - d < C.linea) { if (d === 0) h = C.linea; else d = h - C.linea }
    const dir = (C.direccion >= 0 ? 1 : -1) * (capa === 1 ? -1 : 1)
    return dir > 0 ? [d, h] : [1 - h, 1 - d]
  }
  // golpe: [x0, x1] de la pantalla entera mientras se va
  const posGolpe = n => {
    const t = n - S.golpe
    if (t < 0 || t > C.golpeSostiene + C.golpeCierra) return null
    const d = t < C.golpeSostiene ? 0 : inOut((t - C.golpeSostiene) / C.golpeCierra, C.curva)
    return C.direccion >= 0 ? [d, 1] : [0, 1 - d]
  }

  // los valores de cada recuadro se calculan una vez por cuadro
  const cache = { t: null, v: {} }
  const conEstela = (pos, antes, paso) => {
    if (!pos) return [2, 2, 0, 0]                           // apagada: fuera de pantalla
    const est = lado => {
      if (!antes || C.estela <= 0) return 0
      const vel = Math.abs(pos[lado] - antes[lado]) / paso  // pantallas por negra
      return Math.min(pos[1] - pos[0], vel * C.estela * escala())
    }
    return [pos[0], pos[1], est(0), est(1)]
  }
  const valor = (clave, calc, k) => () => {
    if (cache.t !== time) { cache.t = time; cache.v = {} }
    if (!cache.v[clave]) cache.v[clave] = calc()
    return cache.v[clave][k]
  }
  const PASO = 0.04
  const valorFranja = (capa, j, cual, k) => valor('f' + capa + '_' + j + '_' + cual, () => {
    const n = nb()
    return conEstela(posicion(capa, j, n, cual), posicion(capa, j, n - PASO, cual), PASO)
  }, k)
  const valorGolpe = k => valor('golpe', () => {
    const n = nb()
    return conEstela(posGolpe(n), posGolpe(n - PASO), PASO)
  }, k)

  // altos de las franjas según la versión de F1
  const cortes = () => {
    const n = nFranjas(), v = C.verFranjas | 0
    if (v !== 1) return Array.from({ length: n + 1 }, (_, j) => j / n)
    const pesos = Array.from({ length: n }, (_, j) => 0.25 + azar(j * 3.7 + 0.9, S.semilla * 1.3 + 7))
    const total = pesos.reduce((x, y) => x + y, 0)
    const c = [0]; pesos.forEach(w => c.push(c[c.length - 1] + w / total))
    return c
  }
  let cacheCortes = { t: null, c: null }
  const altoFranja = (j, lado) => () => {
    if (cacheCortes.t !== time) cacheCortes = { t: time, c: cortes() }
    const c = cacheCortes.c
    if (j >= c.length - 1) return 2
    let y0 = c[j], y1 = c[j + 1]
    if ((C.verFranjas | 0) === 2) { const m = (y1 - y0) * clamp01(C.hueco) / 2; y0 += m; y1 -= m }
    return lado === 0 ? y0 : y1
  }
  const modoEstela = () => C.verEstela | 0
  const pasosEstela = () => (C.verEstela | 0) === 1 ? Math.max(2, C.escalones) : C.agujas

  const capaDe = capa => {
    let luz = solid(0, 0, 0)
    for (let j = 0; j < MAX_FRANJAS; j++) {
      for (const cual of [0, 1]) {                          // el gesto actual y el que se está yendo
        luz = luz.add(caja(valorFranja(capa, j, cual, 0), valorFranja(capa, j, cual, 1), altoFranja(j, 0), altoFranja(j, 1),
          valorFranja(capa, j, cual, 2), valorFranja(capa, j, cual, 3), modoEstela, pasosEstela))
      }
    }
    return luz
  }
  const escena = () => capaDe(0)
    .diff(capaDe(1))                                        // donde se cruzan, se invierte
    .add(caja(valorGolpe(0), valorGolpe(1), 0, 1, valorGolpe(2), valorGolpe(3), modoEstela, pasosEstela))

  const definirCaja = () => setFunction({
    name: 'caja', type: 'src',
    inputs: [
      { type: 'float', name: 'x0', default: 0.25 }, { type: 'float', name: 'x1', default: 0.75 },
      { type: 'float', name: 'y0', default: 0.25 }, { type: 'float', name: 'y1', default: 0.75 },
      { type: 'float', name: 'ei', default: 0.0 }, { type: 'float', name: 'ed', default: 0.0 },
      { type: 'float', name: 'modo', default: 0.0 }, { type: 'float', name: 'pasos', default: 4.0 },
    ],
    // un rectángulo blanco; y de ARRIBA hacia abajo (0 = arriba).
    // ei / ed = estela hacia adentro desde el borde izquierdo / derecho (0 = borde duro)
    // modo: 0 degradado · 1 eco (en 'pasos' escalones) · 2 agujas ('pasos' líneas finas)
    glsl: `
      float y = 1.0 - _st.y;
      float ax = 0.7 / resolution.x, ay = 0.7 / resolution.y;
      float dentro = smoothstep(x0 - ax, x0 + ax, _st.x) * (1.0 - smoothstep(x1 - ax, x1 + ax, _st.x));
      float ri = clamp((_st.x - x0) / max(ei, ax), 0.0, 1.0);
      float rd = clamp((x1 - _st.x) / max(ed, ax), 0.0, 1.0);
      float r = min(ri, rd);
      float e = r;
      if (modo > 0.5 && modo < 1.5) e = r >= 1.0 ? 1.0 : floor(r * pasos) / pasos;
      if (modo > 1.5) {
        float rl = r >= 1.0 ? 0.0 : fract(r * pasos);
        float px = ax * 2.0 / max(max(ei, ed), ax) * pasos;
        e = r >= 1.0 ? 1.0 : (1.0 - smoothstep(0.0, max(px, 0.08), rl));
      }
      float h = dentro * e;
      float v = smoothstep(y0 - ay, y0 + ay, y) * (1.0 - smoothstep(y1 - ay, y1 + ay, y));
      return vec4(vec3(h * v), 1.0);`
  })

  V.salida = (out) => { escena().out(out) }

  V.update = () => {
    const n = nb()
    // notas colgadas (sin note-off): se sueltan solas
    for (const capa of S.g) for (const g of capa) {
      if (g.suelta === null && n - g.inicio > C.maxSostenida) { g.notas.clear(); g.suelta = n }
    }
    // reloj: una puerta cada tanto, sin música
    if (C.disparo === 'reloj') {
      const ciclo = C.ciclo > 0 ? C.ciclo
        : Math.max(1, Math.ceil(T('abre') + T('sostiene') + T('cierra') + T('demora') + 0.25))
      const k = Math.floor(n / ciclo)
      if (k !== S.reloj) {
        S.reloj = k
        disparar(0, 'reloj', 0, null)
        if ((C.verGesto | 0) === 2) disparar(1, 'reloj', 0, null)
      }
    }
  }

  // ---- ocultar código y paneles para el show ----
  let codigoVisible = true
  V.toggleCodigo = () => {
    codigoVisible = !codigoVisible
    const partes = ['.CodeMirror', '#editor-container', '#toolbar', '#menu', '#info-container', '#modal']
    document.querySelectorAll(partes.join(',')).forEach(el => { el.style.visibility = codigoVisible ? '' : 'hidden' })
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(codigoVisible)
  }

  V.init = (config = {}) => {
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    definirCaja()
    return V
  }

  console.log('[GP] visual James ' + VERSION + ' (DESARROLLO, produccion/04_James/arq) cargado')
})()
