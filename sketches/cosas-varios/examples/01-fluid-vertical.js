// ======================================================
// 01 — FLUID VERTICAL
// ======================================================

let movement = () =>
  Math.sin(time * 0.22) * 0.08

let pulse = () =>
  0.5 + Math.sin(time * 0.45) * 0.5

let base = osc(3, 0.04, 0.4)
  .rotate(movement)
  .repeatX(3)
  .repeatY(2)
  .modulate(
    noise(2, 0.18),
    () => 0.15 + pulse() * 0.18
  )
  .contrast(1.4)

let vertical = osc(7, 0.02, 0.5)
  .rotate(() => -movement())
  .repeatX(5)
  .modulate(
    noise(3, 0.12),
    () => 0.1 + pulse() * 0.15
  )
  .contrast(1.8)

let organic = noise(2, 0.2)
  .pixelate(35, 100)
  .modulate(
    osc(2, 0.05, 0.3),
    0.15
  )
  .contrast(1.5)

base
  .blend(vertical, 0.5)
  .diff(organic, 0.3)
  .modulate(
    noise(1.5, 0.15),
    () => 0.1 + pulse() * 0.12
  )
  .contrast(1.3)
  .out()
