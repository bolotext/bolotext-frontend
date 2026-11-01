import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

/** End-to-end latency bands (ms): < 1000 good, 1000–2000 slow, > 2000 too slow. */
const GOOD_MAX = 1000
const WARN_MAX = 2000
const SCALE_MAX = 3000

function band(ms: number) {
  if (ms < GOOD_MAX) return { key: 'good', label: 'Good', tone: 'success', Icon: CheckCircle2, text: 'text-success' } as const
  if (ms <= WARN_MAX) return { key: 'warn', label: 'Slow', tone: 'warning', Icon: AlertTriangle, text: 'text-warning' } as const
  return { key: 'bad', label: 'Too slow', tone: 'danger', Icon: XCircle, text: 'text-danger' } as const
}

const CX = 120
const CY = 112
const R = 90
const GAP = 0.045 // radians trimmed from each band end → visible gap between bands

const pt = (theta: number, r = R) => [CX + r * Math.cos(theta), CY - r * Math.sin(theta)] as const
const arc = (from: number, to: number) => {
  const [x1, y1] = pt(from)
  const [x2, y2] = pt(to)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

const BANDS = [
  { key: 'good', cls: 'stroke-success' },
  { key: 'warn', cls: 'stroke-warning' },
  { key: 'bad', cls: 'stroke-danger' },
] as const

/** Half-circle meter for average end-to-end latency, banded green / amber / red. */
export function LatencyGauge({ ms }: { ms: number }) {
  const b = band(ms)
  const clamped = Math.min(Math.max(ms, 0), SCALE_MAX)
  const theta = Math.PI - (clamped / SCALE_MAX) * Math.PI // π (left) → 0 (right)
  const [nx, ny] = pt(theta, R - 24)
  const [dx, dy] = pt(theta, R)
  return (
    <figure className="flex flex-col items-center" aria-label={`Average end-to-end latency ${Math.round(ms)} milliseconds, ${b.label}`}>
      <svg viewBox="0 0 240 150" className="w-full max-w-[280px]" role="img">
        {BANDS.map((x, i) => (
          <path
            key={x.key}
            d={arc(Math.PI - (i * Math.PI) / 3 - GAP, Math.PI - ((i + 1) * Math.PI) / 3 + GAP)}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            className={cn(x.cls, x.key === b.key ? 'opacity-100' : 'opacity-25')}
          />
        ))}
        {/* needle */}
        <line x1={CX} y1={CY} x2={nx} y2={ny} strokeWidth={2} strokeLinecap="round" className="stroke-fg" />
        <circle cx={CX} cy={CY} r={5} className="fill-fg" />
        <circle cx={dx} cy={dy} r={6} strokeWidth={2} className="fill-fg stroke-surface" />
        {/* scale ticks */}
        {[0, 1000, 2000, 3000].map((v, i) => {
          const [tx, ty] = pt(Math.PI - (v / SCALE_MAX) * Math.PI, R + 17)
          return (
            <text key={v} x={tx} y={ty + 3} textAnchor="middle" className="fill-subtle text-[9px]">
              {i === 3 ? '3s+' : i === 0 ? '0' : `${v / 1000}s`}
            </text>
          )
        })}
      </svg>
      <div className="-mt-9 flex flex-col items-center gap-1.5">
        <div className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
          {Math.round(ms).toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted">ms</span>
        </div>
        <Badge tone={b.tone} className="gap-1">
          <b.Icon className="size-3" /> {b.label}
        </Badge>
      </div>
      <figcaption className="mt-2 text-xs text-muted">Avg end-to-end latency</figcaption>
      <div className="mt-1 text-[11px] text-subtle">
        <span className="text-success">&lt; 1s</span> · <span className="text-warning">1–2s</span> · <span className="text-danger">&gt; 2s</span>
      </div>
    </figure>
  )
}
