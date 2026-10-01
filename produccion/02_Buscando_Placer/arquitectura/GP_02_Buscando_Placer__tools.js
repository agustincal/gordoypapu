// ============================================================
// GP_02_Buscando_Placer__tools
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: panel MIDI en pantalla + grabador de audio/MIDI para ensayo
// Standalone · Cargado por: GP_02_Buscando_Placer__loader
// Actualizado: 2026-10-01
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP

  if (GP.tools && GP.tools._version === 'v0.5') {
    if (GP.tools._panelEl && !document.body.contains(GP.tools._panelEl)) {
      document.body.appendChild(GP.tools._panelEl)
    }
    return
  }
  GP.tools = { _version: 'v0.5' }

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
      GP.tools._panelEl = panelEl   // expuesto para poder reinsertarlo si se desprende del DOM
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

  // ---- grabador de MIDI + audio en sincro ----
  let grabando = false
  let grabacion = []
  let inicio = 0
  let audioRecorder = null
  let audioChunks = []
  let audioListo = Promise.resolve()

  GP.tools.grabador = {
    async iniciar() {
      if (grabando) return
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
        const recorder = audioRecorder
        audioListo = new Promise(resolve => {
          recorder.onstop = () => {
            console.log('audio listo,', audioChunks.length, 'chunks')
            resolve()
          }
        })
        recorder.stop()
        recorder.stream.getTracks().forEach(t => t.stop())
      } else {
        console.warn('no había audio activo para detener')
        audioListo = Promise.resolve()
      }
    },
    registrar(nombre, data) {
      if (grabando) grabacion.push([performance.now() - inicio, nombre, [...data]])
    },
    async descargar() {
      await audioListo
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

  // ---- control por un solo pad MIDI: cicla iniciar → detener → descargar ----
  let cicloEstado = 0   // 0 = listo para grabar, 1 = grabando, 2 = listo para descargar
  GP.tools.grabadorCiclo = () => {
    cicloEstado = (cicloEstado + 1) % 3
    if (cicloEstado === 1) GP.tools.grabador.iniciar()
    else if (cicloEstado === 2) GP.tools.grabador.detener()
    else GP.tools.grabador.descargar()
  }

  // ---- atajos de teclado: R=iniciar, S=detener, D=descargar ----
  GP.tools.atajosTeclado = () => {
    if (window._gpToolsAtajos) window.removeEventListener('keydown', window._gpToolsAtajos, true)
    window._gpToolsAtajos = (e) => {
      if (!e.ctrlKey || !e.altKey) return
      const k = e.key.toLowerCase()
      if (k !== 'r' && k !== 's' && k !== 'd') return
      e.preventDefault()
      e.stopPropagation()
      if (k === 'r') GP.tools.grabador.iniciar()
      if (k === 's') GP.tools.grabador.detener()
      if (k === 'd') GP.tools.grabador.descargar()
    }
    window.addEventListener('keydown', window._gpToolsAtajos, true)
  }
})()