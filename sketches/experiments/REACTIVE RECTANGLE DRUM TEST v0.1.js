await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'buscandoplacer',midi:true})
await GP.audio.start()

function rnd(n, seed) {
  let x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

let speed = 3

solid(1,1,1)
  .mask(
    shape(4,0.5,0.001)
      .scale(
        () => {
          let s = Math.floor(time * speed)
          let w = 0.5 + rnd(s,3) * 1.2
          return drums.mid() > 0.25 ? w : 0.001
        },
        () => {
          let s = Math.floor(time * speed)
          let h = 0.5 + rnd(s,4) * 1.2
          return drums.mid() > 0.25 ? h : 0.001
        }
      )
      .scrollX(() => {
        let s = Math.floor(time * speed)
        return rnd(s,1) * 1.25 - 0.625
      })
      .scrollY(() => {
        let s = Math.floor(time * speed)
        return rnd(s,2) * 1.25 - 0.625
      })
  )
  .out(o0)
