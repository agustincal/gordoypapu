// ============================================================
// GP_estados  ·  LIVE/arq/GP_estados.js
// Genérico · Fase 3 · todas las canciones (Gordo y Papu)
// Rol: los estados de cada canción. Cada nota que llega por el canal de
//      estados (canal 16 del Korg, el código convenido con los músicos)
//      pasa al estado siguiente.
// Depende de: GP_midi (faders, toggles, versiones, mutes, LEDs).
//             GP_tools es opcional: si está cargado (ensayo) muestra el
//             estado arriba a la derecha. En el show no se ve.
// Actualizado: 2026-10-16 (v1.0)
// ============================================================
//
// Un estado es una foto de la consola + ajustes de la canción:
//   - faders, toggles, versiones y mutes, como si los hubieras puesto a mano
//   - valores del visual que no tienen control físico (color, tiempos, etc.)
// En vivo podés tocar cualquier control: gana tu mano hasta el próximo estado.
//
// Uso en el sketch (después de V.init y de GP.midi.buttons):
//
//   GP.estados.init({
//     cancion: '03_Vociferan',
//     destino: V.C,              // la configuración del visual: acá se escriben los valores
//     controles: {               // nombre → control físico
//       tamano:  'F1',           //   F1..F8 = fader (valores de 0 a 1)
//       strobe:  'N11',          //   N11..N88 = toggle (true / false)
//       forma:   'V3',           //   V1..V8 = versión del fader (0, 1 o 2)
//       melodia: 'M8',           //   M5..M8 = mute de esa fila de disparo (true = muteada)
//     },
//     estados: [
//       { nombre: 'intro',      tamano: 0.3, strobe: false },
//       { nombre: 'estribillo', tamano: 0.8, hue: 200 },
//       { como: 1, nombre: 'intro otra vez', tamano: 0.4 },   // el 1 con un cambio
//     ],
//     alEntrar: (estado, numero) => { },   // opcional: algo propio al entrar a un estado
//   })
//
// Reglas:
//   - Lo que un estado no anota sale de la base: el valor que tiene el
//     destino al llamar a init (o sea, lo que pusiste en V.init).
//   - como: N arranca del estado N y le aplica lo que anota este.
//   - fundido: segundos que tarda en pasar a ese estado (default 0.3).
//     Los números se funden; true/false y textos cambian al instante.
//   - Antes de la primera nota del canal 16 está el "inicio" (= la base).
//     Después del último estado, las notas se ignoran.
//   - Reevaluar el sketch NO vuelve al principio: re-aplica el estado
//     actual con los números nuevos (para curar sin perder el lugar).
//     GP.estados.reiniciar() vuelve al inicio (ej: antes de dar ▶ a un ensayo).
//
// Ensayo / emergencia: botón redondo 86 = anterior · 87 = siguiente
// (LED prendido = hay a dónde ir).
// Consola: GP.estados.siguiente() · .anterior() · .ir(5) · .reiniciar() · .tabla()
// ============================================================

