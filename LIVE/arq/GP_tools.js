// ============================================================
// GP_tools  ·  LIVE/arq/GP_tools.js
// Genérico · sirve para todas las canciones (Gordo y Papu)
// Rol: panel MIDI + grabador (MIDI + mic + video de Hydra) + reproductor de ensayo
// Reemplaza a __tools.js + __ensayo.js · Sólo para ensayo: no se carga en el show
// Uso:  GP.tools.init({ cancion: '03_Vociferan' })
//       GP.tools.conectarMidi({ alMensaje: (nombre, data) => { ... } })
//       (graba, muestra en el panel, maneja el pad 98 y su LED; seguro al reevaluar)
//       y en el handler MIDI del sketch:  GP.tools.midi(entrada.name, msg.data)
// Actualizado: 2026-10-16 (v1.3: una sola conexión MIDI aunque se reevalúe el sketch)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1.3'

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
    padGrabador: 98,        // nota del Akai que hace grabar / detener+guardar (null = ninguno)
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
  let panelEl = null
  let lineas = []

  T.panel = () => {
    if (!panelEl) {
      panelEl = crearCaja('gpMidiPanel', `
        top: 8px; left: 8px; color: #0f0; max-width: 340px;
        white-space: pre; pointer-events: none;
      `)
      panelEl.textContent = 'esperando MIDI...'
    }
    return panelEl
  }

  T.log = (nombre, data) => {
    const panel = T.panel()
    const [st, d1, d2] = data
    const canal = (st & 0x0f) + 1
    const tipo = st & 0xf0
    const nombreTipo = (tipo === 0x90 && d2 > 0) ? 'on'
      : (tipo === 0x80 || (tipo === 0x90 && d2 === 0)) ? 'off'
      : tipo === 0xb0 ? 'cc'
      : `0x${tipo.toString(16)}`
    lineas.push(`${nombre} · ch${canal} · ${nombreTipo} · ${d1} · ${d2}`)
    if (lineas.length > 12) lineas.shift()
    panel.textContent = lineas.join('\n')
  }

  // atajo para el sketch: graba todo y muestra lo que no es clock/sistema
  T.midi = (nombre, data) => {
    T.grabador.registrar(nombre, data)
    if (data[0] < 0xf0) T.log(nombre, data)
  }

  // ---- conexión MIDI única ----
  // El MIDIAccess se pide UNA vez por página y se guarda en window. Al reevaluar el
  // sketch sólo se reemplaza la función alMensaje: nunca se acumulan handlers
  // (antes, cada reevaluación sumaba otra conexión → mensajes y pad 98 duplicados).
  const esAkaiReal = n => /apc|akai/i.test(n) && !/ensayo/i.test(n)
  T.accesoMidi = () => {
    if (!window._gpMidiAcc) window._gpMidiAcc = navigator.requestMIDIAccess()
    return window._gpMidiAcc
  }
  T.conectarMidi = async ({ alMensaje = null, alConectar = null } = {}) => {
    T._alMensaje = alMensaje
    T._alConectar = alConectar
    const acc = await T.accesoMidi()
    const conectar = () => {
      acc.inputs.forEach(entrada => {
        if (entrada.state !== 'connected') return
        entrada.onmidimessage = (msg) => {
          const data = msg.data
          T.midi(entrada.name, data)
          const esNoteOn = (data[0] & 0xf0) === 0x90 && data[2] > 0
          if (esNoteOn && data[1] === cfg.padGrabador && /apc|akai/i.test(entrada.name)) T.grabadorCiclo()
          if (T._alMensaje) T._alMensaje(entrada.name, data)
        }
      })
      T.led.salida = null
      acc.outputs.forEach(o => { if (o.state === 'connected' && esAkaiReal(o.name)) T.led.salida = o })
      T.led.pintar()
      if (T._alConectar) T._alConectar(acc)
    }
    acc.onstatechange = conectar
    conectar()
    return acc
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
    nota: 98,
    on: 4,             // mismo esquema que midibase: 4 = prendido
    off: 1,            //                             1 = apagado
    parpadeoMs: 400,
  }
  let ledPrendido = null
  const mandarLed = (prender) => {
    if (!T.led.salida || ledPrendido === prender) return
    ledPrendido = prender
    try { T.led.salida.send([0x90, T.led.nota, prender ? T.led.on : T.led.off]) } catch (e) {}
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

    registrar(nombre, data) {
      if (estado === 'grabando') grabacion.push([performance.now() - inicio, nombre, [...data]])
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
  let salidaKorg = null
  let salidaAkai = null
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
        midiEnsayo = JSON.parse(reader.result)
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
    salidaKorg = salidaAkai = null
    acc.outputs.forEach(o => {
      if (o.state !== 'connected') return
      if (/korg|padkontrol/i.test(o.name)) salidaKorg = o
      if (/apc|akai/i.test(o.name)) salidaAkai = o
    })
    return salidaKorg || salidaAkai
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
      let enviados = 0
      midiEnsayo.forEach(([ms, nombreOriginal, bytes]) => {
        const salida = /korg|padkontrol/i.test(nombreOriginal) ? salidaKorg : salidaAkai
        if (!salida) return
        programados.push(setTimeout(() => salida.send(bytes), ms))
        enviados++
      })
      if (audioEl) audioEl.play()
      setEnsayo(`▶ ${resumenEnsayo()}`)
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
  //    Ctrl+Alt+R grabar/detener · S detener · P mostrar/ocultar paneles
  // ============================================================
  T.atajosTeclado = () => {
    if (window._gpToolsAtajos) window.removeEventListener('keydown', window._gpToolsAtajos, true)
    window._gpToolsAtajos = (e) => {
      if (!e.ctrlKey || !e.altKey) return
      const acciones = {
        r: () => T.grabadorCiclo(),     // toggle grabar / detener+guardar
        s: () => T.grabador.detener(),  // detener+guardar
        p: () => T.paneles(),
      }
      const accion = acciones[e.key.toLowerCase()]
      if (!accion) return
      e.preventDefault()
      e.stopPropagation()
      accion()
    }
    window.addEventListener('keydown', window._gpToolsAtajos, true)
  }
  T.atajosTeclado()
})()
