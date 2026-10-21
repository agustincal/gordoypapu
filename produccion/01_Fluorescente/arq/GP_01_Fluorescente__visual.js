// ============================================================
// GP_01_Fluorescente__visual.js  ·  produccion/01_Fluorescente/arq/  (COPIA DE TRABAJO)
// Canción: 01_Fluorescente (Gordo y Papu) · Fase 3
// Rol: motor visual — arpegio, bajo y batería por canal, duración por nota,
//      pantalla partida en dos mitades (la derecha puede rotar y/o atrasarse)
// Lo carga el sketch (LIVE/sketches/01_Fluorescente_vXX.js); el sketch llama GP.fluorescente.*
// Actualizado: 21/10/2026 (v2.1: en silencio el movimiento frena · F1 pixelado de doble
//              sentido + 3 versiones (textura / todo / tiras) — copia de trabajo,
//              la versión que anda sigue en LIVE/arq)
//              16/10/2026 (v2.0: versión LIVE — namespace propio, estados con
//              GP_estados, duración por nota con note-off, rangos configurables)
// ============================================================
//
// Voces:
//   arpegio → altura = frecuencia de las franjas · nota = color · duración = velocidad del scroll
//   bajo    → altura y duración mueven la deformación (modulate)
//   bateria → bombo = pulso de escala · caja = flash de brillo · hat = pixelado
//
// Duración por nota: sigue a la nota sostenida MÁS RECIENTE de cada voz.
//   Mientras se sostiene, va frenando el movimiento; si la sueltan y queda
//   otra sonando, vuelve al ritmo de la otra; si no queda ninguna, usa la
//   duración de la última nota soltada.
//   Rate: 125 ms → 2 · 250 ms → 1 · 500 ms → 0.5 · 2000 ms → 0.125
//   Silencio: si no hay nota sostenida y pasaron C.silencio segundos sin ataques,
//   la velocidad cae a 0 en C.caidaRitmo segundos (frena y queda quieto donde está,
//   sin saltar). La próxima nota lo vuelve a mover.
//
// Todo lo ajustable vive en GP.fluorescente.C. Ahí escriben:
//   - el sketch, con V.init({ ... })            (la base de la canción)
//   - GP_estados, al cambiar de estado          (lo que anota cada estado)
//   - los faders y toggles, a través de GP_estados
//   - vos, en vivo:  V.C.delayMs = 400  + Ctrl+Enter
//
// El sketch llama:
//   GP.fluorescente.init(config)              una vez por evaluación
//   GP.fluorescente.update(dt)                dentro de update = (dt) => {...}
//   GP.fluorescente.salida(o0)                para dibujar
//   GP.fluorescente.nota(voz, nota, vel, on)  desde su ruteo MIDI
//   GP.fluorescente.golpe(pieza)              batería a mano: 'bombo' | 'caja' | 'hat'
//   GP.fluorescente.soltar(voz)               suelta todo lo que suena en esa voz (ej: al mutear)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v2.1'

  if (GP.fluorescente && GP.fluorescente._version === VERSION) return
  GP.fluorescente = { _version: VERSION }
  const V = GP.fluorescente

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  const msToRate = ms => clamp(250 / Math.max(ms, 1), 0.1, 2)

  // ---- valores por defecto (V.init vuelve a estos y aplica la config del sketch) ----
  // Faders: de 0 a 1. En 0 el visual es igual al sketch original (sin fader).
  const DEFAULTS = {
    // voces: rango de alturas que se reparte de grave (0) a agudo (1)
    rangoArpegio: [36, 96],
    rangoBajo: [24, 60],
    // batería: qué notas son cada pieza
    bateria: { bombo: [35, 36], caja: [38, 40], hat: [42, 44, 46] },
    // decaimientos (segundos)
    caidaEnergia: 0.35, caidaBombo: 0.25, caidaCaja: 0.2, caidaHat: 0.1,
    silencio: 0.6,            // segundos sin notas (ni sostenidas ni ataques) para frenar el movimiento
    caidaRitmo: 1.5,          // segundos que tarda en frenar hasta quedar quieto
    maxSostenida: 8,          // segundos: una nota sostenida más que esto se da por suelta (en el ensayo hubo de 4 s)
    // faders
    pixelado: 0.5,            // F1 doble sentido: 0 = bloques enormes · 0.5 = como antes · 1 = pixel muy fino (responde lento a propósito)
    verPixelado: 0,           // V1 (botón arriba de F1): 0 = textura · 1 = todo · 2 = tiras verticales
    kaleid: 0,                // simetría extra
    colorama: 0,              // cuánto viaja el color (fuerte: subir con cuidado)
    deformacion: 0,           // modulate del bajo (0 = recto)
    flash: 0,                 // cuánto flashea cada golpe de caja
    pulso: 0,                 // cuánto pulsa cada golpe de bombo
    velocidad: 0,             // velocidad del scroll de la capa principal
    contraste: 0,             // realce general
    suavizadoPixelado: 0.1,   // más chico = el pixelado sigue al fader más lento
    // toggles
    rotar90: false,           // toda la pantalla rotada 90°
    rotarMitad: false,        // la mitad derecha rotada 90° extra
    delayMitad: false,        // la mitad derecha atrasada
    delayMs: 200,             // cuánto atraso tiene la mitad derecha
    // pruebas sin hardware
    demo: false,
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS

  function noteToRGB(note) {
    const hue = ((note % 12) * 30) / 360
    const i = Math.floor(hue * 6)
    const f = hue * 6 - i
    const q = 1 - f
    const t = f
    switch (i % 6) {
      case 0: return [1, t, 0]
      case 1: return [q, 1, 0]
      case 2: return [0, 1, t]
      case 3: return [0, q, 1]
      case 4: return [t, 0, 1]
      case 5: return [1, 0, q]
    }
  }

  // ============================================================
  // 1) ESTADO de las voces (se conserva al reevaluar)
  // ============================================================
  const nuevaVoz = () => ({
    H: new Map(),       // nota → instante del note-on (sólo mientras suena)
    lastDur: 250,       // duración de la última nota soltada (ms)
    pitch: 0.5,         // 0-1, altura del último ataque
    energy: 0,          // 0-1, decae
    rate: 1,            // velocidad suavizada
    phase: 0,           // fase acumulada
    tAtaque: -Infinity, // instante del último note-on (para saber si hay silencio)
  })
  const S = {
    arpegio: nuevaVoz(),
    bajo: nuevaVoz(),
    bateria: { bombo: 0, caja: 0, hat: 0 },
    rgb: [1, 0, 0],
    rgbObjetivo: [1, 0, 0],
  }
  V.S = S

  // ============================================================
  // 2) ENTRADA (ataques y sueltas)
  // ============================================================
  V.nota = (voz, nota, vel = 100, on = true) => {
    const v01 = vel > 1 ? vel / 127 : vel
    if (voz === 'bateria') {
      if (!on) return
      const B = C.bateria
      if (B.bombo.includes(nota)) S.bateria.bombo = v01
      if (B.caja.includes(nota)) S.bateria.caja = v01
      if (B.hat.includes(nota)) S.bateria.hat = v01
      return
    }
    const v = S[voz]
    if (!v) return
    const ahora = performance.now()
    if (on) {
      const [lo, hi] = voz === 'arpegio' ? C.rangoArpegio : C.rangoBajo
      v.pitch = clamp((nota - lo) / Math.max(1, hi - lo))
      v.energy = v01
      v.H.set(nota, ahora)
      v.tAtaque = ahora
      if (voz === 'arpegio') S.rgbObjetivo = noteToRGB(nota)
    } else {
      const t0 = v.H.get(nota)
      if (t0 != null) { v.lastDur = ahora - t0; v.H.delete(nota) }
    }
  }

  // batería a mano: 'bombo' | 'caja' | 'hat'
  V.golpe = (pieza, v01 = 1) => { if (pieza in S.bateria) S.bateria[pieza] = v01 }

  // suelta todo lo que suena en una voz (al mutear, para que no quede una nota "sostenida" para siempre)
  V.soltar = (voz) => {
    const v = S[voz]
    if (!v || !v.H || !v.H.size) return
    const ahora = performance.now()
    for (const t0 of v.H.values()) v.lastDur = ahora - t0
    v.H.clear()
  }

  // ============================================================
  // 3) TIEMPO
  // ============================================================
  const pasoVoz = (v, k, ahora) => {
    let tNueva = -1
    for (const [n, t0] of v.H) {
      if (ahora - t0 > C.maxSostenida * 1000) { v.lastDur = ahora - t0; v.H.delete(n); continue }
      if (t0 > tNueva) tNueva = t0
    }
    const ms = tNueva >= 0 ? ahora - tNueva : v.lastDur
    // silencio: nada sostenido y hace rato que no hay ataques → la velocidad cae a 0
    const enSilencio = tNueva < 0 && ahora - v.tAtaque > C.silencio * 1000
    if (enSilencio) v.rate += (0 - v.rate) * clamp(k * 3 / Math.max(0.01, C.caidaRitmo))   // ~95% frenado en caidaRitmo s
    else v.rate += (msToRate(ms) - v.rate) * clamp(k * 3)  // suaviza el ritmo
    v.phase += k * v.rate                                  // fase acumulada: sin saltos
    v.energy *= Math.exp(-k / C.caidaEnergia)
  }

  // historial corto para la mitad derecha atrasada
  let historial = []
  let atrasado = null
  const muestra = (t) => ({
    t,
    arpPitch: S.arpegio.pitch, arpPhase: S.arpegio.phase, arpEnergy: S.arpegio.energy,
    rgb: [S.rgb[0], S.rgb[1], S.rgb[2]],
    bassPitch: S.bajo.pitch, bassPhase: S.bajo.phase, bassEnergy: S.bajo.energy,
    bombo: S.bateria.bombo, caja: S.bateria.caja, hat: S.bateria.hat,
  })
  const leerHistorial = (ahora) => {
    if (!historial.length) return muestra(ahora)
    const objetivo = ahora - C.delayMs
    let i = historial.findIndex(h => h.t >= objetivo)
    if (i === -1) i = historial.length - 1
    if (i <= 0) return historial[0]
    const a = historial[i - 1], b = historial[i]
    const t = (b.t - a.t) > 0 ? (objetivo - a.t) / (b.t - a.t) : 0
    const m = (x, y) => x + (y - x) * t
    return {
      arpPitch: m(a.arpPitch, b.arpPitch), arpPhase: m(a.arpPhase, b.arpPhase), arpEnergy: m(a.arpEnergy, b.arpEnergy),
      rgb: [m(a.rgb[0], b.rgb[0]), m(a.rgb[1], b.rgb[1]), m(a.rgb[2], b.rgb[2])],
      bassPitch: m(a.bassPitch, b.bassPitch), bassPhase: m(a.bassPhase, b.bassPhase), bassEnergy: m(a.bassEnergy, b.bassEnergy),
      bombo: m(a.bombo, b.bombo), caja: m(a.caja, b.caja), hat: m(a.hat, b.hat),
    }
  }

  let pixeladoSuave = 0

  V.update = (dt = 16) => {
    const k = Math.min(0.1, Math.max(0, dt / 1000))
    const ahora = performance.now()

    pasoVoz(S.arpegio, k, ahora)
    pasoVoz(S.bajo, k, ahora)

    S.bateria.bombo *= Math.exp(-k / C.caidaBombo)
    S.bateria.caja  *= Math.exp(-k / C.caidaCaja)
    S.bateria.hat   *= Math.exp(-k / C.caidaHat)

    for (let i = 0; i < 3; i++) S.rgb[i] += (S.rgbObjetivo[i] - S.rgb[i]) * clamp(k * 8)   // color con glissando

    pixeladoSuave += (C.pixelado - pixeladoSuave) * C.suavizadoPixelado

    historial.push(muestra(ahora))
    while (historial.length > 1 && ahora - historial[0].t > C.delayMs + 500) historial.shift()
    atrasado = leerHistorial(ahora)
  }

  // ============================================================
  // 4) VISUAL (sólo lee el estado)
  // ============================================================
  // Cada campo es una función: se vuelve a leer en cada cuadro.
  const vivo = {
    arpPitch:   () => S.arpegio.pitch,
    arpPhase:   () => S.arpegio.phase,
    arpEnergy:  () => S.arpegio.energy,
    rgb:        () => S.rgb,
    bassPitch:  () => S.bajo.pitch,
    bassPhase:  () => S.bajo.phase,
    bassEnergy: () => S.bajo.energy,
    bombo:      () => S.bateria.bombo,
    caja:       () => S.bateria.caja,
    hat:        () => S.bateria.hat,
  }
  // la mitad derecha lee lo mismo, salvo con delayMitad: ahí lee el historial
  const derecha = {}
  for (const [campo, fn] of Object.entries(vivo)) {
    derecha[campo] = () => (C.delayMitad && atrasado ? atrasado[campo] : fn())
  }

  // F1: cantidad de celdas, exponencial en los dos sentidos.
  // 0 → 2.5 celdas (bloques enormes) · 0.5 → 8 (como antes) · 1 → 55 (pixel fino;
  // 21/10: tope = lo que antes daba F1 en 0.8 — con 200 se iba de más).
  // El arpegio y el hat las multiplican (más actividad = pixel más fino, como antes).
  const CELDAS_MIN = 2.5, CELDAS_MEDIO = 8, CELDAS_MAX = 55
  const SIN_PIXEL = 4000   // tantas celdas que no se nota: así la cadena es siempre la misma
  const celdasF1 = () => {
    const f = clamp(pixeladoSuave)
    return f < 0.5
      ? CELDAS_MIN * Math.pow(CELDAS_MEDIO / CELDAS_MIN, f / 0.5)
      : CELDAS_MEDIO * Math.pow(CELDAS_MAX / CELDAS_MEDIO, (f - 0.5) / 0.5)
  }
  const celdas = (e) => celdasF1() * (1 + e.arpEnergy() * 2 + e.hat() * 2.5)
  // versiones de F1 (como parámetros: no se re-arma la cadena, cambia sin cortes)
  //   V1 = 0 textura: sólo la capa cruzada · 1 todo: la mitad entera · 2 tiras: la mitad entera, sólo en x
  const ver = () => (C.verPixelado | 0)
  const pxTextura = (e) => (ver() === 0 ? celdas(e) : SIN_PIXEL)
  const pxTodoX   = (e) => (ver() === 0 ? SIN_PIXEL : celdas(e))
  const pxTodoY   = (e) => (ver() === 1 ? celdas(e) : SIN_PIXEL)

  const mitad = (e, anguloExtra) =>
    osc(() => 3 + e.arpPitch() * 30, 0, 0)
      .scrollX(() => e.arpPhase() * (0.2 + C.velocidad * 0.8))
      .color(() => e.rgb()[0], () => e.rgb()[1], () => e.rgb()[2])
      .diff(
        osc(() => 20 + e.arpPitch() * 40, 0, 0)
          .scrollX(() => -e.arpPhase() * 0.1)
          .pixelate(() => pxTextura(e), () => pxTextura(e))
          .kaleid(() => 2 + C.kaleid * 6)
      )
      .colorama(() => 0.005 + C.colorama * 0.3)
      .luma()
      .modulate(
        osc(() => 2 + e.bassPitch() * 6, 0, 0)
          .scrollY(() => e.bassPhase() * 0.1),
        () => C.deformacion * (0.5 + e.bassEnergy() * 0.4)
      )
      .brightness(() => e.caja() * (0.3 + C.flash * 0.7))
      .scale(() => 1.5 + e.bombo() * (0.3 + C.pulso * 0.7))
      .pixelate(() => pxTodoX(e), () => pxTodoY(e))   // V2 todo / V3 tiras (V1: no se nota)
      .rotate(anguloExtra)

  // máscaras duras que parten la pantalla en x = 0.5
  // (funciones: cada uso arma una cadena nueva; reusar la misma rompe el shader)
  const mascaraDerecha = () => gradient(0).r().thresh(0.5, 0.005)
  const mascaraIzquierda = () => gradient(0).r().thresh(0.5, 0.005).invert(1)

  V.salida = (out) => {
    mitad(vivo, () => 0)
      .mask(mascaraIzquierda())
      .add(mitad(derecha, () => (C.rotarMitad ? Math.PI / 2 : 0)).mask(mascaraDerecha()), 1)
      .contrast(() => 1 + C.contraste * 2)
      .rotate(() => (C.rotar90 ? Math.PI / 2 : 0))
      .out(out)
  }

  // ---- demo sin hardware (como el ensayo: corcheas en el canal 1, negras de bombo) ----
  if (window._fluorescenteDemo) window._fluorescenteDemo.forEach(clearInterval)
  window._fluorescenteDemo = [
    setInterval(() => {
      if (!C.demo) return
      const [lo, hi] = C.rangoArpegio
      const nota = lo + Math.floor(Math.random() * (hi - lo + 1))
      V.nota('arpegio', nota, 100, true)
      setTimeout(() => V.nota('arpegio', nota, 0, false), 100)
    }, 268),
    setInterval(() => { if (C.demo) V.golpe('bombo', 0.8) }, 536),
  ]

  // ---- init: valores por defecto + config del sketch ----
  V.init = (config = {}) => {
    // vuelve a los valores por defecto antes de aplicar la config: así un valor
    // que dejó un estado (o un ajuste a mano) no queda pegado al reevaluar
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    return V
  }

  console.log('[GP] visual Fluorescente ' + VERSION + ' (copia de trabajo, produccion) cargado')
})()
