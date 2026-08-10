// ======================================================
// MIDI BASE v1
// Solo MIDI + botones + LEDs
// Fila 8 = notas 56–63 = N81–N88
// ======================================================

await loadScript('https://h.6120.eu/midi.js')
await midi.start().show()

const output = [...(await navigator.requestMIDIAccess()).outputs.values()][0]
const NOTE_START = 56
const NOTE_END = 63

if (window.__APC_LED_INTERVAL) clearInterval(window.__APC_LED_INTERVAL)
for (let n = 0; n <= 63; n++) output.send([0x90, n, 0])

window.__APC_ACTIVO = window.__APC_ACTIVO || {}
const activo = window.__APC_ACTIVO

for (let n = NOTE_START; n <= NOTE_END; n++) {
  activo[n] = false
  output.send([0x90, n, 1])
  midi.channel(0).onNote(n, () => activo[n] = !activo[n])
}

window.__APC_LED_INTERVAL = setInterval(() => {
  for (let n = NOTE_START; n <= NOTE_END; n++)
    output.send([0x90, n, activo[n] ? 4 : 1])
}, 50)

window.STEMS = window.STEMS || {}
for (let n = NOTE_START; n <= NOTE_END; n++)
  window.STEMS[`N8${n - 55}`] = () => activo[n]

window.APC = { output, activo, NOTE_START, NOTE_END }
