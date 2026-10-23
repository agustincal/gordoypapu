// ============================================================
// GP_01_Fluorescente__visual.js  ·  produccion/01_Fluorescente/arq/  (COPIA DE TRABAJO)
// Canción: 01_Fluorescente (Gordo y Papu) · Fase 3
// Rol: motor visual — arpegio, bajo y batería por canal, duración por nota,
//      pantalla partida en dos mitades (la derecha puede rotar y/o atrasarse)
// Lo carga el sketch (LIVE/sketches/01_Fluorescente_vXX.js); el sketch llama GP.fluorescente.*
// Actualizado: 22/10/2026 (v2.17: opciones para el comportamiento de la v03 de producción:
//              ritmoPorDuracion (false = velocidad pareja) y frenoSilencio (false = no frena).
//              Por defecto quedan en true: lo que ya usaba este motor no cambia)
//              21/10/2026 (v2.16: arreglo: al salir del choque la mitad derecha quedaba corrida para siempre
//              (pantalla partida). Ahora vuelve a alinearse con la izquierda en ~0.3 s)
//              21/10/2026 (v2.15: movimiento menos suavizado y ajustable: reaccionRitmo 0.33→0.1 s ·
//              pasoSalto ~0.08 s · empuje del bombo con caída propia 0.15 s · cambio de sentido instantáneo)
//              21/10/2026 (v2.14: sale el contraste. Movimiento en dos faders: F7 cómo avanza (continuo /
//              a saltos / empuje del bombo) · F8 hacia dónde (ida y vuelta / choque en el centro / vertical))
//              21/10/2026 (v2.13: F7 velocidad sin saltos (el desplazamiento se acumula cuadro a cuadro) y
//              sin costura (se corre con modulate, que no envuelve la imagen como scrollX))
//              21/10/2026 (v2.12: F5 flash y F6 pulso con versiones: normal / strobo (4 golpes rápidos) /
//              inverso (flash a negro · pulso que achica))
//              21/10/2026 (v2.11: atraso de la mitad derecha en tres medidas: N13 200 ms · N23 500 ms · N33 1 s)
//              21/10/2026 (v2.10: corte de pantalla con borde duro (rampa pixelada en 2 celdas))
//              21/10/2026 (v2.9: bandas horizontales que se desalinean y se alinean (ref. Hernán Roperto):
//              N21 bandas (al apagar convergen) · N31 bandas que respiran (se alinean solas, cíclico))
//              21/10/2026 (v2.8: F4 se invierten las dos primeras: V1 = ola · V2 = ondas)
//              21/10/2026 (v2.7: F4 versiones = ondas / ola negro-blanco-negro que corre con la fase /
//              líquido quieto. Sale el remolino)
//              21/10/2026 (v2.6: F4 ondas sin desplazamiento (sólo el empuje del bajo, sin corte) ·
//              remolino con anillos fijos (no cambia con cada nota) y más fuerte arriba)
//              21/10/2026 (v2.5: F4 ondas sin corte (cantidad entera de ondas) · remolino de verdad
//              (anillos alrededor del centro, gira más cuanto más afuera))
//              21/10/2026 (v2.4: F4 deformación con versiones ondas que avanzan / líquido / remolino;
//              arreglo: la onda no se movía (scrollY sobre franjas verticales) · empujonBajo ajustable)
//              21/10/2026 (v2.3: F3 colorama con versiones textura fija / altura del bajo / viaja con el bajo)
//              21/10/2026 (v2.2: F2 con versiones textura / mandala / gira; desde ahora cada cambio sube la versión)
//              21/10/2026 (v2.1: en silencio el movimiento frena · F1 pixelado de doble
//              sentido + 3 versiones (textura / todo / tiras) · F2 kaleid con 3 versiones
//              (textura / mandala / gira) — copia de trabajo,
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
// ===========================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v2.17'

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
    ritmoPorDuracion: true,   // false = velocidad pareja (como la v03): no acelera con notas cortas ni frena con sostenidas
    frenoSilencio: true,      // false = no frena en silencio (como la v03)
    silencio: 0.6,            // segundos sin notas (ni sostenidas ni ataques) para frenar el movimiento
    caidaRitmo: 1.5,          // segundos que tarda en frenar hasta quedar quieto
    reaccionRitmo: 0.1,       // s: qué tan rápido la velocidad sigue al ritmo de las notas (antes 0.33)
    pasoSalto: 0.025,         // F7 V2: s de cada paso (constante; ~3× = lo que tarda en frenar)
    caidaEmpuje: 0.15,        // F7 V3: s de caída del acelerón del bombo (aparte del pulso de F6)
    maxSostenida: 8,          // segundos: una nota sostenida más que esto se da por suelta (en el ensayo hubo de 4 s)
    // faders
    pixelado: 0.5,            // F1 doble sentido: 0 = bloques enormes · 0.5 = como antes · 1 = pixel muy fino (responde lento a propósito)
    verPixelado: 0,           // V1 (botón arriba de F1): 0 = textura · 1 = todo · 2 = tiras verticales
    kaleid: 0,                // F2: simetría extra
    verKaleid: 0,             // V2 (botón arriba de F2): 0 = textura · 1 = mandala · 2 = gira
    colorama: 0,              // F3: corrimiento de color (fuerte: subir con cuidado)
    verColorama: 0,           // V3 (botón arriba de F3): 0 = fijo · 1 = altura del bajo · 2 = viaja con el bajo
    deformacion: 0,           // F4: deformación del bajo (0 = recto)
    verDeformacion: 0,        // V4 (botón arriba de F4): 0 = ola · 1 = ondas · 2 = líquido
    empujonBajo: 0.4,         // cuánto suma cada nota del bajo a la deformación (0 = nada, sólo F4)
    flash: 0,                 // F5: cuánto flashea cada golpe de caja
    verFlash: 0,              // V5 (botón arriba de F5): 0 = flash · 1 = strobo · 2 = golpe a negro
    pulso: 0,                 // F6: cuánto pulsa cada golpe de bombo
    verPulso: 0,              // V6 (botón arriba de F6): 0 = agranda · 1 = strobo · 2 = achica
    stroboGolpes: 4,          // strobo: cuántos destellos por golpe
    stroboMs: 60,             // strobo: duración de cada destello + pausa (ms). 4 × 60 = 240 ms
    velocidad: 0,             // F7: cómo avanzan las franjas principales (el fader es la velocidad)
    verVelocidad: 0,          // V7 (botón arriba de F7): 0 = continuo · 1 = a saltos (cada nota del arpegio) · 2 = empuje del bombo
    direccion: 0,             // F8: hacia dónde (en 0 no cambia nada)
    verDireccion: 0,          // V8 (botón arriba de F8): 0 = ida y vuelta (bajo) · 1 = choque en el centro · 2 = vertical
    suavizadoPixelado: 0.1,   // más chico = el pixelado sigue al fader más lento
    // toggles
    rotar90: false,           // toda la pantalla rotada 90°
    rotarMitad: false,        // la mitad derecha rotada 90° extra
    delayMitad: false,        // N13: la mitad derecha atrasada (delayMs)
    delayMs: 200,             // cuánto atraso con N13
    delayMitad2: false,       // N23: más atraso (delayMs2)
    delayMs2: 500,
    delayMitad3: false,       // N33: mucho atraso (delayMs3)
    delayMs3: 1000,           // si hay varios prendidos, manda el de más atraso
    // bandas (ref. Hernán Roperto): franjas horizontales espejadas arriba/abajo, cada una corrida distinto
    bandas: false,            // N21: se desalinean y derivan con la fase del arpegio; al apagar convergen
    bandasRespira: false,     // N31: se separan y se vuelven a alinear solas, cíclico, con la fase del arpegio
    desalineo: 0.4,           // cuánto se corre cada banda (0 = alineadas)
    derivaBandas: 0.05,       // N21: cuánto siguen separándose con la fase (0 = quedan quietas en su lugar)
    fundidoBandas: 0.6,       // segundos que tardan en separarse / alinearse al prender o apagar
    respiraVel: 0.5,          // N31: velocidad del ciclo (más alto = se alinean más seguido)
    cantidadBandas: 24,       // filas del patrón (par: así el espejo cae justo en el centro)
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
    bateria: { bombo: 0, caja: 0, hat: 0, stroboBombo: 0, stroboCaja: 0 },
    golpeT: { bombo: -Infinity, caja: -Infinity },   // instante y fuerza del último golpe (para el strobo)
    golpeV: { bombo: 0, caja: 0 },
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
      if (B.bombo.includes(nota)) V.golpe('bombo', v01)
      if (B.caja.includes(nota)) V.golpe('caja', v01)
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
      if (voz === 'arpegio') { S.rgbObjetivo = noteToRGB(nota); mov.salto += 0.03 + C.velocidad * 0.12 }   // F7 V2: el paso de esta nota
      if (voz === 'bajo') mov.sentido = -mov.sentido   // F8 V1: cada nota del bajo da vuelta el sentido
    } else {
      const t0 = v.H.get(nota)
      if (t0 != null) { v.lastDur = ahora - t0; v.H.delete(nota) }
    }
  }

  // batería a mano: 'bombo' | 'caja' | 'hat'
  V.golpe = (pieza, v01 = 1) => {
    if (!(pieza in S.bateria)) return
    S.bateria[pieza] = v01
    if (pieza in S.golpeT) { S.golpeT[pieza] = performance.now(); S.golpeV[pieza] = v01 }
    if (pieza === 'bombo') mov.empuje = v01   // F7 V3
  }

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
    const ms = C.ritmoPorDuracion ? (tNueva >= 0 ? ahora - tNueva : v.lastDur) : 250   // 250 ms → velocidad 1, pareja
    // silencio: nada sostenido y hace rato que no hay ataques → la velocidad cae a 0
    const enSilencio = C.frenoSilencio && tNueva < 0 && ahora - v.tAtaque > C.silencio * 1000
    if (enSilencio) v.rate += (0 - v.rate) * clamp(k * 3 / Math.max(0.01, C.caidaRitmo))   // ~95% frenado en caidaRitmo s
    else v.rate += (msToRate(ms) - v.rate) * clamp(k / Math.max(0.01, C.reaccionRitmo))  // suaviza el ritmo
    v.phase += k * v.rate                                  // fase acumulada: sin saltos
    v.energy *= Math.exp(-k / C.caidaEnergia)
  }

  // V3 viaja: el color avanza con la velocidad del bajo (en silencio frena). Sin envolver: se envuelve al usarlo
  let viajeColor = 0
  // F7 / F8: desplazamiento de las franjas principales, acumulado cuadro a cuadro
  // (cambiar un fader cambia la velocidad, no la posición). Izquierda y derecha por separado (choque en el centro)
  let desplazamiento = 0, desplDer = 0
  const mov = { salto: 0, sentido: 1, multSentido: 1, empuje: 0 }

  // historial corto para la mitad derecha atrasada
  let historial = []
  let atrasado = null
  const muestra = (t) => ({
    t,
    arpPitch: S.arpegio.pitch, arpPhase: S.arpegio.phase, arpEnergy: S.arpegio.energy,
    rgb: [S.rgb[0], S.rgb[1], S.rgb[2]],
    bassPitch: S.bajo.pitch, bassPhase: S.bajo.phase, bassEnergy: S.bajo.energy,
    viaje: viajeColor,
    despl: desplazamiento, desplDer: desplDer,
    bombo: S.bateria.bombo, caja: S.bateria.caja, hat: S.bateria.hat,
    stroboBombo: S.bateria.stroboBombo, stroboCaja: S.bateria.stroboCaja,
  })
  // atraso que se está usando: el más grande de los prendidos (0 = ninguno)
  const delayActual = () => Math.max(
    C.delayMitad ? C.delayMs : 0,
    C.delayMitad2 ? C.delayMs2 : 0,
    C.delayMitad3 ? C.delayMs3 : 0,
  )
  const leerHistorial = (ahora) => {
    if (!historial.length) return muestra(ahora)
    const objetivo = ahora - delayActual()
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
      viaje: m(a.viaje, b.viaje),
      despl: m(a.despl, b.despl), desplDer: m(a.desplDer, b.desplDer),
      bombo: m(a.bombo, b.bombo), caja: m(a.caja, b.caja), hat: m(a.hat, b.hat),
      stroboBombo: b.stroboBombo, stroboCaja: b.stroboCaja,   // prendido/apagado: sin mezclar
    }
  }

  let pixeladoSuave = 0
  // bandas: cuánto están prendidas (0..1, con fundido) y desde qué fase arrancaron
  let bandasSuave = 0, respiraSuave = 0
  let faseBandas = 0, faseRespira = 0, respiraAntes = false

  V.update = (dt = 16) => {
    const k = Math.min(0.1, Math.max(0, dt / 1000))
    const ahora = performance.now()

    pasoVoz(S.arpegio, k, ahora)
    pasoVoz(S.bajo, k, ahora)

    S.bateria.bombo *= Math.exp(-k / C.caidaBombo)
    S.bateria.caja  *= Math.exp(-k / C.caidaCaja)
    // strobo: después de cada golpe, N destellos de stroboMs (mitad prendido, mitad apagado)
    const strobo = (pieza) => {
      const t = ahora - S.golpeT[pieza], per = Math.max(20, C.stroboMs)
      return t >= 0 && t < C.stroboGolpes * per && (t % per) < per / 2 ? S.golpeV[pieza] : 0
    }
    S.bateria.stroboBombo = strobo('bombo')
    S.bateria.stroboCaja = strobo('caja')
    S.bateria.hat   *= Math.exp(-k / C.caidaHat)

    for (let i = 0; i < 3; i++) S.rgb[i] += (S.rgbObjetivo[i] - S.rgb[i]) * clamp(k * 8)   // color con glissando

    pixeladoSuave += (C.pixelado - pixeladoSuave) * C.suavizadoPixelado
    {
      const paso = clamp(k * 3 / Math.max(0.01, C.fundidoBandas))
      bandasSuave += ((C.bandas ? 1 : 0) - bandasSuave) * paso
      respiraSuave += ((C.bandasRespira ? 1 : 0) - respiraSuave) * paso
      // apagadas del todo: la próxima vez arrancan desde la fase de ese momento (números chicos, sin saltos)
      if (!C.bandas && bandasSuave < 0.001) faseBandas = S.arpegio.phase
      if (C.bandasRespira && !respiraAntes && respiraSuave < 0.001) faseRespira = S.arpegio.phase
      respiraAntes = !!C.bandasRespira
    }
    {
      // F7 cómo avanza
      const vv = C.verVelocidad | 0
      let vel
      if (vv === 1) {            // a saltos: cada nota del arpegio deja un paso que se recorre en ~0.1 s
        const tramo = mov.salto * clamp(k / Math.max(0.005, C.pasoSalto))
        mov.salto -= tramo
        vel = k > 0 ? tramo / k : 0
      } else if (vv === 2) {     // empuje del bombo: base lenta del arpegio + acelerón en cada bombo
        mov.salto = 0
        vel = S.arpegio.rate * 0.2 + mov.empuje * (0.5 + C.velocidad * 2.5)
      } else {                   // continuo (como antes)
        mov.salto = 0
        vel = S.arpegio.rate * (0.2 + C.velocidad * 0.8)
      }
      // F8 hacia dónde
      const vd = C.verDireccion | 0
      const objetivoSentido = vd === 0 && mov.sentido < 0 ? 1 - 2 * C.direccion : 1   // ida y vuelta: F8 = cuánto vuelve
      mov.multSentido = objetivoSentido   // instantáneo
      mov.empuje *= Math.exp(-k / Math.max(0.01, C.caidaEmpuje))
      const izq = vel * mov.multSentido
      const der = vd === 1 ? vel * (1 - 2 * C.direccion) : izq                         // choque: F8 = cuánto va al revés
      desplazamiento += k * izq
      desplDer += k * der
      // fuera del choque, la derecha vuelve a alinearse con la izquierda (si no, quedaba corrida y la pantalla partida)
      if (vd !== 1) desplDer += (desplazamiento - desplDer) * clamp(k / 0.1)
    }
    viajeColor += k * S.bajo.rate * C.colorama * 0.25   // F3 arriba y bajo a ritmo 1: una vuelta cada 4 s

    historial.push(muestra(ahora))
    while (historial.length > 1 && ahora - historial[0].t > Math.max(C.delayMs, C.delayMs2, C.delayMs3) + 500) historial.shift()
    atrasado = leerHistorial(ahora)

    // V2 mandala es otra cadena: si se entra o se sale de esa versión, se re-arma la escena
    if (salidaOut && (verK() === 1) !== armadoMandala) V.salida(salidaOut)
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
    viaje:      () => viajeColor,
    despl:      () => desplazamiento,
    desplDer:   () => desplDer,
    bombo:      () => S.bateria.bombo,
    caja:       () => S.bateria.caja,
    hat:        () => S.bateria.hat,
    stroboBombo: () => S.bateria.stroboBombo,
    stroboCaja:  () => S.bateria.stroboCaja,
  }
  // la mitad derecha lee lo mismo, salvo con N13 / N23 / N33: ahí lee el historial
  const derecha = {}
  for (const [campo, fn] of Object.entries(vivo)) {
    derecha[campo] = () => (delayActual() > 0 && atrasado ? atrasado[campo] : fn())
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

  // versiones de F2
  //   V2 = 0 textura: lados del kaleid de la capa cruzada, 2 → 8
  //        1 mandala: el kaleid toma la mitad entera (las franjas también se vuelven radiales), 2 → 8 lados.
  //          Es otra cadena: al entrar o salir de esta versión se re-arma la escena (puede haber un saltito)
  //        2 gira:    la textura con 4 lados fijos y el kaleid rota con la fase del arpegio
  //          (en silencio frena con el resto); F2 = cuánto gira
  const verK = () => (C.verKaleid | 0)
  const LADOS_GIRA = 4
  const ladosTextura = () => (verK() === 0 ? 2 + C.kaleid * 6 : verK() === 2 ? LADOS_GIRA : 2)
  const giroKaleid = (e) => (verK() === 2 ? e.arpPhase() * C.kaleid * 1.5 : 0)

  // versiones de F3 (como parámetros, sin cortes)
  //   V3 = 0 fijo:   el corrimiento lo da sólo F3 (como antes)
  //        1 altura: cada nota del bajo fija el corrimiento (grave = poco, agudo = mucho) y queda hasta la próxima; F3 = rango
  //        2 viaja:  el color recorre la rueda mientras suena el bajo (notas cortas = más rápido; en silencio frena); F3 = velocidad
  const verC = () => (C.verColorama | 0)
  const corrimiento = (e) => {
    if (verC() === 1) return 0.005 + C.colorama * 0.3 * e.bassPitch()
    if (verC() === 2) return 0.005 + (e.viaje() % 1)
    return 0.005 + C.colorama * 0.3
  }

  // versiones de F4 (como parámetros, sin cortes)
  //   V4 = 0 ola negro-blanco-negro que corre · 1 ondas (quietas, las empuja el bajo) · 2 líquido quieto
  //   cantidad = F4 × (0.5 + energía del bajo × empujonBajo)   (F4 en 0 = recto en las tres)
  const verD = () => (C.verDeformacion | 0)
  const deforma = (e, version) =>
    verD() === version ? C.deformacion * (0.5 + e.bassEnergy() * C.empujonBajo) : 0

  // bandas: patrón de filas con valores distintos, simétrico arriba/abajo (cos centrado en 0.5).
  // Cada fila se corre en x según su valor × cuánto desalineo hay: con 0, todas alineadas.
  const fuenteBandas = () => {
    const f1 = 13, f2 = 31
    const centrada = f => f * 0.5 - Math.PI / 2   // corre la onda para que sea un cos centrado en el medio
    return osc(f1, 0, centrada(f1)).rotate(Math.PI / 2)
      .diff(osc(f2, 0, centrada(f2)).rotate(Math.PI / 2))
      .pixelate(1, () => C.cantidadBandas)
  }
  const desalineoBandas = (e) => {
    const n21 = bandasSuave * (C.desalineo + Math.max(0, e.arpPhase() - faseBandas) * C.derivaBandas)
    const ciclo = 0.5 - 0.5 * Math.cos(Math.max(0, e.arpPhase() - faseRespira) * C.respiraVel)
    const n31 = respiraSuave * ciclo * C.desalineo * 2
    return n21 + n31
  }

  // versiones de F5 y F6 (como parámetros, sin cortes)
  //   V5 flash: 0 = brillo con cada caja · 1 = strobo (stroboGolpes destellos rápidos) · 2 = golpe a negro
  //   V6 pulso: 0 = agranda con cada bombo · 1 = strobo · 2 = achica (zoom hacia afuera)
  const flashCaja = (e) => {
    const f = 0.3 + C.flash * 0.7, v = C.verFlash | 0
    if (v === 1) return e.stroboCaja() * f
    if (v === 2) return -e.caja() * f
    return e.caja() * f
  }
  const pulsoBombo = (e) => {
    const f = 0.3 + C.pulso * 0.7, v = C.verPulso | 0
    if (v === 1) return e.stroboBombo() * f
    if (v === 2) return -e.bombo() * f * 0.8   // achica (1.5 → 0.7 como mucho)
    return e.bombo() * f
  }

  // F8 V3 vertical: las franjas giran de verticales (0) a horizontales (1)
  const giroFranjas = () => ((C.verDireccion | 0) === 2 ? C.direccion * Math.PI / 2 : 0)

  const mitad = (e, anguloExtra, mandala, esDerecha = false) => {
    let c = osc(() => 3 + e.arpPitch() * 30, 0, 0)
      // F7: corre con modulate (suma x sin envolver) en vez de scrollX (envuelve y deja una costura)
      .modulate(solid(1, 0, 0), () => (esDerecha ? e.desplDer() : e.despl()))
      .rotate(() => giroFranjas())   // F8 V3 (en las otras: 0)
      .color(() => e.rgb()[0], () => e.rgb()[1], () => e.rgb()[2])
      .diff(
        osc(() => 20 + e.arpPitch() * 40, 0, 0)
          .scrollX(() => -e.arpPhase() * 0.1)
          .pixelate(() => pxTextura(e), () => pxTextura(e))
          .kaleid(() => ladosTextura())
          .rotate(() => giroKaleid(e))   // V2 gira (en las otras: 0)
      )
      .colorama(() => corrimiento(e))
      .luma()
      // F4: las tres versiones van siempre en la cadena; la que no está elegida tiene cantidad 0 (no hace nada)
      .modulate(   // V4 (prendido) ondas: la onda queda quieta; la mueve sólo el empuje de cada nota del bajo
        // (sin scrollX: desplazar envuelve la imagen y se veía el corte)
        osc(() => 2 + e.bassPitch() * 6, 0, 0),
        () => deforma(e, 1)
      )
      .modulate(   // V4 (apagado) ola: una sola onda negro → blanco → negro a lo ancho, que corre con la fase del bajo.
        // Es exactamente un ciclo (2π) y empieza y termina en negro: al envolver en el borde empalma, sin corte
        osc(Math.PI * 2, 0, 0)
          .scrollX(() => -0.25 + e.bassPhase() * 0.1),   // -0.25 = arranca en negro
        () => deforma(e, 0)
      )
      .modulate(   // V4 líquido: manchas de ruido quietas (no se mueven con la fase); la nota cambia el tamaño
        noise(() => 2 + e.bassPitch() * 6, 0),
        () => deforma(e, 2)
      )
      .brightness(() => flashCaja(e))   // F5 (V5: flash / strobo / a negro)
      .scale(() => 1.5 + pulsoBombo(e))  // F6 (V6: agranda / strobo / achica)
      .modulateScrollX(fuenteBandas(), () => desalineoBandas(e))   // N21 / N31 bandas (en 0 = sin efecto)
    if (mandala) c = c.kaleid(() => 2 + C.kaleid * 6)   // V2 mandala
    return c
      .pixelate(() => pxTodoX(e), () => pxTodoY(e))   // V1 todo / tiras (textura: no se nota)
      .rotate(anguloExtra)
  }

  // máscaras duras que parten la pantalla en x = 0.5
  // (funciones: cada uso arma una cadena nueva; reusar la misma rompe el shader)
  // borde duro: pixelate(2, 1) deja sólo dos valores (0.25 / 0.75), así el corte cae seco en el píxel del medio
  const mascaraDerecha = () => gradient(0).r().pixelate(2, 1).thresh(0.5, 0.1)
  const mascaraIzquierda = () => gradient(0).r().pixelate(2, 1).thresh(0.5, 0.1).invert(1)

  let salidaOut = null
  let armadoMandala = false
  V.salida = (out) => {
    salidaOut = out
    armadoMandala = verK() === 1
    mitad(vivo, () => 0, armadoMandala)
      .mask(mascaraIzquierda())
      .add(mitad(derecha, () => (C.rotarMitad ? Math.PI / 2 : 0), armadoMandala, true).mask(mascaraDerecha()), 1)
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
