// ============================================================
// GP_04_James__visual.js  ·  LIVE/arq/
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: motor visual — muro de monitores de tubo, blanco y negro puro
// Lo carga el sketch (LIVE/sketches/04_James_vXX.js); el sketch llama GP.james.*
// Actualizado: 17/10/2026 (v1.0: primera versión, sin ensayo todavía)
// ============================================================
//
// Qué se ve: un muro de monitores (1, 2x2, 3x3 o 4x4) en una sala oscura.
// Todos muestran la MISMA señal, como en la referencia:
//   - horizonte: bloque blanco abajo
//   - aguja: línea vertical que cae desde arriba hasta el horizonte
//   - persiana: bandas horizontales que bajan con cada pulso
//   - círculo: nace en el horizonte, crece, late y puede girar
// Donde se cruzan, la luz se invierte (blanco sobre blanco = negro).
// La luz de los monitores cae sobre el piso, debajo del muro.
//
// Música:
//   canal 1  (línea principal) → cada nota prende un monitor (grave = abajo a la izquierda)
//   canal 2  (melodía aguda)   → cada nota deja caer una aguja (grave = izquierda)
//   canal 10 (pulso)           → barrido / persiana, y opcional: strobe, alternar, caída de aguja
//
// Todo lo ajustable vive en GP.james.C. Ahí escriben:
//   - el sketch, con V.init({ ... })            (la base de la canción)
//   - GP_estados, al cambiar de estado          (lo que anota cada estado)
//   - los faders, toggles y versiones, a través de GP_estados
//   - vos, en vivo:  V.C.apagado = 0.4  + Ctrl+Enter
//
// El sketch llama:
//   GP.james.init(config)                 una vez por evaluación
//   GP.james.update()                     dentro de update = () => {...}
//   GP.james.salida(o0)                   para dibujar
//   GP.james.monitor(clave, nota, on)     canal 1 (clave = la nota, o algo único para el pad tocado a mano)
//   GP.james.agujaNota(clave, nota, on)   canal 2
//   GP.james.pulso()                      canal 10
//   GP.james.mano(accion, on)             pads a mano: 'barrido' 'aguja' 'circulo' 'invertir' 'blanco' 'negro'
//   GP.james.soltar(voz)                  suelta lo que suena: 'monitor' | 'aguja' (ej: al mutear una fila)
//   GP.james.toggleCodigo()               oculta / muestra el código y los paneles
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1.0'

  if (GP.james && GP.james._version === VERSION) return
  GP.james = { _version: VERSION }
  const V = GP.james

  const clamp01 = v => Math.max(0, Math.min(1, v))
  const easeOut = t => 1 - Math.pow(1 - t, 3)
  const MAX = 16      // monitores como máximo (grilla de 4x4)
  const NA = 4        // agujas del canal 2 a la vez

  // ---- valores por defecto (V.init vuelve a estos y aplica la config del sketch) ----
  const DEFAULTS = {
    // ---- el muro ----
    grilla: 0.3,           // 0 = un monitor · 0.25 = 2x2 · 0.5 = 3x3 · 0.75 = 4x4
    escala: 0.6,           // alto del muro (1 = toda la pantalla). Más chico = muro en la sala, con luz en el piso
    formato: 4 / 3,        // forma de cada monitor (4/3 = tubo · 0 = ocupa la forma de la pantalla)
    muroY: 0.58,           // altura del centro del muro (0.5 = centrado)
    marco: 0.06,           // marco negro de cada monitor
    curva: 0.06,           // abombado del tubo
    esquinas: 0.06,        // redondeo de las esquinas de cada pantalla
    vineta: 0.25,          // oscurece los bordes de cada pantalla
    desfase: 0.4,          // diferencias chicas entre monitores, como en un muro real (0 = todos iguales)
    vidrio: 0.05,          // el negro de un monitor prendido no es negro puro
    carcasa: 0.03,         // la carcasa de cada monitor, apenas iluminada por su propia pantalla
    piso: 0.35,            // luz que los monitores tiran sobre el piso (0 = nada)
    tinte: [1, 1, 1],      // [r, g, b] · blanco puro. Más frío: [0.9, 0.95, 1]

    // ---- la señal (lo mismo en todos los monitores) ----
    horizonte: 0.45,       // alto del bloque blanco (0 = no hay · 1 = todo blanco)
    aguja: 1,              // largo de la aguja central (0 = no hay · 1 = llega al horizonte)
    grosor: 0.012,         // grosor de las agujas
    agujasMelodia: 1,      // largo máximo de las agujas del canal 2 (0 = apagadas)
    persiana: 0,           // luz de las bandas que bajan con el pulso (0 = nada · 1 = blanco)
    circulo: 0,            // tamaño del círculo que nace en el horizonte (0 = no hay)
    circuloMax: 0.9,       // radio con circulo = 1
    circuloPulso: 0.15,    // cuánto late el círculo con cada pulso
    circuloGiro: 1.5,      // velocidad de giro de la elipse (forma 2)

    // ---- versiones (botón redondo arriba de F4, F5 y F6) ----
    modoAguja: 0,          // 0 = fija · 1 = cae con cada pulso · 2 = cae con cada nota del canal 1
    formaPersiana: 0,      // índice de 'persianas'
    formaCirculo: 0,       // índice de 'circulos'
    persianas: [
      { bandas: 1,  ancho: 0.08, queda: false },   // 0 · barrido: una banda baja y se va
      { bandas: 6,  ancho: 0.5,  queda: true },    // 1 · persiana: baja un escalón con cada pulso
      { bandas: 24, ancho: 0.35, queda: true },    // 2 · persiana fina
    ],
    circulos: [
      { aro: 0,    gira: false },                  // 0 · disco
      { aro: 0.85, gira: false },                  // 1 · aro
      { aro: 0.85, gira: true },                   // 2 · elipse que gira
    ],

    // ---- monitores (canal 1) ----
    reposo: 0.35,          // brillo de los monitores sin nota (0 = apagados · 1 = prendidos)
    invertirNota: false,   // false = la nota prende su monitor · true = lo pone en negativo
    rangoMonitores: [25, 48],
    apagado: 0.12,         // segundos en apagarse al soltar la nota (0 = corte seco)
    maxSostenida: 8,       // segundos: una nota sostenida más que esto se da por suelta

    // ---- agujas (canal 2) ----
    rangoAgujas: [57, 86],
    caidaAguja: 0.12,      // segundos en caer
    subeAguja: 0.2,        // segundos en subir al soltar

    // ---- pulso (canal 10) ----
    barridoDur: 0.45,      // segundos que tarda la banda en bajar
    strobe: false,         // cada pulso = flash blanco en todos los monitores (ojo fotosensibilidad)
    alternar: false,       // cada pulso invierte todo: positivo / negativo
    invertir: false,       // todo en negativo
    flashDur: 0.05,

    // ---- pruebas sin hardware ----
    demo: false,
    demoBpm: 120,
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS

  const nGrilla = () => 1 + Math.min(3, Math.floor(clamp01(C.grilla) * 4))
  const alturaRel = (nota, rango) => clamp01((nota - rango[0]) / Math.max(1, rango[1] - rango[0]))
  const ahora = () => (typeof time !== 'undefined' ? time : performance.now() / 1000)

  // ============================================================
  // Monitores (canal 1)
  // ============================================================
  const celdas = Array.from({ length: MAX }, () => ({ sonando: 0, tSuelta: -99, nivelSuelta: 0 }))
  const notasMonitor = new Map()      // clave → { celda, t0 }

  // grave = abajo a la izquierda, sube hacia la derecha y después una fila arriba
  const celdaDeNota = nota => {
    const n = nGrilla() ** 2
    return Math.min(n - 1, Math.floor(alturaRel(nota, C.rangoMonitores) * n))
  }

  const nivelCelda = c => {
    if (c.sonando > 0) return 1
    if (C.apagado <= 0) return 0
    return c.nivelSuelta * Math.exp(-(ahora() - c.tSuelta) / (C.apagado / 4))
  }

  const soltarMonitor = clave => {
    const e = notasMonitor.get(clave)
    if (!e) return
    notasMonitor.delete(clave)
    const c = celdas[e.celda]
    c.sonando = Math.max(0, c.sonando - 1)
    if (c.sonando === 0) { c.tSuelta = ahora(); c.nivelSuelta = 1 }
  }

  V.monitor = (clave, nota, on) => {
    if (!on) { soltarMonitor(clave); return }
    if (notasMonitor.has(clave)) soltarMonitor(clave)
    const i = celdaDeNota(nota)
    celdas[i].sonando++
    notasMonitor.set(clave, { celda: i, t0: ahora() })
    if ((C.modoAguja | 0) === 2) tAguja = ahora()
  }

  // ============================================================
  // Agujas (canal 2)
  // ============================================================
  const agujas = Array.from({ length: NA }, () => ({
    activa: false, x: 0.5, t0: -99, sostenida: false, tSuelta: 0, largoSuelta: 0
  }))
  const notasAguja = new Map()        // clave → aguja
  let proxAguja = 0

  const largoAguja = a => {
    if (!a.activa) return 0
    const t = ahora()
    const baja = easeOut(clamp01((t - a.t0) / Math.max(0.001, C.caidaAguja)))
    if (a.sostenida) return baja
    const k = clamp01((t - a.tSuelta) / Math.max(0.001, C.subeAguja))
    if (k >= 1) { a.activa = false; return 0 }
    return a.largoSuelta * (1 - k)
  }

  const soltarAguja = clave => {
    const a = notasAguja.get(clave)
    if (!a) return
    notasAguja.delete(clave)
    a.largoSuelta = largoAguja(a)
    a.sostenida = false
    a.tSuelta = ahora()
  }

  V.agujaNota = (clave, nota, on) => {
    if (!on) { soltarAguja(clave); return }
    if (notasAguja.has(clave)) soltarAguja(clave)
    const a = agujas[proxAguja]
    proxAguja = (proxAguja + 1) % NA
    for (const [k, v] of notasAguja) if (v === a) notasAguja.delete(k)
    a.activa = true
    a.sostenida = true
    a.t0 = ahora()
    a.x = 0.12 + 0.76 * alturaRel(nota, C.rangoAgujas)
    notasAguja.set(clave, a)
  }

  V.soltar = (voz) => {
    if (!voz || voz === 'monitor') [...notasMonitor.keys()].forEach(soltarMonitor)
    if (!voz || voz === 'aguja') [...notasAguja.keys()].forEach(soltarAguja)
  }

  // ============================================================
  // Pulso (canal 10) y pads a mano
  // ============================================================
  let tPulso = -99, tFlash = -99, tAguja = -99, tBarrido = -99, tBarridoMano = -99
  let invAlternado = 0

  V.pulso = () => {
    const t = ahora()
    tPulso = t
    tBarrido = t
    if (C.strobe) tFlash = t
    if (C.alternar) invAlternado = 1 - invAlternado
    if ((C.modoAguja | 0) === 1) tAguja = t
  }

  const mano = { invertir: false, blanco: false, negro: false, circulo: false }
  let tCirculoMano = -99, tCirculoSuelta = -99, circuloSuelta = 0
  const circuloMano = () => mano.circulo
    ? easeOut(clamp01((ahora() - tCirculoMano) / 0.3))
    : circuloSuelta * Math.max(0, 1 - (ahora() - tCirculoSuelta) / 0.25)

  V.mano = (accion, on) => {
    const t = ahora()
    if (accion === 'barrido') { if (on) tBarridoMano = t; return }
    if (accion === 'aguja') { if (on) tAguja = t; return }
    if (accion === 'circulo') {
      if (on) { mano.circulo = true; tCirculoMano = t }
      else { circuloSuelta = circuloMano(); mano.circulo = false; tCirculoSuelta = t }
      return
    }
    if (accion in mano) mano[accion] = !!on
  }

  // ============================================================
  // Cada cuadro: todo lo que lee el shader queda en U
  // ============================================================
  const U = {
    nCol: 2, nFil: 2, muroW: 0.6, muroH: 0.6, muroY: 0.58,
    marco: 0.06, curva: 0.06, esquinas: 0.06, vineta: 0.25, desfase: 0.4, vidrio: 0.05, carcasa: 0.03,
    horiz: 0.45, aguja: 1, grosor: 0.012,
    a0x: 0.5, a0l: 0, a1x: 0.5, a1l: 0, a2x: 0.5, a2l: 0, a3x: 0.5, a3l: 0,
    bPos: 0, bLuz: 0, bN: 1, bAncho: 0.08,
    cR: 0, cX: 1, cAro: 0,
    inv: 0, blanco: 0, piso: 0.35, brillo: 0,
    l: new Array(MAX).fill(0), v: new Array(MAX).fill(0),
  }
  V.U = U

  V.update = () => {
    const t = ahora()

    // notas que quedaron colgadas (sin note-off)
    for (const [k, e] of notasMonitor) if (t - e.t0 > C.maxSostenida) soltarMonitor(k)
    for (const [k, a] of notasAguja) if (t - a.t0 > C.maxSostenida) soltarAguja(k)

    // el muro: alto = escala, ancho según la forma de cada monitor
    const n = nGrilla()
    const asp = (typeof width !== 'undefined' && height) ? width / height : 16 / 9
    let H = Math.max(0.05, Math.min(1, C.escala))
    let W = C.formato > 0 ? H * C.formato / asp : H
    if (W > 1) { H /= W; W = 1 }
    U.nCol = n; U.nFil = n
    U.muroW = W; U.muroH = H
    U.muroY = Math.min(1 - H / 2, Math.max(H / 2, C.muroY))
    U.marco = C.marco; U.curva = C.curva; U.esquinas = C.esquinas
    U.vineta = C.vineta; U.desfase = C.desfase; U.vidrio = C.vidrio; U.carcasa = C.carcasa; U.piso = C.piso

    // señal: horizonte y aguja central
    U.horiz = clamp01(C.horizonte)
    U.grosor = C.grosor
    const caida = t - tAguja
    const largo = clamp01(C.aguja)
    U.aguja = caida >= 0 && caida < C.caidaAguja ? largo * easeOut(caida / C.caidaAguja) : largo

    // agujas del canal 2
    agujas.forEach((a, i) => {
      U[`a${i}x`] = a.x
      U[`a${i}l`] = largoAguja(a) * clamp01(C.agujasMelodia)
    })

    // persiana: con el pulso, o el barrido a mano (gana el de mano)
    const progMano = (t - tBarridoMano) / Math.max(0.01, C.barridoDur)
    if (progMano >= 0 && progMano < 1) {
      U.bN = 1; U.bAncho = 0.08; U.bLuz = 1; U.bPos = easeOut(progMano)
    } else {
      const fp = C.persianas[C.formaPersiana | 0] || C.persianas[0]
      const prog = clamp01((t - tBarrido) / Math.max(0.01, C.barridoDur))
      U.bN = fp.bandas; U.bAncho = fp.ancho
      U.bPos = easeOut(prog)
      U.bLuz = fp.queda || prog < 1 ? clamp01(C.persiana) : 0
    }

    // círculo: nace en el horizonte, late con el pulso, crece con el pad a mano
    const fc = C.circulos[C.formaCirculo | 0] || C.circulos[0]
    const latido = 1 + C.circuloPulso * Math.exp(-Math.max(0, t - tPulso) / 0.12)
    U.cR = Math.max(clamp01(C.circulo) * C.circuloMax * latido, circuloMano() * C.circuloMax)
    U.cAro = fc.aro
    U.cX = fc.gira ? Math.cos(t * C.circuloGiro) : 1

    // inversión global y flash
    U.inv = (C.invertir ? 1 : 0) ^ invAlternado ^ (mano.invertir ? 1 : 0)
    const flash = Math.exp(-Math.max(0, t - tFlash) / Math.max(0.001, C.flashDur / 3))
    U.blanco = Math.max(mano.blanco ? 1 : 0, flash)

    // cada monitor: prendido por su nota, o en reposo
    const nc = n * n
    const area = U.horiz
    let suma = 0
    for (let i = 0; i < MAX; i++) {
      const e = i < nc ? nivelCelda(celdas[i]) : 0
      const L = mano.negro ? 0 : Math.max(clamp01(C.reposo), e)
      const I = C.invertirNota && e > 0.5 ? 1 : 0
      U.l[i] = L
      U.v[i] = I
      if (i < nc) suma += L * ((I ^ U.inv) ? 1 - area : area)
    }
    U.brillo = Math.max(suma / nc, U.blanco)
  }

  // ============================================================
  // Shader: el muro entero en una sola función
  // ============================================================
  const NOMBRES = [
    'nCol', 'nFil', 'muroW', 'muroH', 'muroY',
    'marco', 'curva', 'esquinas', 'vineta', 'desfase', 'vidrio', 'carcasa',
    'horiz', 'aguja', 'grosor',
    'a0x', 'a0l', 'a1x', 'a1l', 'a2x', 'a2l', 'a3x', 'a3l',
    'bPos', 'bLuz', 'bN', 'bAncho',
    'cR', 'cX', 'cAro',
    'inv', 'blanco', 'piso', 'brillo',
  ]
  const NOMBRES_CELDAS = [
    ...Array.from({ length: MAX }, (_, i) => `l${i}`),
    ...Array.from({ length: MAX }, (_, i) => `v${i}`),
  ]
  const ENTRADAS = [...NOMBRES, ...NOMBRES_CELDAS].map(name => ({ type: 'float', name, default: 0 }))

  // GLSL de WebGL 1 no deja indexar con variables: se elige la celda sumando
  const elegir = (arr, sal) => Array.from({ length: MAX }, (_, i) =>
    `${sal} += ${arr}${i} * (1.0 - step(0.5, abs(k - ${i}.0)));`).join('\n')

  const agujaGLSL = (x, l) => `
    yfin = 1.0 - ${l} * (1.0 - tope);
    ag = max(ag, (1.0 - smoothstep(gw, gw + aax, abs(m.x - ${x} - ox)))
               * smoothstep(yfin - aay, yfin + aay, m.y) * step(0.001, ${l}));`

  const GLSL = `
    float asp = resolution.x / resolution.y;

    // ---- dónde cae este pixel: muro, celda, pantalla ----
    vec2 q = vec2((_st.x - 0.5) / muroW + 0.5, (_st.y - muroY) / muroH + 0.5);
    float dentro = step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
    vec2 g = clamp(q, 0.0, 0.9999) * vec2(nCol, nFil);
    vec2 cel = floor(g);
    vec2 u = fract(g);
    float k = cel.y * nCol + cel.x;
    float L = 0.0;
    float I = 0.0;
    ${elegir('l', 'L')}
    ${elegir('v', 'I')}

    // pantalla de tubo: marco, abombado y esquinas redondeadas
    float zona = max(1.0 - 2.0 * marco, 0.05);
    vec2 m = (u - 0.5) / zona;
    m *= 1.0 + curva * dot(m, m);
    vec2 dq = abs(m) - (0.5 - esquinas);
    float esq = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - esquinas;
    float aay = nFil / (resolution.y * muroH * zona);
    float aax = nCol / (resolution.x * muroW * zona);
    float pantalla = 1.0 - smoothstep(-aay, aay, esq);
    float vig = clamp(1.0 - vineta * dot(m, m) * 2.0, 0.0, 1.0);
    m += 0.5;
    float ca = asp * muroW / muroH * nFil / nCol;

    // diferencias chicas entre monitores
    float hs = fract(sin(dot(cel, vec2(12.9898, 78.233))) * 43758.5453);
    float h = horiz + (hs - 0.5) * desfase * 0.06;
    float ox = (fract(hs * 7.13) - 0.5) * desfase * 0.04;
    float tope = clamp(h, 0.0, 1.0);

    // ---- la señal ----
    // horizonte
    float s = (1.0 - smoothstep(h - aay, h + aay, m.y)) * step(0.001, horiz);

    // agujas: caen desde arriba hasta el horizonte
    float gw = grosor * 0.5 / ca;
    float ag = 0.0;
    float yfin = 0.0;
    ${agujaGLSL('0.5', 'aguja')}
    ${agujaGLSL('a0x', 'a0l')}
    ${agujaGLSL('a1x', 'a1l')}
    ${agujaGLSL('a2x', 'a2l')}
    ${agujaGLSL('a3x', 'a3l')}
    s = max(s, ag);

    // persiana: bandas que bajan (se invierten contra lo que hay)
    float f = fract(m.y * bN + bPos);
    float ea = aay * bN;
    float banda = smoothstep(1.0 - bAncho - ea, 1.0 - bAncho + ea, f) * bLuz;
    s = abs(s - banda);

    // círculo con centro en el horizonte (se invierte contra lo que hay)
    vec2 dc = vec2((m.x - 0.5) * ca / max(abs(cX), 0.02), m.y - tope);
    float dl = length(dc);
    float disco = (1.0 - smoothstep(cR - aay, cR + aay, dl))
                * smoothstep(cR * cAro - aay, cR * cAro + aay, dl)
                * step(0.0005, cR);
    s = abs(s - disco);

    // ---- el monitor: negativo, brillo, flash ----
    s = mix(s, 1.0 - s, abs(clamp(I, 0.0, 1.0) - inv));
    s = max(s, vidrio) * L;
    s = mix(s, 1.0, blanco);
    s *= vig * pantalla * dentro;
    // carcasa: el resto de la celda, con un hilo negro entre monitores
    float caja = step(0.012, u.x) * step(u.x, 0.988) * step(0.012, u.y) * step(u.y, 0.988);
    s += carcasa * max(L, blanco) * caja * (1.0 - pantalla) * dentro;

    // ---- la sala: la luz de los monitores cae sobre el piso ----
    float base = muroY - muroH * 0.5;
    float bajo = max(base - _st.y, 0.0);
    float hx = (_st.x - 0.5) / max(muroW, 0.05);
    float luzPiso = piso * brillo * smoothstep(base, base - 0.02, _st.y) * exp(-bajo * 2.5) * exp(-hx * hx * 1.5);

    return vec4(vec3(s + luzPiso), 1.0);
  `
  V._glsl = GLSL
  V._entradas = ENTRADAS

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
  // Demo sin hardware: pulso por negra, canal 1 por corchea, canal 2 cada tanto
  // ============================================================
  if (window._jamesDemo) clearInterval(window._jamesDemo)
  let demoProx = 0, demoPaso = 0
  window._jamesDemo = setInterval(() => {
    if (!C.demo) return
    const t = performance.now()
    if (t < demoProx) return
    const semi = 60000 / Math.max(30, C.demoBpm) / 4
    demoProx = t - demoProx < 200 ? demoProx + semi : t + semi
    const p = demoPaso++
    if (p % 4 === 0) V.pulso()
    if (p % 2 === 0) {
      const [a, b] = C.rangoMonitores
      const nota = a + Math.floor(Math.random() * (b - a + 1))
      const clave = 'demo1_' + p
      V.monitor(clave, nota, true)
      setTimeout(() => V.monitor(clave, nota, false), semi * 1.5)
    }
    if (p % 16 === 8 && Math.random() < 0.7) {
      const [a, b] = C.rangoAgujas
      const nota = a + Math.floor(Math.random() * (b - a + 1))
      const clave = 'demo2_' + p
      V.agujaNota(clave, nota, true)
      setTimeout(() => V.agujaNota(clave, nota, false), semi * 6)
    }
  }, 10)

  // ============================================================
  // init y salida
  // ============================================================
  V.init = (config = {}) => {
    // vuelve a los valores por defecto antes de aplicar la config: así un valor
    // que dejó un estado (o un ajuste a mano) no queda pegado al reevaluar
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    setFunction({ name: 'jamesMuro', type: 'src', inputs: ENTRADAS, glsl: GLSL })
    return V
  }

  V.salida = (out) => {
    const args = [
      ...NOMBRES.map(k => () => U[k]),
      ...Array.from({ length: MAX }, (_, i) => () => U.l[i]),
      ...Array.from({ length: MAX }, (_, i) => () => U.v[i]),
    ]
    jamesMuro(...args)
      .color(() => C.tinte[0], () => C.tinte[1], () => C.tinte[2])
      .out(out)
  }

  console.log('[GP] visual James ' + VERSION + ' (LIVE) cargado')
})()
