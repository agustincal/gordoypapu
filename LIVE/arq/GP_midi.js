// ============================================================
// GP_midi  ·  LIVE/arq/GP_midi.js
// Genérico · Fase 3 · todas las canciones (Gordo y Papu)
// Rol: base MIDI del Akai (botones N11..N88, faders F1..F8) y
//      ÚNICO dueño de los LEDs del Akai
// Reemplaza a GP_xx__midibase.js (v0.9). Misma API + LEDs centralizados.
// No usa hydra-midi.
// Actualizado: 2026-10-30 (v1.11: la fila 4 pasa a ser de pads (como la 1-3); disparo = filas 5-8 ·
//              SMC-Mixer + JP-Mini se traducen al Akai (sin Akai las canciones andan igual))
//              2026-10-25 (v1.10: pads de las filas 1-3 con modo — toggle · piano · 2 a 4 estados (Shift + pad = atrás) ·
//              toggle prendido = verde parpadeo · el Shift oculta al SOLTARLO, y no oculta si lo usaste con un pad)
//              2026-10-23 (v1.9: filas de disparo en negativo — activa = verde y las notas que suenan se apagan ·
//              muteada = apagada y las notas que suenan en verde · a mano = rojo)
//              2026-10-23 (v1.8: Shift (98) = ocultar / mostrar todo, en cualquier canción y sin GP_tools ·
//              GP.midi.ocultarTodo() · modo pulso 'vuelta' también apagado en reposo: cada golpe prende el
//              pad siguiente en amarillo mientras suena)
//              2026-10-23 (v1.7: filas de disparo apagadas en reposo · muteadas siguen mostrando las notas ·
//              mute sólo en filas con canal)
//              2026-10-20 (v1.6: filas de disparo 4-8 · varios aparatos · APC por nombre exacto)
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
//   filas 1-4 → PADS     (GP.midi.buttons)  cada pad: 'toggle' · 'piano' · 2 a 4 estados
//                                            verde = en reposo (0) · verde parpadeo = prendido / estado 1
//                                            amarillo parpadeo = estado 2 · rojo parpadeo = estado 3
//                                            piano: rojo fijo mientras lo apretás
//                                            Shift + pad de estados = estado anterior
//   filas 5-8 → DISPARO  (GP.midi.filas)    así ves qué filas están activas en cada parte:
//                                            activa  = verde · la nota que suena se apaga
//                                            muteada = apagada · la nota que suena en verde
//                                            rojo = lo tocás vos (activa o muteada)
//   botón derecho de cada fila de disparo (8→82, 7→83, 6→84, 5→85) = MUTE del canal (86 sin uso)
//     apagado = no llegó nada (o la fila no tiene canal) · prendido = recibiendo · parpadea = muteado
//   87 / 88 = estado anterior / siguiente (GP_estados)
//   botones 64-71 (arriba de cada fader F1..F8) = VERSIÓN del efecto de ese fader
//     apagado = versión 1 · prendido = versión 2 · parpadea = versión 3
//   89 = grabador (GP_tools)
//   98 (Shift, sin LED) = ocultar / mostrar todo: código, barras del mic y paneles
//
// Sin Akai: SMC-Mixer + JP-Mini (ver "Otras consolas" más abajo y el manual).
// Lo que tocás en ellas entra como si fuera el Akai: las canciones no cambian.
//
// ============================================================

