import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, Link2, PhoneCall, Plug, TriangleAlert, Unplug } from 'lucide-react'
import { ApiError } from '@/api/client'
import { telephonyApi } from '@/api/endpoints'
import type { Environment, TelephonyConnectBody, TelephonyState } from '@/api/types'
import { copyToClipboard } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TagInput } from '@/components/ui/editors'
import { Field, Input } from '@/components/ui/input'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { toastError } from '../helpers'

const E164 = /^\+[1-9]\d{6,14}$/

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs break-all select-all">{value}</code>
        <Button
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await copyToClipboard(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </Field>
  )
}

/** Shown when the saved numbers already answer inbound calls for another agent: ask for a different inbound number. */
function InboundNumberModal({ agentId, reason, origination, onClose }: { agentId: string; reason: string; origination: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [numbers, setNumbers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const enable = useMutation({
    mutationFn: () => telephonyApi.enableInbound(agentId, numbers),
    onSuccess: (s) => {
      qc.setQueryData(['telephony', agentId], s)
      toast.success('Inbound calls enabled')
      onClose()
    },
    // A second clash (or any other refusal) stays in the form instead of closing it.
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not enable inbound calls'),
  })
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Enter an inbound calling number"
      description={reason}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={numbers.length === 0} loading={enable.isPending} onClick={() => enable.mutate()}>
            <Plug /> Enable inbound
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Inbound calling number" hint="A number from your provider that no other agent answers on. Press Enter after each. Outbound calls keep using the numbers saved in Development.">
          <TagInput
            mono
            value={numbers}
            onChange={(v) => {
              setNumbers(v)
              setError(null)
            }}
            placeholder="+919876543210"
            validate={(v) => (E164.test(v.replace(/[\s-]/g, '')) ? null : 'Use the + country code format, e.g. +919876543210')}
          />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        {origination && (
          <CopyField label="Origination SIP URI" value={origination} hint="Point this number at the URI above in your provider's trunk, or inbound calls won't reach this agent." />
        )}
      </div>
    </Modal>
  )
}

/** Pick one of the outbound trunks that already exist in LiveKit instead of entering provider details. */
function ExistingTrunkModal({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['telephony', agentId, 'trunks'], queryFn: () => telephonyApi.availableTrunks(agentId), staleTime: 0 })
  const [busy, setBusy] = useState<string | null>(null)
  const use = useMutation({
    mutationFn: (id: string) => {
      setBusy(id)
      return telephonyApi.useTrunk(agentId, id)
    },
    onSuccess: (s) => {
      qc.setQueryData(['telephony', agentId], s)
      toast.success('Agent connected to the trunk')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not connect to that trunk'),
    onSettled: () => setBusy(null),
  })
  const rows = list.data ?? []
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title="Connect to an existing trunk"
      description="Outbound trunks already set up for your organization, including ones other agents use. This agent will use the trunk's numbers; the trunk itself is shared and is not changed."
    >
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Plug />}
          title="No existing outbound trunks"
          description="Ask a Super Admin to create one under Telephony, or connect with your provider details instead."
        />
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  {t.name}
                  {t.linked && <Badge tone="success" dot>Connected</Badge>}
                  {t.shared_with > 0 && <Badge tone="info">Also used by {t.shared_with} other agent{t.shared_with === 1 ? '' : 's'}</Badge>}
                </div>
                <div className="font-mono text-xs break-all text-muted">{t.address ?? '—'}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {t.usable ? t.numbers.map((n) => <Badge key={n} tone="neutral">{n}</Badge>) : <span className="text-xs text-warning">No specific phone number on this trunk</span>}
                </div>
              </div>
              <Button
                variant={t.linked ? 'secondary' : 'primary'}
                disabled={!t.usable || t.linked}
                loading={busy === t.id}
                onClick={() => use.mutate(t.id)}
              >
                <Link2 /> {t.linked ? 'Connected' : 'Connect'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function ConnectModal({ agentId, current, onClose, onUseExisting }: { agentId: string; current: TelephonyState; onClose: () => void; onUseExisting: () => void }) {
  const qc = useQueryClient()
  const editing = current.connected
  const [form, setForm] = useState({
    termination_uri: current.termination_uri ?? '',
    auth_username: current.auth_username ?? '',
    auth_password: '',
    numbers: current.numbers,
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const save = useMutation({
    mutationFn: () =>
      telephonyApi.connect(agentId, {
        ...form,
        termination_uri: form.termination_uri.trim(),
        auth_username: form.auth_username.trim() || null,
        auth_password: form.auth_password || null,
      } satisfies TelephonyConnectBody),
    onSuccess: (s) => {
      qc.setQueryData(['telephony', agentId], s)
      toast.success('Telephony connected')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not connect telephony'),
  })
  const needPassword = !editing && form.auth_username.trim() !== '' && form.auth_password === ''
  const valid = form.termination_uri.trim() !== '' && form.numbers.length > 0 && !needPassword

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={editing ? 'Edit telephony connection' : 'Connect telephony'}
      description="Enter the values from your SIP provider's trunk (for example Twilio Elastic SIP Trunking). The LiveKit outbound trunk is created for you."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            <Plug /> {editing ? 'Save changes' : 'Connect'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <button type="button" onClick={onUseExisting} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-left text-[13px] text-muted transition-colors hover:bg-surface-2">
          <Link2 className="size-4" /> Already have an outbound trunk in LiveKit? <span className="font-medium text-accent">Connect to an existing trunk</span>
        </button>
        <Field label="Termination SIP URI" hint="Your provider's SIP host that LiveKit dials for outbound calls, e.g. mytrunk.pstn.twilio.com (no sip: prefix needed).">
          <Input value={form.termination_uri} onChange={(e) => set('termination_uri', e.target.value)} placeholder="mytrunk.pstn.twilio.com" className="font-mono" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auth username" hint="From the provider's credential list.">
            <Input value={form.auth_username} onChange={(e) => set('auth_username', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Auth password" hint={editing ? 'Leave empty to keep the current password.' : undefined}>
            <Input type="password" value={form.auth_password} onChange={(e) => set('auth_password', e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <Field label="Phone numbers" hint="Numbers bought from the provider, with country code. Press Enter after each.">
          <TagInput
            mono
            value={form.numbers}
            onChange={(v) => set('numbers', v)}
            placeholder="+919876543210"
            validate={(v) => (E164.test(v.replace(/[\s-]/g, '')) ? null : 'Use the + country code format, e.g. +919876543210')}
          />
        </Field>
      </div>
    </Modal>
  )
}

function NumberBadges({ numbers }: { numbers: string[] }) {
  return (
    <dd className="mt-0.5 flex flex-wrap gap-1.5">
      {numbers.map((n) => (
        <Badge key={n} tone="neutral">{n}</Badge>
      ))}
    </dd>
  )
}

/** Development / Stage: the provider details the outbound trunk was made from. No inbound information here. */
function Summary({ t }: { t: TelephonyState }) {
  return (
    <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
      <div>
        <dt className="text-xs text-muted">Termination URI</dt>
        <dd className="font-mono text-xs break-all">{t.termination_uri}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Auth username</dt>
        <dd className="font-mono text-xs">{t.auth_username || '—'}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Numbers</dt>
        <NumberBadges numbers={t.numbers} />
      </div>
      <div>
        <dt className="text-xs text-muted">Outbound trunk</dt>
        <dd className="mt-0.5 flex flex-wrap gap-1.5">
          <Badge tone="success">Outbound on</Badge>
          {t.outbound_trunk_shared && <Badge tone="info">Existing trunk</Badge>}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Deployment → Telephony.
 * Development: save the SIP provider details (sets up outbound).
 * Production: switch inbound on, using the details saved in Development.
 * `canManage` is the user's edit right; the builder's read-only flag only reflects the viewed environment.
 */
export function TelephonyPanel({ agentId, env, canManage }: { agentId: string; env: Environment; canManage: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [existingOpen, setExistingOpen] = useState(false)
  const [needNumber, setNeedNumber] = useState<string | null>(null)
  const q = useQuery({ queryKey: ['telephony', agentId], queryFn: () => telephonyApi.get(agentId) })
  const t = q.data
  const set = (s: TelephonyState) => qc.setQueryData(['telephony', agentId], s)

  const disconnect = useMutation({
    mutationFn: () => telephonyApi.disconnect(agentId),
    onSuccess: (s) => {
      set(s)
      toast.success('Telephony disconnected')
    },
    onError: (e) => toastError(e, 'Could not disconnect'),
  })
  const inbound = useMutation({
    mutationFn: (on: boolean) => (on ? telephonyApi.enableInbound(agentId) : telephonyApi.disableInbound(agentId)),
    onSuccess: (s) => {
      set(s)
      toast.success(s.inbound_enabled ? 'Inbound calls enabled' : 'Inbound calls disabled')
    },
    onError: (e) => {
      // The saved numbers already answer inbound for another agent: ask for a different one instead of failing.
      if (e instanceof ApiError && e.type === 'CONFLICT') setNeedNumber(e.message)
      else toastError(e, 'Could not change inbound calling')
    },
  })

  const askDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect telephony?',
      description: `The LiveKit trunks${t?.inbound_enabled ? ', including inbound,' : ''} for this agent are deleted. Calls to its numbers will stop being answered.`,
      confirmLabel: 'Disconnect',
    })
    if (ok) disconnect.mutate()
  }
  const askDisableInbound = async () => {
    const ok = await confirm({
      title: 'Disable inbound calls?',
      description: 'Calls to this agent’s numbers will stop being answered. Outbound calling is not affected.',
      confirmLabel: 'Disable inbound',
    })
    if (ok) inbound.mutate(false)
  }

  if (q.isLoading || !t) return <Skeleton className="h-16 w-full" />

  return (
    <div className="mb-4 rounded-xl border border-line p-4">
      {env === 'development' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <PhoneCall className="size-4 text-muted" /> SIP provider
                {t.connected ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="neutral">Not connected</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {t.connected
                  ? 'Outbound calls go out through the trunk created from your provider details.'
                  : 'Connect Elastic SIP Trunking (Twilio, Telnyx, Plivo…) to make outbound phone calls.'}
              </p>
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                {t.connected && (
                  <Button variant="danger" loading={disconnect.isPending} onClick={askDisconnect}>
                    <Unplug /> Disconnect
                  </Button>
                )}
                <Button onClick={() => setExistingOpen(true)}>
                  <Link2 /> Use existing trunk
                </Button>
                <Button variant="primary" onClick={() => setOpen(true)}>
                  <Plug /> {t.connected ? 'Edit connection' : 'Connect telephony'}
                </Button>
              </div>
            )}
          </div>
          {t.connected && <Summary t={t} />}
        </>
      )}

      {env === 'production' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <PhoneCall className="size-4 text-muted" /> Inbound calls
                {t.inbound_enabled ? <Badge tone="success" dot>Enabled</Badge> : <Badge tone="neutral">Off</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-muted">Calls to this agent&apos;s numbers are answered with its Production config.</p>
            </div>
            {canManage && t.connected && (
              <div className="flex flex-wrap gap-2">
                {t.inbound_enabled ? (
                  <Button variant="danger" loading={inbound.isPending} onClick={askDisableInbound}>
                    <Unplug /> Disable inbound
                  </Button>
                ) : (
                  <Button variant="primary" loading={inbound.isPending} onClick={() => inbound.mutate(true)}>
                    <Plug /> Enable inbound
                  </Button>
                )}
              </div>
            )}
          </div>
          {t.connected ? (
            <dl className="mt-4 text-[13px]">
              <dt className="text-xs text-muted">Inbound number{t.inbound_numbers.length === 1 ? '' : 's'}</dt>
              <NumberBadges numbers={t.inbound_numbers} />
            </dl>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] text-warning">
              <TriangleAlert className="mt-px size-4 shrink-0" />
              <span>
                No telephony details saved yet. First fill in the SIP provider details in <span className="font-medium">Development</span> (Deployment →
                Telephony → Connect telephony), then come back here to enable inbound.
              </span>
            </div>
          )}
        </>
      )}

      {env === 'stage' && (
        <>
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <PhoneCall className="size-4 text-muted" /> SIP provider
            {t.connected ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="neutral">Not connected</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted">Telephony is configured in Development. Nothing to configure for Stage.</p>
          {t.connected && <Summary t={t} />}
        </>
      )}

      {env === 'production' && t.connected && t.origination_uri && (
        <div className="mt-4">
          <CopyField label="Origination SIP URI" value={t.origination_uri} hint="Give this to your provider as the Origination URI so inbound calls reach LiveKit." />
        </div>
      )}

      {open && (
        <ConnectModal
          agentId={agentId}
          current={t}
          onClose={() => setOpen(false)}
          onUseExisting={() => {
            setOpen(false)
            setExistingOpen(true)
          }}
        />
      )}
      {existingOpen && <ExistingTrunkModal agentId={agentId} onClose={() => setExistingOpen(false)} />}
      {needNumber && <InboundNumberModal agentId={agentId} reason={needNumber} origination={t.origination_uri} onClose={() => setNeedNumber(null)} />}
    </div>
  )
}
