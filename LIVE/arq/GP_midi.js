// ============================================================
// GP_midi  ·  LIVE/arq/GP_midi.js
// Genérico · Fase 3 · todas las canciones (Gordo y Papu)
// Rol: base MIDI del Akai (botones N11..N88, faders F1..F8) y
//      ÚNICO dueño de los LEDs del Akai
// Reemplaza a GP_xx__midibase.js (v0.9). Misma API + LEDs centralizados.
// No usa hydra-midi.
// Actualizado: 2026-10-16 (v1.5: FMASTER fundido · fila 'vuelta' · filaDelCanal para el panel)
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
// Zonas de la grilla (igual en todos los sketches)
// ------------------------------------------------
//   filas 1-4 → TOGGLE   (GP.midi.buttons)  verde = habilitado · rojo parpadeo = prendido
//   filas 5-8 → DISPARO  (GP.midi.filas)    verde = en reposo · amarillo = suena el canal
//                                            rojo parpadeo = lo tocás · amarillo al soltar
//   botón derecho de cada fila de disparo (8→82, 7→83, 6→84, 5→85) = MUTE del canal
//     apagado = no llegó nada · prendido = recibiendo · parpadea = muteado
//   botones 64-71 (arriba de cada fader F1..F8) = VERSIÓN del efecto de ese fader
//     apagado = versión 1 · prendido = versión 2 · parpadea = versión 3
//   89 = grabador (GP_tools)
//
// ============================================================

