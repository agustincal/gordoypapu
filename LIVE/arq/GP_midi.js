// ============================================================
// GP_midi  ·  LIVE/arq/GP_midi.js
// Genérico · Fase 3 · todas las canciones (Gordo y Papu)
// Rol: base MIDI del Akai (botones N11..N88, faders F1..F8) y
//      ÚNICO dueño de los LEDs del Akai
// Reemplaza a GP_xx__midibase.js (v0.9). Misma API + LEDs centralizados.
// No usa hydra-midi.
// Actualizado: 2026-10-16
// ============================================================
//
// Cómo funcionan los LEDs
// -----------------------
// Todo lo que quiera prender un LED del Akai pasa por acá. Nadie más le
// manda notas al Akai. Hay tres capas por nota; gana la de más arriba:
//   1. sistema → pad del grabador, avisos  (GP.midi.ledSistema)
//   2. botones → botones activos y faders activos (lo arma GP.midi.buttons/faders)
//   3. luces   → efectos libres: korg→akai, secuencias, etc. (GP.midi.luz)
// Sólo se manda una nota cuando su valor cambia, y en tandas chicas,
// para no saturar la controladora.
//
// ============================================================

;(function () {
  window.GP = window.GP || {}
  const GP = window.GP
  const VERSION = 'v1.0'

  if (GP.midi && GP.midi._version === VERSION) return

  // si quedó cargada la base vieja (v0.9), frenamos su loop de LEDs de 50 ms
  if (GP.midi && GP.midi.state && GP.midi.state.ledInterval) {
    clearInterval(GP.midi.state.ledInterval)
    GP.midi.state.ledInterval = null
  }

  // ============================================================
  // Bus MIDI compartido (mismo código en GP_tools.js)
  // Una sola conexión por página. Cada módulo se anota con un id;
  // al reevaluar, el mismo id reemplaza al anterior → nunca se duplica.
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
                  try { bus.oyentes[id](entrada.name, msg.data) } catch (err) { console.error(`[GP bus] ${id}:`, err) }
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

  // ============================================================
  // Configuración
  // ============================================================
  const cfg = {
    akai: /apc|akai/i,          // nombre de la entrada/salida del Akai
    ensayo: /ensayo/i,          // puertos virtuales del reproductor (entran, pero no reciben LEDs)
    canal: 0,                   // canal del Akai (0 = canal 1)
    tanda: 32,                  // máx. LEDs por envío
    pausaTanda: 4,              // ms entre tandas
  }

  // Valores de color del APC mini (mk1) para la grilla 8x8:
  const COLOR = {
    apagado: 0,
    verde: 1, verdeParpadeo: 2,
    rojo: 3, rojoParpadeo: 4,
    amarillo: 5, amarilloParpadeo: 6,
  }
  // Valores que usaba la base v0.9 para los botones (no cambian, así se ve igual)
  const ESTILO_BOTON = { activo: 4, inactivo: 1 }
  const ESTILO_FADER = 1

  // ============================================================
  // Mapas del Akai (igual que v0.9)
  // ============================================================
  const STORAGE_KEY = 'GP_AkaiMini_Faders_v0.9'   // misma clave: conserva los faders guardados
  const FADER_CC = { F1: 48, F2: 49, F3: 50, F4: 51, F5: 52, F6: 53, F7: 54, F8: 55, FMASTER: 56 }
  const FADER_LED = { F1: 64, F2: 65, F3: 66, F4: 67, F5: 68, F6: 69, F7: 70, F8: 71 }
  const FADER_DEADZONE = { F7: 60 }   // 0..60 de 127 es errático en esta controladora
  const CC_TO_FADER = Object.fromEntries(Object.entries(FADER_CC).map(([n, cc]) => [cc, n]))
  // notas que se limpian al conectar: grilla, botones de abajo, de la derecha y shift
  const NOTAS_AKAI = [...Array(72).keys(), 82, 83, 84, 85, 86, 87, 88, 89, 98]

  function buttonToNote(name) {
    const m = /^N([1-8])([1-8])$/i.exec(String(name).trim())
    if (!m) throw new Error(`GP MIDI: botón inválido "${name}". Usá N11..N88.`)
    return (Number(m[1]) - 1) * 8 + (Number(m[2]) - 1)
  }
  // acepta número de nota o nombre N11..N88
  const aNota = (x) => typeof x === 'number' ? x : buttonToNote(x)

  function faderToCC(name) {
    const cc = FADER_CC[String(name).trim().toUpperCase()]
    if (cc == null) throw new Error(`GP MIDI: fader inválido "${name}". Usá F1..F8 o FMASTER.`)
    return cc
  }

  function limpiarFader(nombre, valor) {
    const piso = FADER_DEADZONE[nombre] || 0
    if (piso <= 0) return valor
    if (valor < piso) return 0
    return ((valor - piso) / (127 - piso)) * 127
  }

  // ============================================================
  // Estado
  // ============================================================
  const state = {
    status: 'idle', output: null, outputName: null,
    activeButtons: [], activeFaders: [], buttonState: {},
    faderValues: Object.fromEntries(Object.values(FADER_CC).map(cc => [cc, 0])),
    buttonHandlers: {}, faderHandlers: {},
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const cc of Object.values(FADER_CC)) if (typeof saved[cc] === 'number') state.faderValues[cc] = saved[cc]
  } catch (_) {}

  function saveFader(cc, value) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      saved[cc] = value
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch (_) {}
  }

  // ============================================================
  // Motor de LEDs (capas + envío sólo de cambios, en tandas)
  // ============================================================
  const capaSistema = {}
  const capaBoton = {}
  const capaLuz = {}
  const enviado = {}
  const pendientes = new Set()
  let envioProgramado = false

  const valorFinal = n =>
    n in capaSistema ? capaSistema[n]
      : n in capaBoton ? capaBoton[n]
      : (capaLuz[n] || 0)

  const enviar = () => {
    envioProgramado = false
    if (!state.output) { pendientes.clear(); return }
    let mandados = 0
    for (const n of pendientes) {
      if (mandados >= cfg.tanda) break        // el resto va en la próxima tanda
      pendientes.delete(n)
      const v = valorFinal(n)
      if (enviado[n] === v) continue
      try {
        state.output.send([0x90 | cfg.canal, n, v])
        enviado[n] = v
        mandados++
      } catch (err) {
        console.warn('[GP MIDI] no se pudo mandar LED', n, err)
      }
    }
    if (pendientes.size) programar(cfg.pausaTanda)
  }
  const programar = (ms = 0) => {
    if (envioProgramado) return
    envioProgramado = true
    setTimeout(enviar, ms)
  }
  const marcar = (n) => { pendientes.add(n); programar() }

  const fijar = (capa, nota, valor) => {
    const n = aNota(nota)
    if (valor == null) delete capa[n]
    else capa[n] = valor
    marcar(n)
  }

  // repinta todo desde cero (al conectar el Akai, o a mano si algo quedó raro)
  const repintar = () => {
    for (const k in enviado) delete enviado[k]
    const notas = new Set([...NOTAS_AKAI, ...Object.keys(capaSistema), ...Object.keys(capaBoton), ...Object.keys(capaLuz)].map(Number))
    notas.forEach(marcar)
  }

  const pintarBoton = (n) => fijar(capaBoton, n, state.buttonState[n] ? ESTILO_BOTON.activo : ESTILO_BOTON.inactivo)

  const limpiarCapaBoton = () => {
    for (const k of Object.keys(capaBoton)) { delete capaBoton[k]; marcar(Number(k)) }
  }

  // ============================================================
  // Entrada MIDI (sólo lo que viene del Akai: real o puerto de ensayo)
  // ============================================================
  let alMensaje = null

  const procesar = (nombre, data) => {
    if (cfg.akai.test(nombre)) {
      const [st, d1, d2] = data
      const tipo = st & 0xf0
      const canal = st & 0x0f
      if (canal === cfg.canal) {
        // fader
        if (tipo === 0xb0 && d1 >= 48 && d1 <= 56) {
          const limpio = limpiarFader(CC_TO_FADER[d1], d2)
          state.faderValues[d1] = limpio
          saveFader(d1, limpio)
          for (const fn of state.faderHandlers[d1] || []) fn(limpio)
        }
        // botón de la grilla (toggle)
        if (tipo === 0x90 && d2 > 0 && d1 <= 63 && state.activeButtons.includes(d1)) {
          state.buttonState[d1] = !state.buttonState[d1]
          pintarBoton(d1)
          for (const fn of state.buttonHandlers[d1] || []) fn({ note: d1, active: state.buttonState[d1], data })
        }
      }
    }
    if (alMensaje) alMensaje(nombre, data)   // el sketch recibe TODO (korg incluido)
  }

  const alCambiarPuertos = (acc) => {
    let elegida = null
    acc.outputs.forEach(o => {
      if (o.state !== 'connected') return
      if (state.outputNameExacto ? o.name === state.outputNameExacto
        : (cfg.akai.test(o.name) && !cfg.ensayo.test(o.name))) elegida = o
    })
    const cambio = elegida !== state.output
    state.output = elegida
    state.outputName = elegida ? elegida.name : null
    if (cambio && elegida) {
      console.info('[GP MIDI] LEDs →', elegida.name)
      repintar()
    }
  }

  // ============================================================
  // Globals F1..F8 / N11..N88 (igual que v0.9)
  // ============================================================
  function installDirectGlobals() {
    for (const name of Object.keys(FADER_CC)) {
      Object.defineProperty(window, name, { configurable: true, get: () => state.faderValues[FADER_CC[name]] ?? 0 })
    }
    for (let r = 1; r <= 8; r++) for (let c = 1; c <= 8; c++) {
      const name = `N${r}${c}`
      Object.defineProperty(window, name, { configurable: true, get: () => !!state.buttonState[buttonToNote(name)] })
    }
  }
  installDirectGlobals()

  // ============================================================
  // API pública (misma que v0.9 + LEDs)
  // ============================================================
  const M = {}
  M._version = VERSION
  M.version = `LIVE-${VERSION}`
  M.config = cfg
  M.COLOR = COLOR
  M.estilo = { boton: ESTILO_BOTON }
  M.state = state

  M.start = async function ({ outputName } = {}) {
    state.outputNameExacto = outputName || null
    bus.escuchar('midi', procesar)
    bus.puertos('midi', alCambiarPuertos)
    try {
      const acc = await bus.conectar()
      alCambiarPuertos(acc)
      state.status = 'ready'
      if (!state.output) console.info('[GP MIDI] sin Akai conectado: LEDs desactivados, valores por defecto')
    } catch (err) {
      state.status = 'idle'
      console.info('[GP MIDI] MIDI no disponible: usando valores por defecto', err)
    }
    return M
  }

  // función propia del sketch para TODO lo que entra (korg, akai, ensayo).
  // Llamala en cada evaluación: reemplaza a la anterior, no se acumula.
  M.alMensaje = (fn) => { alMensaje = fn; return M }

  M.buttons = function (names = []) {
    limpiarCapaBoton()
    const notas = [...new Set(names.map(n => String(n).trim().toUpperCase()))].map(buttonToNote)
    state.activeButtons = notas
    state.buttonState = {}
    state.buttonHandlers = {}
    for (const n of notas) { state.buttonState[n] = false; state.buttonHandlers[n] = []; pintarBoton(n) }
    for (const name of state.activeFaders) if (FADER_LED[name] !== undefined) fijar(capaBoton, FADER_LED[name], ESTILO_FADER)
    return M
  }

  M.button = name => !!state.buttonState[buttonToNote(name)]

  // prender/apagar un botón activo desde código (ej: al cambiar de estado)
  M.setButton = (name, activo) => {
    const n = buttonToNote(name)
    state.buttonState[n] = !!activo
    if (state.activeButtons.includes(n)) pintarBoton(n)
    return M
  }

  M.on = function (name, callback) {
    const n = buttonToNote(name)
    if (!state.activeButtons.includes(n)) throw new Error(`GP MIDI: botón ${name} no está activo`)
    state.buttonHandlers[n].push(callback)
    return M
  }

  M.faders = function (names = []) {
    for (const name of state.activeFaders) if (FADER_LED[name] !== undefined) fijar(capaBoton, FADER_LED[name], null)
    const normalized = [...new Set(names.map(n => String(n).trim().toUpperCase()))]
    state.activeFaders = normalized
    for (const name of normalized) {
      state.faderHandlers[faderToCC(name)] = []
      if (FADER_LED[name] !== undefined) fijar(capaBoton, FADER_LED[name], ESTILO_FADER)
    }
    return M
  }

  M.fader = name => state.faderValues[faderToCC(name)] ?? 0

  M.onFader = function (name, callback) {
    const cc = faderToCC(name)
    state.faderHandlers[cc] = state.faderHandlers[cc] || []
    state.faderHandlers[cc].push(callback)
    return M
  }

  // ---- LEDs ----
  // capa luces (efectos). nota: número o 'N11'. valor: M.COLOR.x, 0 o null = apagar
  M.luz = (nota, valor) => { fijar(capaLuz, nota, valor ? valor : null); return M }
  M.apagarLuces = () => { for (const k of Object.keys(capaLuz)) { delete capaLuz[k]; marcar(Number(k)) } return M }
  // capa sistema (grabador, avisos). null = soltar la nota
  M.ledSistema = (nota, valor) => { fijar(capaSistema, nota, valor); return M }
  M.repintar = () => { repintar(); return M }

  M.show = function (value = true) {
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(!!value)
    return M
  }

  M.reset = function () {
    limpiarCapaBoton()
    M.apagarLuces()
    state.activeButtons = []; state.activeFaders = []
    state.buttonState = {}; state.buttonHandlers = {}; state.faderHandlers = {}
    return M
  }

  M.devices = function () {
    if (!bus.acc) return { inputs: [], outputs: [] }
    return {
      inputs: [...bus.acc.inputs.values()].map(d => d.name),
      outputs: [...bus.acc.outputs.values()].map(d => d.name),
    }
  }

  M.isReady = () => state.status === 'ready'

  GP.midi = M
  console.info(`[GP MIDI] ${M.version} cargada`)
})()
