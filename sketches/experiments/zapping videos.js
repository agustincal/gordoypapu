if (window._gpClockCheck) window._gpClockCheck.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpClockCheck = []

const panel = document.createElement('div')
panel.id = 'gpClockPanel'
panel.style.cssText = `
  position: fixed; top: 8px; left: 8px; z-index: 99999;
  background: rgba(0,0,0,0.7); color: #0f0;
  font: 12px/1.4 monospace; padding: 8px 12px; white-space: pre;
`
document.body.appendChild(panel)
panel.textContent = 'esperando clock (0xF8)...'

let ticks = []
let otrosMsgs = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const fn = m => {
      const st = m.data[0]
      if (st === 0xF8) {
        ticks.push(performance.now())
        if (ticks.length > 48) ticks.shift() // ~2 vueltas de 24ppqn
      } else if (st < 0xF8) {
        // mensaje "normal" (con canal), lo guardamos para ver si también hay pulso por nota
        const canal = (st & 0x0F) + 1
        otrosMsgs.push(`${inp.name} · canal ${canal} · [${[...m.data].join(',')}]`)
        if (otrosMsgs.length > 5) otrosMsgs.shift()
      }
    }
    inp.addEventListener('midimessage', fn)
    window._gpClockCheck.push([inp, fn])
  })
})

setInterval(() => {
  let bpmTxt = 'sin clock (0xF8) detectado'
  if (ticks.length > 2) {
    const intervalos = []
    for (let i = 1; i < ticks.length; i++) intervalos.push(ticks[i] - ticks[i - 1])
    const prom = intervalos.reduce((a, b) => a + b, 0) / intervalos.length
    const bpm = 60000 / (prom * 24) // 24 pulsos de clock por negra
    bpmTxt = `clock activo: ${ticks.length} ticks · ~${bpm.toFixed(1)} BPM`
  }
  panel.textContent = `${bpmTxt}\n\núltimos mensajes con canal:\n${otrosMsgs.join('\n') || '(ninguno)'}`
}, 500)