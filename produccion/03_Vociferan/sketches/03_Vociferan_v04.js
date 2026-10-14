// ============================================================
// 03_Vociferan_v04.js
// Canción: 03_Vociferan (Gordo y Papu)
// Rol: sketch principal — sólo configuración + ruteo MIDI.
//      La lógica visual vive en arquitectura/GP_03_Vociferan__visual.js
// Actualizado: 14/10/2026
// ============================================================

// ---- versión de la arquitectura ----
// 'main' mientras iterás (purgar jsDelivr + recargar después de cada push).
// Antes de un show: hash completo del commit (git rev-parse HEAD).
const GP_SHA = '4452c259a2e90ed2cef525fece2c91c7ef1125b3'  //volver a = 'main' cuando este terminado

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/03_Vociferan/arquitectura/GP_03_Vociferan__loader.js`)
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
  entrada: 0.35,                     // segundos en llegar del borde al centro
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

const AKAI = {
  grabador: 98,        // cicla grabar → detener → descargar
  ocultar: 89,         // oculta/muestra código y paneles
  filaDisparo: 56,     // primer pad de la fila 8 (N81). Pads 1-4: derecha, izquierda, abajo, golpe
  golpesPaleta: { 59: 0, 51: 1, 43: 2, 35: 3 },   // N84, N74, N64, N54 → color 1..4 de la paleta
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

        if (nota in AKAI.golpesPaleta) {
          const i = AKAI.golpesPaleta[nota]
          if (on) V.golpePaleta(i)
          else if (off) V.notaOff(2000 + i)
          return
        }

        const pad = nota - AKAI.filaDisparo
        if (pad >= 0 && pad <= 7) {
          if (on) V.padAkai(pad)
          else if (off) V.notaOff(1000 + pad)
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
