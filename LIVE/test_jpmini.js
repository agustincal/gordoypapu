// ============================================================
// test_jpmini
// Prueba de luces de la JAMJUM JP-Mini (preset 1) por Bluetooth.
// No usa GP_midi ni GP_tools.
// Actualizado: 2026-10-30
//
// Antes (una sola vez):
//   - loopMIDI: crear un puerto  jpmini_luces
//   - BLE-MIDI Connect → JP-Mini → ajustes:
//       Enviar  = jpmini        (lo que tocás → Hydra)
//       Recibir = jpmini_luces  (Hydra → luces)   ¡nunca el mismo puerto en los dos!
//   - Reiniciar Chrome (chrome://restart)
//
// Cómo usarlo:
//   1. Evaluá todo.
//   2. Tocá un pad: su luz pasa por varios valores (y canales). La caja dice
//      cuál está probando: anotá qué color ves en cada uno.
//   3. En la consola:
//        paleta(36)     recorre los 128 valores en el pad 1 del bank 1 (≈ 30 s)
//        pruebaTodo()   prende uno por uno los 48 pads (los 3 banks)
//        apagarTodo()
// ============================================================

const ENTRADA = /^jpmini$/i          // el puerto donde BLE-MIDI Connect "envía"
const SALIDA = /jpmini_luces/i       // el puerto donde BLE-MIDI Connect "recibe"
const CANAL = 9                      // canal 10 (0 = canal 1)
const BANKS = [[36, 'bank 1 · naranja'], [52, 'bank 2 · verde'], [68, 'bank 3 · celeste']]
// valores que se prueban en cada pad: muchas controladoras usan el valor como número de color
const PASOS = [127, 1, 5, 9, 13, 17, 21, 29, 37, 45, 49, 53, 60, 64, 79, 96, 0]
const MS_PASO = 700

// ---- caja (fuera del <body>, así Hydra no la borra) ----
const caja = document.getElementById('jpTest') || document.createElement('div')
caja.id = 'jpTest'
caja.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;background:rgba(0,0,0,.8);color:#ddd;font:13px/1.5 monospace;padding:8px 12px;border-radius:4px;max-width:560px;white-space:pre-wrap'
document.documentElement.appendChild(caja)
if (window._jpObs) window._jpObs.disconnect()
window._jpObs = new MutationObserver(() => { if (!caja.isConnected) document.documentElement.appendChild(caja) })
window._jpObs.observe(document.documentElement, { childList: true })
caja.textContent = 'JP-Mini · pidiendo acceso MIDI…'

let acc
try { acc = window._jpAcc = window._jpAcc || await navigator.requestMIDIAccess({ sysex: false }) }
catch (err) { caja.textContent = `no pude abrir el MIDI: ${err.message}`; throw err }

const padDe = (n) => {
  for (let b = BANKS.length - 1; b >= 0; b--) if (n >= BANKS[b][0] && n < BANKS[b][0] + 16) return `${BANKS[b][1]} · PAD ${n - BANKS[b][0] + 1}`
  return `nota ${n}`
}
let lineas = []
const salidas = () => [...acc.outputs.values()].filter(o => SALIDA.test(o.name))
const mostrar = (txt) => {
  lineas.unshift(txt); lineas = lineas.slice(0, 8)
  caja.textContent =
    `entradas: ${[...acc.inputs.values()].map(i => i.name).join(' · ') || 'ninguna'}\n` +
    `salidas: ${[...acc.outputs.values()].map(o => o.name).join(' · ') || 'ninguna'}\n` +
    `luces a: ${salidas().map(o => o.name).join(' + ') || 'NINGUNA (¿creaste jpmini_luces?)'}\n\n` + lineas.join('\n')
  console.log('[JP]', txt)
}
const mandar = (bytes) => salidas().forEach(o => { try { o.send(bytes) } catch (e) { mostrar(`ERROR al mandar: ${e.message}`) } })
const espera = ms => new Promise(r => setTimeout(r, ms))

// ---- probar un pad: valores en el canal 10, y después el mismo color en otros canales ----
const timers = {}
const probarPad = (nota) => {
  clearTimeout(timers[nota])
  const pasos = [
    ...PASOS.map(v => [CANAL, v, `canal 10 · valor ${v}`]),
    [0, 127, 'canal 1 · valor 127'], [1, 127, 'canal 2 · valor 127'], [5, 127, 'canal 6 · valor 127'],
    [15, 127, 'canal 16 · valor 127'], [CANAL, 0, 'apagado'],
  ]
  let i = 0
  const paso = () => {
    const [ch, v, txt] = pasos[i]
    mandar([0x90 | ch, nota, v])
    mostrar(`${padDe(nota)} (nota ${nota}) → ${txt}`)
    if (++i < pasos.length) timers[nota] = setTimeout(paso, MS_PASO)
  }
  paso()
}

// ---- entrada ----
const entradas = [...acc.inputs.values()].filter(i => ENTRADA.test(i.name))
if (window._jpOyentes) window._jpOyentes.forEach(i => { i.onmidimessage = null })
window._jpOyentes = entradas
entradas.forEach(i => {
  i.onmidimessage = ({ data }) => {
    const [st, d1, d2] = data
    const tipo = st & 0xf0
    if (tipo === 0x90 && d2 > 0) setTimeout(() => probarPad(d1), 150)   // después de que suelte el pad
    else if (tipo === 0xb0) mostrar(`botón: CC ${d1} = ${d2} (canal ${(st & 15) + 1})`)
  }
  i.open && i.open().catch(err => mostrar(`no pude abrir ${i.name}: ${err.message}`))
})
mostrar(entradas.length ? `escuchando: ${entradas.map(i => i.name).join(' + ')} · tocá un pad` : 'no encuentro el puerto jpmini (¿BLE-MIDI Connect abierto con Enviar = jpmini?)')

// ---- recorridos ----
window.paleta = async (nota = 36, ms = 230) => {
  for (let v = 0; v < 128; v++) { mandar([0x90 | CANAL, nota, v]); mostrar(`${padDe(nota)} → valor ${v}`); await espera(ms) }
  mandar([0x90 | CANAL, nota, 0]); mostrar('fin de la paleta')
}
window.pruebaTodo = async () => {
  for (const [base, nombre] of BANKS) {
    for (let p = 0; p < 16; p++) { mandar([0x90 | CANAL, base + p, 127]); mostrar(`${nombre} · PAD ${p + 1} prendido`); await espera(250) }
    for (let p = 0; p < 16; p++) mandar([0x90 | CANAL, base + p, 0])
  }
  mostrar('fin del recorrido')
}
window.apagarTodo = () => { for (let n = 36; n < 84; n++) mandar([0x90 | CANAL, n, 0]) }

solid(0.05, 0.05, 0.08).out()
