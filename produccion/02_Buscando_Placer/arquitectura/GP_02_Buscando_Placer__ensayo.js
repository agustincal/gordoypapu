// ============================================================
// GP_02_Buscando_Placer__ensayo
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: reproductor de ensayo — reinyecta MIDI grabado (.json) y audio (.webm) sin hardware
// Cargado por: GP_02_Buscando_Placer__loader · Descartable después del ensayo
// Actualizado: 2026-09-27
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP

  if (GP.ensayo && GP.ensayo._version === 'v0.4') {
    // el módulo ya está cargado — solo nos aseguramos de que el panel siga visible y al frente
    if (GP.ensayo._panelEl) document.body.appendChild(GP.ensayo._panelEl)
    if (GP.ensayo.overlayEstado && GP.ensayo.overlayEstado._el) document.body.appendChild(GP.ensayo.overlayEstado._el) // nuevo
    return
  }
  GP.ensayo = { _version: 'v0.4' }

  let grabacion = null
  let audioEl = null
  let salidaKorg = null
  let salidaAkai = null

  const panel = document.createElement('div')
  panel.id = 'gpEnsayoPanel'
  panel.style.cssText = `
    position: fixed; bottom: 8px; left: 8px; z-index: 2147483647;
    background: rgba(0,0,0,0.75); color: #fff; font: 12px/1.5 monospace;
    padding: 10px 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 6px;
  `
  panel.innerHTML = `
    <div>grabación MIDI: <input type="file" id="gpEnsayoJson" accept=".json"></div>
    <div>audio del ensayo: <input type="file" id="gpEnsayoAudio" accept=".webm,audio/*"></div>
    <div id="gpEnsayoEstado">esperando archivos...</div>
    <div style="display:flex; gap:6px;">
      <button id="gpEnsayoPlay">▶ reproducir ensayo</button>
      <button id="gpEnsayoStop">■ detener</button>
    </div>
  `
  document.body.appendChild(panel)
  GP.ensayo._panelEl = panel

  const estado = panel.querySelector('#gpEnsayoEstado')
  const setEstado = (t) => { estado.textContent = t }

  panel.querySelector('#gpEnsayoJson').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      grabacion = JSON.parse(reader.result)
      setEstado(`${grabacion.length} mensajes MIDI cargados (${(grabacion[grabacion.length-1][0]/1000).toFixed(1)}s)`)
    }
    reader.readAsText(file)
  })

  panel.querySelector('#gpEnsayoAudio').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (audioEl) audioEl.remove()
    audioEl = new Audio(URL.createObjectURL(file))
    audioEl.controls = true
    audioEl.style.cssText = 'width: 260px;'
    panel.appendChild(audioEl)
  })

  const buscarSalidas = async () => {
    const acc = await navigator.requestMIDIAccess()
    salidaKorg = null
    salidaAkai = null
    acc.outputs.forEach(o => {
      if (/korg|padkontrol/i.test(o.name)) salidaKorg = o
      if (/apc|akai/i.test(o.name)) salidaAkai = o
    })
    if (!salidaKorg) console.warn('no encontré puerto MIDI virtual para padKONTROL (nombre debe contener "korg" o "padkontrol")')
    if (!salidaAkai) console.warn('no encontré puerto MIDI virtual para APC/Akai (nombre debe contener "apc" o "akai")')
    return salidaKorg || salidaAkai
  }

  panel.querySelector('#gpEnsayoPlay').addEventListener('click', async () => {
    if (!grabacion) { setEstado('falta cargar el JSON de MIDI'); return }
    const hayAlgunaSalida = await buscarSalidas()
    if (!hayAlgunaSalida) { setEstado('no hay puertos MIDI virtuales — revisá loopMIDI'); return }

    // limpiar cualquier reproducción anterior todavía en curso antes de programar una nueva
    if (salidaKorg) salidaKorg.clear()
    if (salidaAkai) salidaAkai.clear()
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0 }

    const inicio = performance.now()
    let enviados = 0
    grabacion.forEach(([ms, nombreOriginal, bytes]) => {
      const esKorgMsg = /korg|padkontrol/i.test(nombreOriginal)
      const salida = esKorgMsg ? salidaKorg : salidaAkai
      if (!salida) return
      salida.send(bytes, inicio + ms)
      enviados++
    })
    setEstado(`reproduciendo: ${enviados}/${grabacion.length} mensajes programados`)
    if (audioEl) audioEl.play()
  })

  panel.querySelector('#gpEnsayoStop').addEventListener('click', () => {
    if (salidaKorg) salidaKorg.clear()
    if (salidaAkai) salidaAkai.clear()
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0 }
    setEstado('detenido')
  })

GP.ensayo.overlayEstado = (function () {
  let el = null
  let activo = true // podés apagarlo en consola: GP.ensayo.overlayEstado.activo = false

  function crearElemento() {
    el = document.createElement('div')
    el.id = 'gpOverlayEstado'
    el.style.cssText = `
      position: fixed; top: 8px; right: 8px; z-index: 2147483647;
      background: rgba(0,0,0,0.75); color: #fff; font: bold 28px/1 monospace;
      padding: 10px 16px; border-radius: 6px; pointer-events: none;
    `
    document.body.appendChild(el)
  }

  function mostrar(indice) {
    if (!activo) return
    if (!el) crearElemento()
    if (!document.body.contains(el)) document.body.appendChild(el)
    el.textContent = `estado ${indice + 1}` // +1 porque estadoActual es 0-indexado
  }

  return {
    mostrar,
    get _el() { return el },
    get activo() { return activo },
    set activo(v) { activo = v; if (el) el.style.display = v ? '' : 'none' }
  }
})()

})()   // <- este es el que faltaba: cierra el IIFE de todo el archivo (el que abre en la línea 9)
