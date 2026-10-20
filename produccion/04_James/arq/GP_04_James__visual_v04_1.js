// ============================================================
// GP_04_James__visual_v04_1.js  ·  produccion/04_James/arq/  (DESARROLLO)
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: motor visual v04_1 — las puertas de la v04 (tocadas por la música) + variantes
//      que se suman de a una para probarlas con el ensayo.
//      Rectángulos de luz, blanco puro, pantalla completa.
// Lo carga el sketch produccion/04_James/sketches/04_James_v04_1.js; el sketch llama GP.james.*
// Actualizado: 20/10/2026 (v04_1-d: variante 4, STROBO QUE INVIERTE — no pinta blanco: invierte la
//              pantalla entera (negativo/positivo) en ritmo rápido, en ráfagas cortas, para marcar
//              un punto muy alto (referencia: Milian Mori, primer segundo del video 3).
//              ⚠ Parpadeo rápido de pantalla entera: avisar al público (fotosensibilidad).
//              v04_1-c: variante 3, RESPIRA — en vez de barrer a lo ancho, la franja
//              cambia de grosor: aparece como línea, se llena y vuelve a ser línea antes de
//              apagarse; la estela va arriba y abajo (sale del ejemplo bandas).
//              v04_1-b: variante 2, TÓTEM — la puerta se abre desde un punto hacia
//              los dos lados, con un largo distinto en cada franja (borde dentado), y se recoge
//              hasta quedar en dos agujas. El punto lo da la altura de la nota (sale del ejemplo tótem).
//              v04_1-a: variante 1, PARTIDA — la puerta viene cortada en pedazos
//              con huecos; con cada nota los pedazos saltan una celda, las franjas pares
//              para un lado y las impares para el otro (sale del ejemplo laberinto).
//              La v04 queda intacta en GP_04_James__visual_v04.js (motor v4.1))
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
//                 bajo y melodía: la puerta queda abierta mientras suena la nota (tecla de piano);
//                                 si la nota dura más que sostieneMax, la puerta late con el pulso (repite)
//                 bombo y caja:   la puerta se abre, se sostiene un instante (sostiene) y se va
//                 reloj:          sin música, una puerta cada tanto (como la v03)
//   C.cruce     la voz que dispara una segunda capa en sentido contrario; donde se pisan, diff
//   C.golpe     la voz que prende la pantalla entera y la cierra en barrido
//   C.porAltura cada nota prende SÓLO su franja (grave abajo, agudo arriba);
//               la batería, una franja al azar. Si no, cada nota abre todas, escalonadas.
//   C.golpeAlCambiar  cada cambio de estado (canal 16) se marca con un golpe
//
// VARIANTES (se prenden por estado o desde la consola)
//   C.partida   la puerta viene en pedazos con huecos; cada disparo los hace saltar una celda
//   C.totem     la puerta se abre desde un punto hacia los dos lados y se recoge en dos agujas
//               (se puede combinar con partida)
//   C.respira   la franja no barre a lo ancho: crece de línea a llena y vuelve a línea
//               (se combina con partida — bandas con escalones — y con tótem)
//   strobo      ráfagas que invierten la pantalla entera en ritmo rápido: al entrar a un estado
//               (stroboAlEntrar), con cada nota de una voz (stroboVoz) o mientras apretás el pad
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
//   GP.james.mano('salto')             los pedazos de la partida saltan una celda (sin abrir puertas)
//   GP.james.mano('strobo', on)        invierte la pantalla en ritmo rápido mientras on = true
//   GP.james.strobo(negras)            una ráfaga de strobo
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v04_1-d'

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
                                 // (mientras la puerta se está abriendo también es legato)
    relevo: 0.15,                // cuando una nota llega con la puerta abierta: la que estaba se va
                                 // y la nueva entra esta fracción de 'cierra' después (0 = pegadas:
                                 // la pantalla queda toda blanca · 0.3 = se ve bien el negro entre las dos)
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
    repite: 1,                   // si la nota sigue sonando después de sostieneMax, la puerta vuelve a entrar
                                 // en la próxima negra (1) · 0.5 = corchea · 2 = blanca · 0 = no vuelve
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

    // ---- variante 1: PARTIDA (N12) ----
    partida: false,              // la puerta viene cortada en pedazos con huecos
    celdas: 9,                   // pedazos a lo ancho de la pantalla
    huecos: 0.4,                 // proporción de pedazos que faltan (0 = ninguno · 0.7 = quedan pocos)
    separa: 0.12,                // negro entre pedazo y pedazo (fracción de celda)
    escalon: 0.25,               // cada pedazo un poco más arriba o más abajo dentro de su franja (0 = parejos)
    salto: 1,                    // celdas que salta con cada disparo (las pares a la derecha, las impares a la izquierda)
    saltoDur: 0.35,              // negras que tarda el salto
    deriva: 0.05,                // además se deslizan solos (celdas por negra · 0 = quietos)

    // ---- variante 2: TÓTEM (N13) ----
    totem: false,                // la puerta se abre desde un punto hacia los dos lados y se recoge en dos agujas
    totemLugar: 'altura',        // dónde aparece: 'altura' (grave a la izquierda) · 'azar' · 'centro'
    totemAncho: 0.85,            // ancho máximo, los dos lados juntos (fracción de pantalla)
    dentado: 0.55,               // cuánto cambia el largo de cada franja a cada lado (0 = parejo · 1 = muy dentado)
    totemHueco: 0.035,           // el hueco del medio, entre las dos agujas

    // ---- variante 3: RESPIRA (N14) ----
    respira: false,              // la franja crece de línea a llena y vuelve a línea (a todo el ancho)
    respiraLinea: 0.5,           // dónde queda la línea dentro de su franja: 0 = arriba · 0.5 = al medio · 1 = abajo

    // ---- variante 4: STROBO QUE INVIERTE ----
    // ⚠ parpadeo rápido de pantalla entera: avisar al público (fotosensibilidad)
    stroboAlEntrar: 0,           // negras de ráfaga al entrar al estado (0 = no)
    stroboVoz: 'ninguna',        // voz que dispara una ráfaga con cada nota
    stroboDur: 1,                // negras que dura la ráfaga de cada nota de stroboVoz
    stroboPaso: 0.125,           // negras entre inversión e inversión: 0.125 = fusa · 0.25 = semicorchea · 0.5 = corchea

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
  const nuevosSaltos = () => [0, 1].map(() => Array.from({ length: MAX_FRANJAS }, () => ({ desde: 0, hasta: 0, t: -1e9 })))
  const S = window._jamesV41 || (window._jamesV41 = {
    saltos: nuevosSaltos(),       // partida: cuántas celdas saltó cada franja y cuándo fue el último salto
    strobo: { desde: 0, hasta: -1e9, mano: false, manoDesde: 0 },   // ráfaga del strobo
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
  const tocarFranja = (capa, j, clave, atraso, xc = 0.5, sem = 0) => {
    const g = S.g[capa][j], n = nb()
    // la puerta todavía se está abriendo (o está por entrar): la nota nueva se suma a ésta
    // en vez de cortarla — legato. La batería no la alarga; el bajo y la melodía sí.
    if (n < g.inicio + T('abre') || n - (g.inicio - (g.atraso || 0)) < C.separacion) {
      if (clave && n < cierreDe(g)) { g.suelta = null; g.notas.add(clave) }
      if (!clave && n >= g.inicio + T('abre') && n < cierreDe(g)) g.suelta = Math.max(g.suelta, n + atraso + T('sostiene'))
      return
    }
    // relevo: la puerta que estaba se va ahora (con su animación) y la nueva entra
    // un poquito después, así se ve el negro entre las dos (relevo = 0: entra pegada)
    const suelta = Math.min(g.suelta === null ? Infinity : g.suelta, n + atraso)
    const anterior = { inicio: g.inicio, atraso: g.atraso || 0, suelta, notas: new Set(), prev: null, xc: g.xc, sem: g.sem }
    const sigue = momentoDe(anterior, n) !== null
    const inicio = sigue ? Math.max(n + atraso, cierreDe(anterior) + C.relevo * T('cierra')) : n + atraso
    S.g[capa][j] = {
      inicio,
      atraso,
      nace: inicio,
      suelta: clave ? null : inicio + T('sostiene'),
      notas: new Set(clave ? [clave] : []),
      prev: sigue ? anterior : null,
      xc, sem,                    // tótem: dónde aparece y cómo es su borde dentado
    }
  }
  const soltarClave = clave => {
    S.g.forEach(capa => capa.forEach((g, j) => {
      if (!g.notas.has(clave)) return
      g.notas.delete(clave)
      if (g.notas.size > 0 || g.suelta !== null) return
      // una puerta que iba a volver a entrar (repite) y todavía no entró: no entra
      if (g.repetida && nb() < g.inicio && g.prev) { capa[j] = g.prev; return }
      g.suelta = nb() + (g.atraso || 0)
    }))
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

  // partida: cada disparo hace saltar los pedazos de esa franja una celda (con su escalonado).
  // Si llega otro disparo antes de que termine el salto, el nuevo arranca de donde va.
  const avance = (sl, n) => sl.desde + (sl.hasta - sl.desde) * (C.saltoDur > 0 ? inOut((n - sl.t) / C.saltoDur, C.curva) : 1)
  const saltar = (capa, j, cuando) => {
    const sl = S.saltos[capa][j]
    sl.desde = avance(sl, nb())
    sl.hasta = sl.hasta + 1
    sl.t = cuando
  }
  // corrimiento de los pedazos de la franja j (en celdas)
  const corrimiento = (capa, j, n) => {
    const lado = (j % 2 === 0 ? 1 : -1) * (capa === 1 ? -1 : 1)
    return lado * (C.salto * avance(S.saltos[capa][j], n) + C.deriva * n) + S.semilla * 17
  }

  // tótem: dónde aparece (centro del tótem, de 0 a 1)
  const lugarDe = (voz, nota) => {
    const r = C.rangos[voz]
    if (C.totemLugar === 'centro') return 0.5
    if (C.totemLugar === 'altura' && r) return 0.12 + 0.76 * clamp01((nota - r[0]) / Math.max(1, r[1] - r[0]))
    return 0.15 + 0.7 * azar(S.cuenta * 1.37 + 0.3, 5.1)                     // batería, mano, reloj: al azar
  }

  const disparar = (capa, voz, nota, clave, espejo = false) => {
    S.cuenta++
    const js = franjasDe(voz, nota)
    const lugar = lugarDe(voz, nota)
    const xc = espejo ? 1 - lugar : lugar        // cruzado: la otra capa aparece en el lugar espejado
    js.forEach(j => {
      const atraso = js.length > 1 ? T('demora') * azar(j * 7.31 + capa * 5.3 + 1.7, S.cuenta * 3.1 + 0.5) : 0
      tocarFranja(capa, j, sostenida(voz) ? clave : null, atraso, xc, S.cuenta)
      saltar(capa, j, nb() + atraso)
    })
  }

  // ---- golpe: la pantalla entera blanca, se va en barrido ----
  V.golpe = () => { S.golpe = nb() }

  // ---- strobo: una ráfaga de 'negras' que invierte la pantalla cada stroboPaso ----
  // si ya hay una ráfaga andando, la alarga sin cambiar el ritmo
  V.strobo = (negras = C.stroboDur) => {
    const n = nb(), st = S.strobo || (S.strobo = { desde: 0, hasta: -1e9, mano: false, manoDesde: 0 })
    if (n >= st.hasta) st.desde = n
    st.hasta = Math.max(st.hasta, n + negras)
  }
  // 1 = invertida · 0 = normal (una vez por cuadro)
  let cacheInv = { t: null, v: 0 }
  const invertida = () => {
    if (cacheInv.t === time) return cacheInv.v
    const n = nb(), st = S.strobo
    let desde = null
    if (st && st.mano) desde = st.manoDesde
    else if (st && n < st.hasta) desde = st.desde
    const v = desde === null ? 0 : (Math.floor((n - desde) / Math.max(0.03, C.stroboPaso)) % 2 === 0 ? 1 : 0)
    cacheInv = { t: time, v }
    return v
  }

  // ---- lo que entra ----
  V.nota = (voz, nota, vel, on) => {
    const clave = voz + ':' + nota
    if (!on) { soltarClave(clave); soltarClave(clave + ':x'); soltarClave(clave + ':c'); return }
    if (C.disparo === voz) {
      disparar(0, voz, nota, clave)
      if ((C.verGesto | 0) === 2) disparar(1, voz, nota, clave + ':x', true)   // cruzado: cruza también
    }
    if (C.cruce === voz) disparar(1, voz, nota, clave + ':c')
    if (C.golpe === voz) V.golpe()
    if (C.stroboVoz === voz) V.strobo(C.stroboDur)
  }
  V.soltarVoz = voz => {
    S.g.forEach(capa => capa.forEach((g, j) => {
      for (const k of [...g.notas]) if (k.startsWith(voz + ':')) g.notas.delete(k)
      if (g.notas.size > 0 || g.suelta !== null) return
      if (g.repetida && nb() < g.inicio && g.prev) { capa[j] = g.prev; return }
      g.suelta = nb()
    }))
  }
  V.mano = (accion, on = true) => {
    if (accion === 'strobo') {                   // el pad: invierte mientras lo apretás
      const st = S.strobo || (S.strobo = { desde: 0, hasta: -1e9, mano: false, manoDesde: 0 })
      if (on && !st.mano) st.manoDesde = nb()
      st.mano = !!on
      return
    }
    if (!on) return
    if (accion === 'golpe') V.golpe()
    if (accion === 'salto') { const n = nb(); for (let j = 0; j < MAX_FRANJAS; j++) { saltar(0, j, n); saltar(1, j, n) } }
    if (accion === 'gesto') { disparar(0, 'mano', 0, null); if ((C.verGesto | 0) === 2) disparar(1, 'mano', 0, null, true) }
  }
  // estado = los valores del estado al que se entra (GP_estados los pasa; los números
  // todavía se están fundiendo en C, por eso la ráfaga se lee de acá)
  V.alEntrarEstado = (estado = C) => {
    S.semilla++                                   // desparejas: otros altos en cada estado
    if (C.golpeAlCambiar) V.golpe()               // el corte de la canción se marca con un golpe
    const r = estado.stroboAlEntrar ?? C.stroboAlEntrar
    if (r > 0) V.strobo(r)                        // un punto muy alto: ráfaga que invierte
  }
  V.reiniciar = () => {
    S.g = [Array.from({ length: MAX_FRANJAS }, nuevoGesto), Array.from({ length: MAX_FRANJAS }, nuevoGesto)]
    S.golpe = -1e9; S.reloj = -1
    S.saltos = nuevosSaltos()
    S.strobo = { desde: 0, hasta: -1e9, mano: false, manoDesde: 0 }
  }

  // ============================================================
  // Dibujo
  // ============================================================
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
  // [y0, y1] de la franja j (0 = arriba), con el hueco de la persiana
  const bandaDe = j => {
    if (cacheCortes.t !== time) cacheCortes = { t: time, c: cortes() }
    const c = cacheCortes.c
    if (j >= c.length - 1) return null
    let y0 = c[j], y1 = c[j + 1]
    if ((C.verFranjas | 0) === 2) { const m = (y1 - y0) * clamp01(C.hueco) / 2; y0 += m; y1 -= m }
    return [y0, y1]
  }

  // dónde está la franja j de la capa en la negra n: [x0, x1, h0, h1, y0, y1] o null
  //   h0..h1 = hueco en el medio (sólo el tótem; si no, h1 < h0)
  //   y0..y1 = alto (la franja entera, o lo que respira)
  //   cual: 0 = el gesto actual · 1 = el anterior (que se está yendo)
  const posicion = (capa, j, n, cual = 0) => {
    const banda = bandaDe(j)
    if (!banda) return null
    const xs = posicionX(capa, j, n, cual)
    if (!xs) return null
    if (!C.respira) return [...xs, banda[0], banda[1]]
    // respira: el alto crece desde la línea hasta la franja entera y vuelve a la línea
    const k = xs.k, alto = banda[1] - banda[0], lin = clamp01(C.respiraLinea)
    const grosor = Math.max(C.linea * 16 / 9, k * alto)
    const y0 = banda[0] + (alto - grosor) * lin
    return [...xs, y0, y0 + grosor]
  }
  // lo horizontal: [x0, x1, h0, h1] (+ k = cuánto está abierta, de 0 a 1)
  const posicionX = (capa, j, n, cual) => {
    const g = cual ? S.g[capa][j].prev : S.g[capa][j]
    const m = momentoDe(g, n)
    if (!m) return null
    const k = Math.max(0, m.hasta - m.desde)
    const conK = a => { a.k = k; return a }
    if (C.respira && !C.totem) return conK([0, 1, 0, -1])          // respira: a todo el ancho
    if (C.totem) {
      // abre: crece desde el centro hacia los dos lados · se va: se recoge hasta las dos agujas
      const sem = g.sem || 0, xc = g.xc ?? 0.5, med = C.totemHueco / 2, lado = C.totemAncho / 2
      // cada lado tiene su largo (dentado) y no se sale de la pantalla: cerca del borde queda más corto
      const izq = Math.min(xc - med - 0.01, lado * (1 - clamp01(C.dentado) * azar(j * 3.1 + capa * 1.9 + 0.7, sem * 0.37 + 1.3)))
      const der = Math.min(1 - xc - med - 0.01, lado * (1 - clamp01(C.dentado) * azar(j * 5.7 + capa * 2.3 + 0.1, sem * 0.53 + 9.1)))
      return conK([xc - med - Math.max(C.linea, k * izq), xc + med + Math.max(C.linea, k * der), xc - med, xc + med])
    }
    let d = m.desde, h = m.hasta
    if (h - d < C.linea) { if (d === 0) h = C.linea; else d = h - C.linea }
    const dir = (C.direccion >= 0 ? 1 : -1) * (capa === 1 ? -1 : 1)
    return conK(dir > 0 ? [d, h, 0, -1] : [1 - h, 1 - d, 0, -1])
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
  // devuelve [x0, x1, ei, ed, h0, h1, y0, y1]
  //   ei / ed: estela desde el borde izquierdo / derecho — o, si respira, desde arriba / abajo
  const conEstela = (pos, antes, paso, vertical = false) => {
    if (!pos) return [2, 2, 0, 0, 0, -1, 2, 2]              // apagada: fuera de pantalla
    const hueco = pos[3] > pos[2]
    const y0 = pos[4] ?? 0, y1 = pos[5] ?? 1
    const est = lado => {
      if (!antes || C.estela <= 0) return 0
      const i = vertical ? 4 + lado : lado
      const vel = Math.abs(pos[i] - antes[i]) / paso        // pantallas por negra
      // la estela no pasa de su lado (en el tótem, cada lado tiene la suya; si respira, la mitad del alto)
      const tope = vertical ? (y1 - y0) / 2 : hueco ? (lado === 0 ? pos[2] - pos[0] : pos[1] - pos[3]) : pos[1] - pos[0]
      return Math.min(tope, vel * C.estela * escala())
    }
    return [pos[0], pos[1], est(0), est(1), pos[2] ?? 0, pos[3] ?? -1, y0, y1]
  }
  const valor = (clave, calc, k) => () => {
    if (cache.t !== time) { cache.t = time; cache.v = {} }
    if (!cache.v[clave]) cache.v[clave] = calc()
    return cache.v[clave][k]
  }
  const PASO = 0.04
  const valorFranja = (capa, j, cual, k) => valor('f' + capa + '_' + j + '_' + cual, () => {
    const n = nb()
    return conEstela(posicion(capa, j, n, cual), posicion(capa, j, n - PASO, cual), PASO, !!C.respira)
  }, k)
  const valorGolpe = k => valor('golpe', () => {
    const n = nb()
    return conEstela(posGolpe(n), posGolpe(n - PASO), PASO)
  }, k)

  // partida: valores por franja (los de la capa entera son los mismos para todas)
  const valorCorr = (capa, j) => valor('c' + capa + '_' + j, () => [corrimiento(capa, j, nb())], 0)
  const pCeldas = () => C.partida ? Math.max(1, C.celdas) : 0
  const pHuecos = () => clamp01(C.huecos)
  const pSepara = () => clamp01(C.separa)
  const pEscalon = () => clamp01(C.escalon)
  const modoEstela = () => (C.verEstela | 0) + (C.respira ? 3 : 0)   // +3: la estela va arriba y abajo
  const modoGolpe = () => C.verEstela | 0
  const pasosEstela = () => (C.verEstela | 0) === 1 ? Math.max(2, C.escalones) : C.agujas

  const capaDe = capa => {
    let luz = solid(0, 0, 0)
    for (let j = 0; j < MAX_FRANJAS; j++) {
      for (const cual of [0, 1]) {                          // el gesto actual y el que se está yendo
        luz = luz.add(caja(valorFranja(capa, j, cual, 0), valorFranja(capa, j, cual, 1), valorFranja(capa, j, cual, 6), valorFranja(capa, j, cual, 7),
          valorFranja(capa, j, cual, 2), valorFranja(capa, j, cual, 3), modoEstela, pasosEstela,
          pCeldas, pHuecos, pSepara, pEscalon, valorCorr(capa, j), j + capa * 8 + 1,
          valorFranja(capa, j, cual, 4), valorFranja(capa, j, cual, 5)))
      }
    }
    return luz
  }
  const escena = () => capaDe(0)
    .diff(capaDe(1))                                        // donde se cruzan, se invierte
    .add(caja(valorGolpe(0), valorGolpe(1), 0, 1, valorGolpe(2), valorGolpe(3), modoGolpe, pasosEstela, 0, 0, 0, 0, 0, 0, 0, -1))
    .invert(invertida)                                      // strobo: negativo / positivo

  const definirCaja = () => setFunction({
    name: 'caja', type: 'src',
    inputs: [
      { type: 'float', name: 'x0', default: 0.25 }, { type: 'float', name: 'x1', default: 0.75 },
      { type: 'float', name: 'y0', default: 0.25 }, { type: 'float', name: 'y1', default: 0.75 },
      { type: 'float', name: 'ei', default: 0.0 }, { type: 'float', name: 'ed', default: 0.0 },
      { type: 'float', name: 'modo', default: 0.0 }, { type: 'float', name: 'pasos', default: 4.0 },
      { type: 'float', name: 'celdas', default: 0.0 }, { type: 'float', name: 'huecos', default: 0.4 },
      { type: 'float', name: 'separa', default: 0.1 }, { type: 'float', name: 'escalon', default: 0.0 },
      { type: 'float', name: 'corr', default: 0.0 }, { type: 'float', name: 'sem', default: 0.0 },
      { type: 'float', name: 'h0', default: 0.0 }, { type: 'float', name: 'h1', default: -1.0 },
    ],
    // un rectángulo blanco; y de ARRIBA hacia abajo (0 = arriba).
    // ei / ed = estela hacia adentro desde el borde izquierdo / derecho (0 = borde duro)
    // modo: 0 degradado · 1 eco (en 'pasos' escalones) · 2 agujas ('pasos' líneas finas)
    //       +3 = la estela va desde arriba / abajo (respira)
    // partida (celdas > 0): la puerta se ve sólo donde hay pedazo. Los pedazos se corren
    // 'corr' celdas; 'huecos' de ellos faltan; cada uno sube o baja hasta 'escalon' de la franja
    // tótem (h1 > h0): entre h0 y h1 hay un hueco negro (las dos agujas quedan en sus bordes)
    glsl: `
      float y = 1.0 - _st.y;
      float ax = 0.7 / resolution.x, ay = 0.7 / resolution.y;
      float pieza = 1.0;
      float py0 = y0, py1 = y1;
      if (celdas > 0.5) {
        float u = _st.x * celdas - corr;
        float ci = floor(u);
        float fu = u - ci;
        float hay = step(huecos, fract(sin(ci * 12.9898 + sem * 78.233) * 43758.5453));
        float bc = ax * celdas;
        float mitad = separa * 0.5;
        pieza = hay * smoothstep(mitad - bc, mitad + bc, fu) * (1.0 - smoothstep(1.0 - mitad - bc, 1.0 - mitad + bc, fu));
        float alto = y1 - y0;
        float r2 = fract(sin(ci * 39.346 + sem * 11.135) * 24634.6345);
        py0 = y0 + r2 * escalon * alto;
        py1 = py0 + (1.0 - escalon) * alto;
      }
      float dentro = smoothstep(x0 - ax, x0 + ax, _st.x) * (1.0 - smoothstep(x1 - ax, x1 + ax, _st.x));
      float vert = step(2.5, modo);
      float m = modo - 3.0 * vert;
      float a = mix(ax, ay, vert);
      float ri = mix(clamp((_st.x - x0) / max(ei, ax), 0.0, 1.0), clamp((y - py0) / max(ei, ay), 0.0, 1.0), vert);
      float rd = mix(clamp((x1 - _st.x) / max(ed, ax), 0.0, 1.0), clamp((py1 - y) / max(ed, ay), 0.0, 1.0), vert);
      float r = min(ri, rd);
      float e = r;
      if (m > 0.5 && m < 1.5) e = r >= 1.0 ? 1.0 : floor(r * pasos) / pasos;
      if (m > 1.5) {
        float rl = r >= 1.0 ? 0.0 : fract(r * pasos);
        float px = a * 2.0 / max(max(ei, ed), a) * pasos;
        e = r >= 1.0 ? 1.0 : (1.0 - smoothstep(0.0, max(px, 0.08), rl));
      }
      float h = dentro * e * pieza;
      if (h1 > h0) h *= 1.0 - smoothstep(h0 - ax, h0 + ax, _st.x) * (1.0 - smoothstep(h1 - ax, h1 + ax, _st.x));
      float v = smoothstep(py0 - ay, py0 + ay, y) * (1.0 - smoothstep(py1 - ay, py1 + ay, y));
      return vec4(vec3(h * v), 1.0);`
  })

  V.salida = (out) => { escena().out(out) }

  V.update = () => {
    const n = nb()
    S.g.forEach(capa => capa.forEach((g, j) => {
      if (g.suelta !== null) return
      // notas colgadas (sin note-off): se sueltan solas
      if (n - (g.nace ?? g.inicio) > C.maxSostenida) { g.notas.clear(); g.suelta = n; return }
      // repite: la nota sigue sonando y la puerta ya llegó a sostieneMax → se va,
      // y vuelve a entrar en la próxima negra (con el mismo escalonado de su franja)
      if (!(C.repite > 0) || !(C.sostieneMax > 0)) return
      const cierre = cierreDe(g)
      if (n < cierre) return
      const at = g.atraso || 0
      const inicio = Math.ceil((cierre - at + C.relevo * T('cierra')) / C.repite - 1e-6) * C.repite + at
      capa[j] = { inicio, atraso: at, nace: g.nace ?? g.inicio, suelta: null, notas: g.notas, repetida: true,
                  xc: g.xc, sem: g.sem,
                  prev: { inicio: g.inicio, atraso: at, suelta: cierre, notas: new Set(), prev: null, xc: g.xc, sem: g.sem } }
    }))
    // reloj: una puerta cada tanto, sin música
    if (C.disparo === 'reloj') {
      const ciclo = C.ciclo > 0 ? C.ciclo
        : Math.max(1, Math.ceil(T('abre') + T('sostiene') + T('cierra') + T('demora') + 0.25))
      const k = Math.floor(n / ciclo)
      if (k !== S.reloj) {
        S.reloj = k
        disparar(0, 'reloj', 0, null)
        if ((C.verGesto | 0) === 2) disparar(1, 'reloj', 0, null, true)
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

  console.log('[GP] visual James ' + VERSION + ' (DESARROLLO v04_1, produccion/04_James/arq) cargado')
})()
