/**
 * Indicador de carga: los anillos de la teca se encienden de adentro hacia afuera, con una frase en palabras.
 * Con «reducir movimiento» activado, los anillos quedan quietos.
 */
export function LoadingRings({ label = 'Cargando…', className = '' }: { label?: string; className?: string }) {
  const rings = [
    [14, 12],
    [26, 22],
    [38, 32],
    [50, 42],
  ] as const
  return (
    <div role="status" className={`grid animate-fade-late justify-items-center gap-4 motion-reduce:animate-none ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 120 100" className="h-20 w-24 text-madera" fill="none" stroke="currentColor" strokeWidth="2.4">
        <ellipse cx="60" cy="50" rx="4" ry="3.5" fill="currentColor" stroke="none" />
        {rings.map(([rx, ry], i) => (
          <ellipse
            key={rx}
            cx={60 + (i % 2 === 0 ? -1 : 1)}
            cy="50"
            rx={rx}
            ry={ry}
            className="animate-ring-wave motion-reduce:animate-none motion-reduce:opacity-60"
            style={{ animationDelay: `${i * 0.22}s` }}
          />
        ))}
      </svg>
      <p className="text-lg font-semibold text-carbon-600">{label}</p>
    </div>
  )
}
