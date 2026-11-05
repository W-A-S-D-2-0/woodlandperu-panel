/** Anillos de crecimiento de la teca: elipses concéntricas que decoran las superficies de nogal. */
export function GrowthRings({ className = '', strength = 1 }: { className?: string; strength?: number }) {
  const rings = [
    [22, 17],
    [44, 35],
    [68, 54],
    [92, 73],
    [118, 94],
    [146, 116],
    [176, 139],
    [208, 164],
    [242, 190],
  ] as const
  return (
    <svg aria-hidden="true" viewBox="0 0 520 380" className={`pointer-events-none ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6">
      {rings.map(([rx, ry], i) => (
        <ellipse key={rx} cx={260 + (i % 2 === 0 ? -2 : 2)} cy={190 + (i % 3) - 1} rx={rx} ry={ry} opacity={(0.55 - i * 0.05) * strength} />
      ))}
    </svg>
  )
}
