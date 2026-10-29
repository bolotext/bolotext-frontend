import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { FlaskConical, Settings2 } from 'lucide-react'
import type { ApprovalStatus, SendStatus } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/primitives'
import { useChannel } from './channel'
import { APPROVAL_STATUS, SEND_STATUS, TWILIO_APPROVAL, TWILIO_STATUS, useWhatsAppConfig } from './helpers'
import { SettingsModal } from './SettingsModal'

export function SendStatusBadge({ status }: { status: SendStatus }) {
  const m = SEND_STATUS[status]
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  )
}

export function TwilioStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted">—</span>
  const m = TWILIO_STATUS[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  )
}

export function TwilioApprovalBadge({ status }: { status: string }) {
  const m = TWILIO_APPROVAL[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  )
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const m = APPROVAL_STATUS[status]
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  )
}

/** Opens this organization's Twilio settings (read-only unless the caller is an Admin). */
export function SettingsButton({ variant = 'secondary' }: { variant?: 'secondary' | 'outline' }) {
  const { abilities } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Settings2 /> Twilio settings
      </Button>
      {open && <SettingsModal canEdit={abilities.role === 'ADMIN' || abilities.role === 'SUPER_ADMIN'} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Tells the operator whether a send is simulated or real. */
export function ModeBanner() {
  const { data } = useWhatsAppConfig()
  const ch = useChannel()
  if (!data?.dry_run) return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-transparent bg-warning-soft px-3.5 py-2.5 text-[13px] text-warning">
      <FlaskConical className="size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">Dry-run mode.</span> Messages are simulated and nothing is sent to {ch.noun === 'SMS' ? 'a phone' : 'WhatsApp'}. An
        Admin can add this organization&apos;s Twilio credentials and turn dry-run off in Twilio settings.
      </div>
      <SettingsButton variant="outline" />
    </div>
  )
}

export function Checkbox({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <input type="checkbox" className={cn('size-4 cursor-pointer rounded accent-accent disabled:cursor-not-allowed', className)} {...props} />
}

export function CheckRow({ label, children, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; children?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-fg">
      <Checkbox className="mt-0.5" {...props} />
      <span>
        {label}
        {children}
      </span>
    </label>
  )
}
