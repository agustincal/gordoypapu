;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.ensayo && GP.ensayo._version === 'v0.2') return
  GP.ensayo = { _version: 'v0.2' }

  let grabacion = null
  let audioEl = null
  let salidaKorg = null
  let salidaAkai = null

  const panel = document.createElement('div')
  panel.id = 'gpEnsayoPanel'
  panel.style.cssText = `
    position: fixed; bottom: 8px; left: 8px; z-index: 99999;
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
    if (!salidaKorg) console.warn('no encontré puerto MIDI virtual para padKONTROL (el nombre debe contener "korg" o "padkontrol")')
    if (!salidaAkai) console.warn('no encontré puerto MIDI virtual para APC/Akai (el nombre debe contener "apc" o "akai")')
    return salidaKorg || salidaAkai
  }

  panel.querySelector('#gpEnsayoPlay').addEventListener('click', async () => {
    if (!grabacion) { setEstado('falta cargar el JSON de MIDI'); return }
    const hayAlgunaSalida = await buscarSalidas()
    if (!hayAlgunaSalida) { setEstado('no hay puertos MIDI virtuales — revisá loopMIDI'); return }

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
})()