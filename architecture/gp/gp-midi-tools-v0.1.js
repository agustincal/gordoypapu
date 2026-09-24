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

  // ---- grabador de MIDI (para tener una versión de ensayo offline) ----
  let grabando = false
  let grabacion = []
  let inicio = 0

  GP.tools.grabador = {
    iniciar() {
      grabacion = []
      inicio = performance.now()
      grabando = true
      console.log('grabando MIDI...')
    },
    detener() {
      grabando = false
      console.log('grabación detenida,', grabacion.length, 'mensajes')
    },
    registrar(nombre, data) {
      if (grabando) grabacion.push([performance.now() - inicio, nombre, [...data]])
    },
    descargar() {
      const blob = new Blob([JSON.stringify(grabacion)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ensayo-midi-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // ---- atajos de teclado para el grabador: R=iniciar, S=detener, D=descargar ----
  let atajosInstalados = false
  GP.tools.atajosTeclado = () => {
    if (atajosInstalados) return
    atajosInstalados = true
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') GP.tools.grabador.iniciar()
      if (e.key === 's' || e.key === 'S') GP.tools.grabador.detener()
      if (e.key === 'd' || e.key === 'D') GP.tools.grabador.descargar()
    })
  }
})()