;(function () {
  window.GP = window.GP || {}
  const GP = window.GP
  const VERSION = 'v1.11'

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
    akai: /apc|akai_?ensayo/i,  // el APC mini (o su puerto de ensayo). Ojo: NO /akai/ a secas,
                                //   así un teclado Akai (MPK, etc.) no se confunde con la consola
    ensayo: /ensayo/i,          // puertos virtuales del reproductor (entran, pero no reciben LEDs)
    canal: 0,                   // canal del Akai (0 = canal 1)
    tanda: 32,                  // máx. LEDs por envío
    pausaTanda: 4,              // ms entre tandas
    // otras consolas que se traducen al Akai (ver "Otras consolas")
    consolas: {
      smc: /smc/i,                                   // M-VAVE SMC-Mixer (USB, o su puerto de loopMIDI)
      jp: /jp-?mini/i,                               // JAMJUM JP-Mini, preset 1 (USB o el puerto jpmini)
      ignorar: /midiin2|luces/i,                     // la SMC por USB llega dos veces · puertos de luces
      smcLuces: /^smc-mixer$|^midiout2 \(smc-mixer\)$|smc.*luces/i,   // a dónde van las luces de la SMC
      pasosVersion: 3,                               // clicks de perilla para pasar de versión
      pasoFundido: 4,                                // cuánto mueve cada click de la perilla 8 (de 127)
    },
  }
  // estado de las otras consolas (se llena al conectar)
  const consolas = { smcLuces: [], smcEnviado: {}, perillas: {}, vistas: new Set() }

  // Valores de color del APC mini (mk1) para la grilla 8x8:
  const COLOR = {
    apagado: 0,
    verde: 1, verdeParpadeo: 2,
    rojo: 3, rojoParpadeo: 4,
    amarillo: 5, amarilloParpadeo: 6,
  }
  // pads de las filas 1-3: color por estado (0 = reposo). Toggle = 2 estados.
  const COLOR_ESTADO_PAD = [COLOR.verde, COLOR.verdeParpadeo, COLOR.amarilloParpadeo, COLOR.rojoParpadeo]
  const COLOR_PIANO = { reposo: COLOR.verde, apretado: COLOR.rojo }
  const ESTILO_BOTON = { activo: COLOR_ESTADO_PAD[1], inactivo: COLOR_ESTADO_PAD[0] }

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
  const nombreDeBoton = n => `N${Math.floor(n / 8) + 1}${n % 8 + 1}`
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
    activeButtons: [], activeFaders: [], buttonState: {}, modoBoton: {},   // modo: 'toggle' · 'piano' · 2..4
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
    if (!state.output && !consolas.smcLuces.length) { pendientes.clear(); return }
    let mandados = 0
    for (const n of pendientes) {
      if (mandados >= cfg.tanda) break        // el resto va en la próxima tanda
      pendientes.delete(n)
      const v = valorFinal(n)
      if (state.output && enviado[n] !== v) {
        try {
          state.output.send([0x90 | cfg.canal, n, v])
          enviado[n] = v
          mandados++
        } catch (err) {
          console.warn('[GP MIDI] no se pudo mandar LED', n, err)
        }
      }
      mandados += luzSMC(n, v)
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
    for (const k in consolas.smcEnviado) delete consolas.smcEnviado[k]
    const notas = new Set([...NOTAS_AKAI, ...Object.keys(capaSistema), ...Object.keys(capaBoton), ...Object.keys(capaLuz)].map(Number))
    notas.forEach(marcar)
  }

  const modoDe = n => state.modoBoton[n] || 'toggle'
  const pintarBoton = (n) => {
    const modo = modoDe(n)
    const v = state.buttonState[n]
    if (modo === 'piano') fijar(capaBoton, n, v ? COLOR_PIANO.apretado : COLOR_PIANO.reposo)
    else fijar(capaBoton, n, COLOR_ESTADO_PAD[typeof v === 'number' ? v : (v ? 1 : 0)] ?? COLOR_ESTADO_PAD[0])
  }
  // valor hacia afuera: toggle / piano = true/false · estados = 0..n-1
  const valorBoton = n => {
    const modo = modoDe(n)
    const v = state.buttonState[n]
    if (typeof modo === 'number') return typeof v === 'number' ? v : (v ? 1 : 0)
    return !!v
  }
  const normalizarBoton = (n, v) => {
    const modo = modoDe(n)
    if (typeof modo !== 'number') return !!v
    const x = typeof v === 'number' ? Math.round(v) : (v ? 1 : 0)
    return Math.max(0, Math.min(modo - 1, x))
  }
  // Shift (98) apretado: Shift + pad de estados = anterior. El ocultar todo va al soltar el Shift.
  const shift = { apretado: false, usado: false, dato: null, nombre: null, timer: null }

  const limpiarCapaBoton = () => {
    for (const k of Object.keys(capaBoton)) { delete capaBoton[k]; marcar(Number(k)) }
  }

  // ============================================================
  // Entrada MIDI (sólo lo que viene del Akai: real o puerto de ensayo)
  // ============================================================
  // ============================================================
  // Filas de disparo (5-8) y mute por canal
  // ============================================================
  const FILAS_DISPARO = [5, 6, 7, 8]   // la fila 4 es de pads (GP.midi.buttons), como la 1-3
  const notaDe = (fila, col) => (fila - 1) * 8 + col          // fila 1..8, col 0..7
  const botonMute = fila => 90 - fila                          // 8→82 ... 5→85
  // activa: verde y la nota que suena se apaga · muteada: al revés · a mano: rojo
  const LED_DISPARO = {
    activa: { reposo: COLOR.verde, suena: COLOR.apagado },
    muteada: { reposo: COLOR.apagado, suena: COLOR.verde },
    mano: COLOR.rojo,
  }
  const LED_MUTE = { nada: 0, recibe: 1, muteado: 2 }          // botones redondos: 0 / 1 / 2 parpadeo
  const tiempos = { recienMs: 300, minSuenaMs: 90 }

  // persistente entre reevaluaciones: mute y "ya llegó" por fila
  const filas = {}        // fila → { cfg, mute, visto, pads: [ {mano, korg:Map, hasta, timer} x8 ], vuelta }
  let alDisparo = null

  const nuevaFila = () => ({ cfg: null, mute: false, visto: false,
    pads: Array.from({ length: 8 }, () => ({ mano: false, korg: new Map(), hasta: 0, timer: null })),
    vuelta: { pos: -1, donde: new Map() } })   // modo 'vuelta': pad actual y en qué pad suena cada nota

  const pintarPad = (fila, col) => {
    const f = filas[fila]
    const nota = notaDe(fila, col)
    if (!f || !f.cfg) { fijar(capaBoton, nota, null); return }
    const p = f.pads[col]
    const ahora = performance.now()
    const modo = f.mute ? LED_DISPARO.muteada : LED_DISPARO.activa
    let v = modo.reposo
    if (p.mano) v = LED_DISPARO.mano
    else if (p.korg.size || ahora < p.hasta) v = modo.suena   // hasta: notas muy cortas se ven un mínimo
    fijar(capaBoton, nota, v)
  }
  const pintarFila = (fila) => { for (let c = 0; c < 8; c++) pintarPad(fila, c) }
  const pintarMute = (fila) => {
    const f = filas[fila]
    const n = botonMute(fila)
    if (!f || !f.cfg || f.cfg.canal == null) { fijar(capaBoton, n, null); return }   // sin canal: apagado
    fijar(capaBoton, n, f.mute ? LED_MUTE.muteado : f.visto ? LED_MUTE.recibe : LED_MUTE.nada)
  }

  // "suena" un mínimo de tiempo (notas muy cortas) y después vuelve solo
  const suenaHasta = (fila, col, ms) => {
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
    if (consolaDe(nombre)) return null   // SMC / JP-Mini son consolas, no instrumentos
    for (const fila of FILAS_DISPARO) {
      const f = filas[fila]
      if (!f || !f.cfg || f.cfg.canal == null) continue
      if (f.cfg.canal - 1 !== canal) continue
      // sin puerto: cualquier aparato que no sea el Akai · con puerto: sólo ese aparato
      if (f.cfg.puerto ? f.cfg.puerto.test(nombre) : !cfg.akai.test(nombre)) return fila
    }
    return null
  }

  // nota que entra desde el aparato de un canal (korg u otro)
  const notaDeCanal = (fila, nota, vel, on) => {
    const f = filas[fila]
    if (!f.visto) { f.visto = true; pintarMute(fila) }
    // muteada: la luz sigue mostrando las notas (así sabés que suenan), pero no dispara
    if (f.cfg.pulso === 'vuelta') {
      // cada golpe marca el pad siguiente mientras suena (activa: se apaga · muteada: verde); después del 8, el 1
      const vu = f.vuelta
      const antes = vu.donde.get(nota)
      if (antes != null) {   // esa nota deja su pad anterior (aunque no haya llegado su note-off)
        f.pads[antes].korg.delete(nota)
        vu.donde.delete(nota)
        pintarPad(fila, antes)
      }
      if (!on) return
      vu.pos = (vu.pos + 1) % 8
      const p = f.pads[vu.pos]
      p.korg.set(nota, performance.now())
      vu.donde.set(nota, vu.pos)
      suenaHasta(fila, vu.pos, tiempos.minSuenaMs)
      pintarPad(fila, vu.pos)
      if (!f.mute) emitir({ fila, columna: vu.pos, nota, vel, on, origen: 'canal' })
      return
    }
    const cols = columnasDe(f.cfg, nota)
    for (const col of cols) {
      const p = f.pads[col]
      if (on) { p.korg.set(nota, performance.now()); suenaHasta(fila, col, tiempos.minSuenaMs) }
      else p.korg.delete(nota)
      pintarPad(fila, col)
    }
    if (!f.mute) emitir({ fila, columna: cols.length === 1 ? cols[0] : null, nota, vel, on, origen: 'canal' })
  }

  // pad de disparo tocado a mano en el Akai
  const padDeMano = (fila, col, vel, on) => {
    const f = filas[fila]
    const p = f.pads[col]
    p.mano = on            // al soltar vuelve al color de la fila (o al de "suena" si el canal está sonando ahí)
    pintarPad(fila, col)
    emitir({ fila, columna: col, nota: notaDeColumna(f.cfg, col), vel, on, origen: 'akai' })
  }

  const alternarMute = (fila, valor) => {
    const f = filas[fila]
    if (!f || !f.cfg || f.cfg.canal == null) return   // fila sin canal: no se mutea
    f.mute = valor == null ? !f.mute : !!valor
    pintarMute(fila)
    pintarFila(fila)   // la fila entera cambia: activa = verde · muteada = apagada
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

  // ============================================================
  // Ocultar / mostrar todo (Shift 98 del Akai · GP.midi.ocultarTodo)
  // Oculta el código de Hydra, las barras del mic y lo que se anote con
  // GP.midi.alOcultar (las cajas de GP_tools). Anda con o sin GP_tools.
  // Si el motor de la canción ya maneja el 98 (su toggleCodigo), no lo
  // repite: sólo se pone al día y completa lo que falte.
  // ============================================================
  const PARTES_EDITOR = '.CodeMirror, #editor-container, #toolbar, #menu, #info-container, #modal'
  // estado compartido (mismo código en GP_tools.js): sobrevive a reevaluar y al orden de carga
  const ocu = window._gpOcultar || (window._gpOcultar = { visible: true, bins: false, oyentes: {} })

  const firmaEditor = () => [...document.querySelectorAll(PARTES_EDITOR)]
    .map(el => `${el.style.visibility}/${el.style.display}`).join('|')
  const editorVisible = () => {
    const el = document.querySelector('.CodeMirror, #editor-container')
    return !el || (el.style.visibility !== 'hidden' && el.style.display !== 'none')
  }
  // barras del mic de Hydra (a.show / a.hide): al volver, sólo si estaban a la vista
  const ponerBins = (visible) => {
    try {
      const A = typeof a !== 'undefined' ? a : null   // a = audio de Hydra
      if (!A || !A.canvas || !A.hide) return
      if (!visible) { ocu.bins = A.canvas.style.display !== 'none'; A.hide() }
      else if (ocu.bins) { ocu.bins = false; A.show() }
    } catch (_) {}
  }
  const avisarOcultar = (visible) => {
    for (const id in ocu.oyentes) {
      try { ocu.oyentes[id](visible) } catch (err) { console.error(`[GP MIDI] ocultar · ${id}:`, err) }
    }
  }
  const ocultarTodo = (visible = !ocu.visible) => {
    ocu.visible = !!visible
    document.querySelectorAll(PARTES_EDITOR).forEach(el => { el.style.visibility = ocu.visible ? '' : 'hidden' })
    ponerBins(ocu.visible)
    avisarOcultar(ocu.visible)
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
        const limpio = esVirtual(nombre) ? d2 : limpiarFader(CC_TO_FADER[d1], d2)   // la zona muerta es del Akai
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
        else if (esOn && d1 >= 82 && d1 <= 86) alternarMute(90 - d1)
        // botón de versión arriba de cada fader (64..71)
        else if (esOn && d1 >= 64 && d1 <= 71) { const f = `F${d1 - 63}`; ponerVersion(f, versionDe(f) + 1, 'akai') }
        // pad de las filas 1-3 (o donde el sketch los habilite): toggle · piano · estados
        else if (d1 <= 63 && state.activeButtons.includes(d1)) {
          const modo = modoDe(d1)
          let cambio = false
          if (modo === 'piano') { state.buttonState[d1] = esOn; cambio = true }
          else if (esOn && typeof modo === 'number') {
            const v = valorBoton(d1)
            state.buttonState[d1] = shift.apretado ? (v - 1 + modo) % modo : (v + 1) % modo
            cambio = true
          } else if (esOn) { state.buttonState[d1] = !state.buttonState[d1]; cambio = true }
          if (cambio) {
            pintarBoton(d1)
            const valor = valorBoton(d1)
            for (const fn of state.buttonHandlers[d1] || []) fn({ note: d1, active: !!valor, valor, modo, data })
          }
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

    // Shift (98) del Akai: al apretarlo no pasa nada todavía (puede ser Shift + pad).
    // Al soltarlo, si no lo usaste con ningún pad = ocultar / mostrar todo.
    const esAkai = st < 0xf0 && canal === cfg.canal && cfg.akai.test(nombre)
    if (esAkai && d1 === 98 && (esOn || esOff)) {
      if (esOn) {
        shift.apretado = true; shift.usado = false; shift.dato = data; shift.nombre = nombre
        clearTimeout(shift.timer)
        shift.timer = setTimeout(soltarShift, 4000)   // por si el aviso de soltar no llega
      } else soltarShift()
      return
    }
    if (esAkai && esOn && shift.apretado) shift.usado = true

    entregar(nombre, data, { muteado })
  }

  // el sketch recibe TODO (korg incluido); info.muteado avisa si ese canal está muteado
  const entregar = (nombre, data, info) => {
    if (!alMensaje) return
    try { alMensaje(nombre, data, info) } catch (err) { console.error('[GP MIDI] alMensaje del sketch:', err) }
  }

  function soltarShift() {
    clearTimeout(shift.timer)
    if (!shift.apretado) return
    shift.apretado = false
    if (shift.usado) return   // Shift + pad: el sketch no se entera del Shift
    // el sketch recibe el Shift recién ahora (los motores de Vociferan / James ocultan con él)
    const firmaAntes = firmaEditor()
    entregar(shift.nombre, shift.dato, { muteado: false })
    entregar(shift.nombre, new Uint8Array([0x80 | cfg.canal, 98, 0]), { muteado: false })
    if (firmaEditor() === firmaAntes) ocultarTodo()
    else {
      // lo hizo el motor de la canción: nos ponemos al día y completamos (barras del mic, paneles)
      ocu.visible = editorVisible()
      ponerBins(ocu.visible)
      avisarOcultar(ocu.visible)
    }
  }

  // ============================================================
  // Otras consolas: SMC-Mixer + JP-Mini → Akai
  // Lo que se toca en ellas entra a procesar() como si fuera el Akai
  // (nombre "APC virtual (…)"): pads, mutes, faders, Shift, versiones,
  // fundido. Grabador y estados se llaman directo. Las canciones no se enteran.
  //
  //   SMC-Mixer                         Akai
  //   faders 1-8 (pitch bend)        →  F1-F8
  //   perillas 1-7                   →  versión de F1-F7 (girar = anterior / siguiente)
  //   perilla 8                      →  FMASTER (fundido a negro)
  //   botones fila 1 (24-31, arriba) →  fila 4 (24-31)
  //   botones fila 2 (0-7)           →  fila 3 (16-23)
  //   botones fila 3 (8-15)          →  fila 2 (8-15)
  //   botones fila 4 (16-23, abajo)  →  fila 1 (0-7)
  //   ▶ 94 → grabador (89) · ⏸ 93 → pausar estados · ■ 95 → Shift (98)
  //   ⏮ 91 / ⏭ 92 → estado anterior / siguiente (87 / 88)
  //   ↑ 96 · ↓ 97 · ← 98 · → 99     →  mute filas 8 · 7 · 6 · 5 (82-85)
  //   ⏪ 46 / ⏩ 47                    →  libres (llegan al sketch tal cual)
  //
  //   JP-Mini (preset 1, 4x4, pads de abajo a arriba)
  //   bank 1 (36-51): pads 1-8 → fila 5 · pads 9-16 → fila 6
  //   bank 2 (52-67): pads 1-8 → fila 7 · pads 9-16 → fila 8
  //   bank 3 (68-83) y ▶ ■ ● (CC 22-24) → libres (llegan al sketch tal cual)
  // ============================================================
  const VIRTUAL = 'APC virtual'
  const esVirtual = nombre => typeof nombre === 'string' && nombre.startsWith(VIRTUAL)
  const consolaDe = (nombre) => {
    const c = cfg.consolas
    if (!c || c.ignorar.test(nombre)) return c && (c.smc.test(nombre) || c.jp.test(nombre)) ? 'ignorar' : null
    if (c.smc.test(nombre)) return 'smc'
    if (c.jp.test(nombre)) return 'jp'
    return null
  }
  const akaiVirtual = (de, bytes) => procesar(`${VIRTUAL} (${de})`, bytes)
  const notaAkai = (de, nota, vel, on) => akaiVirtual(de, [(on ? 0x90 : 0x80) | cfg.canal, nota, on ? (vel || 127) : 0])

  // botones de la SMC ↔ notas del Akai (ida y vuelta, para las luces)
  const SMC_A_AKAI = {}
  for (let i = 0; i < 8; i++) {
    SMC_A_AKAI[24 + i] = 24 + i   // fila 1 de la SMC → fila 4
    SMC_A_AKAI[i] = 16 + i        // fila 2 → fila 3
    SMC_A_AKAI[8 + i] = 8 + i     // fila 3 → fila 2
    SMC_A_AKAI[16 + i] = i        // fila 4 → fila 1
  }
  Object.assign(SMC_A_AKAI, { 95: 98, 96: 82, 97: 83, 98: 84, 99: 85 })
  const AKAI_A_SMC = {}
  for (const [smc, akai] of Object.entries(SMC_A_AKAI)) if (akai !== 98) AKAI_A_SMC[akai] = Number(smc)
  AKAI_A_SMC[89] = 94   // grabador → ▶

  const traducirSMC = (nombre, data) => {
    const [st, d1, d2] = data
    const tipo = st & 0xf0
    const ch = st & 0x0f
    const esOn = tipo === 0x90 && d2 > 0
    const esNota = tipo === 0x90 || tipo === 0x80
    // fader: pitch bend del canal 1-8 (14 bits) → CC 48-55 del Akai
    if (tipo === 0xe0 && ch < 8) {
      const v = Math.round((((d2 << 7) | d1) / 16383) * 127)
      akaiVirtual('SMC', [0xb0 | cfg.canal, 48 + ch, v])
      return
    }
    // perillas: CC 16-23, giro relativo (1..63 = derecha · 65..127 = izquierda)
    if (tipo === 0xb0 && d1 >= 16 && d1 <= 23) {
      const i = d1 - 16
      const dir = d2 > 0 && d2 < 64 ? d2 : d2 > 64 ? -(d2 - 64) : 0
      if (!dir) return
      if (i === 7) {   // perilla 8 = FMASTER
        const cc = FADER_CC.FMASTER
        const desde = fundido.movido ? state.faderValues[cc] : 127   // sin tocar, arranca a pleno
        const v = Math.max(0, Math.min(127, Math.round(desde + dir * cfg.consolas.pasoFundido)))
        akaiVirtual('SMC', [0xb0 | cfg.canal, cc, v])
        return
      }
      const f = `F${i + 1}`
      const n = versiones.cuantas[f]
      if (!n) return
      consolas.perillas[i] = (consolas.perillas[i] || 0) + dir
      const pasos = cfg.consolas.pasosVersion
      if (Math.abs(consolas.perillas[i]) < pasos) return
      const paso = Math.sign(consolas.perillas[i])
      consolas.perillas[i] = 0
      const v = Math.max(0, Math.min(n - 1, versionDe(f) + paso))   // sin dar la vuelta
      ponerVersion(f, v, 'akai')
      return
    }
    if (esNota && SMC_A_AKAI[d1] != null) { notaAkai('SMC', SMC_A_AKAI[d1], d2, esOn); return }
    if (esNota) {
      if (!esOn) return
      if (d1 === 94) { if (GP.tools && GP.tools.grabadorCiclo) GP.tools.grabadorCiclo(); return }
      if (d1 === 93) { if (GP.estados && GP.estados.suspender) GP.estados.suspender(); marcar(87); return }
      if (d1 === 91) { if (GP.estados && GP.estados.anterior) GP.estados.anterior('SMC ⏮'); return }
      if (d1 === 92) { if (GP.estados && GP.estados.siguiente) GP.estados.siguiente('SMC ⏭'); return }
    }
    entregar(nombre, data, { muteado: false })   // ⏪ ⏩ y lo demás: al sketch tal cual
  }

  const traducirJP = (nombre, data) => {
    const [st, d1, d2] = data
    const tipo = st & 0xf0
    if ((tipo === 0x90 || tipo === 0x80) && d1 >= 36 && d1 <= 67) {
      const p = d1 - 36
      const bank = p >> 4            // 0 = bank 1 · 1 = bank 2
      const pad = p & 15             // 0..15, de abajo a arriba
      const fila = (bank ? 7 : 5) + (pad >= 8 ? 1 : 0)
      notaAkai('JP-Mini', (fila - 1) * 8 + (pad % 8), d2, tipo === 0x90 && d2 > 0)
      return
    }
    entregar(nombre, data, { muteado: false })   // bank 3 y ▶ ■ ●: al sketch tal cual
  }

  // todo lo que entra por el bus pasa por acá
  const recibir = (nombre, data) => {
    const consola = consolaDe(nombre)
    if (!consola) { procesar(nombre, data); return }
    if (consola === 'ignorar') return
    if (!consolas.vistas.has(nombre)) {
      consolas.vistas.add(nombre)
      console.info(`[GP MIDI] ${nombre} → se traduce al Akai (${consola === 'smc' ? 'SMC-Mixer' : 'JP-Mini'})`)
    }
    if (data[0] >= 0xf0) return
    if (consola === 'smc') traducirSMC(nombre, data)
    else traducirJP(nombre, data)
  }

  // luces de la SMC: un solo color, prender / apagar. Devuelve 1 si mandó algo.
  const luzSMC = (n, v) => {
    if (!consolas.smcLuces.length) return 0
    let nota = AKAI_A_SMC[n]
    let on
    if (n === 87) {   // pausa (93) = estados suspendidos
      nota = 93
      on = !!(GP.estados && GP.estados.suspendido)
    } else if (nota == null) return 0
    else if (n <= 31) on = v >= 2                 // pads: verde fijo = reposo → apagado
    else if (n >= 82 && n <= 85) on = v === 1     // mute: prendido = recibiendo
    else if (n === 89) on = v === 2               // grabador: prendido mientras graba
    else on = !!v
    const val = on ? 127 : 0
    if (consolas.smcEnviado[nota] === val) return 0
    consolas.smcEnviado[nota] = val
    for (const o of consolas.smcLuces) { try { o.send([0x90, nota, val]) } catch (err) { console.warn('[GP MIDI] luz SMC', nota, err) } }
    return 1
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
    // luces de la SMC (sólo prender / apagar)
    const smc = []
    acc.outputs.forEach(o => { if (o.state === 'connected' && cfg.consolas.smcLuces.test(o.name)) smc.push(o) })
    const cambioSmc = smc.map(o => o.name).join('|') !== consolas.smcLuces.map(o => o.name).join('|')
    consolas.smcLuces = smc
    if (cambioSmc && smc.length) console.info('[GP MIDI] luces SMC →', smc.map(o => o.name).join(' + '))
    if (cambio && elegida) console.info('[GP MIDI] LEDs →', elegida.name)
    if ((cambio && elegida) || (cambioSmc && smc.length)) repintar()
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
      Object.defineProperty(window, name, { configurable: true, get: () => valorBoton(buttonToNote(name)) })
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
    bus.escuchar('midi', recibir)   // Akai, Korg, etc. + SMC / JP-Mini traducidas
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
  //   puerto: regex del aparato (ej /korg/i, /keystep/i). Sin puerto = cualquier aparato menos el Akai.
  //   null = fila apagada · {} sin canal = sólo disparo a mano
  // El mute y el "ya llegó" se conservan al reevaluar.
  M.filas = function (config = {}) {
    for (const k of Object.keys(config)) {
      if (!FILAS_DISPARO.includes(Number(k)) && config[k]) console.warn(`[GP MIDI] fila ${k}: las filas de disparo son de la 5 a la 8 (la 1-4 son de pads: GP.midi.buttons)`)
    }
    const canalEstados = GP.estados && GP.estados.config ? GP.estados.config.canal : 16
    for (const fila of FILAS_DISPARO) {
      const c = config[fila]
      const f = filas[fila] || (filas[fila] = nuevaFila())
      const antes = f.cfg
      f.cfg = c ? { puerto: null, ...c } : null
      if (f.cfg && f.cfg.puerto && !(f.cfg.puerto instanceof RegExp)) f.cfg.puerto = new RegExp(String(f.cfg.puerto), 'i')
      if (f.cfg && f.cfg.canal === canalEstados) console.warn(`[GP MIDI] fila ${fila}: el canal ${canalEstados} es el de los estados, no hace falta mostrarlo`)
      const mismoOrigen = antes && f.cfg && antes.canal === f.cfg.canal && String(antes.puerto) === String(f.cfg.puerto)
      if (!mismoOrigen) { f.mute = false; f.visto = false }
      for (const p of f.pads) { p.mano = false; p.korg.clear() }
      f.vuelta = { pos: -1, donde: new Map() }
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

  // GP.midi.buttons(['N11', 'N12'])  → todos toggle (como siempre)
  // GP.midi.buttons({ N11: 'toggle', N12: 'piano', N13: 3 })  → 3 = tres estados (0, 1, 2). Máx. 4.
  M.buttons = function (names = []) {
    limpiarCapaBoton()
    const modos = {}
    const lista = Array.isArray(names) ? names.map(n => [n, 'toggle']) : Object.entries(names || {})
    for (const [nombre, modo] of lista) {
      const n = buttonToNote(String(nombre).trim().toUpperCase())
      let m = modo
      if (typeof m === 'number') m = Math.max(2, Math.min(4, m | 0))
      else if (m !== 'piano') m = 'toggle'
      if (m === 2) m = 'toggle'
      modos[n] = m
    }
    const notas = Object.keys(modos).map(Number)
    const enDisparo = notas.filter(n => n >= 32 && n <= 63 && filas[Math.floor(n / 8) + 1] && filas[Math.floor(n / 8) + 1].cfg)
    if (enDisparo.length) console.warn(`[GP MIDI] ${enDisparo.map(n => `N${Math.floor(n / 8) + 1}${n % 8 + 1}`).join(', ')}: esa fila es de disparo; los pads van en las filas 1-4`)
    // los toggles que siguen activos conservan su estado al reevaluar (como los mutes)
    const antes = state.buttonState || {}
    const modosAntes = state.modoBoton || {}
    state.activeButtons = notas
    state.modoBoton = modos
    state.buttonState = {}
    state.buttonHandlers = {}
    for (const n of notas) {
      // piano arranca suelto; si cambió el modo, arranca en 0
      const conserva = modos[n] !== 'piano' && modosAntes[n] === modos[n]
      state.buttonState[n] = normalizarBoton(n, conserva ? antes[n] : 0)
      state.buttonHandlers[n] = []
      pintarBoton(n)
    }
    pintarVersiones()
    for (const fila of FILAS_DISPARO) { pintarFila(fila); pintarMute(fila) }   // no borrar las filas de disparo
    return M
  }

  // toggle / piano → true/false · estados → 0..n-1
  M.button = name => valorBoton(buttonToNote(name))
  // modo de cada pad habilitado: { N11: 'toggle', N13: 3, ... }
  M.modos = () => Object.fromEntries(state.activeButtons.map(n => [nombreDeBoton(n), modoDe(n)]))

  // fijar un pad desde código (ej: al cambiar de estado). Toggle: true/false · estados: número
  M.setButton = (name, activo) => {
    const n = buttonToNote(name)
    state.buttonState[n] = normalizarBoton(n, activo)
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

  // ocultar / mostrar todo (lo mismo que el Shift 98): código, barras del mic y paneles.
  //   GP.midi.ocultarTodo() alterna · (true) oculta · (false) muestra
  M.ocultarTodo = (oculto = ocu.visible) => { ocultarTodo(!oculto); return M }
  M.oculto = () => !ocu.visible
  // otro módulo que tenga cosas en pantalla: GP.midi.alOcultar('id', visible => {...}). Mismo id = reemplaza.
  M.alOcultar = (id, fn) => { if (fn) ocu.oyentes[id] = fn; else delete ocu.oyentes[id]; return M }

  M.show = function (value = true) {
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(!!value)
    return M
  }

  M.reset = function () {
    M.filas({})
    limpiarCapaBoton()
    M.apagarLuces()
    state.activeButtons = []; state.activeFaders = []
    state.buttonState = {}; state.modoBoton = {}; state.buttonHandlers = {}; state.faderHandlers = {}
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
