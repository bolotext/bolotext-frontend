import type { UsageTotals } from '@/api/types'

export const money = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: n >= 1 ? 2 : 4,
    maximumFractionDigits: n >= 1 ? 2 : 4,
  }).format(n)

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
export const compactNum = (n: number) => (n < 1000 ? n.toLocaleString() : compact.format(n))

export function audioLabel(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} s`
  const m = seconds / 60
  if (m < 120) return `${m.toFixed(1)} min`
  return `${(m / 60).toFixed(1)} h`
}

/** Human-readable usage of one kind, in that kind's own unit. */
export function usageLabel(kind: 'stt' | 'llm' | 'tts', u: UsageTotals) {
  if (kind === 'stt') return audioLabel(u.audio_seconds)
  if (kind === 'tts') return `${compactNum(u.characters)} chars`
  return `${compactNum(u.input_tokens)} in · ${compactNum(u.output_tokens)} out`
}

export const KIND_LABEL = { stt: 'STT', llm: 'LLM', tts: 'TTS' } as const
export const KIND_UNIT = { stt: 'per audio minute', llm: 'per 1M tokens', tts: 'per 1M characters' } as const


/** Rupee amount for a USD figure, or null while no rate is set. */
export const inr = (usd: number, rate: number | null | undefined) =>
  rate ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: usd * rate >= 100 ? 0 : 2 }).format(usd * rate) : null

const iso = (d: Date) => d.toISOString().slice(0, 10)
export const defaultRange = (days = 30) => ({ from: iso(new Date(Date.now() - (days - 1) * 86_400_000)), to: iso(new Date()) })
