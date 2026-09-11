// Ring Modulator for Hydra
// Uses F1-F8 from stems-base.js to modulate mc_ring()

function ringMod() {
  const f1 = () => (window.STEMS?.F1?.() ?? 0)
  const f2 = () => (window.STEMS?.F2?.() ?? 0)
  const f3 = () => (window.STEMS?.F3?.() ?? 0)
  const f4 = () => (window.STEMS?.F4?.() ?? 0)
  const f5 = () => (window.STEMS?.F5?.() ?? 0)
  const f6 = () => (window.STEMS?.F6?.() ?? 0)
  const f7 = () => (window.STEMS?.F7?.() ?? 0)
  const f8 = () => (window.STEMS?.F8?.() ?? 0)

  // F1-F3 = RGB modulation
  // F4 = outer threshold
  // F5 = inner threshold
  // F6 = edge softness
  // F7 = color modulation speed
  // F8 = overall animation amount
  return mc_ring(
    () => 0.22 + f5() * 0.18,
    () => 0.30 + f5() * 0.22,
    () => 0.24 + f4() * 0.16,
    () => 0.29 + f4() * 0.20
  )
    .color(
      () => 0.35 + f1() * 1.3,
      () => 0.35 + f2() * 1.3,
      () => 0.35 + f3() * 1.3
    )
    .modulateScale(
      osc(() => 0.05 + f8() * 0.15, 0.1 + f7() * 2, 0)
        .rotate(() => f7() * Math.PI * 2),
      () => f8() * 0.15
    )
}
