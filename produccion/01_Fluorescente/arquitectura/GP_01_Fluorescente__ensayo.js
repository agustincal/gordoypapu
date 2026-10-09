// ============================================================
// GP_01_Fluorescente__ensayo.js
// Simulador de ensayo / Overlays visuales
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.ensayo && GP.ensayo._version === 'v1.0') return

  GP.ensayo = {
    _version: 'v1.0',
    overlayEstado: {
      mostrar: (idx) => {
        const p = GP.tools.panel()
        if (p) {
          const prev = p.style.color
          p.style.color = '#ff0'
          setTimeout(() => p.style.color = prev, 1000)
        }
      }
    }
  }
})()