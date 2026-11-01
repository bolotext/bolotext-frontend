import { AlertTriangle } from 'lucide-react'
import type { DailyPoint, KindSummary, UsageSummary } from '@/api/types'
import { KIND_LABEL, compactNum, inr, money, usageLabel } from '@/lib/usage'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/primitives'
import { Badge, Card, CardBody } from '@/components/ui/primitives'

/** `$1.23` with the rupee equivalent beside it once a rate is set. */
export function Money({ usd, rate, currency = 'USD', stacked }: { usd: number; rate: number | null | undefined; currency?: string; stacked?: boolean }) {
  const r = inr(usd, rate)
  return (
    <>
      <span>{money(usd, currency)}</span>
      {r && <span className={stacked ? 'block text-xs font-normal text-muted' : 'ml-1.5 text-xs font-normal text-muted'}>{stacked ? r : `≈ ${r}`}</span>}
    </>
  )
}

export interface Filters {
  from: string
  to: string
  test: boolean
}

export function FilterBar({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <label className="text-xs text-muted">
        <span className="mb-1 block">From (UTC)</span>
        <Input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </label>
      <label className="text-xs text-muted">
        <span className="mb-1 block">To (UTC)</span>
        <Input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-[13px]">
        <Switch checked={value.test} onCheckedChange={(test) => onChange({ ...value, test })} />
        Include test calls
      </label>
    </div>
  )
}

export function UnpricedNote({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <Badge tone="warning" className="gap-1">
      <AlertTriangle className="size-3" /> Some models have no price
    </Badge>
  )
}

/** Total cost plus one tile per provider kind. */
export function KindCards({ summary, currency, rate }: { summary: UsageSummary; currency: string; rate: number | null }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardBody>
          <div className="text-xs text-muted">Total cost</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight"><Money usd={summary.cost} rate={rate} currency={currency} stacked />
          </div>
          <div className="mt-2">
            <UnpricedNote show={summary.has_unpriced} />
          </div>
        </CardBody>
      </Card>
      {summary.kinds.map((k) => (
        <KindCard key={k.kind} k={k} currency={currency} rate={rate} />
      ))}
    </div>
  )
}

function KindCard({ k, currency, rate }: { k: KindSummary; currency: string; rate: number | null }) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-muted">{KIND_LABEL[k.kind]}</div>
        <div className="mt-1 text-2xl font-semibold tracking-tight"><Money usd={k.cost} rate={rate} currency={currency} stacked />
        </div>
        <div className="mt-2 text-xs text-muted">{usageLabel(k.kind, k.usage)}</div>
        {k.unpriced_models > 0 && <div className="mt-1 text-[11px] text-warning">{k.unpriced_models} model(s) unpriced</div>}
      </CardBody>
    </Card>
  )
}

/** Daily cost bars (one series, one hue). */
export function DailyCostChart({ data, currency, rate }: { data: DailyPoint[]; currency: string; rate: number | null }) {
  if (data.length === 0) return <p className="py-8 text-center text-[13px] text-muted">No usage in this period.</p>
  const W = 640
  const H = 150
  const pad = { l: 8, r: 8, t: 8, b: 22 }
  const max = Math.max(...data.map((d) => d.cost), 0.0001)
  const bw = (W - pad.l - pad.r) / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily cost">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="stroke-line" />
      {data.map((d, i) => {
        const h = Math.max(2, (d.cost / max) * (H - pad.t - pad.b))
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${money(d.cost, currency)}${inr(d.cost, rate) ? ` (${inr(d.cost, rate)})` : ''} · ${compactNum(d.calls)} calls`}</title>
            <rect
              x={pad.l + i * bw + Math.min(2, bw * 0.15)}
              y={H - pad.b - h}
              width={Math.max(1, bw - Math.min(4, bw * 0.3))}
              height={h}
              rx={Math.min(3, bw / 3)}
              className="fill-accent"
            />
          </g>
        )
      })}
      <text x={pad.l} y={H - 6} className="fill-subtle text-[10px]">
        {data[0].day}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="fill-subtle text-[10px]">
        {data[data.length - 1].day}
      </text>
      <text x={W - pad.r} y={pad.t + 8} textAnchor="end" className="fill-subtle text-[10px]">
        peak {money(max, currency)}
        {inr(max, rate) ? ` (${inr(max, rate)})` : ''}
      </text>
    </svg>
  )
}
