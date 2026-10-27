import { useState, type KeyboardEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Input, SecretInput } from './input'

/**
 * Edits a Record<string,string> as ordered rows. Rows are kept locally so a
 * half-typed (empty or duplicate) key doesn't collapse while editing; only
 * complete rows are emitted.
 */
export function KeyValueEditor({
  value,
  onChange,
  disabled,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  secretValues,
  addLabel = 'Add',
  keyPattern,
}: {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
  disabled?: boolean
  keyPlaceholder?: string
  valuePlaceholder?: string
  /** Mask values (e.g. HTTP headers that usually carry API keys). */
  secretValues?: boolean
  addLabel?: string
  keyPattern?: RegExp
}) {
  const toRows = (v: Record<string, string>) => Object.entries(v).map(([k, val]) => ({ k, v: val }))
  const [rows, setRows] = useState(() => toRows(value))
  const [synced, setSynced] = useState(value)
  // Re-sync when the value changes from outside (e.g. reset after save).
  if (JSON.stringify(synced) !== JSON.stringify(value)) {
    setSynced(value)
    const emitted = Object.fromEntries(rows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]))
    if (JSON.stringify(emitted) !== JSON.stringify(value)) setRows(toRows(value))
  }

  const emit = (next: { k: string; v: string }[]) => {
    setRows(next)
    const obj = Object.fromEntries(next.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v]))
    setSynced(obj)
    onChange(obj)
  }

  const keys = rows.map((r) => r.k.trim())
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const dup = row.k.trim() && keys.indexOf(row.k.trim()) !== i
        const badKey = keyPattern && row.k.trim() && !keyPattern.test(row.k.trim())
        const ValueInput = secretValues ? SecretInput : Input
        return (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                value={row.k}
                placeholder={keyPlaceholder}
                disabled={disabled}
                invalid={Boolean(dup || badKey)}
                className="font-mono text-xs"
                onChange={(e) => emit(rows.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))}
              />
              {dup && <p className="mt-1 text-xs text-danger">Duplicate key</p>}
              {badKey && !dup && (
                <p className="mt-1 text-xs text-danger">Use letters, digits and underscores; don&apos;t start with a digit</p>
              )}
            </div>
            <div className="flex-1">
              <ValueInput
                value={row.v}
                placeholder={valuePlaceholder}
                disabled={disabled}
                className="text-xs"
                onChange={(e) => emit(rows.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))}
              />
            </div>
            {!disabled && (
              <Button variant="ghost" size="icon" aria-label="Remove row" onClick={() => emit(rows.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            )}
          </div>
        )
      })}
      {rows.length === 0 && disabled && <p className="text-xs text-subtle">None configured</p>}
      {!disabled && (
        <Button
          variant="ghost"
          size="sm"
          className="text-accent hover:text-accent"
          onClick={() => setRows([...rows, { k: '', v: '' }])}
        >
          <Plus /> {addLabel}
        </Button>
      )}
    </div>
  )
}

/** Free-form string list entered as chips (Enter or comma to add). */
export function TagInput({
  value,
  onChange,
  disabled,
  placeholder = 'Type and press Enter',
  mono,
  validate,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  placeholder?: string
  mono?: boolean
  validate?: (v: string) => string | null
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const v = draft.trim().replace(/,$/, '')
    if (!v) return
    const err = validate?.(v) ?? (value.includes(v) ? 'Already added' : null)
    if (err) {
      setError(err)
      return
    }
    onChange([...value, v])
    setDraft('')
    setError(null)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={cn(
          'flex min-h-8.5 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5',
          'focus-within:border-accent focus-within:ring-3 focus-within:ring-ring',
          disabled && 'bg-surface-2',
        )}
      >
        {value.map((v) => (
          <span
            key={v}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md border border-line bg-surface-2 pr-1 pl-2 text-xs text-fg',
              mono && 'font-mono',
            )}
          >
            {v}
            {!disabled && (
              <button
                type="button"
                className="rounded p-0.5 text-subtle hover:bg-surface-3 hover:text-fg"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            onKeyDown={onKey}
            onBlur={add}
            placeholder={value.length ? '' : placeholder}
            className={cn(
              'min-w-32 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-subtle',
              mono && 'font-mono text-xs',
            )}
          />
        )}
        {disabled && value.length === 0 && <span className="px-1 text-xs text-subtle">None</span>}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}
