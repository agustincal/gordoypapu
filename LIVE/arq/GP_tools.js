// ============================================================
// GP_tools  ·  LIVE/arq/GP_tools.js
// Genérico · sirve para todas las canciones (Gordo y Papu)
// Rol: panel MIDI + grabador (MIDI + mic + video de Hydra) + reproductor de ensayo
// Reemplaza a __tools.js + __ensayo.js · Sólo para ensayo: no se carga en el show
// Uso:  GP.tools.init({ cancion: '03_Vociferan' })
//       Graba, muestra y maneja el pad 89 solo, apenas se carga.
//       Sketch sin GP_midi: GP.tools.conectarMidi({ alMensaje: (nombre, data) => {...} })
//       Sketch con GP_midi: GP.midi.alMensaje((nombre, data) => {...})
//       y en el handler MIDI del sketch:  GP.tools.midi(entrada.name, msg.data)
// Actualizado: 2026-10-30 (v1.15: sugerencia de filas 5-8 (la 4 es de pads) · la SMC y la JP-Mini no cuentan como instrumentos)
//              2026-10-23 (v1.14: el Shift (98) pasa a GP_midi (anda sin GP_tools); las cajas se anotan para ocultarse con él)
//              2026-10-23 (v1.13: Shift (98) oculta todo en cualquier canción · al volver a mostrar, las cajas no se desarman ·
//              Ctrl+Shift+H de Hydra: las cajas se ocultan y vuelven junto con el código)
//              2026-10-23 (v1.12: reproductor con línea de tiempo, estados marcados, pausa y bucle del estado ·
//              cajas rediseñadas; REC sale de abajo a la derecha (ahí van las barras del mic de Hydra))
//              2026-10-22 (v1.11: video en MP4 · audio de la grabación = la canción del reproductor si está cargada, si no el mic)
//              2026-10-21 (v1.10: botonera de estados bajo el cartel — próximo/anterior/pausa/reiniciar · copiar/guardar/borrar)
//              2026-10-20 (v1.9: informe de canción · ensayo con varios aparatos · canal de estados)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1.15'

  // ya cargado: sólo volvemos a poner los paneles en pantalla
  if (GP.tools && GP.tools._version === VERSION) {
    GP.tools._reinsertar()
    return
  }

  const T = GP.tools = { _version: VERSION }

  // ---- configuración (se cambia con GP.tools.init) ----
  const cfg = {
    cancion: 'sin_nombre',  // va en el nombre de los archivos grabados
    grabarVideo: true,      // false = sólo MIDI + audio
    formatoVideo: 'mp4',    // 'mp4' (si Chrome no puede, sale .webm) · 'webm'
    // de dónde sale el audio de la grabación (archivo de audio y sonido del video):
    //   'auto'   = si hay un audio cargado en el reproductor de ensayo, esa canción
    //              (directo, a volumen completo); si no, el micrófono (ensayo real)
    //   'mic' · 'ensayo' · 'ambos' (canción + mic mezclados)
    audio: 'auto',
    fps: 30,                // cuadros por segundo del video
    videoBitrate: 6e6,      // 6 Mbps · subilo si se ve pixelado, bajalo si pesa mucho
    padGrabador: 89,
    // reproductor de ensayo: a qué puerto loopMIDI va cada aparato grabado.
    // [aparato grabado, puerto de ensayo]. Además, automático: un puerto llamado
    // "<palabra>_Ensayo" recibe lo del aparato cuyo nombre contiene esa palabra
    // (ej: keystep_Ensayo ← "Arturia KeyStep 37").
    puertosEnsayo: [
      [/korg|padkontrol/i, /korg.*ensayo|padkontrol.*ensayo/i],
      [/apc|akai_?ensayo/i, /akai.*ensayo|apc.*ensayo/i],
    ],        // nota del Akai que hace grabar / detener+guardar (null = ninguno)
  }
  T.config = cfg
  T.init = (opciones = {}) => {
    Object.assign(cfg, opciones)
    if (cfg.padGrabador != null) T.led.nota = cfg.padGrabador
    console.log(`GP.tools ${VERSION} · canción: ${cfg.cancion}`)
    return T
  }

  // ============================================================
  // Cajas en pantalla (todas fuera del canvas de Hydra:
  // nunca salen en la proyección ni en el video grabado)
  // ============================================================
  const elementos = []
  const crearCaja = (id, css) => {
    const viejo = document.getElementById(id)
    if (viejo) viejo.remove()   // limpia restos de versiones anteriores (tools/ensayo viejos)
    const el = document.createElement('div')
    el.id = id
    el.style.cssText = `
      position: fixed; z-index: 2147483647; box-sizing: border-box;
      background: rgba(0,0,0,0.65); color: #ddd;
      font: 11px/1.4 monospace; padding: 4px 8px; border-radius: 4px;
      ${css}
    `
    document.body.appendChild(el)
    elementos.push(el)
    return el
  }
  // mismo estilo para todos los botones de las cajas
  const BTN = 'font:11px/1 monospace; color:#ddd; background:#1d1d1d; border:1px solid #555; border-radius:3px; padding:3px 7px; cursor:pointer;'
  // abajo a la derecha quedan libres 100 × 80 px para las barras del mic de Hydra (a.show())
  const MARGEN_DER = 116
  const ALTO_FILA = 28

  T._reinsertar = () => elementos.forEach(el => {
    if (!document.body.contains(el)) document.body.appendChild(el)
  })

  let panelesVisibles = true
  // se ocultan con visibility (no con display): al volver a mostrarlas, cada caja conserva su forma
  T.paneles = (visible = !panelesVisibles) => {
    panelesVisibles = !!visible
    elementos.forEach(el => { el.style.visibility = visible ? '' : 'hidden' })
  }
  // ocultar todo (Shift 98) lo maneja GP_midi: acá sólo anotamos las cajas para que se oculten con él.
  // Estado compartido (mismo código en GP_midi.js): no importa cuál se carga primero.
  const ocu = window._gpOcultar || (window._gpOcultar = { visible: true, bins: false, oyentes: {} })
  ocu.oyentes.tools = (visible) => T.paneles(visible)

  // Ctrl+Shift+H de Hydra ("hide all") vuelve a dibujar la página y se lleva las
  // cajas. Las volvemos a poner solas, y se ocultan / muestran junto con el código.
  const hayEditorHydra = () => !!document.querySelector('.CodeMirror, .cm-editor, #editor-container')
  const reponerCajas = () => {
    let falto = false
    for (const el of elementos) if (!document.body.contains(el)) { document.body.appendChild(el); falto = true }
    return falto
  }
  // sólo sigue al editor cuando el editor aparece o desaparece (así no pisa un
  // ocultar hecho con Shift o Ctrl+Alt+P si Hydra re-dibuja por otra cosa)
  let editorAntes = hayEditorHydra()
  const seguirEditor = () => {
    const ahora = hayEditorHydra()
    if (ahora !== editorAntes) { editorAntes = ahora; T.paneles(ahora) }
  }
  if (window._gpToolsObs) window._gpToolsObs.disconnect()
  if (typeof MutationObserver !== 'undefined') {
    window._gpToolsObs = new MutationObserver(() => { reponerCajas(); seguirEditor() })
    window._gpToolsObs.observe(document.body, { childList: true })
  }
  if (window._gpToolsHydraH) window.removeEventListener('keydown', window._gpToolsHydraH, true)
  window._gpToolsHydraH = (e) => {
    if (!(e.ctrlKey && e.shiftKey && e.code === 'KeyH')) return
    setTimeout(() => { reponerCajas(); seguirEditor() }, 150)   // después de que Hydra re-dibuja
  }
  window.addEventListener('keydown', window._gpToolsHydraH, true)

  // ============================================================
  // 1. Panel MIDI (arriba a la izquierda)
  // ============================================================
  // Una línea por aparato + canal: último mensaje, cantidad, y un punto que se
  // prende con la actividad. El clock va aparte, con su BPM.
  // Si GP_midi está cargado, muestra a qué fila va el canal y si está muteado.
  let panelEl = null
  const canales = new Map()        // 'aparato|ch' → { aparato, ch, ultimo, n, t, notas, ccs, desde, hasta, tiempos }
  let panelDesde = performance.now()   // desde cuándo junta datos el panel (limpiarPanel lo reinicia)
  const clocks = new Map()         // aparato → { pulsos, ultimaNegra, bpm, t }
  let renderPendiente = false
  const ACTIVO_MS = 180

  T.panel = () => {
    if (!panelEl) {
      panelEl = crearCaja('gpMidiPanel', `
        top: 8px; left: 8px; color: #0f0; min-width: 300px; max-width: 420px;
        white-space: pre; pointer-events: none;
      `)
      panelEl.textContent = 'esperando MIDI...'
    }
    return panelEl
  }

  const corto = n => n.replace(/\s*\d+\s*$/,'').slice(0, 12).padEnd(12)
  const describir = (tipo, d1, d2) =>
    (tipo === 0x90 && d2 > 0) ? `on  ${String(d1).padStart(3)} v${String(d2).padStart(3)}`
    : (tipo === 0x80 || tipo === 0x90) ? `off ${String(d1).padStart(3)}     `
    : tipo === 0xb0 ? `cc  ${String(d1).padStart(3)} =${String(d2).padStart(3)}`
    : `0x${tipo.toString(16)} ${d1} ${d2}`

  const render = () => {
    renderPendiente = false
    const panel = T.panel()
    const ahora = performance.now()
    const filas = []
    for (const [ap, c] of clocks) {
      const vivo = ahora - c.t < 1000
      filas.push(`<span style="color:${vivo ? '#0f0' : '#555'}">${vivo ? '♩' : '·'}</span> ${corto(ap)} clock  ${vivo && c.bpm ? c.bpm.toFixed(1) + ' BPM' : 'detenido'}`)
    }
    const orden = [...canales.values()].sort((a, b) => a.aparato.localeCompare(b.aparato) || a.ch - b.ch)
    for (const c of orden) {
      const activo = ahora - c.t < ACTIVO_MS
      let extra = ''
      if (GP.estados && GP.estados.esCanalEstados && GP.estados.esCanalEstados(c.aparato, c.ch)) {
        extra = ` <span style="color:#c9f">estados</span>`
      } else if (GP.midi && GP.midi.filaDelCanal) {
        const fila = GP.midi.filaDelCanal(c.aparato, c.ch - 1)
        if (fila) extra = GP.midi.muteado(fila) ? ` <span style="color:#f80">fila ${fila} MUTE</span>` : ` <span style="color:#888">fila ${fila}</span>`
      }
      filas.push(`<span style="color:${activo ? '#ff0' : '#264'}">●</span> ${corto(c.aparato)} ch${String(c.ch).padEnd(2)} ${c.ultimo}  <span style="color:#888">${String(c.n).padStart(5)}</span>${extra}`)
      if (verNotas && c.notas.size) {
        const lista = [...c.notas.keys()].sort((a, b) => a - b)
        const ultimaNota = c.ultimo.startsWith('on') ? Number(c.ultimo.slice(3, 7)) : null
        const pintadas = lista.map(n => n === ultimaNota && activo ? `<span style="color:#ff0">${n}</span>` : n)
        for (let i = 0; i < pintadas.length; i += 12) {
          filas.push(`<span style="color:#9cf">    ${i === 0 ? `notas (${lista.length}):` : '           '} ${pintadas.slice(i, i + 12).join(' ')}</span>`)
        }
        filas.push(`<span style="color:#9cf">    → rango: [${lista[0]}, ${lista[lista.length - 1]}]</span>`)
      }
    }
    panel.innerHTML = filas.length ? filas.join('\n') : 'esperando MIDI...'
  }
  const pedirRender = () => {
    if (renderPendiente) return
    renderPendiente = true
    setTimeout(render, 60)        // como mucho ~16 veces por segundo
  }
  // apaga los puntos de actividad aunque no lleguen más mensajes
  if (window._gpPanelReloj) clearInterval(window._gpPanelReloj)
  window._gpPanelReloj = setInterval(() => { if (panelEl && (canales.size || clocks.size)) render() }, 250)

  T.log = (nombre, data) => {
    const [st, d1, d2] = data
    if (st === 0xf8) {
      const c = clocks.get(nombre) || { pulsos: 0, ultimaNegra: 0, bpm: 0, t: 0 }
      const ahora = performance.now()
      c.t = ahora
      if (++c.pulsos % 24 === 0) {
        if (c.ultimaNegra) c.bpm = 60000 / (ahora - c.ultimaNegra)
        c.ultimaNegra = ahora
      }
      clocks.set(nombre, c)
      return
    }
    if (st >= 0xf0) return
    const ch = (st & 0x0f) + 1
    const tipo = st & 0xf0
    const k = `${nombre}|${ch}`
    const c = canales.get(k) || { aparato: nombre, ch, ultimo: '', n: 0, t: 0, notas: new Map(), ccs: new Map(), desde: null, hasta: null, tiempos: [] }
    c.ultimo = describir(tipo, d1, d2)
    const ahora = performance.now()
    if (tipo === 0x90 && d2 > 0) {
      c.n++; c.t = ahora; c.notas.set(d1, (c.notas.get(d1) || 0) + 1)
      if (c.desde == null) c.desde = ahora
      c.hasta = ahora
      if (c.tiempos.length < 200) c.tiempos.push(ahora)
    } else if (tipo === 0xb0) { c.t = ahora; c.ccs.set(d1, (c.ccs.get(d1) || 0) + 1) }
    canales.set(k, c)
    pedirRender()
  }
  // lista de notas por canal (para configurar GP.midi.filas). Ctrl+Alt+N la prende/apaga.
  let verNotas = false
  T.notas = (v = !verNotas) => { verNotas = !!v; if (panelEl) { panelEl.style.maxWidth = verNotas ? '560px' : '420px'; render() } return verNotas }
  // devuelve las notas vistas por canal y las imprime en consola listas para copiar
  T.listaNotas = () => {
    const out = {}
    for (const c of canales.values()) {
      if (!c.notas.size) continue
      const lista = [...c.notas.keys()].sort((a, b) => a - b)
      out[`${c.aparato} ch${c.ch}`] = { notas: lista, rango: [lista[0], lista[lista.length - 1]], veces: Object.fromEntries([...c.notas].sort((a, b) => a[0] - b[0])) }
      console.log(`${c.aparato} ch${c.ch} → notas: [${lista.join(', ')}]  rango: [${lista[0]}, ${lista[lista.length - 1]}]`)
    }
    return out
  }
  T.limpiarPanel = () => { canales.clear(); clocks.clear(); panelDesde = performance.now(); if (panelEl) panelEl.textContent = 'esperando MIDI...' }

  // ============================================================
  // Informe de canción (Ctrl+Alt+I): qué entró por cada aparato y canal desde
  // el último limpiarPanel(), con una sugerencia de GP.midi.filas. Se descarga
  // como .md y se imprime en la consola.
  // ============================================================
  const esAPC = n => /apc|akai_?ensayo/i.test(n)
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
  const regexDe = n => {
    const palabra = (n.match(/[A-Za-z][A-Za-z0-9]{2,}/) || [n])[0]
    return `/${palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i`
  }
  T.informe = ({ descargar = true } = {}) => {
    const ahora = performance.now()
    const lista = [...canales.values()].sort((a, b) => a.aparato.localeCompare(b.aparato) || a.ch - b.ch)
    const esEst = c => GP.estados && GP.estados.esCanalEstados && GP.estados.esCanalEstados(c.aparato, c.ch)
    const d = new Date(), dd = n => String(n).padStart(2, '0')
    const fecha = `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())} ${dd(d.getHours())}:${dd(d.getMinutes())}`
    const L = []
    L.push(`# Mapa MIDI · ${cfg.cancion} · ${fecha}`, '')
    L.push(`Escuchado: ${mmss(ahora - panelDesde)} (desde el último limpiarPanel).`)
    for (const [ap, c] of clocks) L.push(`Clock: ${ap}${c.bpm ? ` · ${c.bpm.toFixed(1)} BPM` : ''}.`)
    L.push('', '| Aparato | Canal | Notas | Distintas | Rango | Más tocadas | CC | De – a | Hoy va a |', '|---|---|---|---|---|---|---|---|---|')
    for (const c of lista) {
      const notas = [...c.notas.keys()].sort((a, b) => a - b)
      const top = [...c.notas].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `${n} (${v})`).join(', ')
      const ccs = [...c.ccs].sort((a, b) => a[0] - b[0]).map(([n, v]) => `${n}×${v}`).join(' ')
      let uso = '—'
      if (esEst(c)) uso = 'estados'
      else if (esAPC(c.aparato)) uso = 'consola Akai'
      else if (GP.midi && GP.midi.filaDelCanal) { const f = GP.midi.filaDelCanal(c.aparato, c.ch - 1); if (f) uso = `fila ${f}` }
      const tramo = c.desde != null ? `${mmss(c.desde - panelDesde)} – ${mmss(c.hasta - panelDesde)}` : '—'
      L.push(`| ${c.aparato} | ${c.ch} | ${c.n} | ${notas.length} | ${notas.length ? `${notas[0]}–${notas[notas.length - 1]}` : '—'} | ${top || '—'} | ${ccs || '—'} | ${tramo} | ${uso} |`)
    }
    const est = lista.filter(esEst)
    if (est.length) {
      L.push('', '## Canal de estados')
      for (const c of est) L.push(`${c.aparato} canal ${c.ch}: **${c.n} cambios** → ${c.tiempos.map(t => mmss(t - panelDesde)).join(', ')}`)
      if (GP.estados && GP.estados.total) L.push(`El sketch tiene ${GP.estados.total} estados.`)
    }
    // las consolas (SMC-Mixer, JP-Mini) no son instrumentos: no van a las filas
    const cons = GP.midi && GP.midi.config && GP.midi.config.consolas
    const esConsola = a => !!(cons && (cons.smc.test(a) || cons.jp.test(a)))
    const musicales = lista.filter(c => c.n > 0 && !esEst(c) && !esAPC(c.aparato) && !esConsola(c.aparato))
    if (musicales.length) {
      L.push('', '## Notas de cada canal')
      for (const c of musicales) L.push(`- ${c.aparato} canal ${c.ch}: ${[...c.notas.keys()].sort((a, b) => a - b).join(' ')}`)
      L.push('', '## Sugerencia para GP.midi.filas (los más tocados arriba)', '', '```js', 'GP.midi.filas({')
      const orden = [...musicales].sort((a, b) => b.n - a.n)
      ;[8, 7, 6, 5].forEach((fila, i) => {
        const c = orden[i]
        if (!c) { L.push(`  ${fila}: null,`); return }
        const notas = [...c.notas.keys()].sort((a, b) => a - b)
        const como = notas.length <= 2 ? `pulso: 'vuelta'` : notas.length <= 8 ? `notas: [${notas.join(', ')}]` : `rango: [${notas[0]}, ${notas[notas.length - 1]}]`
        L.push(`  ${fila}: { puerto: ${regexDe(c.aparato)}, canal: ${c.ch}, ${como} },   // ${c.n} notas`)
      })
      L.push('})', '```')
      if (orden.length > 4) L.push('', `Quedaron afuera (hay 4 filas): ${orden.slice(4).map(c => `${c.aparato} ch${c.ch} (${c.n})`).join(', ')}.`)
    }
    const texto = L.join('\n')
    console.log(texto)
    if (descargar) {
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/markdown' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${cfg.cancion}_mapa_midi_${fecha.replace(' ', '_').replace(':', '-')}.md`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }
    return texto
  }

  // atajo para el sketch: graba todo y muestra lo que no es clock/sistema
  T.midi = (nombre, data, ts) => {
    T.grabador.registrar(nombre, data, ts)
    if (data[0] < 0xf0 || data[0] === 0xf8) T.log(nombre, data)
  }

  // ---- conexión MIDI única (bus compartido con GP_midi.js) ----
  // Una sola conexión por página; al reevaluar, cada id reemplaza al anterior.
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


  const esAkaiReal = n => /apc/i.test(n) && !/ensayo/i.test(n)   // el APC físico (un teclado Akai no cuenta)
  T.accesoMidi = () => bus.conectar()

  // graba + panel + pad del grabador. Siempre activo apenas se carga tools.
  bus.escuchar('tools', (nombre, data, ts) => {
    T.midi(nombre, data, ts)
    const esNoteOn = (data[0] & 0xf0) === 0x90 && data[2] > 0
    if (esNoteOn && data[1] === cfg.padGrabador && /apc|akai_?ensayo/i.test(nombre)) T.grabadorCiclo()
  })
  bus.puertos('tools', (acc) => {
    T.led.salida = null
    acc.outputs.forEach(o => { if (o.state === 'connected' && esAkaiReal(o.name)) T.led.salida = o })
    T.led.pintar()
  })

  // Para sketches SIN GP_midi. Si el sketch usa GP_midi, usá GP.midi.alMensaje en su lugar.
  T.conectarMidi = async ({ alMensaje = null } = {}) => {
    if (GP.midi && GP.midi.alMensaje) GP.midi.alMensaje(alMensaje)
    else bus.escuchar('sketch', alMensaje)
    return bus.conectar()
  }

  // ============================================================
  // 2. Grabador: MIDI + audio + video de Hydra (indicador abajo, a la izquierda de las barras del mic)
  // ============================================================
  // estados: listo → grabando → guardando → guardado → listo
  // (detener ya incluye guardar)
  let estado = 'listo'
  let grabacion = []
  let inicio = 0
  let fechaInicio = null
  let partes = []
  let micStream = null
  let videoTrack = null
  let recAudio = null
  let recVideo = null
  let chunksAudio = []
  let chunksVideo = []
  let terminados = Promise.resolve()

  const indicador = crearCaja('gpRecIndicador', `
    bottom: 8px; right: ${MARGEN_DER}px; height: ${ALTO_FILA}px; display: flex; align-items: center;
    font: bold 11px/1 monospace; pointer-events: none;
  `)

  const ESTILOS = {
    listo:     { fondo: 'rgba(0,0,0,0.65)', texto: '○ REC listo' },
    grabando:  { fondo: 'rgba(200,0,0,0.85)', texto: '● GRABANDO' },
    iniciando: { fondo: 'rgba(200,0,0,0.5)', texto: '● iniciando…' },
    guardando: { fondo: 'rgba(170,150,0,0.85)', texto: '… GUARDANDO' },
    guardado:  { fondo: 'rgba(0,140,0,0.85)', texto: '✓ GUARDADO' },
  }

  const dosDigitos = n => String(n).padStart(2, '0')
  const reloj = () => {
    const s = Math.floor((performance.now() - inicio) / 1000)
    return `${dosDigitos(Math.floor(s / 60))}:${dosDigitos(s % 60)}`
  }

  const pintarIndicador = () => {
    const e = ESTILOS[estado]
    indicador.style.background = e.fondo
    let texto = e.texto
    if (estado === 'grabando') texto += ` ${reloj()} · ${partes.join('+')}`
    indicador.textContent = texto
  }

  // ---- LED del pad del grabador (botón de un solo color) ----
  // listo: prendido · grabando: parpadea · guardando: apagado · guardado: prendido
  // el parpadeo lo hace el script (no depende del modo blink del Akai)
  T.led = {
    salida: null,      // MIDIOutput del Akai — lo asigna el sketch
    nota: 89,          // último botón redondo de la columna derecha (el Shift 98 no tiene LED)
    on: 1,             // botones redondos: 1 = prendido
    off: 0,            //                   0 = apagado
    parpadeoMs: 400,
  }
  let ledPrendido = null
  const mandarLed = (prender) => {
    if ((!T.led.salida && !(GP.midi && GP.midi.ledSistema)) || ledPrendido === prender) return
    ledPrendido = prender
    const valor = prender ? T.led.on : T.led.off
    // si está GP_midi, el LED pasa por su motor (un solo dueño de los LEDs)
    if (GP.midi && GP.midi.ledSistema) { GP.midi.ledSistema(T.led.nota, valor); return }
    try { T.led.salida.send([0x90, T.led.nota, valor]) } catch (e) {}
  }
  const pintarLed = () => {
    ledPrendido = null   // fuerza reenvío (por si se reconectó el Akai)
    if (estado === 'grabando') mandarLed(true)
    else mandarLed(estado !== 'guardando')
  }
  T.led.pintar = pintarLed
  let fase = true
  const parpadear = () => {
    if (estado === 'grabando') { fase = !fase; mandarLed(fase) }
    window._gpLedParpadeo = setTimeout(parpadear, T.led.parpadeoMs)
  }
  if (window._gpLedParpadeo) clearTimeout(window._gpLedParpadeo)
  parpadear()

  const setEstado = (nuevo) => {
    estado = nuevo
    pintarIndicador()
    pintarLed()
    if (typeof T.grabador.alCambiar === 'function') T.grabador.alCambiar(estado)  // ej: prender el LED del pad
  }

  if (window._gpRecReloj) clearInterval(window._gpRecReloj)
  window._gpRecReloj = setInterval(() => { if (estado === 'grabando') pintarIndicador() }, 500)

  // el canvas de Hydra es el más grande de la página
  const canvasHydra = () => [...document.querySelectorAll('canvas')]
    .sort((a, b) => b.width * b.height - a.width * a.height)[0]

  const elegirMime = (lista) => lista.find(m => MediaRecorder.isTypeSupported(m)) || ''

  const nuevoGrabador = (stream, mimes, opciones, destino, esperas) => {
    const rec = new MediaRecorder(stream, { mimeType: elegirMime(mimes), ...opciones })
    rec.ondataavailable = e => { if (e.data.size > 0) destino.push(e.data) }
    esperas.push(new Promise(resolve => { rec.onstop = resolve }))
    rec.start(1000)   // junta el archivo de a 1 s
    return rec
  }

  const fechaArchivo = (d) =>
    `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}` +
    `_${dosDigitos(d.getHours())}-${dosDigitos(d.getMinutes())}-${dosDigitos(d.getSeconds())}`

  const bajar = (blob, nombre) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 20000)   // los videos grandes tardan en escribirse
  }

  const esperar = ms => new Promise(r => setTimeout(r, ms))

  // ---- audio del reproductor de ensayo, para grabarlo directo ----
  // El audio del reproductor pasa por un AudioContext: suena igual por los
  // parlantes y además se puede grabar sin micrófono. (audioEl se declara más
  // abajo, en el reproductor; estas funciones se usan después de cargar.)
  let ctxAudio = null
  let busEnsayo = null
  const contexto = () => {
    if (!ctxAudio) {
      ctxAudio = new (window.AudioContext || window.webkitAudioContext)()
      busEnsayo = ctxAudio.createGain()
      busEnsayo.connect(ctxAudio.destination)
    }
    if (ctxAudio.state === 'suspended') ctxAudio.resume().catch(() => {})
    return ctxAudio
  }
  const enrutarEnsayo = (el) => {
    if (!el || el._gpFuente) return
    const ctx = contexto()
    el._gpFuente = ctx.createMediaElementSource(el)
    el._gpFuente.connect(busEnsayo)
  }
  const hayAudioEnsayo = () => !!audioEl

  // mime de video en orden de preferencia (MP4 con H.264 en Chrome; si no, WebM)
  const MIMES_VIDEO = {
    mp4: ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4'],
    webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
  }
  const extension = mime => /mp4/i.test(mime) ? 'mp4' : 'webm'
  let mezcla = null   // destino de audio de la grabación cuando sale del AudioContext

  T.grabador = {
    alCambiar: null,
    get estado() { return estado },

    async iniciar() {
      if (estado !== 'listo' && estado !== 'guardado') return
      setEstado('iniciando')   // marca ya, para que un segundo toque no arranque otra grabación
      chunksAudio = []
      chunksVideo = []
      recAudio = recVideo = null
      micStream = null
      videoTrack = null
      mezcla = null
      partes = ['midi']
      const esperas = []

      // ¿de dónde sale el audio?
      const modo = cfg.audio === 'auto' ? (hayAudioEnsayo() ? 'ensayo' : 'mic') : cfg.audio
      const quiereMic = modo === 'mic' || modo === 'ambos'
      const quiereEnsayo = (modo === 'ensayo' || modo === 'ambos') && hayAudioEnsayo()
      if ((modo === 'ensayo' || modo === 'ambos') && !hayAudioEnsayo()) {
        console.warn('GP.tools: audio "ensayo" pero no hay audio cargado en el reproductor')
      }

      // micrófono sin procesar (sin cancelación de eco ni control de volumen: es música)
      if (quiereMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          })
        } catch (err) {
          console.warn('GP.tools: no se pudo grabar el mic (¿permiso?):', err)
        }
      }
      let pistaAudio = null
      if (quiereEnsayo) {
        // la canción del reproductor, directo (y el mic mezclado si es 'ambos')
        const ctx = contexto()
        enrutarEnsayo(audioEl)
        mezcla = ctx.createMediaStreamDestination()
        busEnsayo.connect(mezcla)
        if (micStream) ctx.createMediaStreamSource(micStream).connect(mezcla)
        pistaAudio = mezcla.stream
        partes.push(micStream ? 'canción+mic' : 'canción')
      } else if (micStream) {
        pistaAudio = micStream
        partes.push('mic')
      }
      if (pistaAudio) {
        recAudio = nuevoGrabador(pistaAudio, ['audio/webm;codecs=opus', 'audio/webm'],
          {}, chunksAudio, esperas)
      }

      // video del canvas de Hydra, con el mismo audio adentro
      if (cfg.grabarVideo) {
        const canvas = canvasHydra()
        if (canvas) {
          try {
            videoTrack = canvas.captureStream(cfg.fps).getVideoTracks()[0]
            const pistas = [videoTrack, ...(pistaAudio ? pistaAudio.getAudioTracks() : [])]
            const mimes = cfg.formatoVideo === 'webm' ? MIMES_VIDEO.webm : [...MIMES_VIDEO.mp4, ...MIMES_VIDEO.webm]
            recVideo = nuevoGrabador(new MediaStream(pistas), mimes,
              { videoBitsPerSecond: cfg.videoBitrate }, chunksVideo, esperas)
            partes.push(`video ${extension(recVideo.mimeType)}`)
          } catch (err) {
            console.warn('GP.tools: no se pudo grabar el video:', err)
          }
        } else {
          console.warn('GP.tools: no encontré el canvas de Hydra')
        }
      }

      terminados = Promise.all(esperas)
      // el reloj del MIDI arranca recién cuando audio y video ya están grabando → quedan alineados
      grabacion = []
      inicio = performance.now()
      fechaInicio = new Date()
      setEstado('grabando')
      console.log(`GP.tools: grabando ${partes.join(' + ')}`)
    },

    detener() {
      if (estado !== 'grabando') return
      if (recAudio && recAudio.state !== 'inactive') recAudio.stop()
      if (recVideo && recVideo.state !== 'inactive') recVideo.stop()
      if (micStream) micStream.getTracks().forEach(t => t.stop())
      if (mezcla && busEnsayo) { try { busEnsayo.disconnect(mezcla) } catch (_) {} }
      if (videoTrack) videoTrack.stop()
      console.log(`GP.tools: detenido · ${grabacion.length} mensajes MIDI · ${reloj()}`)
      return guardar()   // detener incluye guardar
    },

    // ts = momento en que llegó el mensaje (msg.timeStamp). Si el navegador se traba un
    // instante, el mensaje se procesa tarde pero se graba con su hora real de llegada.
    registrar(nombre, data, ts) {
      if (estado !== 'grabando') return
      const t = (typeof ts === 'number' && ts > 0) ? ts : performance.now()
      grabacion.push([Math.max(0, t - inicio), nombre, [...data]])
    },

    descargar() { return T.grabador.detener() },   // compatibilidad: igual que detener
  }

  async function guardar() {
      setEstado('guardando')
      await terminados
      const base = `${cfg.cancion}_ensayo_${fechaArchivo(fechaInicio)}`

      bajar(new Blob([JSON.stringify(grabacion)], { type: 'application/json' }), `${base}_midi.json`)
      if (chunksAudio.length) {
        await esperar(400)
        bajar(new Blob(chunksAudio, { type: 'audio/webm' }), `${base}_audio.webm`)
      }
      if (chunksVideo.length) {
        await esperar(400)
        const mime = (recVideo && recVideo.mimeType) || 'video/webm'
        bajar(new Blob(chunksVideo, { type: mime.split(';')[0] }), `${base}_video.${extension(mime)}`)
      }
      console.log(`GP.tools: guardado ${base}`)
      setEstado('guardado')
      await esperar(3000)
      if (estado === 'guardado') setEstado('listo')
  }

  // un solo pad: toggle grabar / detener+guardar (sigue el estado real, no se desincroniza)
  T.grabadorCiclo = () => {
    if (estado === 'listo' || estado === 'guardado') T.grabador.iniciar()
    else if (estado === 'grabando') T.grabador.detener()
    // mientras guarda, el pad no hace nada
  }

  pintarIndicador()

  // ============================================================
  // 3. Reproductor de ensayo (abajo, a lo ancho)
  // ============================================================
  //   fila de abajo:   [midi] [audio]  ▶/⏸  ■  🔁   1:23 / 3:40 · estado 5        ○ REC
  //   arriba de eso:   línea de tiempo con una marca por estado (canal 16)
  //   · clic en la línea = ir a ese momento (la canción, el MIDI y el estado)
  //   · clic cerca de una marca = ir justo al comienzo de ese estado
  //   · 🔁 = repetir la parte del estado en el que está la canción (para diseñarlo)
  //   · ▶ desde el principio hace GP.estados.reiniciar() solo
  let midiEnsayo = null
  let audioEl = null
  let salidas = []

  const ensayoEl = crearCaja('gpEnsayoPanel', `
    bottom: 8px; left: 8px; height: ${ALTO_FILA}px; display: flex; align-items: center; gap: 5px;
  `)
  ensayoEl.innerHTML = `
    <label data-carga="midi" style="${BTN}" title="cargar .json de MIDI">midi<input type="file" accept=".json" style="display:none"></label>
    <label data-carga="audio" style="${BTN}" title="cargar audio (.webm / .mp3 / .wav)">audio<input type="file" accept=".webm,audio/*,video/webm" style="display:none"></label>
    <button data-accion="play" style="${BTN}" title="reproducir / pausa">▶&#xFE0E;</button>
    <button data-accion="stop" style="${BTN}" title="detener y volver al principio">■&#xFE0E;</button>
    <button data-accion="bucle" style="${BTN}" title="repetir la parte del estado actual">🔁&#xFE0E;</button>
    <span data-estado style="margin-left:4px; white-space:nowrap;"></span>
  `
  const estadoEnsayo = ensayoEl.querySelector('[data-estado]')
  let avisoEnsayo = ''              // texto extra (ej: sin puerto) que queda al lado del reloj
  const setEnsayo = t => { avisoEnsayo = t; pintarReloj() }
  const botonMidi = ensayoEl.querySelector('[data-carga="midi"]')
  const botonAudio = ensayoEl.querySelector('[data-carga="audio"]')
  const botonPlay = ensayoEl.querySelector('[data-accion="play"]')
  const botonBucle = ensayoEl.querySelector('[data-accion="bucle"]')

  const marcar = (boton, estadoCarga, nombreArchivo = '') => {
    const colores = {
      vacio:  { fondo: '#1d1d1d', borde: '#555', texto: '#ddd' },
      ok:     { fondo: '#0a0',    borde: '#0c0', texto: '#000' },
      error:  { fondo: '#b00',    borde: '#e00', texto: '#fff' },
    }[estadoCarga]
    boton.style.background = colores.fondo
    boton.style.borderColor = colores.borde
    boton.style.color = colores.texto
    if (nombreArchivo) boton.title = nombreArchivo   // pasando el mouse se ve qué archivo es
  }

  const duracion = ms => {
    const s = Math.max(0, Math.floor(ms / 1000))
    return `${Math.floor(s / 60)}:${dosDigitos(s % 60)}`
  }

  // ---- línea de tiempo ----
  const lineaEl = crearCaja('gpLineaTiempo', `
    bottom: ${8 + ALTO_FILA + 4}px; left: 8px; right: ${MARGEN_DER}px; height: 26px; padding: 3px 8px;
    cursor: pointer;
  `)
  lineaEl.innerHTML = `
    <div data-pista style="position:relative; height:100%;">
      <div data-tramos style="position:absolute; inset:9px 0 3px 0;"></div>
      <div data-bucle style="position:absolute; top:9px; bottom:3px; background:rgba(255,200,0,0.28); display:none;"></div>
      <div data-avance style="position:absolute; top:9px; bottom:3px; left:0; background:rgba(0,200,0,0.35);"></div>
      <div data-marcas style="position:absolute; inset:0;"></div>
      <div data-cabeza style="position:absolute; top:6px; bottom:0; width:2px; background:#fff; left:0;"></div>
    </div>
  `
  const pistaEl = lineaEl.querySelector('[data-pista]')
  const avanceEl = lineaEl.querySelector('[data-avance]')
  const cabezaEl = lineaEl.querySelector('[data-cabeza]')
  const bucleEl = lineaEl.querySelector('[data-bucle]')

  // ---- motor del reproductor ----
  // Un reloj propio (pos en ms de la canción) y un programador que manda el MIDI
  // de a poquito (60 ms adelante, con la hora exacta de cada mensaje). Así se
  // puede pausar, saltar y repetir sin que se acumulen envíos.
  const ADELANTE = 60
  let msgs = []                     // [ms, aparato, bytes] ordenados
  let marcas = []                   // ms de cada cambio de estado (canal de estados)
  let total = 0                     // duración en ms
  let ruta = new Map()              // aparato grabado → puerto de ensayo
  let sonando = new Map()           // notas prendidas, para soltarlas al pausar o saltar
  let reproduciendo = false
  let posBase = 0, tBase = 0        // pos = posBase + (ahora - tBase)
  let posPausa = 0
  let cursor = 0                    // próximo mensaje a mandar
  let bucle = null                  // { desde, hasta } o null

  const pos = () => reproduciendo ? posBase + (performance.now() - tBase) : posPausa
  const esEstados = (nombre, st) => {
    if ((st & 0xf0) !== 0x90 || st >= 0xf0) return false
    const canal = (st & 0x0f) + 1
    if (GP.estados && GP.estados.esCanalEstados) return GP.estados.esCanalEstados(nombre, canal)
    return canal === 16 && !/apc|akai_?ensayo/i.test(nombre)
  }
  // estado en el que está la canción en un momento: cuántas marcas pasaron
  const estadoEn = (ms) => { let n = 0; while (n < marcas.length && marcas[n] <= ms) n++; return n }

  const prepararEnsayo = () => {
    msgs = midiEnsayo ? [...midiEnsayo].sort((x, y) => x[0] - y[0]) : []
    marcas = []
    const anti = (GP.estados && GP.estados.config && GP.estados.config.antirrebote) || 150
    let ultima = -1e9
    for (const [ms, n, b] of msgs) {
      if (b[2] > 0 && esEstados(n, b[0]) && ms - ultima >= anti) { marcas.push(ms); ultima = ms }
    }
    const durAudio = audioEl && isFinite(audioEl.duration) ? audioEl.duration * 1000 : 0
    total = Math.max(msgs.length ? msgs[msgs.length - 1][0] : 0, durAudio, 1)
    dibujarLinea()
  }

  const dibujarLinea = () => {
    // sin midi cargado la línea no se ve (pero la caja existe, así "mostrar paneles" no la descoloca)
    const hay = msgs.length > 0
    pistaEl.style.display = hay ? '' : 'none'
    lineaEl.style.background = hay ? 'rgba(0,0,0,0.65)' : 'transparent'
    lineaEl.style.pointerEvents = hay ? '' : 'none'
    if (!hay) return
    const tramos = lineaEl.querySelector('[data-tramos]')
    const capa = lineaEl.querySelector('[data-marcas]')
    // tramos alternados (se ve dónde empieza y termina cada estado) + marcas con número
    const bordes = [0, ...marcas, total]
    tramos.innerHTML = bordes.slice(0, -1).map((d, i) => {
      const izq = d / total * 100, ancho = (bordes[i + 1] - d) / total * 100
      return `<div style="position:absolute; top:0; bottom:0; left:${izq}%; width:${ancho}%; background:${i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)'};"></div>`
    }).join('')
    capa.innerHTML = marcas.map((m, i) => {
      const izq = m / total * 100
      const titulo = `estado ${i + 1} · ${duracion(m)}`
      return `<div title="${titulo.replace(/"/g, '&quot;')}" style="position:absolute; left:${izq}%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.75);">
        <span style="position:absolute; top:-2px; left:2px; font-size:9px; line-height:1; color:#bbb;">${i + 1}</span></div>`
    }).join('')
    pintarBucle()
    pintarReloj()
  }
  const pintarBucle = () => {
    bucleEl.style.display = bucle ? '' : 'none'
    if (bucle) { bucleEl.style.left = `${bucle.desde / total * 100}%`; bucleEl.style.width = `${(bucle.hasta - bucle.desde) / total * 100}%` }
    botonBucle.style.background = bucle ? '#fc0' : '#1d1d1d'
    botonBucle.style.color = bucle ? '#000' : '#ddd'
  }
  const pintarReloj = () => {
    const p = Math.min(pos(), total)
    if (msgs.length) {
      const x = `${p / total * 100}%`
      avanceEl.style.width = x
      cabezaEl.style.left = x
    }
    const est = marcas.length ? ` · estado ${estadoEn(p)}/${marcas.length}` : ''
    estadoEnsayo.textContent = msgs.length
      ? `${duracion(p)} / ${duracion(total)}${est}${avisoEnsayo ? ' · ' + avisoEnsayo : ''}`
      : (avisoEnsayo || '')
    const icono = reproduciendo ? '⏸\uFE0E' : '▶\uFE0E'
    if (botonPlay.textContent !== icono) botonPlay.textContent = icono
  }

  // suelta lo que quedó sonando (después de lo que ya estaba programado)
  const soltarTodo = () => {
    const t = performance.now() + ADELANTE + 5
    for (const [k, salida] of sonando) {
      const [, canal, nota] = k.split('|').map(Number)
      try { salida.send([0x80 | canal, nota, 0], t) } catch (_) {}
    }
    sonando.clear()
    for (const o of salidas) { try { if (o.clear) o.clear() } catch (_) {} }
  }

  const programar = () => {
    if (!reproduciendo) return
    const p = pos()
    const limite = bucle ? Math.min(p + ADELANTE, bucle.hasta - 1) : p + ADELANTE
    while (cursor < msgs.length && msgs[cursor][0] <= limite) {
      const [ms, n, bytes] = msgs[cursor++]
      const salida = ruta.get(n)
      if (!salida) continue
      try { salida.send(bytes, tBase + (ms - posBase)) } catch (_) {}
      const tipo = bytes[0] & 0xf0
      const k = `${salida.name}|${bytes[0] & 0x0f}|${bytes[1]}`
      if (tipo === 0x90 && bytes[2] > 0) sonando.set(k, salida)
      else if (tipo === 0x80 || tipo === 0x90) sonando.delete(k)
    }
    if (bucle && p >= bucle.hasta) { irA(bucle.desde, { fijarEstado: false }); return }
    if (!bucle && p >= total) { pausar(); posPausa = total; setEnsayo('fin'); }
    if (audioEl && reproduciendo && !audioEl.paused && Math.abs(audioEl.currentTime * 1000 - p) > 120) {
      try { audioEl.currentTime = p / 1000 } catch (_) {}   // si el audio se corrió, lo acomoda
    }
  }

  const arrancarReloj = () => {
    if (window._gpEnsayoReloj) clearInterval(window._gpEnsayoReloj)
    let vuelta = 0
    window._gpEnsayoReloj = setInterval(() => { programar(); if (++vuelta % 5 === 0) pintarReloj() }, 20)
  }
  arrancarReloj()

  const buscarSalidas = async () => {
    const acc = await T.accesoMidi()
    salidas = []
    acc.outputs.forEach(o => { if (o.state === 'connected' && /ensayo/i.test(o.name)) salidas.push(o) })
    return salidas.length > 0
  }
  const soloLetras = t => t.toLowerCase().replace(/[^a-z0-9]/g, '')
  // a qué puerto de ensayo va un aparato grabado (null = no hay)
  const salidaPara = (nombreOriginal) => {
    for (const [orig, dest] of cfg.puertosEnsayo) {
      if (orig.test(nombreOriginal)) { const o = salidas.find(x => dest.test(x.name)); if (o) return o }
    }
    const limpio = soloLetras(nombreOriginal)
    for (const o of salidas) {
      const m = /^(.+?)[\s_-]*ensayo/i.exec(o.name)
      const palabra = m ? soloLetras(m[1]) : ''
      if (palabra.length >= 3 && limpio.includes(palabra)) return o
    }
    return null
  }

  // para chequear antes del ensayo: GP.tools.rutaEnsayo(['Arturia KeyStep 37', 'padKONTROL'])
  // (sin argumentos usa los aparatos del .json cargado)
  T.rutaEnsayo = async (nombres) => {
    await buscarSalidas()
    const lista = nombres || (midiEnsayo ? [...new Set(midiEnsayo.map(m => m[1]))] : [])
    const r = lista.map(n => { const o = salidaPara(n); return { aparato: n, puerto: o ? o.name : 'SIN PUERTO' } })
    console.table(r)
    return r
  }

  const armarRuta = async () => {
    if (!(await buscarSalidas())) { setEnsayo('sin puertos loopMIDI'); return false }
    ruta = new Map()
    for (const [, n] of msgs) if (!ruta.has(n)) ruta.set(n, salidaPara(n))
    const faltan = [...ruta].filter(([, o]) => !o).map(([n]) => n)
    console.info('GP.tools ensayo:', [...ruta].map(([n, o]) => `${n} → ${o ? o.name : 'SIN PUERTO'}`).join(' · '))
    if (faltan.length) {
      console.warn(`GP.tools ensayo: no hay puerto para ${faltan.join(', ')}. Creá en loopMIDI un puerto "<palabra>_Ensayo" con una palabra de ese nombre (ej: ${soloLetras(faltan[0]).slice(0, 8)}_Ensayo) y reiniciá Chrome entero.`)
      setEnsayo(`sin puerto: ${faltan.map(n => n.slice(0, 12)).join(', ')}`)
    } else setEnsayo('')
    return true
  }

  // ir a un momento de la canción. fijarEstado: poner los estados en el que corresponde
  const irA = (ms, { fijarEstado = true } = {}) => {
    ms = Math.max(0, Math.min(total, ms))
    soltarTodo()
    // desde el principio: también el mensaje del ms 0; si no, sólo lo que viene después
    cursor = 0
    while (cursor < msgs.length && (ms === 0 ? msgs[cursor][0] < 0 : msgs[cursor][0] <= ms)) cursor++
    if (reproduciendo) { posBase = ms; tBase = performance.now() } else posPausa = ms
    if (audioEl) { try { audioEl.currentTime = ms / 1000 } catch (_) {} }
    if (fijarEstado && GP.estados) {
      // un instante después, por si un cambio de estado ya programado (de los 60 ms
      // de adelanto) todavía estaba en camino: el que manda es el del salto
      const n = estadoEn(ms)
      clearTimeout(irA._t)
      irA._t = setTimeout(() => { if (n === 0) GP.estados.reiniciar(); else GP.estados.ir(n, 'reproductor') }, ADELANTE + 15)
    }
    if (bucle && fijarEstado) ponerBucle()
    pintarReloj()
  }

  const reproducir = async () => {
    if (!midiEnsayo) { setEnsayo('falta midi'); return }
    if (!(await armarRuta())) return
    if (audioEl) { try { enrutarEnsayo(audioEl); contexto() } catch (_) {} }
    const desde = posPausa >= total ? 0 : posPausa
    reproduciendo = true
    posBase = desde; tBase = performance.now()
    if (desde === 0) {                 // desde el principio: estados al inicio, ya
      irA(0, { fijarEstado: false })
      if (GP.estados) GP.estados.reiniciar()
    }
    // al reanudar, el cursor sigue donde quedó (lo ya mandado no se repite)
    if (audioEl) { try { audioEl.currentTime = desde / 1000; await audioEl.play() } catch (_) {} }
    pintarReloj()
  }
  const pausar = () => {
    if (!reproduciendo) return
    posPausa = pos()
    reproduciendo = false
    soltarTodo()
    if (audioEl) audioEl.pause()
    pintarReloj()
  }
  const detener = () => {
    pausar()
    posPausa = 0
    if (audioEl) { try { audioEl.currentTime = 0 } catch (_) {} }
    setEnsayo('')
  }

  // bucle: la parte del estado en el que está la canción
  const ponerBucle = () => {
    const n = estadoEn(pos())
    bucle = { desde: n === 0 ? 0 : marcas[n - 1], hasta: n < marcas.length ? marcas[n] : total }
    pintarBucle()
  }
  const alternarBucle = () => {
    if (bucle) { bucle = null; pintarBucle(); return }
    if (!marcas.length) { setEnsayo('sin estados en el midi'); return }
    ponerBucle()
  }

  // ---- carga de archivos ----
  botonMidi.querySelector('input').addEventListener('change', (e) => {
    const file = e.target.files[0]
    e.target.value = ''   // permite volver a elegir el mismo archivo
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const crudo = JSON.parse(reader.result)
        // las grabaciones viejas tienen mensajes duplicados (bug de reevaluar): se limpian
        const vistos = new Set()
        midiEnsayo = crudo.filter(([ms, n, b]) => {
          const k = `${Math.round(ms * 10)}|${n}|${b.join(',')}`
          if (vistos.has(k)) return false
          vistos.add(k); return true
        })
        const quitados = crudo.length - midiEnsayo.length
        if (quitados) console.info(`GP.tools: ${quitados} mensajes duplicados quitados de ${file.name}`)
        detener(); bucle = null
        prepararEnsayo()
        marcar(botonMidi, 'ok', file.name)
        setEnsayo('')
      } catch (err) {
        midiEnsayo = null
        prepararEnsayo()
        marcar(botonMidi, 'error', file.name)
        setEnsayo('json inválido')
      }
    }
    reader.readAsText(file)
  })

  botonAudio.querySelector('input').addEventListener('change', (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (audioEl) audioEl.pause()
    audioEl = new Audio(URL.createObjectURL(file))   // sin barra: lo maneja la línea de tiempo
    try { enrutarEnsayo(audioEl) } catch (err) { console.warn('GP.tools: audio del ensayo sin AudioContext', err) }
    audioEl.onloadedmetadata = () => prepararEnsayo()
    audioEl.onerror = () => { audioEl = null; marcar(botonAudio, 'error', file.name) }
    marcar(botonAudio, 'ok', file.name)
  })

  // ---- botones y línea ----
  botonPlay.addEventListener('click', () => { (reproduciendo ? pausar : reproducir)(); botonPlay.blur() })
  // ■ = todo al principio: la canción y los estados
  ensayoEl.querySelector('[data-accion="stop"]').addEventListener('click', (e) => { detener(); if (GP.estados) GP.estados.reiniciar(); e.currentTarget.blur() })
  botonBucle.addEventListener('click', () => { alternarBucle(); botonBucle.blur() })
  lineaEl.addEventListener('click', (e) => {
    if (!msgs.length) return
    const r = pistaEl.getBoundingClientRect()
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left))
    let ms = x / r.width * total
    // cerca de una marca (6 px): justo al comienzo de ese estado
    for (const m of marcas) if (Math.abs(m / total * r.width - x) <= 6) { ms = m; break }
    irA(ms)
  })

  // desde la consola
  T.ensayo = {
    reproducir, pausar, detener,
    ir: (ms) => irA(ms),
    irEstado: (n) => irA(n <= 0 ? 0 : marcas[Math.min(n, marcas.length) - 1]),
    bucle: (v = !bucle) => { if (!!v !== !!bucle) alternarBucle(); return !!bucle },
    get pos() { return pos() },
    get marcas() { return marcas.slice() },
    get reproduciendo() { return reproduciendo },
  }

  // ============================================================
  // 4. Estados (arriba a la derecha): cartel + botonera en una sola caja
  // ============================================================
  //   3/13 · estribillo
  //   ⏭ ⏮ ⏸ ⟲  ·  ⧉ ⤓ ✕
  // ⏸ / ⧉ / ⤓ = Ctrl+Alt+E / C / D. Sólo en ensayo: vive en GP_tools, que en el show no se carga.
  { const viejo = document.getElementById('gpBotonesEstados'); if (viejo) viejo.remove() }   // de la v1.10
  const estadosEl = crearCaja('gpOverlayEstado', `
    top: 8px; right: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  `)
  estadosEl.innerHTML = `
    <div data-texto style="font: bold 13px/1.3 monospace; color:#fff; white-space:nowrap; display:none;"></div>
    <div style="display:flex; gap:4px; align-items:center;">
      <button data-est="siguiente" style="${BTN}" title="próximo estado (botón 88)">⏭&#xFE0E;</button>
      <button data-est="anterior" style="${BTN}" title="estado anterior (botón 87)">⏮&#xFE0E;</button>
      <button data-est="suspender" style="${BTN}" title="pausar / reanudar los estados (Ctrl+Alt+E)">⏸&#xFE0E;</button>
      <button data-est="reiniciar" style="${BTN}" title="volver al inicio">⟲</button>
      <span style="width:6px;"></span>
      <button data-est="copiar" style="${BTN}" title="copiar el estado actual (Ctrl+Alt+C)">⧉&#xFE0E;</button>
      <button data-est="guardar" style="${BTN}" title="guardar las capturas en un .js (Ctrl+Alt+D)">⤓&#xFE0E;</button>
      <button data-est="borrar" style="${BTN}" title="borrar la lista de capturas de esta canción">✕&#xFE0E;</button>
    </div>
  `
  const textoEstadoEl = estadosEl.querySelector('[data-texto]')
  let cartelActivo = true
  T.cartel = {
    mostrar(texto) {
      if (!cartelActivo) return
      textoEstadoEl.textContent = texto
      textoEstadoEl.style.display = texto ? '' : 'none'
    },
    get activo() { return cartelActivo },
    set activo(v) { cartelActivo = v; estadosEl.style.display = v ? '' : 'none' },
  }
  estadosEl.addEventListener('click', ev => {
    const b = ev.target.closest('[data-est]')
    if (!b) return
    const E = GP.estados
    if (!E) { console.warn('[GP tools] GP.estados no está cargado'); return }
    const acciones = {
      siguiente: () => E.siguiente(), anterior: () => E.anterior(),
      suspender: () => E.suspender(), reiniciar: () => E.reiniciar(),
      copiar: () => E.copiar(), guardar: () => E.guardarCapturas(), borrar: () => E.borrarCapturas(),
    }
    if (acciones[b.dataset.est]) acciones[b.dataset.est]()
    b.blur()   // que Espacio/Enter no vuelvan a apretarlo sin querer
  })
  // el botón ⏸ se pinta de amarillo mientras los estados están en pausa (con el atajo o la consola también)
  if (window._gpBotonesEstadosReloj) clearInterval(window._gpBotonesEstadosReloj)
  window._gpBotonesEstadosReloj = setInterval(() => {
    const susp = GP.estados ? !!GP.estados.suspendido : textoEstadoEl.textContent.startsWith('⏸')
    const b = estadosEl.querySelector('[data-est="suspender"]')
    if (b) { b.style.background = susp ? '#fc0' : '#1d1d1d'; b.style.color = susp ? '#000' : '#ddd' }
  }, 300)

  // compatibilidad con los sketches que llaman al ensayo.js viejo
  GP.ensayo = {
    _version: `unificado en GP.tools ${VERSION}`,
    overlayEstado: {
      mostrar: i => T.cartel.mostrar(`estado ${i + 1}`),
      get activo() { return T.cartel.activo },
      set activo(v) { T.cartel.activo = v },
    },
  }

  // ============================================================
  // 5. Atajos de teclado (no escriben en el editor)
  //    Ctrl+Alt+R grabar/detener · S detener · P mostrar/ocultar paneles · N lista de notas
  //    I informe de la canción (mapa MIDI)
  //    (se lee la tecla física: con AltGr en teclado español no se confunde con €, @, etc.)
  // ============================================================
  T.atajosTeclado = () => {
    if (window._gpToolsAtajos) window.removeEventListener('keydown', window._gpToolsAtajos, true)
    window._gpToolsAtajos = (e) => {
      if (!e.ctrlKey || !e.altKey) return
      const acciones = {
        KeyR: () => T.grabadorCiclo(),     // toggle grabar / detener+guardar
        KeyS: () => T.grabador.detener(),  // detener+guardar
        KeyP: () => T.paneles(),
        KeyN: () => T.notas(),
        KeyI: () => T.informe(),
      }
      const accion = acciones[e.code]
      if (!accion) return
      e.preventDefault()
      e.stopPropagation()
      accion()
    }
    window.addEventListener('keydown', window._gpToolsAtajos, true)
  }
  T.atajosTeclado()

  // conecta MIDI apenas se carga (graba y muestra aunque el sketch no haga nada)
  bus.conectar().then(acc => { if (bus.alCambiarPuertos.tools) bus.alCambiarPuertos.tools(acc) })
    .catch(err => console.warn('GP.tools: sin acceso MIDI', err))
})()
