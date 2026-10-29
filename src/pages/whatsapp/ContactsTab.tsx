import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Plus, Send, SearchX, Trash2, Upload, Users, X } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppContactOut } from '@/api/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, SearchInput, Select } from '@/components/ui/input'
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger, Modal, useConfirm } from '@/components/ui/overlay'
import { Card, EmptyState, ErrorState, Switch } from '@/components/ui/primitives'
import { Pager, Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'
import { APPROVAL_STATUS, canSendWith, formatPhone, SOURCE_LABEL, useAgentFields, useDebounced, useWhatsAppConfig } from './helpers'
import { Checkbox, CheckRow, SendStatusBadge } from './shared'
import { useChannel } from './channel'
import { UploadModal } from './UploadModal'

const PAGE_SIZE = 50

// ---------------------------------------------------------------- add / edit
function ContactModal({ agentId, contact, onClose }: { agentId: string; contact: WhatsAppContactOut | 'new'; onClose: () => void }) {
  const qc = useQueryClient()
  const editing = contact === 'new' ? null : contact
  const [name, setName] = useState(editing?.customer_name ?? '')
  const [phone, setPhone] = useState(editing ? formatPhone(editing.phone_number) : '')
  const [optedOut, setOptedOut] = useState(editing?.opted_out ?? false)
  const custom = useAgentFields(agentId).filter((f) => !f.locked)
  const [extra, setExtra] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(editing?.data ?? {}).map(([k, v]) => [k, String(v ?? '').slice(0, typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? 10 : undefined)])),
  )

  const save = useMutation({
    mutationFn: () => {
      const body = { customer_name: name.trim(), phone_number: phone.trim(), data: { ...Object.fromEntries(custom.filter((f) => f.type === 'checkbox').map((f) => [f.key, 'false'])), ...extra } }
      return editing ? whatsappApi.updateContact(agentId, editing.id, { ...body, opted_out: optedOut }) : whatsappApi.createContact(agentId, body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.wa.contacts(agentId) })
      void qc.invalidateQueries({ queryKey: qk.wa.stats(agentId) })
      toast.success(editing ? 'Contact updated' : 'Contact added')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not save contact'),
  })

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={editing ? 'Edit contact' : 'Add contact'}
      description={editing && editing.send_status !== 'pending' ? 'Changing the name, number or details makes this contact sendable again.' : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || !phone.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            {editing ? 'Save changes' : 'Add contact'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name">
          <Input autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone number" hint="International format, e.g. +919876543210. A 10-digit number is treated as +91.">
          <Input value={phone} maxLength={32} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </Field>
        {custom.map((f) =>
          f.type === 'checkbox' ? (
            <label key={f.key} className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-fg">
              <Checkbox checked={extra[f.key] === 'true'} onChange={(e) => setExtra({ ...extra, [f.key]: String(e.target.checked) })} />
              {f.key}
            </label>
          ) : (
            <Field key={f.key} label={f.key} hint={f.required ? 'Required' : undefined}>
              {f.type === 'boolean' ? (
                <Select value={extra[f.key] ?? ''} onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}>
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              ) : (
                <Input
                  type={f.type === 'date' ? 'date' : f.type === 'number' || f.type === 'long' ? 'number' : 'text'}
                  step={f.type === 'number' ? 'any' : f.type === 'long' ? 1 : undefined}
                  value={extra[f.key] ?? ''}
                  onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
                />
              )}
            </Field>
          ),
        )}
        {editing && (
          <label className="flex cursor-pointer items-center justify-between gap-6 rounded-lg border border-line px-3.5 py-3">
            <div>
              <div className="text-[13px] font-medium text-fg">Opted out</div>
              <div className="text-xs text-muted">Never send messages to this contact.</div>
            </div>
            <Switch checked={optedOut} onCheckedChange={setOptedOut} />
          </label>
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- send
function SendModal({
  agentId,
  selected,
  batchId,
  batchName,
  onClose,
  onSent,
}: {
  agentId: string
  selected: string[]
  batchId: string | null
  batchName: string | null
  onClose: () => void
  onSent: () => void
}) {
  const qc = useQueryClient()
  const ch = useChannel()
  const sms = ch.channel === 'sms'
  const config = useWhatsAppConfig()
  const templates = useQuery({ queryKey: qk.wa.templates(agentId), queryFn: () => whatsappApi.listTemplates(agentId), staleTime: 0 })
  const approved = (templates.data ?? []).filter((t) => canSendWith(t, sms))
  const [scope, setScope] = useState<'selected' | 'batch'>(selected.length ? 'selected' : 'batch')
  const [templateId, setTemplateId] = useState('')
  const [consent, setConsent] = useState(false)

  const send = useMutation({
    mutationFn: () =>
      whatsappApi.send(agentId, {
        ...(scope === 'selected' ? { contact_ids: selected } : { batch_id: batchId! }),
        template_id: templateId || null,
        consent_confirmed: consent,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk.wa.contacts(agentId) })
      void qc.invalidateQueries({ queryKey: qk.wa.stats(agentId) })
      if (r.queued === 0) toast.info('Nothing to send — those contacts were already sent, queued or opted out.')
      else toast.success(`${r.queued} message${r.queued === 1 ? '' : 's'} ${r.dry_run ? 'simulated (dry-run)' : 'queued'}${r.skipped ? ` · ${r.skipped} skipped` : ''}`)
      onSent()
    },
    onError: (e) => toastError(e, 'Could not send messages'),
  })

  const canSend = (scope === 'selected' ? selected.length > 0 : Boolean(batchId)) && consent
  const dry = config.data?.dry_run

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={sms ? 'Send SMS messages' : 'Send WhatsApp messages'}
      description="Contacts that are already sent, delivered or opted out are skipped automatically."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!canSend} loading={send.isPending} onClick={() => send.mutate()}>
            <Send /> {dry ? 'Simulate send' : 'Send now'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {dry && <div className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Dry-run mode: nothing will actually be sent.</div>}
        {sms && (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            Sending to Indian numbers requires a DLT-registered sender and template [TO CONFIRM with Compliance]. Twilio reports blocked messages in Message status.
          </div>
        )}
        <Field label="Recipients">
          <div className="space-y-2">
            <label className={cn('flex items-center gap-2.5 text-[13px]', !selected.length && 'opacity-50')}>
              <input type="radio" className="accent-accent" disabled={!selected.length} checked={scope === 'selected'} onChange={() => setScope('selected')} />
              {selected.length} selected contact{selected.length === 1 ? '' : 's'}
            </label>
            <label className={cn('flex items-center gap-2.5 text-[13px]', !batchId && 'opacity-50')}>
              <input type="radio" className="accent-accent" disabled={!batchId} checked={scope === 'batch'} onChange={() => setScope('batch')} />
              {batchId ? <>Every unsent contact in <span className="font-medium">{batchName}</span></> : 'Every unsent contact of an upload (filter by upload first)'}
            </label>
          </div>
        </Field>
        <Field
          label="Message"
          hint={
            sms
              ? templateId
                ? 'The template text is filled in for each contact and sent as an SMS.'
                : 'Each contact’s own message column is sent as the SMS text; contacts without one fail.'
              : templateId
              ? templates.data?.find((t) => t.id === templateId)?.source === 'twilio' ? 'Sent through this Twilio template. WhatsApp must have approved it for your sender, otherwise Twilio rejects it (see Message status).' : 'Sent through the approved template, so it can reach customers at any time.'
              : 'Each contact’s own message is sent as plain text. WhatsApp only delivers this to customers who messaged you in the last 24 hours — use an approved template otherwise.'
          }
        >
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">No template — send each contact’s message as text</option>
            {sms &&
              (templates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            {!sms && (['bolotext', 'twilio'] as const).map((src) => {
              const group = (templates.data ?? []).filter((t) => t.source === src)
              return (
                group.length > 0 && (
                  <optgroup key={src} label={SOURCE_LABEL[src]}>
                    {group.map((t) => (
                      <option key={t.id} value={t.id} disabled={!canSendWith(t, sms)}>
                        {t.name}
                        {!canSendWith(t, sms) && ` — ${APPROVAL_STATUS[t.approval_status].label}`}
                      </option>
                    ))}
                  </optgroup>
                )
              )
            })}
          </Select>
          {!templates.isLoading && approved.length === 0 && (
            <p className="text-xs text-muted">
              {(templates.data ?? []).length === 0 ? 'No templates yet.' : 'None of your templates can be sent yet.'}{' '}
              {sms ? 'Add a text template in' : 'Create or submit one in Bolotext, or link one from Twilio, in'}{' '}
              <Link to={`${ch.base}/${agentId}/settings?section=templates`} className="font-medium text-accent hover:underline">
                Settings → Templates
              </Link>
              {sms ? '.' : '; WhatsApp must approve it before it can be selected.'}
            </p>
          )}
        </Field>
        <CheckRow checked={consent} onChange={(e) => setConsent(e.target.checked)} label={`Every recipient has opted in to receive ${ch.noun} messages from us.`} />
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- tab
const DELIVERED = 'sent,delivered,read'
const STATUS_FILTERS = [
  { value: 'pending', label: 'Not sent' },
  { value: 'queued', label: 'Sending…' },
  { value: DELIVERED, label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

export function ContactsTab({ agentId, canWrite }: { agentId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const batchId = params.get('batch') ?? ''
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<WhatsAppContactOut | 'new' | null>(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const batches = useQuery({ queryKey: qk.wa.batches(agentId), queryFn: () => whatsappApi.listBatches(agentId) })
  const stats = useQuery({
    queryKey: qk.wa.stats(agentId),
    queryFn: () => whatsappApi.stats(agentId),
    refetchInterval: (query) => (query.state.data?.queued ? 2000 : false),
  })
  const contacts = useQuery({
    queryKey: [...qk.wa.contacts(agentId), { q, status, batchId, page }],
    queryFn: () => whatsappApi.listContacts(agentId, { q, status, batch_id: batchId, skip: page * PAGE_SIZE, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
    // While messages are going out, poll so statuses tick over live.
    refetchInterval: (query) => (query.state.data?.items.some((c) => c.send_status === 'queued') ? 2000 : false),
  })

  const rows = useMemo(() => contacts.data?.items ?? [], [contacts.data])
  const total = contacts.data?.total ?? 0
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const batch = batches.data?.find((b) => b.id === batchId)
  const hasFilters = Boolean(q || status || batchId)

  const resetPage = () => setPage(0)
  const setBatch = (id: string) => {
    setParams(id ? { batch: id } : {}, { replace: true })
    resetPage()
  }
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })
  const togglePage = () =>
    setSelected((s) => {
      const n = new Set(s)
      for (const r of rows) {
        if (allOnPage) n.delete(r.id)
        else n.add(r.id)
      }
      return n
    })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.wa.contacts(agentId) })
    void qc.invalidateQueries({ queryKey: qk.wa.stats(agentId) })
  }
  const remove = useMutation({
    mutationFn: (ids: string[]) => (ids.length === 1 ? whatsappApi.deleteContact(agentId, ids[0]).then(() => 1) : whatsappApi.bulkDeleteContacts(agentId, ids)),
    onSuccess: (n, ids) => {
      invalidate()
      setSelected((s) => {
        const next = new Set(s)
        ids.forEach((i) => next.delete(i))
        return next
      })
      toast.success(`Deleted ${n} contact${n === 1 ? '' : 's'}`)
    },
    onError: (e) => toastError(e, 'Could not delete'),
  })
  const askDelete = async (ids: string[], label: string) => {
    const ok = await confirm({ title: `Delete ${label}?`, description: 'Their delivery history is deleted too. This cannot be undone.', confirmLabel: 'Delete' })
    if (ok) remove.mutate(ids)
  }

  const s = stats.data
  const statCards: [string, number | undefined, string][] = [
    ['Contacts', s?.total, ''],
    ['Not sent', s?.pending, 'pending'],
    ['Sending', s?.queued, 'queued'],
    ['Delivered', s ? s.sent + s.delivered + s.read : undefined, DELIVERED],
    ['Failed', s?.failed, 'failed'],
  ]

  const empty = !contacts.isLoading && total === 0 && !hasFilters

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {statCards.map(([label, value, filter]) => (
          <button
            key={label}
            type="button"
            disabled={!filter}
            onClick={() => {
              setStatus(filter)
              resetPage()
            }}
            className={cn(
              'rounded-lg border border-line bg-surface px-3 py-2 text-left shadow-card transition-colors enabled:hover:bg-surface-2',
              status && status === filter && 'ring-1 ring-accent',
            )}
          >
            <div className="text-[11px] text-muted">{label}</div>
            <div className="text-lg font-semibold tabular-nums text-fg">{value ?? '–'}</div>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            resetPage()
          }}
          placeholder="Search name or phone…"
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            resetPage()
          }}
          className="w-40"
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((st) => (
            <option key={st.value} value={st.value}>
              {st.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by upload" value={batchId} onChange={(e) => setBatch(e.target.value)} className="w-48">
          <option value="">All uploads</option>
          {(batches.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.filename}
            </option>
          ))}
        </Select>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch('')
              setStatus('')
              setBatch('')
            }}
          >
            <X /> Clear
          </Button>
        )}
        {canWrite && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button onClick={() => setUploadOpen(true)}>
              <Upload /> Upload CSV
            </Button>
            <Button onClick={() => setEditing('new')}>
              <Plus /> Add contact
            </Button>
            <Button variant="primary" onClick={() => setSendOpen(true)}>
              <Send /> Send messages
            </Button>
          </div>
        )}
      </div>

      {canWrite && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-accent-soft px-3.5 py-2 text-[13px]">
          <span className="font-medium text-fg">{selected.size} selected</span>
          <Button size="sm" variant="primary" onClick={() => setSendOpen(true)}>
            <Send /> Send to selected
          </Button>
          <Button size="sm" variant="danger" onClick={() => askDelete([...selected], `${selected.size} contacts`)}>
            <Trash2 /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {contacts.error ? (
        <Card>
          <ErrorState error={contacts.error} onRetry={() => contacts.refetch()} />
        </Card>
      ) : empty ? (
        <Card>
          <EmptyState
            icon={<Users />}
            title="No contacts yet"
            description="Upload a CSV with full_name and phone_number, or add a contact by hand."
            action={
              canWrite && (
                <Button variant="primary" onClick={() => setUploadOpen(true)}>
                  <Upload /> Upload CSV
                </Button>
              )
            }
          />
        </Card>
      ) : !contacts.isLoading && rows.length === 0 ? (
        <Card>
          <EmptyState icon={<SearchX />} title="No matching contacts" description="Try a different search or filter." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <Th className="w-10">
                  {canWrite && <Checkbox aria-label="Select all on this page" checked={allOnPage} onChange={togglePage} />}
                </Th>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th className="hidden lg:table-cell">Message</Th>
                <Th>Status</Th>
                <Th className="w-10" />
              </tr>
            </THead>
            {contacts.isLoading ? (
              <TableSkeleton cols={6} />
            ) : (
              <tbody className={cn(contacts.isPlaceholderData && 'opacity-60')}>
                {rows.map((c) => (
                  <Tr key={c.id} className={cn(selected.has(c.id) && 'bg-accent-soft/40')}>
                    <Td className="w-10">
                      {canWrite && <Checkbox aria-label={`Select ${c.customer_name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />}
                    </Td>
                    <Td className="font-medium">{c.customer_name}</Td>
                    <Td className="font-mono text-xs text-muted">{formatPhone(c.phone_number)}</Td>
                    <Td className="hidden max-w-xs lg:table-cell">
                      <div className="truncate text-xs text-muted" title={c.message}>
                        {c.message}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <SendStatusBadge status={c.send_status} />
                        {c.opted_out && <span className="text-[11px] text-subtle">Opted out</span>}
                      </div>
                      {c.error && (
                        <div className="mt-0.5 max-w-56 truncate text-[11px] text-danger" title={c.error}>
                          {c.error}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Contact actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownTrigger>
                          <DropdownContent align="end">
                            <DropdownItem disabled={c.send_status === 'queued'} onSelect={() => setEditing(c)}>
                              <Pencil /> Edit
                            </DropdownItem>
                            <DropdownItem danger onSelect={() => askDelete([c.id], `“${c.customer_name}”`)}>
                              <Trash2 /> Delete
                            </DropdownItem>
                          </DropdownContent>
                        </DropdownMenu>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            )}
          </Table>
          <TotalPager page={page} total={total} onPage={setPage} loading={contacts.isFetching} />
        </Card>
      )}

      {editing && <ContactModal agentId={agentId} contact={editing} onClose={() => setEditing(null)} />}
      {uploadOpen && <UploadModal agentId={agentId} open onOpenChange={setUploadOpen} onUploaded={(id) => setBatch(id)} />}
      {sendOpen && (
        <SendModal
          agentId={agentId}
          selected={[...selected]}
          batchId={batchId || null}
          batchName={batch?.filename ?? null}
          onClose={() => setSendOpen(false)}
          onSent={() => {
            setSendOpen(false)
            setSelected(new Set())
          }}
        />
      )}
    </>
  )
}

function TotalPager({ page, total, onPage, loading }: { page: number; total: number; onPage: (p: number) => void; loading: boolean }) {
  if (total <= PAGE_SIZE) return null
  const count = Math.min(PAGE_SIZE, total - page * PAGE_SIZE)
  return (
    <div>
      <Pager page={page} pageSize={PAGE_SIZE} count={count} onPage={onPage} loading={loading} />
      <div className="border-t border-line px-5 py-1.5 text-right text-[11px] text-subtle">{total} contacts</div>
    </div>
  )
}
