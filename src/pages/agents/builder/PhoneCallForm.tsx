import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Phone } from 'lucide-react'
import { telephonyApi } from '@/api/endpoints'
import type { Environment } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/primitives'
import { ENV_META, toastError } from '../helpers'

const E164 = /^\+[1-9]\d{6,14}$/

/** Places a real outbound phone call from the connected SIP trunk to a number you enter. */
export function PhoneCallForm({ agentId, env }: { agentId: string; env: Environment }) {
  const state = useQuery({ queryKey: ['telephony', agentId], queryFn: () => telephonyApi.get(agentId) })
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const call = useMutation({
    mutationFn: () => telephonyApi.call(agentId, { phone_number: phone.replace(/[\s-]/g, ''), environment: env, consent_confirmed: consent }),
    onSuccess: () => toast.success(`Calling ${phone}… the agent dials and speaks once it's answered`),
    onError: (e) => toastError(e, 'Could not start the call'),
  })

  if (state.isLoading) return <Skeleton className="h-24 w-full" />
  const t = state.data
  const blocked = !t?.connected
    ? 'Connect a SIP provider first.'
    : !t.outbound_enabled
      ? 'Outbound calling is turned off for this agent.'
      : null
  if (blocked) {
    return (
      <div className="rounded-lg border border-line bg-surface-2/60 p-4 text-[13px] text-muted">
        {blocked}{' '}
        {!t?.connected && (
          <Link to={`/agents/${agentId}/deployment`} className="font-medium text-accent hover:underline">
            Deployment → Telephony
          </Link>
        )}
      </div>
    )
  }
  const valid = E164.test(phone.replace(/[\s-]/g, ''))
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Calls the {ENV_META[env].label} version of this agent from {t?.numbers[0] ?? 'your number'}.</p>
      <Field label="Phone number to call" hint="International format, e.g. +919876543210." error={phone && !valid ? 'Use the + country code format' : undefined}>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+919876543210" />
      </Field>
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
        <input type="checkbox" className="mt-0.5 accent-accent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          The person being called has agreed to receive this call.
          <span className="mt-0.5 block text-xs text-muted">
            Indian numbers fall under TRAI consent and DND rules, and the agent should say it is an AI [TO CONFIRM with Compliance].
          </span>
        </span>
      </label>
      <Button variant="primary" disabled={!valid || !consent} loading={call.isPending} onClick={() => call.mutate()}>
        <Phone /> Call now
      </Button>
    </div>
  )
}