;(function () {
  window.GP = window.GP || {}
  const GP = window.GP
  const VERSION = 'v1.5'

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

  // ============================================================
  // Mapas del Akai (igual que v0.9)
  // ============================================================
  const STORAGE_KEY = 'GP_AkaiMini_Faders_v0.9'   // misma clave: conserva los faders guardados
  const FADER_CC = { F1: 48, F2: 49, F3: 50, F4: 51, F5: 52, F6: 53, F7: 54, F8: 55, FMASTER: 56 }
  const BOTON_VERSION = { F1: 64, F2: 65, F3: 66, F4: 67, F5: 68, F6: 69, F7: 70, F8: 71 }
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
  // ============================================================
  // Filas de disparo (5-8) y mute por canal
  // ============================================================
  const FILAS_DISPARO = [5, 6, 7, 8]
  const notaDe = (fila, col) => (fila - 1) * 8 + col          // fila 1..8, col 0..7
  const botonMute = fila => 90 - fila                          // 8→82 ... 5→85
  const LED_DISPARO = { reposo: COLOR.verde, suena: COLOR.amarillo, mano: COLOR.rojoParpadeo, recien: COLOR.amarillo }
  const LED_MUTE = { nada: 0, recibe: 1, muteado: 2 }          // botones redondos: 0 / 1 / 2 parpadeo
  const tiempos = { recienMs: 300, minSuenaMs: 90 }

  // persistente entre reevaluaciones: mute y "ya llegó" por fila
  const filas = {}        // fila → { cfg, mute, visto, pads: [ {mano, korg:Set, hasta, timer} x8 ] }
  let alDisparo = null

  const nuevaFila = () => ({ cfg: null, mute: false, visto: false,
    pads: Array.from({ length: 8 }, () => ({ mano: false, korg: new Map(), hasta: 0, timer: null, color: null })),
    vuelta: { pos: -1, n: 0 } })

  const pintarPad = (fila, col) => {
    const f = filas[fila]
    const nota = notaDe(fila, col)
    if (!f || !f.cfg) { fijar(capaBoton, nota, null); return }
    const p = f.pads[col]
    const ahora = performance.now()
    let v = p.color != null ? p.color : LED_DISPARO.reposo   // en modo 'vuelta' cada pad tiene su color
    if (p.mano) v = LED_DISPARO.mano
    else if (p.korg.size) v = LED_DISPARO.suena
    else if (ahora < p.hasta) v = LED_DISPARO.recien
    fijar(capaBoton, nota, v)
  }
  const pintarFila = (fila) => { for (let c = 0; c < 8; c++) pintarPad(fila, c) }
  const pintarMute = (fila) => {
    const f = filas[fila]
    const n = botonMute(fila)
    if (!f || !f.cfg) { fijar(capaBoton, n, null); return }
    fijar(capaBoton, n, f.mute ? LED_MUTE.muteado : f.visto ? LED_MUTE.recibe : LED_MUTE.nada)
  }

  // amarillo "recién tocado / recién sonó": vuelve a verde solo
  const amarilloHasta = (fila, col, ms) => {
    const p = filas[fila].pads[col]
    p.hasta = Math.max(p.hasta, performance.now() + ms)
    clearTimeout(p.timer)
    p.timer = setTimeout(() => pintarPad(fila, col), p.hasta - performance.now() + 5)
  }

  // nota del canal → columna(s)
  const columnasDe = (c, nota) => {
    if (c.pulso) return [0, 1, 2, 3, 4, 5, 6, 7]
    if (c.notas) {
      const i = c.notas.indexOf(nota)
      if (i >= 0) return [i % 8]
    }
    if (c.rango) {
      const [min, max] = c.rango
      const col = Math.floor((nota - min) * 8 / (max - min + 1))
      return [Math.max(0, Math.min(7, col))]
    }
    return [nota % 8]
  }
  // columna → nota representativa (para los disparos a mano)
  const notaDeColumna = (c, col) => {
    if (c.notas && c.notas[col] != null) return c.notas[col]
    if (c.notas && c.notas.length) return c.notas[0]
    if (c.rango) { const [min, max] = c.rango; return Math.round(min + (col + 0.5) * (max - min + 1) / 8 - 0.5) }
    return null
  }

  const emitir = (ev) => { if (alDisparo) try { alDisparo(ev) } catch (err) { console.error('[GP MIDI] alDisparo:', err) } }

  // ¿este mensaje es de un canal asignado a una fila? → devuelve la fila
  const filaDelCanal = (nombre, canal) => {
    for (const fila of FILAS_DISPARO) {
      const f = filas[fila]
      if (!f || !f.cfg || f.cfg.canal == null) continue
      if (f.cfg.canal - 1 === canal && f.cfg.puerto.test(nombre)) return fila
    }
    return null
  }

  // nota que entra desde el aparato de un canal (korg u otro)
  const notaDeCanal = (fila, nota, vel, on) => {
    const f = filas[fila]
    if (!f.visto) { f.visto = true; pintarMute(fila) }
    if (f.mute) return                                  // muteado: ni luz ni disparo
    if (f.cfg.pulso === 'vuelta') {
      // cada nota avanza un pad; una vuelta pinta de rojo, la siguiente de verde
      if (!on) return
      const vu = f.vuelta
      vu.pos = (vu.pos + 1) % 8
      if (vu.pos === 0) vu.n++
      f.pads[vu.pos].color = vu.n % 2 ? COLOR.rojo : COLOR.verde
      pintarPad(fila, vu.pos)
      emitir({ fila, columna: vu.pos, nota, vel, on, origen: 'canal' })
      return
    }
    const cols = columnasDe(f.cfg, nota)
    for (const col of cols) {
      const p = f.pads[col]
      if (on) { p.korg.set(nota, performance.now()); amarilloHasta(fila, col, tiempos.minSuenaMs) }
      else p.korg.delete(nota)
      pintarPad(fila, col)
    }
    emitir({ fila, columna: cols.length === 1 ? cols[0] : null, nota, vel, on, origen: 'canal' })
  }

  // pad de disparo tocado a mano en el Akai
  const padDeMano = (fila, col, vel, on) => {
    const f = filas[fila]
    const p = f.pads[col]
    p.mano = on
    if (!on) amarilloHasta(fila, col, tiempos.recienMs)
    pintarPad(fila, col)
    emitir({ fila, columna: col, nota: notaDeColumna(f.cfg, col), vel, on, origen: 'akai' })
  }

  const alternarMute = (fila, valor) => {
    const f = filas[fila]
    if (!f || !f.cfg) return
    f.mute = valor == null ? !f.mute : !!valor
    if (f.mute) for (let c = 0; c < 8; c++) { f.pads[c].korg.clear(); pintarPad(fila, c) }   // suelta lo que estaba sonando
    pintarMute(fila)
    console.info(`[GP MIDI] fila ${fila} (canal ${f.cfg.canal}) ${f.mute ? 'MUTEADA' : 'activa'}`)
  }

  // ============================================================
  // Versiones por fader (botones 64-71)
  // ============================================================
  const VERS_KEY = 'GP_LIVE_Versiones'
  const LED_VERSION = [0, 1, 2]                       // apagado / prendido / parpadeo
  const versiones = { cuantas: {}, actual: {} }       // F1 → 3 · F1 → 0..2
  let alVersion = null
  try { Object.assign(versiones.actual, JSON.parse(localStorage.getItem(VERS_KEY) || '{}')) } catch (_) {}
  const guardarVersiones = () => { try { localStorage.setItem(VERS_KEY, JSON.stringify(versiones.actual)) } catch (_) {} }
  const versionDe = f => {
    const n = versiones.cuantas[f]
    if (!n) return 0
    return Math.min(versiones.actual[f] || 0, n - 1)
  }
  const pintarVersiones = () => {
    for (const [f, nota] of Object.entries(BOTON_VERSION)) {
      fijar(capaBoton, nota, versiones.cuantas[f] ? LED_VERSION[versionDe(f)] : null)
    }
  }
  const ponerVersion = (f, v, origen) => {
    const n = versiones.cuantas[f]
    if (!n) return
    const nueva = ((v % n) + n) % n
    if (nueva === versionDe(f)) { pintarVersiones(); return }
    versiones.actual[f] = nueva
    guardarVersiones()
    pintarVersiones()
    if (alVersion) try { alVersion(f, nueva, origen) } catch (err) { console.error('[GP MIDI] alVersion:', err) }
  }

  // ============================================================
  // FMASTER = fundido a negro (en todos los sketches, sin tocar Hydra)
  // ============================================================
  // Una capa negra encima del canvas de Hydra; su opacidad sigue al FMASTER.
  // Arriba = imagen completa · abajo = negro. No toca la cadena de Hydra ni los
  // feedbacks, y no cuesta nada de GPU.
  // Seguridad: hasta que no movés el FMASTER en esta sesión, la imagen se ve completa
  // (así un valor viejo guardado en 0 no te deja la pantalla en negro al arrancar).
  const fundido = { activo: true, movido: false, curva: 2, el: null }
  const capaNegra = () => {
    if (fundido.el && document.body.contains(fundido.el)) return fundido.el
    let el = document.getElementById('gpFundido')
    if (!el) {
      el = document.createElement('div')
      el.id = 'gpFundido'
      el.style.cssText = 'position:fixed; inset:0; background:#000; opacity:0; pointer-events:none;'
    }
    // se pone justo después del canvas de Hydra: tapa la imagen pero NO el editor de código
    // ni los paneles (que van por encima)
    const canvas = [...document.querySelectorAll('canvas')].sort((x, y) => y.width * y.height - x.width * x.height)[0]
    if (canvas && canvas.parentNode) {
      const z = getComputedStyle(canvas).zIndex
      el.style.zIndex = z === 'auto' ? 'auto' : z
      canvas.parentNode.insertBefore(el, canvas.nextSibling)
    } else {
      document.body.appendChild(el)
    }
    fundido.el = el
    return el
  }
  const aplicarFundido = () => {
    if (typeof document === 'undefined') return
    const el = capaNegra()
    if (!fundido.activo || !fundido.movido) { el.style.opacity = 0; return }
    const v = state.faderValues[FADER_CC.FMASTER] / 127                // 0..1
    const brillo = v >= 0.98 ? 1 : v <= 0.02 ? 0 : Math.pow(v, fundido.curva)
    el.style.opacity = (1 - brillo).toFixed(3)
  }

  let alMensaje = null

  const procesar = (nombre, data) => {
    const [st, d1, d2] = data
    const tipo = st & 0xf0
    const canal = st & 0x0f
    const esOn = tipo === 0x90 && d2 > 0
    const esOff = tipo === 0x80 || (tipo === 0x90 && d2 === 0)
    let muteado = false

    if (st < 0xf0 && cfg.akai.test(nombre) && canal === cfg.canal) {
      // fader
      if (tipo === 0xb0 && d1 >= 48 && d1 <= 56) {
        const limpio = limpiarFader(CC_TO_FADER[d1], d2)
        state.faderValues[d1] = limpio
        saveFader(d1, limpio)
        if (d1 === FADER_CC.FMASTER) { fundido.movido = true; aplicarFundido() }
        for (const fn of state.faderHandlers[d1] || []) fn(limpio)
      }
      if (esOn || esOff) {
        const fila = Math.floor(d1 / 8) + 1
        // pad de una fila de disparo configurada
        if (d1 <= 63 && filas[fila] && filas[fila].cfg) padDeMano(fila, d1 % 8, d2, esOn)
        // botón de mute (82..85)
        else if (esOn && d1 >= 82 && d1 <= 85) alternarMute(90 - d1)
        // botón de versión arriba de cada fader (64..71)
        else if (esOn && d1 >= 64 && d1 <= 71) { const f = `F${d1 - 63}`; ponerVersion(f, versionDe(f) + 1, 'akai') }
        // botón de la grilla (toggle, filas 1-4 o donde el sketch los habilite)
        else if (esOn && d1 <= 63 && state.activeButtons.includes(d1)) {
          state.buttonState[d1] = !state.buttonState[d1]
          pintarBoton(d1)
          for (const fn of state.buttonHandlers[d1] || []) fn({ note: d1, active: state.buttonState[d1], data })
        }
      }
    } else if (st < 0xf0 && (esOn || esOff)) {
      // nota de otro aparato: ¿pertenece a un canal asignado a una fila?
      const fila = filaDelCanal(nombre, canal)
      if (fila) {
        muteado = filas[fila].mute
        notaDeCanal(fila, d1, d2, esOn)
      }
    } else if (st < 0xf0) {
      const fila = filaDelCanal(nombre, canal)
      if (fila) muteado = filas[fila].mute
    }

    // el sketch recibe TODO (korg incluido); info.muteado avisa si ese canal está muteado
    if (alMensaje) alMensaje(nombre, data, { muteado })
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
    for (let i = 1; i <= 8; i++) {
      Object.defineProperty(window, `V${i}`, { configurable: true, get: () => versionDe(`F${i}`) })
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
    state.faderHandlers = {}   // cada evaluación registra sus onFader de nuevo: no se acumulan
    aplicarFundido()
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

  // filas de disparo 5-8. Cada fila: { puerto, canal (1-16), notas | rango | pulso }
  //   null = fila apagada · {} sin canal = sólo disparo a mano
  // El mute y el "ya llegó" se conservan al reevaluar.
  M.filas = function (config = {}) {
    for (const fila of FILAS_DISPARO) {
      const c = config[fila]
      const f = filas[fila] || (filas[fila] = nuevaFila())
      const antes = f.cfg
      f.cfg = c ? { puerto: /korg|padkontrol/i, ...c } : null
      if (!antes || !f.cfg || antes.canal !== f.cfg.canal) { f.mute = false; f.visto = false }
      for (const p of f.pads) { p.mano = false; p.korg.clear(); p.color = null }
      f.vuelta = { pos: -1, n: 0 }
      pintarFila(fila)
      pintarMute(fila)
    }
    return M
  }
  // fn({ fila, columna, nota, vel, on, origen: 'canal' | 'akai' })
  M.alDisparo = (fn) => { alDisparo = fn; return M }
  M.mute = (fila, valor) => { alternarMute(fila, valor); return M }
  M.muteado = fila => !!(filas[fila] && filas[fila].mute)
  M.filaDelCanal = (nombre, canal0) => filaDelCanal(nombre, canal0)   // canal 0..15 → fila o null
  M.tiempos = tiempos

  M.buttons = function (names = []) {
    limpiarCapaBoton()
    const notas = [...new Set(names.map(n => String(n).trim().toUpperCase()))].map(buttonToNote)
    state.activeButtons = notas
    state.buttonState = {}
    state.buttonHandlers = {}
    for (const n of notas) { state.buttonState[n] = false; state.buttonHandlers[n] = []; pintarBoton(n) }
    pintarVersiones()
    for (const fila of FILAS_DISPARO) { pintarFila(fila); pintarMute(fila) }   // no borrar las filas de disparo
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

  // compatibilidad: ya no publica faders ni prende LEDs. Los faders se usan o no.
  // (sólo limpia los onFader de esos faders para que no se acumulen al reevaluar)
  M.faders = function (names = []) {
    for (const name of names) state.faderHandlers[faderToCC(name)] = []
    return M
  }

  // versiones: cuántas tiene cada fader (máx. 3). Los que no se nombran quedan sin uso y apagados.
  // La versión elegida se guarda y se recupera al recargar (el LED la muestra al conectar).
  M.versiones = function (config = {}) {
    versiones.cuantas = {}
    for (const [k, n] of Object.entries(config)) {
      const f = String(k).trim().toUpperCase()
      faderToCC(f)   // valida el nombre
      versiones.cuantas[f] = Math.max(1, Math.min(3, n | 0))
    }
    pintarVersiones()
    return M
  }
  M.versionDe = f => versionDe(String(f).toUpperCase())                   // 0, 1 o 2
  // fijar desde código (ej: al entrar a un estado). objeto { F1: 0, F3: 2 } o (fader, v)
  M.fijarVersion = (f, v) => {
    if (typeof f === 'object') { for (const [k, x] of Object.entries(f)) ponerVersion(k.toUpperCase(), x, 'codigo') }
    else ponerVersion(String(f).toUpperCase(), v, 'codigo')
    return M
  }
  // fn(fader, version, origen: 'akai' | 'codigo')
  M.alVersion = (fn) => { alVersion = fn; return M }

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
    M.filas({})
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

  // FMASTER fundido a negro. GP.midi.fundido(false) lo apaga para un sketch que use FMASTER para otra cosa.
  M.fundido = (activo = true) => { fundido.activo = !!activo; aplicarFundido(); return M }
  M.fundidoCurva = (c = 2) => { fundido.curva = c; aplicarFundido(); return M }   // 1 = lineal · 2 = más suave cerca del negro

  M.isReady = () => state.status === 'ready'

  GP.midi = M
  console.info(`[GP MIDI] ${M.version} cargada`)
})()
