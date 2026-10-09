// ============================================================
// GP_01_Fluorescente__tools.js
// Herramientas de log y grabador de ensayos
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.tools && GP.tools._version === 'v1.0') return

  const panelDiv = document.createElement('div')
  panelDiv.style.position = 'fixed'
  panelDiv.style.bottom = '10px'
  panelDiv.style.left = '10px'
  panelDiv.style.zIndex = '9999'
  panelDiv.style.background = 'rgba(0,0,0,0.7)'
  panelDiv.style.color = '#0ff'
  panelDiv.style.padding = '8px 12px'
  panelDiv.style.fontFamily = 'monospace'
  panelDiv.style.fontSize = '12px'
  panelDiv.style.borderRadius = '4px'
  document.body.appendChild(panelDiv)

  GP.tools = {
    _version: 'v1.0',
    panel: () => panelDiv,
    log: (disp, data) => {
      panelDiv.textContent = `MIDI [${disp}] -> [${data.join(', ')}]`
    },
    grabador: {
      registrar: (disp, data) => {}
    },
    grabadorCiclo: () => {
      console.log('Grabador de ciclo alternado.')
    }
  }
})()