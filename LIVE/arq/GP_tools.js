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
// Actualizado: 2026-10-20 (v1.9: informe de canción · ensayo con varios aparatos · canal de estados)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1.9'

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
      position: fixed; z-index: 2147483647;
      background: rgba(0,0,0,0.7); color: #fff;
      font: 11px/1.4 monospace; padding: 5px 8px; border-radius: 4px;
      ${css}
    `
    document.body.appendChild(el)
    elementos.push(el)
    return el
  }
  T._reinsertar = () => elementos.forEach(el => {
    if (!document.body.contains(el)) document.body.appendChild(el)
  })

  let panelesVisibles = true
  T.paneles = (visible = !panelesVisibles) => {
    panelesVisibles = visible
    elementos.forEach(el => { el.style.display = visible ? '' : 'none' })
  }

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
    const musicales = lista.filter(c => c.n > 0 && !esEst(c) && !esAPC(c.aparato))
    if (musicales.length) {
      L.push('', '## Notas de cada canal')
      for (const c of musicales) L.push(`- ${c.aparato} canal ${c.ch}: ${[...c.notas.keys()].sort((a, b) => a - b).join(' ')}`)
      L.push('', '## Sugerencia para GP.midi.filas (los más tocados arriba)', '', '```js', 'GP.midi.filas({')
      const orden = [...musicales].sort((a, b) => b.n - a.n)
      ;[8, 7, 6, 5, 4].forEach((fila, i) => {
        const c = orden[i]
        if (!c) { L.push(`  ${fila}: null,`); return }
        const notas = [...c.notas.keys()].sort((a, b) => a - b)
        const como = notas.length <= 2 ? `pulso: 'vuelta'` : notas.length <= 8 ? `notas: [${notas.join(', ')}]` : `rango: [${notas[0]}, ${notas[notas.length - 1]}]`
        L.push(`  ${fila}: { puerto: ${regexDe(c.aparato)}, canal: ${c.ch}, ${como} },   // ${c.n} notas`)
      })
      L.push('})', '```')
      if (orden.length > 5) L.push('', `Quedaron afuera (hay 5 filas): ${orden.slice(5).map(c => `${c.aparato} ch${c.ch} (${c.n})`).join(', ')}.`)
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
  // 2. Grabador: MIDI + micrófono + video de Hydra (abajo a la derecha)
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
    bottom: 8px; right: 8px; font: bold 13px/1.4 monospace; pointer-events: none;
  `)

  const ESTILOS = {
    listo:     { fondo: 'rgba(0,0,0,0.7)', texto: '○ REC listo' },
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
      partes = ['midi']
      const esperas = []

      // micrófono sin procesar (sin cancelación de eco ni control de volumen: es música)
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        })
        recAudio = nuevoGrabador(micStream, ['audio/webm;codecs=opus', 'audio/webm'],
          {}, chunksAudio, esperas)
        partes.push('mic')
      } catch (err) {
        console.warn('GP.tools: no se pudo grabar el mic (¿permiso?):', err)
      }

      // video del canvas de Hydra, con el audio del mic adentro
      if (cfg.grabarVideo) {
        const canvas = canvasHydra()
        if (canvas) {
          try {
            videoTrack = canvas.captureStream(cfg.fps).getVideoTracks()[0]
            const pistas = [videoTrack, ...(micStream ? micStream.getAudioTracks() : [])]
            recVideo = nuevoGrabador(new MediaStream(pistas),
              ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
              { videoBitsPerSecond: cfg.videoBitrate }, chunksVideo, esperas)
            partes.push('video')
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
        bajar(new Blob(chunksVideo, { type: 'video/webm' }), `${base}_video.webm`)
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
  // 3. Reproductor de ensayo (abajo a la izquierda, compacto)
  // ============================================================
  let midiEnsayo = null
  let audioEl = null
  let salidas = []
  let programados = []

  const ensayoEl = crearCaja('gpEnsayoPanel', `
    bottom: 8px; left: 8px; display: flex; align-items: center; gap: 6px;
  `)
  // botones midi / audio: gris = vacío · verde = cargado
  const BOTON = `cursor:pointer; border:1px solid #888; border-radius:3px; padding:1px 6px;`
  ensayoEl.innerHTML = `
    <label data-carga="midi" style="${BOTON}" title="cargar .json de MIDI">
      midi<input type="file" accept=".json" style="display:none">
    </label>
    <label data-carga="audio" style="${BOTON}" title="cargar audio (.webm / .mp3 / .wav)">
      audio<input type="file" accept=".webm,audio/*,video/webm" style="display:none">
    </label>
    <button data-accion="play" style="font:inherit; padding:0 6px;">▶</button>
    <button data-accion="stop" style="font:inherit; padding:0 6px;">■</button>
    <span data-estado></span>
  `
  const estadoEnsayo = ensayoEl.querySelector('[data-estado]')
  const setEnsayo = t => { estadoEnsayo.textContent = t }
  const botonMidi = ensayoEl.querySelector('[data-carga="midi"]')
  const botonAudio = ensayoEl.querySelector('[data-carga="audio"]')

  const marcar = (boton, estadoCarga, nombreArchivo = '') => {
    const colores = {
      vacio:  { fondo: 'transparent', borde: '#888', texto: '#fff' },
      ok:     { fondo: '#0a0',        borde: '#0c0', texto: '#000' },
      error:  { fondo: '#b00',        borde: '#e00', texto: '#fff' },
    }[estadoCarga]
    boton.style.background = colores.fondo
    boton.style.borderColor = colores.borde
    boton.style.color = colores.texto
    if (nombreArchivo) boton.title = nombreArchivo   // pasando el mouse se ve qué archivo es
  }

  const duracion = ms => {
    const s = Math.round(ms / 1000)
    return `${Math.floor(s / 60)}:${dosDigitos(s % 60)}`
  }
  const resumenEnsayo = () => midiEnsayo ? duracion(midiEnsayo[midiEnsayo.length - 1][0]) : ''

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
        marcar(botonMidi, 'ok', file.name)
        setEnsayo(resumenEnsayo())
      } catch (err) {
        midiEnsayo = null
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
    audioEl = new Audio(URL.createObjectURL(file))   // sin barra: lo maneja ▶/■
    audioEl.onended = () => setEnsayo(`fin ${resumenEnsayo()}`)
    audioEl.onerror = () => { audioEl = null; marcar(botonAudio, 'error', file.name) }
    marcar(botonAudio, 'ok', file.name)
  })

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

  const detenerProgramados = () => {
    programados.forEach(id => clearTimeout(id))
    programados = []
  }

  const detenerEnsayo = () => {
    detenerProgramados()
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0 }
  }

  ensayoEl.querySelector('[data-accion="play"]').addEventListener('click', async () => {
    try {
      if (!midiEnsayo) { setEnsayo('falta midi'); return }
      if (!(await buscarSalidas())) { setEnsayo('sin puertos loopMIDI'); return }

      detenerEnsayo()   // nunca se suman dos reproducciones
      const ruta = new Map()       // aparato grabado → puerto de ensayo
      for (const [, n] of midiEnsayo) if (!ruta.has(n)) ruta.set(n, salidaPara(n))
      const faltan = [...ruta].filter(([, o]) => !o).map(([n]) => n)
      let enviados = 0
      midiEnsayo.forEach(([ms, nombreOriginal, bytes]) => {
        const salida = ruta.get(nombreOriginal)
        if (!salida) return
        programados.push(setTimeout(() => salida.send(bytes), ms))
        enviados++
      })
      if (audioEl) audioEl.play()
      console.info('GP.tools ensayo:', [...ruta].map(([n, o]) => `${n} → ${o ? o.name : 'SIN PUERTO'}`).join(' · '))
      if (faltan.length) {
        console.warn(`GP.tools ensayo: no hay puerto para ${faltan.join(', ')}. Creá en loopMIDI un puerto "<palabra>_Ensayo" con una palabra de ese nombre (ej: ${soloLetras(faltan[0]).slice(0, 8)}_Ensayo) y reiniciá Chrome entero.`)
        setEnsayo(`▶ ${resumenEnsayo()} · sin puerto: ${faltan.map(n => n.slice(0, 12)).join(', ')}`)
      } else setEnsayo(`▶ ${resumenEnsayo()}`)
    } catch (err) {
      setEnsayo(`error: ${err.message}`)
      console.error('GP.tools ensayo:', err)
    }
  })

  ensayoEl.querySelector('[data-accion="stop"]').addEventListener('click', () => {
    detenerEnsayo()
    setEnsayo(`■ ${resumenEnsayo()}`)
  })

  // ============================================================
  // 4. Cartel (arriba a la derecha) — ej: número de estado
  // ============================================================
  let cartelEl = null
  let cartelActivo = true
  T.cartel = {
    mostrar(texto) {
      if (!cartelActivo) return
      if (!cartelEl) cartelEl = crearCaja('gpOverlayEstado', `
        top: 8px; right: 8px; font: bold 28px/1 monospace; padding: 10px 16px; pointer-events: none;
      `)
      cartelEl.textContent = texto
    },
    get activo() { return cartelActivo },
    set activo(v) { cartelActivo = v; if (cartelEl) cartelEl.style.display = v ? '' : 'none' },
  }

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
