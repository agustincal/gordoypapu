// ============================================================
// 03_Vociferan_v07.js
// Canción: 03_Vociferan (Gordo y Papu)
// Rol: sketch principal — sólo configuración + ruteo MIDI.
//      La lógica visual vive en arquitectura/GP_03_Vociferan__visual.js
// Actualizado: 14/10/2026 (v07: barrido de luz + multicolor con la voz, calibración de ruido del mic)
// ============================================================

// ---- versión de la arquitectura ----
// 'ultimo' = carga siempre el último commit subido a GitHub. No hace falta purgar:
//            después de cada push, recargá la página de Hydra y volvé a evaluar.
// Antes de un show: pegá acá el hash completo del commit que probaste
//            (GitHub Desktop → History → clic derecho → Copy SHA), así queda fijo.
let GP_SHA = 'ultimo'

if (GP_SHA === 'ultimo') {
  if (!window._vociferanSha) {
    try {
      const r = await fetch('https://api.github.com/repos/agustincal/gordoypapu/commits/main', { cache: 'no-store' })
      window._vociferanSha = (await r.json()).sha
    } catch (e) {}
  }
  GP_SHA = window._vociferanSha || 'main'
}
console.log('Vociferan: cargando arquitectura @' + GP_SHA)

// baja un archivo del repo y lo ejecuta. Primero directo de GitHub (está
// disponible apenas pusheás), si falla prueba jsDelivr. Si no llega, avisa.
window.GP_cargar = async (ruta, sha = GP_SHA) => {
  const urls = [
    `https://raw.githubusercontent.com/agustincal/gordoypapu/${sha}/${ruta}`,
    `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${sha}/${ruta}`,
  ]
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) continue
      const script = document.createElement('script')
      script.textContent = (await r.text()) + '\n//# sourceURL=' + url
      document.head.appendChild(script)
      return
    } catch (e) {}
  }
  throw new Error('No se pudo cargar ' + ruta + ' @' + sha + ' (ni de GitHub ni de jsDelivr)')
}

await GP_cargar('produccion/03_Vociferan/arquitectura/GP_03_Vociferan__loader.js')
await GP_cargarModulosVociferan(GP_SHA)

await GP.midi.start({ outputName: 'APC MINI' })
GP.tools.atajosTeclado()          // Ctrl+Alt+R graba, Ctrl+Alt+S detiene, Ctrl+Alt+D descarga
GP.tools.panel().textContent = 'esperando MIDI...'

const V = GP.vociferan


// ============================================================
// CONFIGURACIÓN VISUAL — se puede cambiar en vivo: V.C.release = 2
// ============================================================
V.init({
  // tamaño según la nota: grave = grande, agudo = chico
  notaGrave: 36, notaAguda: 84,
  radioGrave: 0.32, radioAgudo: 0.07,
  borde: 0.07,

  // color: cada disparo toma un tono cerca de 'hue' (+/- hueVar grados)
  hue: 20, hueVar: 8, sat: 1,
  paleta: [20, 110, 200, 290],       // los 4 golpes de paleta: rojo-naranja, verde, azul, violeta

  // vida de cada círculo
  entrada: 0.35,                     // segundos en llegar del borde al centro (notas de la canción)
  entradas: [0.15, 0.35, 0.8],       // Akai: rápido, medio, lento
  radioAkai: 0.22,                   // tamaño de los disparos laterales del Akai
  mantener: 0.5,                     // segundos que se queda entero en el centro
  release: 1.2,                      // segundos en desvanecerse
  huecoAlIrse: 0.8,                  // al irse se ahueca como aro
  escapeProb: 0.12,                  // chance de que se escape en vez de apagarse
  escapeDir: 1,                      // 1 = arriba, -1 = abajo

  // golpe central
  golpeDur: 0.4, golpeRadio: 1.3, golpeLuz: 1.8,

  // fluctuación suave de intensidad
  fluct: 0.25, fluctVel: 3,

  // micrófono: temblor de la luz
  micPos: 0.06, micLuz: 0.9, micTam: 0.25, micUmbral: 0.15,

  // voz: franja de luz que recorre cada círculo, sólo mientras hay voz
  barridoFuerza: 0.8,                // cuánto oscurece la franja (0 = sin efecto)
  barridoVel: 4,                     // qué tan rápido corre con la voz
  multicolor: 0.7,                   // 0 = una franja, 1 = tres franjas de tonos vecinos
  mostrarMic: true,                  // barras del mic en pantalla para calibrar

  // strobe rojo (ojo fotosensibilidad en vivo)
  strobeBombo: true,                 // un golpe por cada nota del canal de bombo
  strobeClock: false,                // golpes con patrón sobre el clock MIDI
  strobePatron: 'X.X.X...........',  // X = golpe, . = nada
  strobeRes: 3,                      // ticks por paso: 3 fusa, 6 semicorchea, 12 corchea
  flashDur: 0.045,

  demo: false,                       // true = notas falsas para probar sin MIDI
})


