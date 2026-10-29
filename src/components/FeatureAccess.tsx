import { cn } from '@/lib/utils'
import type { Feature } from '@/api/types'
import { FEATURES } from '@/lib/features'

/** Pick which product areas an organization may use (at least one). */
export function FeatureAccess({ value, onChange, disabled }: { value: Feature[]; onChange: (v: Feature[]) => void; disabled?: boolean }) {
  const toggle = (id: Feature, on: boolean) => onChange(FEATURES.map((f) => f.id).filter((x) => (x === id ? on : value.includes(x))))
  return (
    <div className="space-y-2">
      {FEATURES.map((f) => {
        const checked = value.includes(f.id)
        const last = checked && value.length === 1
        return (
          <label
            key={f.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors',
              checked ? 'border-accent/40 bg-accent-soft' : 'border-line',
              disabled || last ? 'cursor-not-allowed' : 'cursor-pointer hover:border-line-strong',
            )}
            title={last ? 'An organization needs at least one product' : undefined}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-accent disabled:cursor-not-allowed"
              checked={checked}
              disabled={disabled || last}
              onChange={(e) => toggle(f.id, e.target.checked)}
            />
            <span>
              <span className="block text-[13px] font-medium text-fg">{f.label}</span>
              <span className="block text-xs text-muted">{f.description}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
