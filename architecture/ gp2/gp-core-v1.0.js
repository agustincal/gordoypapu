// ======================================================
// G&P — GP CORE — v1.0
//
// Único archivo que el sketch necesita cargar. No contiene
// lógica de audio ni de MIDI — solo decide QUÉ módulos cargar
// y en qué orden. Así, tanto los stems como la controladora
// se pueden versionar/reemplazar sin tocar este archivo (o
// tocándolo mínimamente, solo para sumar una controladora
// nueva al mapa CONTROLLERS).
//
// Por ahora apunta a la rama "main" (la versión más simple para
// empezar). Más adelante, cuando tengas varios experimentos ya
// armados y no quieras que un cambio futuro los afecte, se puede
// "congelar" a una versión fija — no hace falta pensarlo todavía.
// ======================================================
;(function () {
  window.GP = window.GP || {}

  const REPO_REF = 'main'
  const BASE = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${REPO_REF}/architecture/gp2`

  const STEMS_URL = `${BASE}/gp-stems-v1.0.js`

  // Mapa de controladoras conocidas. Para sumar una nueva:
  // agregar una línea acá con el mismo patrón. También podés
  // pasar una URL propia directo en GP.init({ controller: '...' })
  // para probar una controladora nueva sin tocar este archivo.
  const CONTROLLERS = {
    akaimini: `${BASE}/gp-controller-akaimini-v1.0.js`
  }

  // song:       nombre de carpeta en /stems (ej: 'buscandoplacer')
  // stems:      lista opcional de nombres de stem (default bass/drums/synth/vocals)
  // controller: nombre corto del mapa CONTROLLERS, o una URL directa,
  //             o null/false para arrancar SIN controladora (solo audio)
  GP.init = async function ({ song, stems, controller = 'akaimini' } = {}) {
    if (!song) throw new Error('GP.init: falta "song"')

    await loadScript(STEMS_URL)
    await GP.audio.init({ song, stems })
    await GP.audio.start()

    if (controller) {
      const url = CONTROLLERS[controller] || controller
      await loadScript(url)
      await GP.midi.start()
    }

    return GP
  }

  window.GP.coreVersion = '1.0'
  console.info('[GP CORE] v1.0 cargado')
})()