;(function () {
  window.GP = window.GP || {}
  const GP = window.GP
  const VERSION = 'v1.0'

  if (GP.estados && GP.estados._version === VERSION) return

  // ---- configuración general (igual para todas las canciones) ----
  const cfg = {
    fuente: /korg|padkontrol/i,  // aparato que manda los cambios de estado (incluye korg_Ensayo)
    canal: 16,                   // canal de estados, 1..16 como lo muestra el panel
    antirrebote: 150,            // ms: dos notas más juntas que esto cuentan como una sola
    akai: /apc|akai/i,
    botonAnterior: 86,           // botones redondos de la columna derecha (null = sin botón)
    botonSiguiente: 87,
    fundido: 0.3,                // segundos entre estados, si el estado no dice otra cosa
    umbralToque: 3,              // cuánto hay que mover un fader (de 0 a 127) para tomar el control
    mezclaToque: 0.25,           // segundos que tarda en pasar del valor del estado al del fader
    suavizado: 0.1,              // segundos de suavizado del fader físico
  }

  const RESERVADAS = new Set(['nombre', 'como', 'fundido'])
  const BASE_POR_TIPO = { fader: 0, toggle: false, version: 0, mute: false }

  // se conserva al reevaluar: en qué estado estamos
  const mem = window._gpEstadosMem || (window._gpEstadosMem = { cancion: null, numero: 0 })

  // ============================================================
  // Utilidades
  // ============================================================
  const clamp01 = v => Math.max(0, Math.min(1, v))
  const suave = t => t * t * (3 - 2 * t)
  const copia = v => Array.isArray(v) ? v.slice() : (v && typeof v === 'object') ? { ...v } : v
  const esNumeros = v => Array.isArray(v) && v.length > 0 && v.every(x => typeof x === 'number')
  const esFundible = (a, b) =>
    (typeof a === 'number' && typeof b === 'number') ||
    (esNumeros(a) && esNumeros(b) && a.length === b.length)
  const mezclar = (a, b, k) => {
    if (k >= 1 || !esFundible(a, b)) return copia(b)
    if (typeof a === 'number') return a + (b - a) * k
    return a.map((x, i) => x + (b[i] - x) * k)
  }

  const notaDeBoton = n => { const m = /^N([1-8])([1-8])$/.exec(n); return (m[1] - 1) * 8 + (m[2] - 1) }
  const nombreDeNota = n => `N${Math.floor(n / 8) + 1}${(n % 8) + 1}`

  const leerControl = (clave, ref) => {
    const s = String(ref).trim().toUpperCase()
    let m
    if ((m = /^F([1-8])$/.exec(s))) return { tipo: 'fader', ref: s }
    if ((m = /^N([1-8])([1-8])$/.exec(s))) return { tipo: 'toggle', ref: s }
    if ((m = /^V([1-8])$/.exec(s))) return { tipo: 'version', ref: `F${m[1]}` }
    if ((m = /^M([5-8])$/.exec(s))) return { tipo: 'mute', fila: Number(m[1]) }
    throw new Error(`GP estados: el control "${clave}: '${ref}'" no existe. Usá F1..F8, N11..N88, V1..V8 o M5..M8.`)
  }

  // ============================================================
  // Puente con GP_midi
  // ============================================================
  const midi = () => GP.midi || null
  const leerFisico = (c) => {
    const M = midi()
    if (!M) return BASE_POR_TIPO[c.tipo]
    if (c.tipo === 'fader') return M.fader(c.ref)           // 0..127
    if (c.tipo === 'toggle') return M.button(c.ref)
    if (c.tipo === 'version') return M.versionDe(c.ref)
    return M.muteado(c.fila)
  }
  const aplicarDiscreto = (c, v) => {
    const M = midi()
    if (!M) return
    if (c.tipo === 'toggle') M.setButton(c.ref, !!v)
    else if (c.tipo === 'version') M.fijarVersion(c.ref, v | 0)
    else if (c.tipo === 'mute' && M.muteado(c.fila) !== !!v) M.mute(c.fila, !!v)
  }

  // ============================================================
  // Estado interno
  // ============================================================
  let can = null          // la canción cargada con init
  let numero = 0          // 0 = inicio · 1..N = estados
  let objetivo = {}       // valores del estado actual (ya resueltos)
  const desde = {}        // valores al momento del cambio (de ahí arranca el fundido)
  const valores = {}      // lo que se está usando ahora mismo
  const toque = {}        // fader → { base, tocado, t }
  const fisico = {}       // fader → posición física suavizada (0..1)
  let tCambio = 0, durFundido = 0, fundiendo = false
  let ultimoTick = performance.now()
  let ultimaNota = -1e9

  const escribir = (k, v) => {
    if (v === undefined) return
    valores[k] = v
    if (can.destino) can.destino[k] = v
  }

  // ============================================================
  // Cada cuadro: fundidos + takeover de faders → destino
  // ============================================================
  const tick = () => {
    if (!can) return
    const ahora = performance.now()
    const dt = Math.min(100, Math.max(0, ahora - ultimoTick))
    ultimoTick = ahora
    const t = durFundido > 0 ? clamp01((ahora - tCambio) / (durFundido * 1000)) : 1
    const kf = suave(t)
    const aFisico = 1 - Math.exp(-dt / Math.max(1, cfg.suavizado * 1000))

    for (const k of can.claves) {
      const c = can.controles[k]
      if (!c) {
        // valores sueltos: sólo se escriben mientras dura el fundido (después
        // quedan quietos, así un ajuste a mano con Ctrl+Enter se respeta)
        if (fundiendo && esFundible(desde[k], objetivo[k])) escribir(k, mezclar(desde[k], objetivo[k], kf))
      } else if (c.tipo === 'fader') {
        const raw = leerFisico(c)
        const tk = toque[k]
        if (!tk.tocado && Math.abs(raw - tk.base) > cfg.umbralToque) { tk.tocado = true; tk.t = ahora }
        fisico[k] += (raw / 127 - fisico[k]) * aFisico
        const curado = mezclar(desde[k], objetivo[k], kf)
        const m = tk.tocado ? suave(clamp01((ahora - tk.t) / Math.max(1, cfg.mezclaToque * 1000))) : 0
        escribir(k, typeof curado === 'number' ? curado + (fisico[k] - curado) * m : curado)
      } else {
        escribir(k, leerFisico(c))   // toggles, versiones y mutes: manda lo que está en la consola
      }
    }
    if (t >= 1) fundiendo = false
  }

  let erroresTick = 0
  if (window._gpEstadosLoop) cancelAnimationFrame(window._gpEstadosLoop)
  const loop = () => {
    try { tick() } catch (err) { if (erroresTick++ < 3) console.error('[GP estados]', err) }
    window._gpEstadosLoop = requestAnimationFrame(loop)
  }
  window._gpEstadosLoop = requestAnimationFrame(loop)

  // ============================================================
  // Entrar a un estado
  // ============================================================
  const mostrar = (origen) => {
    const total = can.lista.length - 1
    const texto = numero === 0 ? 'inicio' : `${numero}/${total} · ${objetivo.nombre}`
    if (GP.tools && GP.tools.cartel) GP.tools.cartel.mostrar(texto)
    const M = midi()
    if (M && M.luz) {
      if (cfg.botonAnterior != null) M.luz(cfg.botonAnterior, numero > 0 ? 1 : 0)
      if (cfg.botonSiguiente != null) M.luz(cfg.botonSiguiente, numero < total ? 1 : 0)
    }
    console.info(`[GP estados] ${texto}${origen ? `  (${origen})` : ''}`)
  }

  const entrar = (n, { fundir = true, avisar = true, origen = '' } = {}) => {
    if (!can) return
    const total = can.lista.length - 1
    n = Math.max(0, Math.min(total, n | 0))
    const anterior = numero
    const proximo = can.lista[n]

    // el fundido arranca de lo que se ve ahora (incluye lo que hayas tocado a mano)
    for (const k of can.claves) {
      const ahora = can.destino && k in can.destino ? can.destino[k] : valores[k]
      desde[k] = copia(ahora === undefined ? proximo[k] : ahora)
    }

    numero = n
    mem.numero = n
    objetivo = proximo
    tCambio = performance.now()
    durFundido = fundir ? Math.max(0, can.fundidos[n] || 0) : 0
    fundiendo = true

    for (const k of can.claves) {
      const c = can.controles[k]
      if (c && c.tipo === 'fader') {
        // takeover: el fader vuelve a mandar el estado hasta que lo muevas
        const raw = leerFisico(c)
        toque[k] = { base: raw, tocado: false, t: 0 }
        if (fisico[k] == null) fisico[k] = raw / 127
      } else if (c) {
        aplicarDiscreto(c, objetivo[k])   // toggles, versiones, mutes: al instante (con su LED)
      } else if (durFundido === 0 || !esFundible(desde[k], objetivo[k])) {
        escribir(k, copia(objetivo[k]))   // lo que no se funde, al instante
      }
    }
    tick()
    mostrar(origen)
    if (avisar && can.alEntrar) {
      try { can.alEntrar(objetivo, n, anterior) } catch (err) { console.error('[GP estados] alEntrar:', err) }
    }
  }

  // ============================================================
  // Mensajes MIDI: canal de estados + botones 86/87 del Akai
  // ============================================================
  const procesar = (nombre, data) => {
    if (!can) return
    const [st, d1, d2] = data
    if (st >= 0xf0 || (st & 0xf0) !== 0x90 || !(d2 > 0)) return
    const canal = (st & 0x0f) + 1
    if (canal === cfg.canal && cfg.fuente.test(nombre)) {
      const ahora = performance.now()
      if (ahora - ultimaNota < cfg.antirrebote) return
      ultimaNota = ahora
      E.siguiente(`canal ${cfg.canal}`)
      return
    }
    if (canal === 1 && cfg.akai.test(nombre)) {
      if (d1 === cfg.botonSiguiente) E.siguiente(`botón ${d1}`)
      else if (d1 === cfg.botonAnterior) E.anterior(`botón ${d1}`)
    }
  }

  // ============================================================
  // Bus MIDI compartido (mismo código en GP_midi.js y GP_tools.js)
  // ============================================================
  const bus = window._gpMidiBus || (window._gpMidiBus = { oyentes: {}, alCambiarPuertos: {}, acc: null, listo: null })
  if (!bus.conectar) {
    bus.escuchar = (id, fn) => { if (fn) bus.oyentes[id] = fn; else delete bus.oyentes[id] }
    bus.puertos = (id, fn) => { if (fn) bus.alCambiarPuertos[id] = fn; else delete bus.alCambiarPuertos[id] }
    bus.conectar = () => {
      if (!bus.listo) {
        bus.listo = navigator.requestMIDIAccess().then(acc => {
          bus.acc = acc
          const enganchar = () => {
            acc.inputs.forEach(entrada => {
              if (entrada.state !== 'connected') return
              entrada.onmidimessage = (msg) => {
                for (const id in bus.oyentes) {
                  try { bus.oyentes[id](entrada.name, msg.data, msg.timeStamp) } catch (err) { console.error(`[GP bus] ${id}:`, err) }
                }
              }
            })
            for (const id in bus.alCambiarPuertos) {
              try { bus.alCambiarPuertos[id](acc) } catch (err) { console.error(`[GP bus] ${id}:`, err) }
            }
          }
          bus.enganchar = enganchar
          acc.onstatechange = enganchar
          enganchar()
          return acc
        })
      }
      return bus.listo
    }
  }
  bus.escuchar('estados', procesar)

  // ============================================================
  // API
  // ============================================================
  const E = { _version: VERSION, config: cfg }

  E.init = (op = {}) => {
    const destino = op.destino || null

    const controles = {}
    for (const [clave, ref] of Object.entries(op.controles || {})) controles[clave] = leerControl(clave, ref)

    let estados = op.estados || []
    if (!Array.isArray(estados)) {
      estados = Object.keys(estados).map(Number).filter(n => n >= 1).sort((a, b) => a - b).map(n => op.estados[n])
    }

    // claves que manejan los estados: los controles + todo lo que anote algún estado
    const claves = new Set(Object.keys(controles))
    estados.forEach(e => Object.keys(e || {}).forEach(k => { if (!RESERVADAS.has(k)) claves.add(k) }))

    // base = lo que tiene el destino ahora (lo que puso V.init) + op.base
    const base = {}
    const sinBase = []
    for (const k of claves) {
      if (op.base && k in op.base) base[k] = copia(op.base[k])
      else if (destino && k in destino) base[k] = copia(destino[k])
      else if (controles[k]) base[k] = BASE_POR_TIPO[controles[k].tipo]
      else sinBase.push(k)
    }
    if (sinBase.length) {
      console.warn(`[GP estados] "${sinBase.join('", "')}" no existe en la configuración del visual: ¿error de tipeo? (si es nuevo, ponele un valor en V.init)`)
    }

    // resolver cada estado: base (o el estado de "como") + lo que anota
    const resueltos = []
    const resolver = (i, pila) => {
      if (resueltos[i]) return resueltos[i]
      if (pila.includes(i)) throw new Error(`GP estados: los "como" forman un círculo (${[...pila, i].map(x => x + 1).join(' → ')})`)
      const e = estados[i] || {}
      let previo = base
      if (e.como != null) {
        const j = Number(e.como) - 1
        if (!(j >= 0 && j < estados.length)) throw new Error(`GP estados: el estado ${i + 1} dice como: ${e.como}, y ese estado no existe`)
        previo = resolver(j, [...pila, i])
      }
      const r = {}
      for (const k of claves) r[k] = copia(previo[k])
      for (const [k, v] of Object.entries(e)) if (!RESERVADAS.has(k)) r[k] = copia(v)
      r.nombre = e.nombre || (e.como != null ? `${previo.nombre} (bis)` : `estado ${i + 1}`)
      resueltos[i] = r
      return r
    }

    const fundidoDefault = op.fundido != null ? Number(op.fundido) : cfg.fundido
    const inicio = { nombre: 'inicio' }
    for (const k of claves) inicio[k] = copia(base[k])
    const lista = [inicio]
    const fundidos = [fundidoDefault]
    estados.forEach((e, i) => {
      lista.push(resolver(i, []))
      fundidos.push(e && e.fundido != null ? Number(e.fundido) : fundidoDefault)
    })

    const cancion = op.cancion ?? (GP.tools && GP.tools.config ? GP.tools.config.cancion : null)
    can = { cancion, controles, claves: [...claves], lista, fundidos, destino, alEntrar: op.alEntrar || null }

    // los toggles tienen que estar habilitados en GP_midi para que el Akai los cambie
    const M = midi()
    if (M && M.state) {
      const activos = M.state.activeButtons || []
      const faltan = Object.values(controles).filter(c => c.tipo === 'toggle' && !activos.includes(notaDeBoton(c.ref)))
      if (faltan.length) M.buttons([...activos.map(nombreDeNota), ...faltan.map(c => c.ref)])
    } else if (!M) {
      console.warn('[GP estados] GP_midi no está cargado: los controles no van a responder')
    }

    // misma canción → seguimos en el mismo estado (reevaluar no vuelve al principio)
    if (mem.cancion !== cancion) { mem.cancion = cancion; mem.numero = 0 }
    entrar(Math.min(mem.numero, lista.length - 1), { fundir: false, avisar: false, origen: 'init' })
    return E
  }

  E.siguiente = (origen = 'código') => {
    if (!can) return E
    if (numero >= can.lista.length - 1) { console.info('[GP estados] ya estás en el último estado'); return E }
    entrar(numero + 1, { origen })
    return E
  }
  E.anterior = (origen = 'código') => {
    if (!can || numero <= 0) return E
    entrar(numero - 1, { origen })
    return E
  }
  E.ir = (n, origen = 'código') => { entrar(n, { origen }); return E }
  E.reiniciar = () => { entrar(0, { fundir: false, origen: 'reiniciar' }); return E }

  // valor que se está usando ahora (con takeover y fundido incluidos)
  E.valor = clave => valores[clave]

  // todos los estados ya resueltos, en una tabla en la consola
  E.tabla = () => {
    if (!can) return
    const filas = {}
    can.lista.forEach((e, i) => {
      const fila = {}
      for (const k of can.claves) {
        const v = e[k]
        fila[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : Array.isArray(v) ? v.join(' ') : v
      }
      filas[i === 0 ? '0 · inicio' : `${i} · ${e.nombre}`] = fila
    })
    console.table(filas)
  }

  Object.defineProperties(E, {
    numero: { get: () => numero },                                  // 0 = inicio
    total: { get: () => (can ? can.lista.length - 1 : 0) },
    actual: { get: () => objetivo },                                // el estado actual, resuelto
    nombre: { get: () => (objetivo && objetivo.nombre) || '' },
  })
  E._tick = tick   // para pruebas

  GP.estados = E
  if (bus.conectar && typeof navigator !== 'undefined' && navigator.requestMIDIAccess) bus.conectar().catch(() => {})
  console.info(`[GP estados] ${VERSION} cargado`)
})()
