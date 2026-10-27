import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Textarea with `{{variable}}` highlighting. A mirror div renders the same
 * text behind a transparent-text textarea; both share font metrics and the
 * mirror's scroll is kept in sync.
 */
export function PromptEditor({
  value,
  onChange,
  readOnly,
  placeholder,
  rows = 4,
  declared,
  mono,
  className,
}: {
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  placeholder?: string
  rows?: number
  /** Declared variable names; references outside this set are flagged. Omit to skip checking. */
  declared?: string[]
  mono?: boolean
  className?: string
}) {
  const mirror = useRef<HTMLDivElement>(null)
  const parts: ReactNode[] = []
  let last = 0
  for (const m of value.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
    const i = m.index ?? 0
    parts.push(value.slice(last, i))
    const ok = !declared || declared.includes(m[1])
    parts.push(
      <mark
        key={i}
        className={cn(
          'rounded-[3px] text-transparent',
          ok ? 'bg-accent-soft ring-1 ring-accent/30' : 'bg-danger-soft ring-1 ring-danger/40',
        )}
      >
        {m[0]}
      </mark>,
    )
    last = i + m[0].length
  }
  parts.push(value.slice(last))

  const shared = cn('px-3 py-2.5 text-[13px] leading-[1.65] whitespace-pre-wrap break-words', mono && 'font-mono text-[12.5px]')

  return (
    <div
      className={cn(
        'relative rounded-lg border border-line bg-surface transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-ring',
        readOnly && 'bg-surface-2 focus-within:border-line focus-within:ring-0',
        className,
      )}
    >
      <div
        ref={mirror}
        aria-hidden
        className={cn(shared, 'pointer-events-none absolute inset-0 overflow-hidden text-transparent')}
      >
        {parts}
        {'\n'}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop
        }}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className={cn(
          shared,
          'relative block w-full resize-y bg-transparent text-fg caret-fg outline-none placeholder:text-subtle scrollbar-thin',
        )}
      />
    </div>
  )
}
