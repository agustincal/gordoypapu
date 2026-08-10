// ======================================================
// CREATIVE STEM + MIDI v1 — EXPERIMENTAL
// ======================================================

await loadScript('https://h.6120.eu/midi.js')
await midi.start().show()

const output = [...(await navigator.requestMIDIAccess()).outputs.values()][0]

// FADERS
const F = {F1:0,F2:0,F3:0,F4:0,F5:0,F6:0,F7:0,F8:0,FMASTER:1}
const CC = {48:'F1',49:'F2',50:'F3',51:'F4',52:'F5',53:'F6',54:'F7',55:'F8',56:'FMASTER'}
for (const cc in CC) midi.channel(0).onCC(Number(cc),({value})=>F[CC[cc]]=value/127)

// BUTTONS — ROW 8
const NOTE_START=56, NOTE_END=63
if(window.__APC_LED_INTERVAL) clearInterval(window.__APC_LED_INTERVAL)
for(let n=0;n<=63;n++) output.send([0x90,n,0])
const activo={}
for(let n=NOTE_START;n<=NOTE_END;n++){
  activo[n]=false
  output.send([0x90,n,1])
  midi.channel(0).onNote(n,()=>activo[n]=!activo[n])
}
window.__APC_LED_INTERVAL=setInterval(()=>{
  for(let n=NOTE_START;n<=NOTE_END;n++) output.send([0x90,n,activo[n]?4:1])
},50)
window.STEMS=window.STEMS||{}
for(let n=NOTE_START;n<=NOTE_END;n++) window.STEMS[`N8${n-55}`]=()=>activo[n]
for(const name in F) window.STEMS[name]=()=>F[name]

// STEM ENGINE
window.ctx=window.ctx||new AudioContext()
window.stems=window.stems||{}
await ctx.resume()

function stem(name){
  if(stems[name]){window[name]=stems[name];return stems[name]}
  const player=new Audio(`https://agustincal.github.io/gordoypapu/stems/vociferan/${name}.mp3`)
  player.crossOrigin='anonymous';player.loop=true
  const source=ctx.createMediaElementSource(player), analyser=ctx.createAnalyser()
  analyser.fftSize=1024
  source.connect(analyser);source.connect(ctx.destination)
  const fft=new Uint8Array(analyser.frequencyBinCount)
  setInterval(()=>analyser.getByteFrequencyData(fft),1000/60)
  player.play()
  const obj={player,analyser,fft,
    low(){return this.fft[8]/255},
    mid(){return this.fft[40]/255},
    high(){return this.fft[100]/255}}
  stems[name]=obj;window[name]=obj;return obj
}
stem('bass');stem('drums');stem('synth');stem('vocals')

// AUDIO ENERGY
const energy=()=>((bass.low()+drums.mid()+synth.mid()+vocals.high())/4)
const pulse=()=>1+Math.sin(time*(0.3+F.F1*2))*0.1

// A1 — FLUID VERTICAL
const fluid=osc(3+F.F1*5,0.04,0.4)
  .rotate(()=>Math.sin(time*0.22)*(0.08+F.F3*0.15))
  .repeatX(3).repeatY(2)
  .modulate(noise(2,0.18),()=>0.15+bass.low()*0.3)
  .contrast(1.4)
const vertical=osc(7,0.02,0.5)
  .rotate(()=>-Math.sin(time*0.22)*(0.05+drums.mid()*0.15))
  .repeatX(5)
  .modulate(noise(3,0.12),()=>0.1+synth.mid()*0.2)
  .contrast(1.8)
const organic=noise(2,0.2)
  .pixelate(()=>25+vocals.high()*100,()=>60+vocals.high()*140)
  .modulate(osc(2,0.05,0.3),0.15)
const A1=fluid.blend(vertical,0.5).diff(organic,0.3)
  .modulate(noise(1.5,0.15),()=>0.03+F.F3*0.15+energy()*0.2)

// A2 — PLEGADO
const planes=shape(4,0.5,0)
  .scale(()=>1.2*pulse(),0.32).repeatY(7).rotate(-0.12)
  .scrollY(()=>Math.sin(time*0.18)*(0.04+F.F4*0.12))
const planes2=osc(2,0,0.5).rotate(()=>Math.sin(time*0.21)*0.12)
  .scale(1.4,0.5).repeatY(5).modulate(noise(2,0.15),0.12).contrast(2)
const folds=planes.modulateScale(noise(1.5,0.25),()=>0.15+bass.low()*0.2)
  .rotate(()=>-0.15+Math.sin(time*0.27)*0.08)
const A2=planes2.layer(folds.invert().luma(0.45))
  .diff(planes.rotate(0.08).scrollX(()=>Math.sin(time*0.23)*0.04))
  .modulate(osc(1.5,0.03,0.5),()=>0.12+drums.mid()*0.25)
  .posterize(()=>3+F.F5*8,0.6).contrast(1.4)

// A3 — SIGNAL BLOCKS
const signalV=osc(18,0.02,0.5).repeatX(2).repeatY(3)
  .rotate(()=>Math.sin(time*0.17)*0.05)
const signalH=osc(7,0.03,0.4).rotate(Math.PI/2).repeatX(3).repeatY(2)
const blocks=shape(4,0.7,0.01)
  .repeatX(()=>3+Math.floor(F.F6*5)).repeatY(7)
  .scrollX(()=>Math.sin(time*0.37)*0.04)
  .scrollY(()=>Math.cos(time*0.29)*0.03)
const A3=signalV.blend(signalH,0.45).diff(blocks,0.35)
  .scrollX(()=>Math.sin(time*9)*(0.008+vocals.high()*0.04))
  .scrollY(()=>Math.sin(time*13)*(0.005+drums.high()*0.03))
  .modulate(noise(5,0.1),()=>0.08+F.F7*0.15+energy()*0.1)
  .contrast(1.8)

// A4 — MODULAR ARCHITECTURE
const grid=shape(4,0.5,0.01).repeatX(6).repeatY(8)
  .scale(()=>1.1*pulse(),0.75)
  .scrollX(()=>Math.sin(time*0.21)*0.08)
const bands=osc(5,0.025,0.3).repeatY(8)
  .rotate(()=>Math.sin(time*0.16)*0.08).modulate(noise(2,0.12),0.12)
const columns=osc(12,0.015,0.2).repeatX(5).repeatY(2)
  .scrollX(()=>Math.sin(time*0.31)*0.05)
const A4=grid.blend(bands,0.5).diff(columns,0.35)
  .modulate(osc(2,0.04,0.5),()=>0.12+synth.high()*0.25)
  .contrast(()=>1.2+F.F8*2).brightness(-0.1)

// SCENE MIX
const mix=A1
  .blend(A2,()=>activo[57]?0.5:0)
  .blend(A3,()=>activo[58]?0.5:0)
  .blend(A4,()=>activo[59]?0.5:0)

// AUDIO REACTOR
const reactor=mix
  .modulate(noise(()=>2+bass.low()*8,()=>0.1+F.F2*0.4),()=>activo[61]?0.05+energy()*0.5:0.05)
  .scale(()=>0.75+energy()*0.25+F.F1*0.15)

reactor
  .blend(mix,()=>activo[60]?0.8:0)
  .invert(()=>activo[62]?1:0)
  .brightness(()=>activo[63]?energy()*0.3:0)
  .contrast(()=>1+F.F7*2)
  .scale(()=>0.1+F.FMASTER*0.9)
  .out()