// ============================================================
// RUTEO MIDI — qué control dispara qué
// Nombre Akai N<fila><columna> → nota = (fila-1)*8 + (columna-1)
// ============================================================
const KORG = {
  canalMelodia: 1,     // notas → círculos que entran por los costados
  canalBombo: 10,      // golpes → strobe
  canalEscena: 16,     // reservado para cambio de escena/estado (todavía sin acción)
}

// Grilla del Akai: la COLUMNA dice qué tipo de disparo, la FILA dice el color.
//
//              col 1    col 2    col 3    col 4   col 5    col 6    col 7    col 8
//              izq      izq      izq      golpe   der      der      der      escape
//              rápido   medio    lento    centro  rápido   medio    lento    arr/abajo
//   fila 8  →  color 1 de la paleta (rojo-naranja)
//   fila 7  →  color 2 (verde)
//   fila 6  →  color 3 (azul)
//   fila 5  →  color 4 (violeta)
//
// Los laterales y los escapes salen del color de su fila SÓLO ese disparo.
// La columna 4 (golpe) además cambia la paleta de los círculos de la canción.
const AKAI = {
  grabador: 98,        // cicla grabar → detener → descargar
  ocultar: 89,         // oculta/muestra código y paneles
  calibrarMic: 88,     // escucha 3 s de ambiente SIN voz y limpia ese ruido del mic
  filasColor: { 8: 0, 7: 1, 6: 2, 5: 3 },
  columnas: {
    1: { lado: -1, velocidad: 0 },
    2: { lado: -1, velocidad: 1 },
    3: { lado: -1, velocidad: 2 },
    4: { golpe: true },
    5: { lado: 1, velocidad: 0 },
    6: { lado: 1, velocidad: 1 },
    7: { lado: 1, velocidad: 2 },
    8: { escape: true, velocidad: 1 },
  },
}

if (window._vociferanMidi) window._vociferanMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._vociferanMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const esAkai = /apc|akai/i.test(inp.name)

    const fn = m => {
      const [st, nota, vel] = m.data
      GP.tools.grabador.registrar(inp.name, m.data)

      // mensajes de sistema: clock y play
      if (st === 0xF8) { V.tickClock(); return }
      if (st === 0xFA) { V.reiniciarClock(); return }
      if (st >= 0xF0) return

      GP.tools.log(inp.name, m.data)

      const tipo = st & 0xF0
      const canal = (st & 0x0F) + 1
      const on = tipo === 0x90 && vel > 0
      const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)

      // ---- Akai ----
      if (esAkai) {
        if (nota === AKAI.grabador) { if (on) GP.tools.grabadorCiclo(); return }
        if (nota === AKAI.ocultar)  { if (on) V.toggleCodigo(); return }
        if (nota === AKAI.calibrarMic) { if (on) V.calibrarMic(); return }

        if (nota > 63) return
        const fila = Math.floor(nota / 8) + 1
        const col = (nota % 8) + 1
        const color = AKAI.filasColor[fila]
        const accion = AKAI.columnas[col]
        if (color == null || !accion) return

        if (accion.golpe) {
          if (on) V.golpePaleta(color)
          else if (off) V.notaOff(2000 + color)
        } else {
          if (on) V.disparo(3000 + nota, 110, { ...accion, color })
          else if (off) V.notaOff(3000 + nota)
        }
        return
      }

      // ---- padKONTROL / DAW ----
      if (canal === KORG.canalEscena) return   // reservado
      if (canal === KORG.canalBombo) { if (on && V.C.strobeBombo) V.golpe(); return }
      if (canal === KORG.canalMelodia) {
        if (on) V.notaOn(nota, vel)
        else if (off) V.notaOff(nota)
      }
    }

    inp.addEventListener('midimessage', fn)
    window._vociferanMidi.push([inp, fn])
  })
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0)
render(o0)
