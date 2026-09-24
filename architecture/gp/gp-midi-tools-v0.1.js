;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP

  GP.tools = {}

  // ---- panel MIDI en pantalla ----
  let panelEl = null
  let lineas = []

  GP.tools.panel = () => {
    if (!panelEl) {
      panelEl = document.createElement('div')
      panelEl.id = 'gpMidiPanel'
      panelEl.style.cssText = `
        position: fixed; top: 8px; left: 8px; z-index: 99999;
        background: rgba(0,0,0,0.6); color: #0f0;
        font: 11px/1.4 monospace; padding: 6px 10px;
        max-width: 340px; white-space: pre; pointer-events: none;
      `
      document.body.appendChild(panelEl)
    }
    return panelEl
  }

  GP.tools.log = (nombre, data) => {
    const panel = GP.tools.panel()
    const [st, nota, vel] = data
    const canal = (st & 0x0f) + 1
    const tipo = st & 0xf0
    const nombreTipo = (tipo === 0x90 && vel > 0) ? 'on'
      : (tipo === 0x80 || (tipo === 0x90 && vel === 0)) ? 'off'
      : `0x${tipo.toString(16)}`
    lineas.push(`${nombre} · ch${canal} · ${nombreTipo} · nota=${nota} vel=${vel}`)
    if (lineas.length > 12) lineas.shift()
    panel.textContent = lineas.join('\n')
  }

  // ---- grabador de MIDI + audio en sincro (para tener una versión de ensayo offline) ----
  let grabando = false
  let grabacion = []
  let inicio = 0
  let audioRecorder = null
  let audioChunks = []

  GP.tools.grabador = {
    async iniciar() {
      if (grabando) return   // evita reiniciar si ya está grabando
      grabacion = []
      inicio = performance.now()
      grabando = true
      console.log('grabando MIDI...')

      audioChunks = []
      audioRecorder = null
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioRecorder = new MediaRecorder(stream)
        audioRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data) }
        audioRecorder.start()
        console.log('grabando audio... (mic OK)')
      } catch (err) {
        console.warn('NO se pudo grabar audio (revisar permiso de mic):', err)
      }
    },
    detener() {
      if (!grabando) return
      grabando = false
      console.log('grabación detenida,', grabacion.length, 'mensajes')
      if (audioRecorder && audioRecorder.state !== 'inactive') {
        audioRecorder.stop()
        audioRecorder.stream.getTracks().forEach(t => t.stop())
      } else {
        console.warn('no había audio activo para detener')
      }
    },
    registrar(nombre, data) {
      if (grabando) grabacion.push([performance.now() - inicio, nombre, [...data]])
    },
    descargar() {
      const ts = Date.now()

      const blobMidi = new Blob([JSON.stringify(grabacion)], { type: 'application/json' })
      const urlMidi = URL.createObjectURL(blobMidi)
      const aMidi = document.createElement('a')
      aMidi.href = urlMidi
      aMidi.download = `ensayo-midi-${ts}.json`
      aMidi.click()
      URL.revokeObjectURL(urlMidi)

      if (!audioChunks.length) {
        console.warn('no hay audio grabado para descargar (¿se habilitó el mic al iniciar?)')
        return
      }

      // pequeño delay para que el navegador no bloquee la segunda descarga
      setTimeout(() => {
        const blobAudio = new Blob(audioChunks, { type: 'audio/webm' })
        const urlAudio = URL.createObjectURL(blobAudio)
        const aAudio = document.createElement('a')
        aAudio.href = urlAudio
        aAudio.download = `ensayo-audio-${ts}.webm`
        aAudio.click()
        URL.revokeObjectURL(urlAudio)
      }, 300)
    }
  }

  // ---- atajos de teclado para el grabador: R=iniciar, S=detener, D=descargar ----
  let atajosInstalados = false
  GP.tools.atajosTeclado = () => {
    if (atajosInstalados) return
    atajosInstalados = true
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return   // ignora el auto-repeat si se mantiene la tecla apretada
      if (e.key === 'r' || e.key === 'R') GP.tools.grabador.iniciar()
      if (e.key === 's' || e.key === 'S') GP.tools.grabador.detener()
      if (e.key === 'd' || e.key === 'D') GP.tools.grabador.descargar()
    })
  }
})()