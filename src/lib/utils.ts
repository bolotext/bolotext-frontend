import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ApiError } from '@/api/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Backend timestamps are naive UTC ("2026-09-19T17:16:12.362000").
function parseDate(value: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return '—'
  const d = parseDate(value)
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return 'never'
  const diff = (Date.now() - parseDate(value).getTime()) / 1000
  if (diff < 45) return 'just now'
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Infinity, 'year'],
  ]
  let n = diff
  for (const [step, unit] of units) {
    if (Math.abs(n) < step) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-Math.round(n), unit)
    n /= step
  }
  return formatDate(value)
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}

export function errorDetails(err: unknown): string[] {
  return err instanceof ApiError ? err.details : []
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  )
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Stable JSON comparison for dirty-checking form state against server state. */
export function isEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** `{{name}}` placeholders referenced in prompt text — same pattern as
 * agents_service/prompt/service.py _DYNAMIC_VAR_PATTERN. */
export function extractVariables(...texts: (string | null | undefined)[]) {
  const set = new Set<string>()
  for (const t of texts) for (const m of (t ?? '').matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) set.add(m[1])
  return [...set]
}

export function copyToClipboard(text: string) {
  return navigator.clipboard?.writeText(text)
}
