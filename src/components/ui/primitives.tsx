import type { ReactNode } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn, errorDetails, errorMessage, initials } from '@/lib/utils'
import { Button } from './button'

// ---------- Badge ----------
type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

// ---------- Card ----------
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-line bg-surface shadow-card', className)}>{children}</div>
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted [&_svg]:size-4">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

// ---------- Skeleton ----------
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-surface-2', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5" />
    </div>
  )
}

// ---------- Avatar ----------
const avatarPalette = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
]

export function Avatar({ name, className }: { name: string; className?: string }) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        avatarPalette[h % avatarPalette.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

// ---------- Empty / Error ----------
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const details = errorDetails(error)
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-fg">Couldn&apos;t load this</h3>
      <p className="mt-1 max-w-md text-[13px] text-muted">{errorMessage(error)}</p>
      {details.length > 0 && (
        <ul className="mt-2 max-w-md text-left text-xs text-muted">
          {details.map((d) => (
            <li key={d}>• {d}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  )
}

// ---------- Switch ----------
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  size = 'md',
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  id?: string
  size?: 'sm' | 'md'
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'bg-line-strong data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'h-5 w-9' : 'h-4 w-7',
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block rounded-full bg-white shadow transition-transform',
          size === 'md'
            ? 'size-4 translate-x-0.5 data-[state=checked]:translate-x-[18px]'
            : 'size-3 translate-x-0.5 data-[state=checked]:translate-x-[14px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

/** A labelled toggle row used throughout the agent builder. */
export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <label className="flex cursor-pointer items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-fg">{title}</div>
          {description && <div className="mt-0.5 text-xs leading-relaxed text-muted">{description}</div>}
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </label>
      {checked && children && <div className="mt-4">{children}</div>}
    </div>
  )
}

// ---------- Tooltip ----------
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs animate-fade-in rounded-md bg-fg px-2 py-1 text-xs text-bg shadow-pop"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider

// ---------- Segmented control ----------
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-surface-2 p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed [&_svg]:size-3.5',
            value === o.value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------- Slider ----------
export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  format = (v) => String(v),
  marks,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  disabled?: boolean
  format?: (v: number) => string
  marks?: [string, string]
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--line) ${pct}%)` }}
        />
        <span className="w-12 rounded-md border border-line bg-surface-2 py-0.5 text-center font-mono text-xs tabular-nums">
          {format(value)}
        </span>
      </div>
      {marks && (
        <div className="mt-1 flex justify-between pr-15 text-[11px] text-subtle">
          <span>{marks[0]}</span>
          <span>{marks[1]}</span>
        </div>
      )}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-surface-2 px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-4 animate-spin rounded-full border-2 border-line border-t-accent', className)} />
}
