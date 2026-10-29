import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PlugZap } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppSettings, WhatsAppSettingsUpdate } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Field, Input, SecretInput } from '@/components/ui/input'
import { Modal } from '@/components/ui/overlay'
import { ErrorState, Spinner, Switch } from '@/components/ui/primitives'
import { toastError } from '../agents/helpers'

function SettingsForm({ saved, canEdit, onClose }: { saved: WhatsAppSettings; canEdit: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [sid, setSid] = useState(saved.twilio_account_sid)
  const [token, setToken] = useState('')
  const [from, setFrom] = useState(saved.twilio_whatsapp_from)
  const [smsFrom, setSmsFrom] = useState(saved.twilio_sms_from)
  const [dryRun, setDryRun] = useState(saved.dry_run)
  const [country, setCountry] = useState(saved.default_country_code)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.wa.settings })
    void qc.invalidateQueries({ queryKey: qk.wa.config })
  }
  const save = useMutation({
    mutationFn: () => {
      const body: WhatsAppSettingsUpdate = {
        twilio_account_sid: sid.trim(),
        twilio_whatsapp_from: from.trim(),
        twilio_sms_from: smsFrom.trim(),
        dry_run: dryRun,
        default_country_code: country.trim(),
      }
      if (token.trim()) body.auth_token = token.trim()
      return whatsappApi.saveSettings(body)
    },
    onSuccess: () => {
      refresh()
      toast.success('Twilio settings saved')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not save settings'),
  })
  const test = useMutation({
    mutationFn: whatsappApi.testSettings,
    onSuccess: (r) => (r.ok ? toast.success(r.detail) : toast.error('Connection failed', { description: r.detail })),
    onError: (e) => toastError(e, 'Could not test connection'),
  })

  const dirty =
    sid.trim() !== saved.twilio_account_sid ||
    token.trim() !== '' ||
    from.trim() !== saved.twilio_whatsapp_from ||
    smsFrom.trim() !== saved.twilio_sms_from ||
    dryRun !== saved.dry_run ||
    country.trim() !== saved.default_country_code

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Twilio settings"
      description="Used by every WhatsApp and SMS agent in this organization. Other organizations have their own."
      size="lg"
      footer={
        <>
          <Button className="mr-auto" disabled={!saved.has_auth_token && !saved.dry_run} loading={test.isPending} onClick={() => test.mutate()} title={dirty ? 'Tests the last saved credentials' : undefined}>
            <PlugZap /> Test connection
          </Button>
          <Button onClick={onClose}>{canEdit ? 'Cancel' : 'Close'}</Button>
          {canEdit && (
            <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
              Save settings
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!canEdit && <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Only an Admin can change these settings.</p>}
        <label className="flex cursor-pointer items-center justify-between gap-6 rounded-lg border border-line px-3.5 py-3">
          <div>
            <div className="text-[13px] font-medium text-fg">Dry-run (simulate sending)</div>
            <div className="text-xs text-muted">
              {dryRun ? 'Messages are simulated — nothing is sent to WhatsApp or by SMS.' : 'Messages are really sent through Twilio and billed to your account.'}
            </div>
          </div>
          <Switch checked={dryRun} onCheckedChange={setDryRun} disabled={!canEdit} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account SID" hint="Starts with AC. Find it in the Twilio console.">
            <Input value={sid} disabled={!canEdit} onChange={(e) => setSid(e.target.value)} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="font-mono" autoComplete="off" />
          </Field>
          <Field label="Auth token" hint="Stored encrypted and never shown again. Leave blank to keep the saved token.">
            <SecretInput
              value={token}
              disabled={!canEdit}
              onChange={(e) => setToken(e.target.value)}
              placeholder={saved.has_auth_token ? `Saved ${saved.auth_token_hint ?? ''} — type to replace` : 'Paste your Twilio auth token'}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Default WhatsApp sender" hint="WhatsApp-enabled number, e.g. +14155238886 (sandbox). Each agent can override it.">
            <Input value={from} disabled={!canEdit} onChange={(e) => setFrom(e.target.value)} placeholder="+14155238886" inputMode="tel" />
          </Field>
          <Field label="Default SMS sender" hint="SMS-capable number (e.g. +12025550123) or a Messaging Service SID (MG…). Each SMS agent can override it.">
            <Input value={smsFrom} disabled={!canEdit} onChange={(e) => setSmsFrom(e.target.value)} placeholder="+12025550123" />
          </Field>
          <Field label="Default country code" hint="Added to bare 10-digit numbers in uploads. India is 91.">
            <Input value={country} disabled={!canEdit} onChange={(e) => setCountry(e.target.value)} placeholder="91" inputMode="numeric" maxLength={5} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function SettingsModal({ canEdit, onClose }: { canEdit: boolean; onClose: () => void }) {
  const settings = useQuery({ queryKey: qk.wa.settings, queryFn: whatsappApi.settings })
  if (settings.data) return <SettingsForm saved={settings.data} canEdit={canEdit} onClose={onClose} />
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Twilio settings">
      {settings.error ? <ErrorState error={settings.error} onRetry={() => settings.refetch()} /> : <div className="flex justify-center py-10"><Spinner className="size-5" /></div>}
    </Modal>
  )
}
