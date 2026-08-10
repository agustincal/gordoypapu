// ======================================================
// 03 — SIGNAL BLOCKS
// ======================================================

let jx = () =>
  Math.sin(time * 9) * 0.015

let jy = () =>
  Math.sin(time * 13) * 0.008

let vertical = osc(18, 0.02, 0.5)
  .repeatX(2)
  .repeatY(3)
  .rotate(() =>
    Math.sin(time * 0.17) * 0.05
  )

let horizontal = osc(7, 0.03, 0.4)
  .rotate(Math.PI / 2)
  .repeatX(3)
  .repeatY(2)

let blocks = shape(4, 0.7, 0.01)
  .repeatX(5)
  .repeatY(7)
  .scrollX(() =>
    Math.sin(time * 0.37) * 0.04
  )
  .scrollY(() =>
    Math.cos(time * 0.29) * 0.03
  )

let structure = vertical
  .blend(horizontal, 0.45)
  .diff(blocks, 0.35)

structure
  .scrollX(jx)
  .scrollY(jy)
  .modulate(
    noise(5, 0.1),
    () => 0.08 + Math.sin(time * 1.7) * 0.04
  )
  .contrast(1.8)
  .brightness(-0.05)
  .out()
