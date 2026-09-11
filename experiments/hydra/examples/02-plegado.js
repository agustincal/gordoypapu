// ======================================================
// 02 — PLEGADO
// ======================================================

let breathe = () =>
  1 + Math.sin(time * 0.31) * 0.08

let angle = () =>
  Math.sin(time * 0.21) * 0.12

let planes = shape(4, 0.5, 0)
  .scale(
    () => 1.2 * breathe(),
    0.32
  )
  .repeatY(7)
  .rotate(-0.12)
  .scrollY(
    () => Math.sin(time * 0.18) * 0.08
  )

let planes2 = osc(
  2,
  0,
  0.5
)
  .rotate(angle)
  .scale(1.4, 0.5)
  .repeatY(5)
  .modulate(
    noise(2, 0.15),
    0.12
  )
  .contrast(2)

let folds = planes
  .modulateScale(
    noise(1.5, 0.25),
    () => 0.15 + Math.sin(time * 0.4) * 0.08
  )
  .rotate(
    () => -0.15 + Math.sin(time * 0.27) * 0.08
  )

planes2
  .layer(
    folds
      .invert()
      .luma(0.45)
  )
  .diff(
    planes
      .rotate(0.08)
      .scrollX(
        () => Math.sin(time * 0.23) * 0.04
      )
  )
  .modulate(
    osc(1.5, 0.03, 0.5),
    0.18
  )
  .posterize(5, 0.6)
  .contrast(1.4)
  .out()
