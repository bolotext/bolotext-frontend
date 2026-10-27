import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-lg border border-line bg-surface text-fg placeholder:text-subtle transition-colors ' +
  'hover:border-line-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-ring ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted read-only:bg-surface-2 read-only:focus:ring-0 read-only:focus:border-line'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(fieldBase, 'h-8.5 px-3 text-[13px]', invalid && 'border-danger focus:border-danger', className)}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

/** Password/secret input with a reveal toggle. */
export const SecretInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input ref={ref} type={shown ? 'text' : 'password'} className={cn('pr-9 font-mono', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShown((s) => !s)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg"
        aria-label={shown ? 'Hide value' : 'Show value'}
      >
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  )
})
SecretInput.displayName = 'SecretInput'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        fieldBase,
        'min-h-20 px-3 py-2 text-[13px] leading-relaxed scrollbar-thin',
        invalid && 'border-danger',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(fieldBase, 'h-8.5 appearance-none pr-8 pl-3 text-[13px] disabled:opacity-100')} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle" />
    </div>
  ),
)
Select.displayName = 'Select'

/** Single-select dropdown with a type-to-filter box. Keeps an unlisted current value selectable. */
export function SearchableSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder = 'Search…',
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const all = useMemo(() => (value && !options.includes(value) ? [value, ...options] : options), [value, options])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '_')
    return q ? all.filter((o) => o.toLowerCase().includes(q)) : all
  }, [all, query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const openList = () => {
    setQuery('')
    setActive(Math.max(0, all.indexOf(value)))
    setOpen(true)
  }
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
          <Input
            autoFocus
            value={query}
            placeholder={placeholder}
            className="pl-8.5"
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                if (filtered[active]) pick(filtered[active])
              } else if (e.key === 'Escape') {
                e.stopPropagation()
                setOpen(false)
              }
            }}
          />
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={openList}
            className={cn(fieldBase, 'h-8.5 truncate pr-8 pl-3 text-left text-[13px] disabled:opacity-100')}
          >
            {value}
          </button>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle" />
        </>
      )}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="scrollbar-thin absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted">No matches</li>}
          {filtered.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={o === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[13px]',
                i === active && 'bg-surface-2',
              )}
            >
              <span className="truncate">{o}</span>
              {o === value && <Check className="size-3.5 shrink-0 text-accent" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-8 pl-8.5" />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('text-[13px] font-medium text-fg', className)}>
      {children}
    </label>
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  aside,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
  aside?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-2">
          {label && <Label htmlFor={htmlFor}>{label}</Label>}
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/** Numeric input that keeps the raw string while typing and emits a number. */
export function NumberInput({
  value,
  onChange,
  step,
  min,
  max,
  disabled,
  suffix,
  integer,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  suffix?: string
  integer?: boolean
}) {
  const [raw, setRaw] = useState(String(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    if (Number(raw) !== value) setRaw(String(value))
  }
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={raw}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        readOnly={disabled}
        className={cn(suffix && 'pr-10', 'tabular-nums')}
        onChange={(e) => {
          setRaw(e.target.value)
          const n = integer ? parseInt(e.target.value, 10) : parseFloat(e.target.value)
          if (!Number.isNaN(n)) onChange(n)
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-subtle">{suffix}</span>
      )}
    </div>
  )
}
