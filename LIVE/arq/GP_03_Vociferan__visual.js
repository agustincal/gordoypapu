// ============================================================
// GP_03_Vociferan__visual.js  ·  LIVE/arq/  (VERSIÓN VALIDADA — única en LIVE)
// Copiado a LIVE el 04/11/2026 desde produccion/03_Vociferan/arquitectura/GP_03_Vociferan__visual_v3.js (v3.9)
// Canción: 03_Vociferan (Gordo y Papu) · Fase 3
// Rol: motor visual — círculos de luz (la Vociferan de siempre) + escenas de
//      formas que se transforman (morfo, iris, corte, anidado, lente), todo en
//      el color de la canción, con la vibración del mic y el strobe del bombo.
// Lo carga el sketch de desarrollo (produccion/03_Vociferan/sketches/03_Vociferan_v03.js).
// La versión de LIVE (LIVE/arq/GP_03_Vociferan__visual.js v2.0) queda intacta.
// Actualizado: 17/10/2026 (v3.1: fusión por umbral — círculos y escenas en un solo
//              campo de bordes duros; el mic deforma el contorno antes del umbral;
//              puerta de ruido del mic)
//              (v3.2: paleta propia de las formas — cyan/celeste/azul, avanza en cada
//              cambio de escena; F7 voz en la forma; F8 tono de las formas;
//              grilla de lente que pasa de cuadrado a triángulo a círculo)
//              (v3.4: color por FAMILIAS — cada escena un tono + dos vecinos, F8 elige
//              la familia por zonas; anillos por objeto (V1: ninguno/algunos/muchos);
//              F7 = vibración general, suavizada)
//              (v3.5: degradado de UNA franja como estética de color, en círculos y
//              formas, siempre presente y la voz lo hace correr; anillos sólo en las
//              formas de James, más gruesos)
//              (v3.6: micMute apaga la vibración; byn = blanco y negro puro (N13);
//              franja de las formas más angosta y marcada)
// Actualizado: 04/11/2026 (v3.7: la escena se dibuja sola en o1 (C.bufferEscena) y los
//              círculos + la fusión la leen de ahí: al cambiar de escena sólo se
//              recompila la escena, el shader grande de los círculos queda armado.
//              El golpe largo al cambiar se reemplaza por un telón corto (C.telon))
//              (v3.8: cambio seco por defecto (telon: false); motor y sketches pasan de
//              fase3/ a arquitectura/ y sketches/)
//              (v3.9: bordes duros sin pixelar — o1 se lee interpolando; los círculos
//              cortan con un borde de 1 píxel calculado con su pendiente real (umbralAA);
//              la escena y los golpes con borde de ~1 píxel; la franja no llega al negro
//              (pisoFranja) y puede ir en escalones (pasosFranja))
// ============================================================
//
// Escenas (C.escena):
//   'circulos'  la Vociferan de siempre: cada nota del canal 1 entra como círculo
//   'morfo'     una forma que se derrite en la siguiente
//   'iris'      formas que nacen en el centro y crecen hasta tapar todo (diff)
//   'corte'     la forma se corta en franjas que se separan y vuelve como la siguiente
//   'anidado'   formas una adentro de otra; cada cambio hace zoom un nivel
//   'lente'     una lente con forma agranda una grilla que se mueve
// Fusión (C.fusion):
//   'xor'     (por defecto) círculos y escena se recortan entre sí: donde se cruzan
//             queda un hueco. Los círculos además empujan la escena (C.desplazar).
//   'union'   círculos y escena se funden en una sola mancha
//   'encima'  como la v3.0: círculos difusos sumados encima de la escena (para comparar)
// Los círculos son un campo que pasa por un umbral: bordes duros, y dos círculos
// cercanos se funden como gotas. C.circulos (F6) es su tamaño en las escenas
// nuevas: 0 = no se ven, 0.5 = normal, 1 = el doble. Los golpes van siempre encima.
// Al cambiar de escena el cambio es seco; con C.telon = true un telón corto del
// color de la familia tapa el corte. El golpe largo de antes queda en C.golpeAlCambiar.
// Buffers: o1 = la escena sola · o2 = imagen final (antes del blanco y negro) · o0 = salida.
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
  const VERSION = 'LIVE-v3.9'

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
    // color por FAMILIAS: cada familia es un tono principal (las formas) y dos
    // vecinos (los círculos). Cada cambio de escena pasa a la familia siguiente.
    familias: [20, 195, 340, 215, 40, 180],   // naranja, celeste, rosa, azul, ámbar, cyan
    vecinos: 25,            // grados de distancia de los dos tonos vecinos
    familia: 0,             // familia de arranque
    familiaFija: -1,        // un estado puede fijar una familia exacta (0, 1, 2...); -1 = avanza sola
    tonoFormas: 0,          // F8 · elige la familia por zonas (cada tramo del fader = una familia)
    satFormas: 1,
    entrada: 0.35, desdeX: 0.35,
    ataque: 0.02, mantener: 0.5, release: 1.2,
    huecoAlIrse: 0.8,
    escapeProb: 0.12, escapeDur: 0.6, escapeDir: 1,
    radioAkai: 0.22,
    entradas: [0.15, 0.35, 0.8],
    golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,
    fluct: 0.25, fluctVel: 3,
    // vibración del mic: F7 (vibracion) es el volumen de TODO esto junto
    vibracion: 0.5,         // F7 · 0 = nada · 0.5 = normal · 1 = mucho
    micMute: false,         // true = sin vibración del mic, mueva F7 o no (la franja de la voz sigue)
    micPos: 0.06, micLuz: 0.5, micTam: 0.25,   // sacudón, parpadeo de luz y latido de tamaño (a vibración 0.5)
    vibSuave: 0.35,         // suavizado del temblor (más chico = más lento y orgánico · 1 = crudo)
    micUmbral: 0.15,        // puerta de ruido: por debajo de esto el mic no hace nada
    micRodilla: 0.1,        // transición suave arriba del umbral
    micBorde: 0.05,         // deformación del contorno (a vibración 0.5)
    micRuido: 4,            // escala de esa deformación (más alto = ondas más chicas)
    mostrarMic: true,
    barridoFuerza: 0.8, barridoVel: 4, multicolor: 0.7,
    degradado: 0.6,         // franja de degradado siempre presente (0 = color plano · 1 = de luz a negro)
    degradadoFormas: 0.75,  // lo mismo en las formas de las escenas
    anchoFranja: 1.6,       // cuántas franjas entran a lo ancho de la pantalla en las formas (más = más angosta)
    pisoFranja: 0.25,       // la franja nunca baja de esta luz (0 = llega al negro y se lee como borde blando)
    pasosFranja: 0,         // 0 = degradado continuo · 3 = la franja en 3 escalones de color
    // blanco y negro puro: todo lo que tiene luz queda blanco, el resto negro (N13)
    byn: false,
    umbralByn: 0.04,        // desde qué luz cuenta como blanco (más alto = sólo lo más claro)
    bufferFinal: 'o2',      // buffer libre donde se dibuja la imagen antes del blanco y negro
    bufferEscena: 'o1',     // buffer donde se dibuja la escena sola (al cambiar, sólo se recompila esto)
    vozAtaque: 0.3, vozCaida: 0.05,
    calibrarSeg: 3, calibrarMargen: 1.3,
    tamano: 0.5,            // F1 · círculos y formas · 0 = nada · 0.5 = normal · 1 = enormes
    direccion: 0,           // F2 · de dónde entran los círculos
    tamanoMax: 1.15, giroMax: 90,
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
    circulos: 0.5,          // F6 · tamaño de los círculos del canal 1 en las escenas nuevas (0.5 = normal)
    quieto: false,          // N12 · congela las formas
    golpeAlCambiar: false,  // el golpe central largo de antes (~2 s) al cambiar de escena
    // telón corto al cambiar de escena: entra, se cambia la escena tapada, sale
    telon: false,           // false = cambio seco (por defecto: con la v3.7 casi no hay tirón) · true = telón
    telonEntrada: 0.05,     // segundos en tapar
    telonSalida: 0.15,      // segundos en destapar
    // fusión círculos + escena
    fusion: 'xor',          // 'xor' | 'union' | 'encima'
    suavidad: 0.004,        // (modo 'encima' y unión) borde del umbral
    // bordes: todo duro, con ~1 píxel de transición para que no pixele
    bordePx: 1,             // ancho del borde de los círculos y golpes, en píxeles (0.5 = más seco · 3 = blando)
    suavidadEscena: 0.3,    // borde de la escena al leerla de o1 (0.3 ≈ 1 píxel · 0.01 = serruchado)
    desplazar: 0.25,        // cuánto empujan los círculos a la escena (0 = nada)
    // anillos: algunas formas y algunos círculos nacen como anillo (no toda la imagen)
    contorno: 0,            // V1 · 0 = ningún anillo · 1 = algunos · 2 = muchos
    probAnillos: [0, 0.35, 0.7],
    grosorAnillo: 0.6,      // hueco del anillo (fracción del tamaño: 0.6 = anillo grueso · 0.8 = fino)
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
    formaGrilla: 'morfo',   // 'morfo' (cuadrado → triángulo → círculo, sin parar) | 'cuadrado' | 'circulo'
    velGrilla: 0.25,        // formas por segundo en la grilla 'morfo'
    tamGrilla: 0.42,        // tamaño de cada forma de la grilla (0.5 = se tocan)
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
  // anillos por objeto: ¿la forma/círculo n es anillo? (decidido por un sorteo fijo por n)
  const probAnillo = () => (C.probAnillos || [0])[Math.max(0, Math.min(2, Math.round(C.contorno || 0)))] || 0
  const azar = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
  const esAnillo = n => azar(n) < probAnillo()
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
    s.rgb = hsvARgb(op.hue ?? hueCirculo(), C.sat)
    s.fase = Math.random() * 6.28
    s.barrido = Math.random() * 6.28
    s.angulo = anguloActual()
    s.anillo = false   // los círculos de Vociferan usan su hueco original, sin anillos
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
    if (op.color != null && C.familias && C.familias.length) o.hue = C.familias[mod(op.color, C.familias.length)] + (Math.random() < 0.5 ? -1 : 1) * C.vecinos
    if (op.escape) { o.escapa = true; o.escapeDir = Math.random() < 0.5 ? -1 : 1 }
    V.notaOn(id, vel, o)
  }
  // golpe de paleta: salta a la familia `indice` (0, 1, 2, 3...)
  V.golpePaleta = (indice, vel = 110) => {
    if (Math.round(C.familiaFija ?? -1) >= 0) C.familiaFija = mod(indice - zonaF8(), nFamilias())
    else iPaleta += mod(indice - indiceFamilia(), nFamilias())
    V.notaOn(2000 + indice, vel, { tipo: 'golpe', hue: hueFormas() })
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

  // ---- micrófono: puerta de ruido ----
  // Por debajo del piso no pasa nada; por encima, el sonido pasa ENTERO.
  // Sin calibrar, el piso es C.micUmbral para todas las bandas.
  let pisos = null
  const suaveStep = (a0, a1, x) => { const k = clamp01((x - a0) / (a1 - a0)); return k * k * (3 - 2 * k) }
  const voz = () => {
    if (typeof a === 'undefined' || !a.fft) return 0
    let max = 0
    a.fft.forEach((v, i) => {
      const piso = pisos ? pisos[i] : C.micUmbral
      max = Math.max(max, v * suaveStep(piso, piso + C.micRodilla, v))
    })
    return Math.min(1, max)
  }
  let calibrando = false
  V.calibrarMic = () => {
    if (calibrando || typeof a === 'undefined') return
    calibrando = true
    const max = a.fft.map(() => 0)
    console.log('[Vociferan] calibrando mic: silencio ' + C.calibrarSeg + ' s...')
    const id = setInterval(() => { a.fft.forEach((v, i) => { if (v > max[i]) max[i] = v }) }, 20)
    setTimeout(() => {
      clearInterval(id)
      pisos = max.map(m => Math.max(0.02, m * C.calibrarMargen))
      calibrando = false
      console.log('[Vociferan] mic calibrado. Piso por banda:', pisos.map(p => p.toFixed(2)).join(' / '))
    }, C.calibrarSeg * 1000)
  }
  V.pisoMic = () => pisos ? pisos.slice() : (typeof a !== 'undefined' ? a.fft.map(() => C.micUmbral) : [])
  V.resetMic = () => { pisos = null }
  let vozEnv = 0
  let ultimo = 0

  // vibración global para las escenas nuevas (la misma idea que en cada círculo)
  const J = { x: 0, y: 0, l: 1, r: 1 }
  let faseFormas = 0.8   // la franja de las formas: quieta en silencio, corre con la voz
  // F7: 0 = nada · 0.5 = los valores de micPos/micLuz/micTam/micBorde · 1 = 2.5 veces
  const cuantoVibra = () => {
    if (C.micMute) return 0
    const v = clamp01(C.vibracion); return v <= 0.5 ? v * 2 : 1 + (v - 0.5) * 3
  }
  // temblor suavizado: cada cuadro se acerca a un valor al azar en vez de saltar
  const hacia = (actual, objetivo) => actual + (objetivo - actual) * C.vibSuave

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
    // anillo: la misma forma más chica, restada (sólo en las formas que salen anillo)
    const hueco = k => () => esAnillo(Math.floor(p()) + k) ? C.grosorAnillo : 0.0001
    const dentro = k => () => campo(k)() * hueco(k)()
    return shape(ld(0), 0, campo(0))
      .blend(shape(ld(1), 0, campo(1)), () => frac(p()))
      .thresh(0.5, 0.004)
      .diff(shape(ld(0), 0, dentro(0))
        .blend(shape(ld(1), 0, dentro(1)), () => frac(p()))
        .thresh(0.5, 0.004))
      .rotate(() => p() * C.giroMorfo * f2(C.giro) * GRADOS)
      .scale(() => 1 + C.popMorfo * f2(C.latido) * latido(0.12))
      .scale(1, ASP, 1)
  }

  const iris = () => {
    let img = solid(() => S.fondoIris, () => S.fondoIris, () => S.fondoIris)
    for (let k = 0; k < MAX_CAPAS; k++) {
      const c = () => S.capas[k]
      const prog = () => c() ? Math.max(0, (t() - c().t0) / durIris()) : 0
      const radio = () => c() ? Math.pow(prog(), 1.4) * C.finalIris * peso(c().i) : -1
      const radioHueco = () => (c() && esAnillo(c().i)) ? radio() * C.grosorAnillo : -1
      img = img.diff(
        shape(() => c() ? lados(c().i) : 3, radio, 0.004)
          .diff(shape(() => c() ? lados(c().i) : 3, radioHueco, 0.004))
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
    const radioC = () => C.tamCorte * f2(C.tamano) * peso(cual())
    return shape(() => lados(cual()), radioC, 0.004)
      .diff(shape(() => lados(cual()), () => esAnillo(cual() + 1000) ? radioC() * C.grosorAnillo : -1, 0.004))
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
    // grilla: cuadrados, círculos, o una forma que pasa sin parar de
    // cuadrado a triángulo a círculo (campos mezclados + umbral, como morfo)
    const SEC = [4, 3, 100], PES = [0.89, 0.78, 1]
    const g = () => C.formaGrilla === 'morfo' ? t() * C.velGrilla : (C.formaGrilla === 'cuadrado' ? 0 : 2)
    const ladosG = d => () => SEC[mod(Math.floor(g()) + d, 3)]
    const campoG = d => () => 2 * C.tamGrilla * PES[mod(Math.floor(g()) + d, 3)] + 1e-4
    const celda = shape(ladosG(0), 0, campoG(0))
      .blend(shape(ladosG(1), 0, campoG(1)), () => C.formaGrilla === 'morfo' ? suave(frac(g())) : 0)
      .thresh(0.5, 0.004)
    return celda
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
      { type: 'float', name: 'piso', default: 0.0 },
      { type: 'float', name: 'pasos', default: 0.0 },
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
      // una sola franja de degradado a lo ancho del círculo (los tres canales
      // levemente corridos para el multicolor)
      float una = 1.0 - sombra * abs(sin(u * 1.57 + barrido));
      vec3 tres = vec3(
        1.0 - sombra * abs(sin(u * 1.2 + barrido)),
        1.0 - sombra * abs(sin(u * 1.57 + barrido * 1.3 + 0.5)),
        1.0 - sombra * abs(sin(u * 2.0 + barrido * 1.7 + 1.0)));
      vec3 k = clamp(mix(vec3(una), tres, multi), 0.0, 1.0);
      if (pasos > 0.5) k = floor(k * pasos + 0.5) / pasos;
      k = piso + (1.0 - piso) * k;
      return vec4(v * k, 1.0);
    `
  })

  // campo: intensidad que vale `fuerza` en el centro y fuerza/2 justo en el radio,
  // y se apaga afuera. Sumados y pasados por un umbral de 0.5 dan círculos de borde
  // duro que se funden entre sí cuando se acercan.
  const definirCampo = () => setFunction({
    name: 'campo',
    type: 'src',
    inputs: [
      { type: 'float', name: 'cx', default: 0.5 },
      { type: 'float', name: 'cy', default: 0.5 },
      { type: 'float', name: 'radio', default: 0.2 },
      { type: 'float', name: 'hueco', default: 0.0 },
      { type: 'float', name: 'fuerza', default: 1.0 },
    ],
    glsl: `
      float asp = resolution.x / resolution.y;
      vec2 p = vec2((_st.x - 0.5) * asp + 0.5, _st.y);
      vec2 c = vec2((cx - 0.5) * asp + 0.5, cy);
      float d = distance(p, c);
      float r = max(radio, 0.0001);
      // r = el campo · g, b = su pendiente (x, y) en unidades de alto de pantalla:
      // al sumar los círculos se suman también las pendientes, y el umbral (umbralAA)
      // sabe cuánto cambia el campo por píxel → borde de 1 píxel sin importar el tamaño
      float x = clamp(d / (2.0 * r), 0.0, 1.0);
      float f = fuerza * (1.0 - x * x * (3.0 - 2.0 * x));
      float df = -fuerza * 6.0 * x * (1.0 - x) / (2.0 * r);
      if (hueco > 0.001) {
        float y = clamp((d - hueco * 0.8) / (hueco * 0.2), 0.0, 1.0);
        float h = y * y * (3.0 - 2.0 * y);
        float dh = 6.0 * y * (1.0 - y) / (hueco * 0.2);
        df = df * h + f * dh;
        f *= h;
      }
      vec2 dir = d > 0.00001 ? (p - c) / d : vec2(0.0);
      vec2 g = df * dir;
      return vec4(f, g.x, g.y, 1.0);
    `
  })
  // banda: la misma franja de degradado, de lado a lado de la pantalla (para las formas)
  const definirBanda = () => setFunction({
    name: 'banda',
    type: 'src',
    inputs: [
      { type: 'float', name: 'fase', default: 0.0 },
      { type: 'float', name: 'sombra', default: 0.6 },
      { type: 'float', name: 'multi', default: 0.0 },
      { type: 'float', name: 'ancho', default: 1.6 },
      { type: 'float', name: 'piso', default: 0.0 },
      { type: 'float', name: 'pasos', default: 0.0 },
    ],
    glsl: `
      float u = (_st.x - 0.5) * 2.0 * ancho;
      float una = 1.0 - sombra * abs(sin(u * 0.9 + fase));
      vec3 tres = vec3(
        1.0 - sombra * abs(sin(u * 0.7 + fase)),
        1.0 - sombra * abs(sin(u * 0.9 + fase * 1.3 + 0.5)),
        1.0 - sombra * abs(sin(u * 1.15 + fase * 1.7 + 1.0)));
      vec3 k = clamp(mix(vec3(una), tres, multi), 0.0, 1.0);
      if (pasos > 0.5) k = floor(k * pasos + 0.5) / pasos;
      return vec4(piso + (1.0 - piso) * k, 1.0);
    `
  })
  // empuje: vector que aleja del centro del círculo (para desplazar la escena)
  const definirEmpuje = () => setFunction({
    name: 'empuje',
    type: 'src',
    inputs: [
      { type: 'float', name: 'cx', default: 0.5 },
      { type: 'float', name: 'cy', default: 0.5 },
      { type: 'float', name: 'radio', default: 0.2 },
      { type: 'float', name: 'fuerza', default: 1.0 },
    ],
    glsl: `
      float asp = resolution.x / resolution.y;
      vec2 p = vec2((_st.x - 0.5) * asp + 0.5, _st.y);
      vec2 c = vec2((cx - 0.5) * asp + 0.5, cy);
      vec2 dv = p - c;
      float r = max(radio, 0.0001);
      float w = fuerza * exp(-pow(length(dv) / (1.5 * r), 2.0));
      return vec4(dv.x / asp * w, dv.y * w, 0.0, 1.0);
    `
  })

  // umbral con borde de N píxeles: usa la pendiente que trae el campo (g, b)
  const definirUmbralAA = () => setFunction({
    name: 'umbralAA',
    type: 'color',
    inputs: [
      { type: 'float', name: 'umbral', default: 0.5 },
      { type: 'float', name: 'px', default: 1.0 },
    ],
    glsl: `
      float pend = max(length(_c0.gb) * px / resolution.y, 0.00001);
      float a = clamp((_c0.r - umbral) / pend + 0.5, 0.0, 1.0);
      return vec4(vec3(a), 1.0);
    `
  })

  // en la escena de círculos se ven todos; en las otras, los de la canción
  // según C.circulos y los golpes siempre
  const capaCirculos = s => (C.escena === 'circulos' || s.tipo === 'golpe') ? 1 : clamp01(C.circulos)
  // tamaño de los círculos en la fusión (F6: 0.5 = normal)
  const escalaFusion = s => (C.escena === 'circulos' || !ARMAR[C.escena]) ? 1 : 2 * clamp01(C.circulos)

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
  let armada = null, armadaFusion = null, armadaConBuffer = false
  let pendiente = null, tPendiente = 0
  // ---- familias de color ----
  // índice de familia = arranque (C.familia) + cambios de escena + zona de F8
  let iPaleta = 0
  const nFamilias = () => (C.familias && C.familias.length) ? C.familias.length : 1
  const zonaF8 = () => Math.min(nFamilias() - 1, Math.floor(clamp01(C.tonoFormas) * nFamilias()))
  const indiceFamilia = () => {
    const fija = Math.round(C.familiaFija ?? -1)
    const base = fija >= 0 ? fija : Math.round(C.familia || 0) + iPaleta
    return mod(base + zonaF8(), nFamilias())
  }
  const hueFormas = () => (C.familias && C.familias.length) ? C.familias[indiceFamilia()] : C.hue
  // círculos: uno de los dos vecinos de la familia (más una pizca de variación)
  const hueCirculo = () => hueFormas() + (Math.random() < 0.5 ? -1 : 1) * C.vecinos + (Math.random() * 2 - 1) * C.hueVar * 0.5
  const colorFormas = () => hsvARgb(hueFormas(), C.satFormas)
  V.hueFormas = () => hueFormas()

  // ---- piezas de la fusión (cada llamada arma una cadena nueva: en Hydra
  //      las cadenas no se pueden reusar) ----
  const esNormal = s => s.activo && s.tipo !== 'golpe'
  const radioFusion = s => radioActual(s) * s.jr * escalaFusion(s)
  const fuerzaCampo = s => esNormal(s) ? clamp01(nivel(s) / Math.max(s.vel, 0.01)) : 0
  const huecoDe = s => Math.max(
    s.anillo ? radioFusion(s) * C.grosorAnillo : 0,
    radioFusion(s) * C.huecoAlIrse * (s.sostenida ? 0 : clamp01(1 - nivel(s) / Math.max(s.nivelSuelta, 0.001))))

  const campoCirculos = () => {
    let img = solid(0, 0, 0)
    for (let i = 0; i < N; i++) {
      const s = slots[i]
      img = img.add(campo(() => posX(s) + s.jx, () => posY(s) + s.jy, () => radioFusion(s), () => huecoDe(s), () => fuerzaCampo(s)))
    }
    return img
  }
  const empujeCirculos = () => {
    let img = solid(0, 0, 0)
    for (let i = 0; i < N; i++) {
      const s = slots[i]
      img = img.add(empuje(() => posX(s) + s.jx, () => posY(s) + s.jy, () => radioFusion(s), () => fuerzaCampo(s)))
    }
    return img
  }
  // la voz deforma el contorno ANTES del umbral
  const vozBorde = () => vozEnv * C.micBorde * cuantoVibra()
  const temblor = () => noise(() => C.micRuido, 0.8)
  const mascaraCirculos = () => campoCirculos()
    .modulate(temblor(), vozBorde)
    .umbralAA(0.5, () => Math.max(0.05, C.bordePx))
  // color de los círculos: cada uno en su tono (con el barrido de la voz), en un
  // disco del doble de su radio para que la deformación no salga de la pintura.
  // Donde se pisan se ve el de arriba (sin sumar luz: así no se va al amarillo
  // y queda dentro de la familia de color). La máscara recorta la forma.
  // borde de ~1 píxel en unidades de alto de pantalla (para aro)
  const bordeUV = () => Math.max(0.05, C.bordePx) / (typeof height !== 'undefined' && height ? height : 1080)
  const colorCirculos = () => {
    let img = solid(() => colorFormas()[0], () => colorFormas()[1], () => colorFormas()[2])
    for (let i = 0; i < N; i++) {
      const s = slots[i]
      const luz = () => esNormal(s) ? s.jl * fluct(s) : 0
      // el disco de color mide lo mismo que el círculo (borde de 1 píxel): así, donde
      // se pisan dos círculos, el cambio de color también es duro. Sólo con la
      // vibración del mic prendida se agranda (hasta el doble) para que la
      // deformación no salga de la pintura.
      const r2 = () => esNormal(s) ? radioFusion(s) * (1 + Math.min(1, cuantoVibra())) : 0
      const disco = aro(() => posX(s) + s.jx, () => posY(s) + s.jy, r2, bordeUV, 0)
      img = img.layer(aro(
          () => posX(s) + s.jx, () => posY(s) + s.jy,
          r2, bordeUV, 0,
          () => s.barrido, () => Math.min(1, C.degradado + C.barridoFuerza * vozEnv), () => C.multicolor,
          () => C.pisoFranja, () => C.pasosFranja)
        .color(() => s.rgb[0] * luz(), () => s.rgb[1] * luz(), () => s.rgb[2] * luz())
        .mask(disco))
    }
    return img
  }
  // golpes: telón duro encima de todo (tapa los cambios de escena)
  const golpes = (img) => {
    for (let i = 0; i < N; i++) {
      const s = slots[i]
      const es = () => s.activo && s.tipo === 'golpe'
      const r = () => es() ? radioActual(s) : 0
      const luz = () => es() ? nivel(s) * s.luzMult : 0
      const forma = () => aro(() => posX(s), () => posY(s), r, bordeUV, 0)
      img = img.layer(solid(() => s.rgb[0] * luz(), () => s.rgb[1] * luz(), () => s.rgb[2] * luz()).mask(forma()))
    }
    return img
  }
  // ---- la escena sola, en su buffer (C.bufferEscena) ----
  // Es un shader chico: al cambiar de escena se recompila sólo esto.
  // En la escena 'circulos' el buffer queda negro (no recorta nada).
  const bufEscena = () => {
    const b = window[C.bufferEscena]
    return (b && b !== salidaOut && b !== window[C.bufferFinal]) ? b : null
  }
  // o1 se lee interpolando: Hydra crea sus buffers con 'nearest' y, cuando el
  // empuje estira la escena, cada píxel se veía como un bloque (escalones)
  const interpolar = b => {
    if (!b || !b.fbos) return
    b.fbos.forEach(f => {
      const tx = f.color && f.color[0]
      if (!tx || tx._gpLineal) return
      tx({ width: f.width, height: f.height, mag: 'linear', min: 'linear' })
      tx._gpLineal = true
    })
  }
  const armarEscena = () => {
    const b = bufEscena()
    interpolar(b)
    if (b) (ARMAR[C.escena] ? ARMAR[C.escena]() : solid(0, 0, 0)).out(b)
    armada = C.escena
  }
  // la escena tal como la leen los círculos: del buffer si hay, si no armada en línea
  const escenaCruda = () => {
    const b = bufEscena()
    if (b) return src(b)
    return ARMAR[C.escena] ? ARMAR[C.escena]() : solid(0, 0, 0)
  }
  // vibración, empuje de los círculos y deformación de la voz: se aplican al LEER
  const escena = () => escenaCruda()
    .scrollX(() => J.x).scrollY(() => J.y)
    .scale(() => J.r)
    .modulate(empujeCirculos(), () => -C.desplazar)
    .modulate(temblor(), vozBorde)
    .thresh(0.5, () => C.suavidadEscena)

  // ---- telón corto al cambiar de escena ----
  const T = { estado: 'nada', t0: -99, tSale: null, rgb: [0, 0, 0] }
  const telon = () => {
    if (T.estado === 'entra') return C.telonEntrada > 0 ? clamp01((t() - T.t0) / C.telonEntrada) : 1
    if (T.estado === 'sale') {
      if (T.tSale === null) return 1
      return C.telonSalida > 0 ? 1 - clamp01((t() - T.tSale) / C.telonSalida) : 0
    }
    return 0
  }

  const armarPrincipal = () => {
    if (!salidaOut) return
    let img
    const conBuffer = !!bufEscena()
    const conEscena = conBuffer || !!ARMAR[C.escena]
    if (C.fusion === 'encima') {
      // como la v3.0
      if (conEscena) {
        const luz = () => C.luzFormas * J.l
        img = escenaCruda()
          .scrollX(() => J.x).scrollY(() => J.y)
          .scale(() => J.r)
          .color(() => colorFormas()[0] * luz(), () => colorFormas()[1] * luz(), () => colorFormas()[2] * luz())
          .add(todosLosCirculos())
      } else img = todosLosCirculos()
    } else {
      // forma final: círculos y escena combinados por umbral
      let forma = mascaraCirculos()
      if (conEscena) {
        forma = C.fusion === 'union'
          ? forma.add(escena()).thresh(0.5, 0.25)
          : forma.diff(escena())
      }
      // pintura: la escena en el color de la canción, los círculos en el suyo
      const luz = () => C.luzFormas * J.l
      // (mezcla explícita base·(1−m) + círculos·m: sumar capas en Hydra también suma
      //  el alpha, y con .layer eso desborda el color)
      img = solid(() => colorFormas()[0] * luz(), () => colorFormas()[1] * luz(), () => colorFormas()[2] * luz())
        .mult(banda(() => faseFormas, () => Math.min(1, C.degradadoFormas + C.barridoFuerza * vozEnv * 0.5), () => C.multicolor, () => C.anchoFranja, () => C.pisoFranja, () => C.pasosFranja))
        .mult(mascaraCirculos().invert())
        .add(colorCirculos().mult(mascaraCirculos()))
        .mult(forma)
      img = golpes(img)
    }
    // telón del cambio de escena (encima de todo, debajo del strobe)
    img = img.blend(solid(() => T.rgb[0], () => T.rgb[1], () => T.rgb[2]), telon)
    // la imagen se dibuja en un buffer y se lee de ahí: el blanco y negro (N13)
    // es instantáneo y no obliga a recalcular la escena
    const fin = window[C.bufferFinal]
    if (fin && fin !== salidaOut) {
      img
        .add(solid(() => C.flashColor[0], () => C.flashColor[1], () => C.flashColor[2]), flash)
        .out(fin)
      src(fin)
        .blend(src(fin).thresh(() => C.umbralByn, 0.0001), () => C.byn ? 1 : 0)
        .out(salidaOut)
    } else {
      img
        .add(solid(() => C.flashColor[0], () => C.flashColor[1], () => C.flashColor[2]), flash)
        .out(salidaOut)
    }
    armadaFusion = C.fusion
    armadaConBuffer = conBuffer
  }
  // todo: la escena en su buffer + la imagen principal
  const armar = () => {
    if (!salidaOut) return
    armarEscena()
    armarPrincipal()
  }
  // cambio de escena: si la escena tiene su buffer, se recompila sólo ella;
  // si no (sin buffer libre), se rearma todo como antes
  const cambiarEscena = () => {
    if (bufEscena() && armadaConBuffer) armarEscena()
    else armar()
  }

  V.salida = (out) => { salidaOut = out; armar() }

  V.update = () => {
    const v = voz()
    const dt = Math.min(0.1, Math.max(0, t() - ultimo))
    ultimo = t()
    vozEnv += (v - vozEnv) * (v > vozEnv ? C.vozAtaque : C.vozCaida)
    for (const s of slots) {
      const k = v * cuantoVibra()
      s.jx = hacia(s.jx, (Math.random() - 0.5) * 2 * k * C.micPos)
      s.jy = hacia(s.jy, (Math.random() - 0.5) * 2 * k * C.micPos)
      s.jl = hacia(s.jl, 1 - Math.random() * Math.min(1, k * C.micLuz))
      s.jr = hacia(s.jr, 1 + (Math.random() - 0.5) * 2 * k * C.micTam)
      s.barrido += dt * C.barridoVel * v
    }
    faseFormas += dt * C.barridoVel * 0.5 * v
    const kj = v * cuantoVibra()
    J.x = hacia(J.x, (Math.random() - 0.5) * 2 * kj * C.micPos * 0.5)
    J.y = hacia(J.y, (Math.random() - 0.5) * 2 * kj * C.micPos * 0.5)
    J.l = hacia(J.l, 1 - Math.random() * Math.min(1, kj * C.micLuz * 0.6))
    J.r = hacia(J.r, 1 + (Math.random() - 0.5) * 2 * kj * C.micTam * 0.4)

    // iris: las formas que ya taparon la pantalla pasan al fondo
    const d = durIris()
    for (let k = S.capas.length - 1; k >= 0; k--) {
      if ((t() - S.capas[k].t0) / d >= 1) { S.capas.splice(k, 1); S.fondoIris ^= 1 }
    }
    // cambio de escena: primero se tapa (telón corto o el golpe largo de antes)
    // y, ya tapado, se recompila la escena (así no se ve el salto de Hydra)
    if (C.escena !== armada && C.escena !== pendiente) {
      if (armada !== null) {
        iPaleta++
        if (C.golpeAlCambiar) {
          pendiente = C.escena
          tPendiente = t() + C.golpeDur * 0.7
          V.notaOn(2999, 110, { tipo: 'golpe', hue: hueFormas() })
          setTimeout(() => V.notaOff(2999), 150)
        } else if (C.telon) {
          pendiente = C.escena
          tPendiente = t() + Math.max(0, C.telonEntrada)
          T.rgb = colorFormas()
          T.estado = 'entra'; T.t0 = t(); T.tSale = null
        } else cambiarEscena()
      } else armar()
    }
    if (pendiente !== null && t() >= tPendiente) {
      pendiente = null
      cambiarEscena()
      if (T.estado === 'entra') { T.estado = 'sale'; T.tSale = null }
      return   // la recompilación congela este cuadro: la salida del telón arranca en el próximo
    }
    // el telón empieza a salir en el primer cuadro después de recompilar
    if (T.estado === 'sale') {
      if (T.tSale === null) T.tSale = t()
      else if (t() - T.tSale >= C.telonSalida) T.estado = 'nada'
    }
    // cambiar C.fusion en vivo re-arma la imagen
    if (pendiente === null && armada !== null && C.fusion !== armadaFusion) armar()
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
    definirCampo()
    definirBanda()
    definirEmpuje()
    definirUmbralAA()
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
    T.estado = 'nada'
    return V
  }

  V.reiniciar = () => {
    iPaleta = 0
    Object.assign(S, { n: 1, t0: -99, tg: -99, capas: [], fondoIris: 0,
      corte: { t0: -99, de: 0, a: 0, vertical: false } })
  }

  console.log('[GP] visual Vociferan ' + VERSION + ' (LIVE/arq) cargado')
})()
