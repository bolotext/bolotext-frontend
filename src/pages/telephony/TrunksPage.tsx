import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Braces, Cable, Check, Copy, Hash, Pencil, Plus, Trash2 } from 'lucide-react'
import { telephonyApi } from '@/api/endpoints'
import type { SipDispatchRule, SipTrunk, SipTrunkBody, TrunkKind } from '@/api/types'
import { copyToClipboard } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { TagInput } from '@/components/ui/editors'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { Badge, Card, CardHeader, EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { ApiError } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { toastError } from '../agents/helpers'
import { NumbersTab } from './NumbersTab'

const E164 = /^\+[1-9]\d{6,14}$/
const qk = ['telephony', 'admin'] as const

type EditMode = 'form' | 'json'
type Tab = 'trunks' | 'numbers'

function TrunkModal({ kind, trunk, onClose }: { kind: TrunkKind; trunk: SipTrunk | null; onClose: () => void }) {
  const { abilities } = useAuth()
  const isSuperAdmin = abilities.role === 'SUPER_ADMIN'
  const qc = useQueryClient()
  const editing = Boolean(trunk)
  const [mode, setMode] = useState<EditMode>('form')
  // JSON editor: loaded from the server the first time it is opened, then edited as plain text.
  const [jsonText, setJsonText] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const raw = useQuery({
    queryKey: [...qk, 'raw', kind, trunk?.id],
    queryFn: () => telephonyApi.adminGetRaw(kind, trunk!.id),
    enabled: editing && mode === 'json',
    staleTime: 0,
    gcTime: 0,
  })
  const [f, setF] = useState({
    name: trunk?.name ?? '',
    address: trunk?.address ?? '',
    numbers: trunk?.numbers ?? [],
    auth_username: trunk?.auth_username ?? '',
    auth_password: '',
    allowed_addresses: trunk?.allowed_addresses ?? [],
  })
  const save = useMutation({
    mutationFn: () => {
      const body: SipTrunkBody = {
        name: f.name.trim(),
        numbers: f.numbers,
        auth_username: f.auth_username.trim() || null,
        auth_password: f.auth_password || null,
        ...(kind === 'outbound' ? { address: f.address.trim() } : { allowed_addresses: f.allowed_addresses }),
      }
      return trunk ? telephonyApi.adminUpdate(kind, trunk.id, body) : telephonyApi.adminCreate(kind, body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk })
      toast.success(editing ? 'Trunk updated' : 'Trunk created')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not save trunk'),
  })
  const saveJson = useMutation({
    mutationFn: (doc: Record<string, unknown>) => telephonyApi.adminPutRaw(kind, trunk!.id, doc),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk })
      toast.success('Trunk updated')
      onClose()
    },
    // Validation problems (unknown field, wrong type, missing password) are shown next to the editor.
    onError: (e) => setJsonError(e instanceof ApiError ? e.message : 'Could not save the trunk'),
  })
  const text = jsonText ?? (raw.data ? JSON.stringify(raw.data.trunk, null, 2) : '')
  const submitJson = () => {
    let doc: unknown
    try {
      doc = JSON.parse(text)
    } catch (e) {
      return setJsonError(`Invalid JSON: ${(e as Error).message}`)
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return setJsonError('The JSON must be an object, like { "name": "…" }')
    setJsonError(null)
    saveJson.mutate(doc as Record<string, unknown>)
  }
  const valid = f.name.trim() && (kind === 'inbound' || f.address.trim()) && (kind === 'inbound' || f.numbers.length > 0 || editing)
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={`${editing ? 'Edit' : 'Add'} ${kind} trunk`}
      description={kind === 'outbound' ? 'LiveKit dials your provider through this trunk.' : 'Calls from your provider to these numbers enter LiveKit through this trunk.'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {mode === 'json' ? (
            <Button variant="primary" disabled={!text || raw.isLoading} loading={saveJson.isPending} onClick={submitJson}>
              Save JSON
            </Button>
          ) : (
            <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
              {editing ? 'Save changes' : 'Create trunk'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {editing && (
          <Segmented<EditMode>
            value={mode}
            onChange={(m) => {
              setMode(m)
              setJsonError(null)
            }}
            options={[
              { value: 'form', label: 'Form' },
              { value: 'json', label: <span className="flex items-center gap-1.5"><Braces className="size-3.5" /> JSON editor</span> },
            ]}
          />
        )}
        {mode === 'json' ? (
          <div className="space-y-2">
            {raw.error ? (
              <ErrorState error={raw.error} onRetry={() => raw.refetch()} />
            ) : raw.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <Textarea
                  value={text}
                  rows={22}
                  spellCheck={false}
                  className="font-mono text-xs"
                  onChange={(e) => {
                    setJsonText(e.target.value)
                    setJsonError(null)
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted">
                    Every field of the trunk, as LiveKit stores it (camelCase). sipTrunkId and the dates are read-only and ignored on save; fields you remove are cleared.{isSuperAdmin ? '' : ' metadata is read-only for Admins and is kept as is.'} The password is never shown: leave <code className="font-mono">authPassword</code> out to keep it, or add it to change it.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      try {
                        setJsonText(JSON.stringify(JSON.parse(text), null, 2))
                        setJsonError(null)
                      } catch (e) {
                        setJsonError(`Invalid JSON: ${(e as Error).message}`)
                      }
                    }}
                  >
                    Format
                  </Button>
                </div>
                {jsonError && <p className="text-xs break-words text-danger">{jsonError}</p>}
              </>
            )}
          </div>
        ) : (
          <>
        <Field label="Name">
          <Input value={f.name} maxLength={100} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        {kind === 'outbound' && (
          <Field label="Termination SIP URI" hint="Provider host, e.g. mytrunk.pstn.twilio.com.">
            <Input value={f.address} className="font-mono" onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
        )}
        <Field label="Phone numbers" hint={kind === 'inbound' ? 'Empty accepts calls to any number.' : 'Caller IDs allowed on this trunk.'}>
          <TagInput mono value={f.numbers} onChange={(numbers) => setF({ ...f, numbers })} placeholder="+919876543210" validate={(v) => (E164.test(v.replace(/[\s-]/g, '')) ? null : 'Use +country code format')} />
        </Field>
        {kind === 'inbound' && (
          <Field label="Allowed provider IPs" hint="Only these addresses/CIDRs may call in. Empty allows any [TO CONFIRM with Security].">
            <TagInput mono value={f.allowed_addresses} onChange={(allowed_addresses) => setF({ ...f, allowed_addresses })} placeholder="54.172.60.0/30" />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Auth username">
            <Input value={f.auth_username} autoComplete="off" onChange={(e) => setF({ ...f, auth_username: e.target.value })} />
          </Field>
          <Field label="Auth password" hint={editing ? 'Leave empty to keep the current one.' : undefined}>
            <Input type="password" value={f.auth_password} autoComplete="new-password" onChange={(e) => setF({ ...f, auth_password: e.target.value })} />
          </Field>
        </div>
          </>
        )}
      </div>
    </Modal>
  )
}

function AgentLink({ id }: { id: string | null }) {
  return id ? (
    <Link to={`/agents/${id}/deployment`} className="font-mono text-xs text-accent hover:underline">
      {id.slice(-6)}
    </Link>
  ) : (
    <span className="text-subtle">—</span>
  )
}

function Numbers({ list }: { list: string[] }) {
  return list.length ? (
    <div className="flex flex-wrap gap-1">
      {list.map((n) => (
        <Badge key={n} tone="neutral">{n}</Badge>
      ))}
    </div>
  ) : (
    <span className="text-subtle">any</span>
  )
}

function TrunkTable({ kind, rows, loading, onEdit, onDelete }: { kind: TrunkKind; rows: SipTrunk[]; loading: boolean; onEdit: (t: SipTrunk) => void; onDelete: (t: SipTrunk) => void }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Name</Th>
          <Th>{kind === 'outbound' ? 'Termination URI' : 'Allowed IPs'}</Th>
          <Th>Numbers</Th>
          <Th>Auth user</Th>
          <Th>Agent</Th>
          <Th>Trunk ID</Th>
          <Th className="w-24" />
        </tr>
      </THead>
      <tbody>
        {loading ? (
          <TableSkeleton rows={2} cols={7} />
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-5 py-6 text-center text-[13px] text-muted">
              No {kind} trunks yet.
            </td>
          </tr>
        ) : (
          rows.map((t) => (
            <Tr key={t.id}>
              <Td className="font-medium">{t.name}</Td>
              <Td className="font-mono text-xs text-muted">{kind === 'outbound' ? t.address : t.allowed_addresses.join(', ') || 'any'}</Td>
              <Td><Numbers list={t.numbers} /></Td>
              <Td className="font-mono text-xs text-muted">{t.auth_username || '—'}</Td>
              <Td><AgentLink id={t.agent_id} /></Td>
              <Td className="font-mono text-xs text-subtle">{t.id}</Td>
              <Td className="text-right">
                <Button size="icon-sm" variant="ghost" aria-label="Edit trunk" onClick={() => onEdit(t)}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Delete trunk" onClick={() => onDelete(t)}>
                  <Trash2 />
                </Button>
              </Td>
            </Tr>
          ))
        )}
      </tbody>
    </Table>
  )
}

export default function TrunksPage() {
  const { abilities } = useAuth()
  const isSuperAdmin = abilities.role === 'SUPER_ADMIN'
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'numbers' ? 'numbers' : 'trunks'
  const qc = useQueryClient()
  const confirm = useConfirm()
  const q = useQuery({ queryKey: qk, queryFn: telephonyApi.adminList })
  const [modal, setModal] = useState<{ kind: TrunkKind; trunk: SipTrunk | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const d = q.data

  const del = useMutation({
    mutationFn: ({ kind, id }: { kind: TrunkKind | 'dispatch-rule'; id: string }) => telephonyApi.adminDelete(kind, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk })
      void qc.invalidateQueries({ queryKey: ['telephony'] })
      toast.success('Deleted')
    },
    onError: (e) => toastError(e, 'Could not delete'),
  })
  const askDelete = async (kind: TrunkKind | 'dispatch-rule', id: string, name: string, owned: boolean) => {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      description: `${owned ? 'It belongs to an agent, whose phone calls will stop working. ' : ''}This removes it from LiveKit and cannot be undone.`,
      confirmLabel: 'Delete',
    })
    if (ok) del.mutate({ kind, id })
  }

  return (
    <Page wide>
      <PageHeader
        title="Telephony"
        description={
          tab === 'numbers'
            ? 'Rent a phone number from LiveKit and connect it to an agent, without a SIP provider.'
            : isSuperAdmin
              ? 'Every SIP trunk and dispatch rule in the LiveKit project. Agents get theirs automatically from Deployment → Telephony; edit them here only for fixes.'
              : 'The SIP trunks and dispatch rules of your organization. Agents get theirs automatically from Deployment → Telephony; edit them here only for fixes. Shared trunks set up by the platform team are not listed.'
        }
        actions={
          tab === 'trunks' && (
            <>
              <Button onClick={() => setModal({ kind: 'inbound', trunk: null })}>
                <Plus /> Inbound trunk
              </Button>
              <Button variant="primary" onClick={() => setModal({ kind: 'outbound', trunk: null })}>
                <Plus /> Outbound trunk
              </Button>
            </>
          )
        }
      />
      <Segmented<Tab>
        className="mb-6"
        value={tab}
        onChange={(t) => setParams(t === 'trunks' ? {} : { tab: t }, { replace: true })}
        options={[
          { value: 'trunks', label: <span className="flex items-center gap-1.5"><Cable className="size-3.5" /> SIP trunks</span> },
          { value: 'numbers', label: <span className="flex items-center gap-1.5"><Hash className="size-3.5" /> Phone numbers</span> },
        ]}
      />
      {tab === 'numbers' ? (
        <NumbersTab />
      ) : (
        <>
      {d?.origination_uri && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-[13px]">
          <span className="text-muted">Origination SIP URI</span>
          <code className="font-mono text-xs select-all">{d.origination_uri}</code>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Copy origination URI"
            onClick={async () => {
              await copyToClipboard(d.origination_uri!)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      )}
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader title="Outbound trunks" description="LiveKit → provider (termination)." />
            <TrunkTable kind="outbound" rows={d?.outbound ?? []} loading={q.isLoading} onEdit={(t) => setModal({ kind: 'outbound', trunk: t })} onDelete={(t) => askDelete('outbound', t.id, t.name, Boolean(t.agent_id))} />
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Inbound trunks" description="Provider → LiveKit (origination)." />
            <TrunkTable kind="inbound" rows={d?.inbound ?? []} loading={q.isLoading} onEdit={(t) => setModal({ kind: 'inbound', trunk: t })} onDelete={(t) => askDelete('inbound', t.id, t.name, Boolean(t.agent_id))} />
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Dispatch rules" description="Which room (and agent) an inbound call is sent to." />
            {d && d.dispatch_rules.length === 0 ? (
              <EmptyState icon={<Cable />} title="No dispatch rules" description="They are created for an agent when you connect telephony." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Trunks</Th>
                    <Th>Room prefix</Th>
                    <Th>Agent</Th>
                    <Th>Rule ID</Th>
                    <Th className="w-12" />
                  </tr>
                </THead>
                <tbody>
                  {!d ? (
                    <TableSkeleton rows={2} cols={6} />
                  ) : (
                    d.dispatch_rules.map((r: SipDispatchRule) => (
                      <Tr key={r.id}>
                        <Td className="font-medium">{r.name}</Td>
                        <Td className="font-mono text-xs text-muted">{r.trunk_ids.join(', ') || 'all'}</Td>
                        <Td className="font-mono text-xs text-muted">{r.room_prefix ?? '—'}</Td>
                        <Td><AgentLink id={r.agent_id} /></Td>
                        <Td className="font-mono text-xs text-subtle">{r.id}</Td>
                        <Td className="text-right">
                          <Button size="icon-sm" variant="ghost" aria-label="Delete rule" onClick={() => askDelete('dispatch-rule', r.id, r.name, Boolean(r.agent_id))}>
                            <Trash2 />
                          </Button>
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
        </>
      )}
      {modal && <TrunkModal key={`${modal.kind}-${modal.trunk?.id ?? 'new'}`} kind={modal.kind} trunk={modal.trunk} onClose={() => setModal(null)} />}
    </Page>
  )
}
