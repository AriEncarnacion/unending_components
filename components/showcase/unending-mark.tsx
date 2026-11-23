import { cn } from "cn"

const pluses = [
  { x: 8, y: 17 },
  { x: 30, y: 9 },
  { x: 52, y: 17 },
  { x: 74, y: 17 },
]

export function UnendingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 82 26" fill="currentColor" aria-hidden className={cn("h-4 w-auto", className)}>
      {pluses.map(({ x, y }) => (
        <g key={x}>
          <rect x={x - 8} y={y - 1.25} width={16} height={2.5} />
          <rect x={x - 1.25} y={y - 8} width={2.5} height={16} />
        </g>
      ))}
    </svg>
  )
}
