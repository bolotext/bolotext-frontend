import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { ApprovalStatus, SendStatus, WhatsAppTemplateOut, WhatsAppField, WhatsAppFieldType } from '@/api/types'

// Non-component WhatsApp helpers (kept apart from shared.tsx so Fast Refresh works).

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export const SEND_STATUS: Record<SendStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Not sent', tone: 'neutral' },
  queued: { label: 'Sending…', tone: 'info' },
  // Once Twilio has accepted the message the Contacts tab calls it Delivered; the Message status tab shows the real state.
  sent: { label: 'Delivered', tone: 'success' },
  delivered: { label: 'Delivered', tone: 'success' },
  read: { label: 'Delivered', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
}

export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

export const USE_CASES = [
  { value: 'payment-reminder', label: 'Payment reminder' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'order-update', label: 'Order update' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'other', label: 'Other' },
]

export const labelForUseCase = (v: string | null) => USE_CASES.find((u) => u.value === v)?.label ?? v ?? '—'

export const CATEGORY_HELP: Record<string, string> = {
  utility: 'Transactional updates a customer expects (reminders, order status).',
  marketing: 'Promotions and offers. Needs stricter opt-in and costs more.',
  authentication: 'One-time passcodes and login verification.',
}

export function useWhatsAppConfig() {
  return useQuery({ queryKey: qk.wa.config, queryFn: whatsappApi.config, staleTime: 5 * 60_000 })
}

/** Raw Twilio statuses shown in the Message status tab. */
export const TWILIO_STATUS: Record<string, { label: string; tone: Tone }> = {
  simulated: { label: 'Simulated (dry-run)', tone: 'neutral' },
  accepted: { label: 'Accepted', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  queued: { label: 'Queued', tone: 'info' },
  sending: { label: 'Sending', tone: 'info' },
  sent: { label: 'Sent', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'success' },
  read: { label: 'Read', tone: 'success' },
  undelivered: { label: 'Undelivered', tone: 'danger' },
  failed: { label: 'Failed', tone: 'danger' },
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export const FIELD_TYPES: { value: WhatsAppFieldType; label: string; hint: string }[] = [
  { value: 'string', label: 'String', hint: 'Text' },
  { value: 'number', label: 'Number', hint: 'e.g. 1500 or 99.5' },
  { value: 'long', label: 'Long', hint: 'whole number, 64-bit' },
  { value: 'boolean', label: 'Boolean', hint: 'true/false, yes/no, 1/0' },
  { value: 'checkbox', label: 'Checkbox', hint: 'tick box; stored as true/false' },
  { value: 'date', label: 'Date', hint: 'YYYY-MM-DD' },
]

const BUILTIN: WhatsAppField[] = [
  { key: 'full_name', type: 'string', required: true, locked: true },
  { key: 'phone_number', type: 'long', required: true, locked: true },
]

/** The agent's upload fields (full_name and phone_number plus its custom ones). */
export function useAgentFields(agentId: string): WhatsAppField[] {
  const { data } = useQuery({ queryKey: qk.wa.agent(agentId), queryFn: () => whatsappApi.getAgent(agentId) })
  return data?.field_mapper ?? BUILTIN
}

/** Phone numbers are stored as integers (E.164 digits); show them in the usual `+` form. */
export const formatPhone = (n: number) => `+${n}`

/** WhatsApp approval status exactly as Twilio reports it for a template in the account. */
export const TWILIO_APPROVAL: Record<string, { label: string; tone: Tone }> = {
  approved: { label: 'Approved', tone: 'success' },
  pending: { label: 'Pending approval', tone: 'warning' },
  received: { label: 'Pending approval', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
  paused: { label: 'Paused', tone: 'danger' },
  disabled: { label: 'Disabled', tone: 'danger' },
  unsubmitted: { label: 'Not submitted to WhatsApp', tone: 'neutral' },
}

export const SOURCE_LABEL = { bolotext: 'Created in Bolotext', twilio: 'From Twilio' } as const

/** Mirrors the backend: SMS templates are always sendable; WhatsApp ones must be approved (Twilio-linked ones unless rejected). */
export const canSendWith = (t: WhatsAppTemplateOut, sms = false) =>
  sms || (Boolean(t.twilio_content_sid) && (t.approval_status === 'approved' || (t.source === 'twilio' && t.approval_status !== 'rejected')))
