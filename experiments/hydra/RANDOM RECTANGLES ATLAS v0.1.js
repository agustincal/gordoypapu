// ATLAS — 84 rectángulos
// Ventana con saltos de posición y escala

function rnd(n, seed) {
  let x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}


// --------------------------------------------------
// ATLAS
// --------------------------------------------------

let atlas = solid(0, 0, 0)

for (let i = 0; i < 84; i++) {

  let x = rnd(i, 1) * 1.15 - 0.575
  let y = rnd(i, 2) * 1.15 - 0.575

  let w = 0.06 + rnd(i, 3) * 0.55
  let h = 0.06 + rnd(i, 4) * 0.55

  let r = solid(
    rnd(i, 10),
    rnd(i, 20),
    rnd(i, 30)
  )

  r = r.mask(
    shape(4, 0.5, 0.001)
      .scale(w, h)
      .scrollX(x)
      .scrollY(y)
  )

  atlas = atlas.layer(r)
}

atlas.out(o1)


// --------------------------------------------------
// VENTANA
// --------------------------------------------------

const INTERVAL = 0.09

src(o1)
  .scrollX(() => {
    let s = Math.floor(time / INTERVAL)
    return rnd(s, 101) * 0.4 - 0.2
  })
  .scrollY(() => {
    let s = Math.floor(time / INTERVAL)
    return rnd(s, 102) * 0.4 - 0.2
  })
  .scale(() => {
    let s = Math.floor(time / INTERVAL)
    return 5 + rnd(s, 1) * 20.5
  })
  .out(o0)
