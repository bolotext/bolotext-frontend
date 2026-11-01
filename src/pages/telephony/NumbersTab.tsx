import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Hash, Phone, Plus, Search, Trash2 } from 'lucide-react'
import { telephonyApi } from '@/api/endpoints'
import { useAllAgents } from '@/api/queries'
import { useAuth } from '@/auth/AuthContext'
import type { NumberSearchResult, RentedNumber } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'

const qk = ['telephony', 'numbers'] as const
const TYPE_LABEL: Record<string, string> = { local: 'Local', toll_free: 'Toll-free', mobile: 'Mobile', unknown: '—' }

function RentModal({ onClose, full }: { onClose: () => void; full: boolean }) {
  const qc = useQueryClient()
  // The server only lets an agent of the renting organization answer the number, and rejects any other.
  const agents = useAllAgents().data ?? []
  const [area, setArea] = useState('')
  const [results, setResults] = useState<NumberSearchResult[] | null>(null)
  const [picked, setPicked] = useState<NumberSearchResult | null>(null)
  const [agentId, setAgentId] = useState('')
  const [agree, setAgree] = useState(false)

  const search = useMutation({
    mutationFn: () => telephonyApi.numbersSearch(area),
    onSuccess: setResults,
    onError: (e) => toastError(e, 'Search failed'),
  })
  const rent = useMutation({
    mutationFn: () => telephonyApi.numbersRent({ phone_number: picked!.phone_number, agent_id: agentId || null, billing_confirmed: agree }),
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: qk })
      if (n.warning) toast.warning(n.warning)
      else toast.success(`${n.phone_number} rented`)
      onClose()
    },
    onError: (e) => toastError(e, 'Could not rent the number'),
  })
  const validArea = /^\d{3}$/.test(area)

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={picked ? 'Rent this number' : 'Rent a number'}
      description="LiveKit phone numbers: US only, inbound calls only. No SIP trunk, username or password is needed."
      footer={
        picked ? (
          <>
            <Button onClick={() => setPicked(null)}>Back</Button>
            <Button variant="primary" disabled={!agree} loading={rent.isPending} onClick={() => rent.mutate()}>
              <Phone /> Rent {picked.phone_number}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {picked ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-2/60 px-4 py-3">
            <div className="font-mono text-base font-semibold">{picked.phone_number}</div>
            <div className="text-xs text-muted">
              {TYPE_LABEL[picked.number_type] ?? picked.number_type}
              {picked.locality || picked.region ? ` · ${[picked.locality, picked.region].filter(Boolean).join(', ')}` : ''}
            </div>
          </div>
          <Field label="Connect to an agent" hint="Optional. Calls to this number are answered by the agent's Production version. You can connect it later.">
            <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Don’t connect yet</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.agent_details.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="rounded-lg bg-warning-soft px-3 py-2.5 text-xs text-warning">
            Renting is billed by LiveKit every month. A LiveKit plan may include one free US local number; otherwise charges apply, and releasing early still bills the full
            month [TO CONFIRM current pricing on your LiveKit plan].
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
            <input type="checkbox" className="mt-0.5 accent-accent" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I understand this number will be billed to our LiveKit account.
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {full && <div className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Your organization has reached its limit of rented numbers. Release one first, or ask a Super Admin.</div>}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (validArea) search.mutate()
            }}
          >
            <Field label="Area code" hint="e.g. 415. Use 800, 833 or 888 for toll-free." className="w-48">
              <Input value={area} inputMode="numeric" maxLength={3} placeholder="415" onChange={(e) => setArea(e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Button type="submit" variant="primary" disabled={!validArea} loading={search.isPending} className="mb-[22px]">
              <Search /> Search
            </Button>
          </form>
          {results && results.length === 0 && <EmptyState icon={<Hash />} title="No numbers available" description="Try a different area code." />}
          {results && results.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {results.map((r) => (
                <li key={r.phone_number} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-mono text-[13px] font-medium">{r.phone_number}</div>
                    <div className="text-xs text-muted">{[r.locality, r.region].filter(Boolean).join(', ') || r.area_code || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{TYPE_LABEL[r.number_type] ?? r.number_type}</Badge>
                    <Button variant="primary" size="sm" disabled={full} onClick={() => setPicked(r)}>
                      Rent
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Rented LiveKit numbers: connect each to an agent (no trunk needed), or release it. */
export function NumbersTab() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { abilities } = useAuth()
  const isSuperAdmin = abilities.role === 'SUPER_ADMIN'
  const [renting, setRenting] = useState(false)
  const q = useQuery({ queryKey: qk, queryFn: telephonyApi.numbersList })
  const agentsQ = useAllAgents()
  const names = new Map((agentsQ.data ?? []).map((a) => [a.id, a.agent_details.name]))
  const rows = q.data?.items ?? []
  const cap = q.data?.limit_per_org ?? null
  const full = cap !== null && rows.length >= cap

  const assign = useMutation({
    mutationFn: ({ id, agent_id }: { id: string; agent_id: string | null }) => telephonyApi.numbersAssign(id, agent_id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk })
      toast.success('Number updated')
    },
    onError: (e) => toastError(e, 'Could not update the number'),
  })
  const release = useMutation({
    mutationFn: (id: string) => telephonyApi.numbersRelease(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk })
      toast.success('Number released')
    },
    onError: (e) => toastError(e, 'Could not release the number'),
  })
  const askRelease = async (n: RentedNumber) => {
    const ok = await confirm({
      title: `Release ${n.phone_number}?`,
      description: 'The number goes back to LiveKit and callers will no longer reach this agent. LiveKit still bills it for the rest of the month, and you may not get the same number again.',
      confirmLabel: 'Release number',
      tone: 'danger',
    })
    if (ok) release.mutate(n.id)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-muted">
          Rent a US phone number from LiveKit and connect it to an agent. Inbound calls only, and no SIP provider details are needed. {isSuperAdmin ? 'Numbers that already exist in the LiveKit project are listed too.' : null}
          {cap !== null && <span className="ml-1 text-subtle">Your organization can hold up to {cap} numbers.</span>}
        </p>
        <Button variant="primary" onClick={() => setRenting(true)}>
          <Plus /> Rent a number
        </Button>
      </div>
      <Card className="overflow-hidden">
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState icon={<Phone />} title="No rented numbers yet" description="Rent one to receive calls without setting up a SIP trunk." />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Number</Th>
                <Th>Type</Th>
                <Th>Location</Th>
                {isSuperAdmin && <Th>Organization</Th>}
                <Th>Answered by</Th>
                <Th>Status</Th>
                <Th className="w-12" />
              </tr>
            </THead>
            <tbody>
              {q.isLoading ? (
                <TableSkeleton rows={3} cols={isSuperAdmin ? 7 : 6} />
              ) : (
                rows.map((n) => {
                  const options = (agentsQ.data ?? []).filter((a) => n.org_id === null || a.org_id === n.org_id)
                  return (
                    <Tr key={n.id}>
                      <Td className="font-mono text-xs font-medium">{n.phone_number}</Td>
                      <Td><Badge tone="neutral">{TYPE_LABEL[n.number_type] ?? n.number_type}</Badge></Td>
                      <Td className="text-muted">{[n.locality, n.region].filter(Boolean).join(', ') || '—'}</Td>
                      {isSuperAdmin && <Td className="text-muted">{n.org_name ?? (n.external ? 'Not assigned' : '—')}</Td>}
                      <Td className="min-w-48">
                        {agentsQ.isLoading ? (
                          <Skeleton className="h-8 w-40" />
                        ) : (
                          <Select
                            aria-label={`Agent for ${n.phone_number}`}
                            value={n.agent_id ?? ''}
                            disabled={assign.isPending}
                            onChange={(e) => assign.mutate({ id: n.id, agent_id: e.target.value || null })}
                          >
                            <option value="">Not connected</option>
                            {options.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.agent_details.name}
                              </option>
                            ))}
                            {n.agent_id && !options.some((a) => a.id === n.agent_id) && <option value={n.agent_id}>{names.get(n.agent_id) ?? n.agent_id}</option>}
                          </Select>
                        )}
                        {n.external && (
                          <p className="mt-1 text-[11px] text-subtle">
                            Already in your LiveKit project.
                            {n.dispatch_rule_ids.length > 0 && ` Tied to rule ${n.dispatch_rule_ids[0]} outside Bolotext.`} Connecting it hands it to that agent&apos;s organization.
                          </p>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={n.status === 'active' ? 'success' : n.status === 'pending' ? 'warning' : 'neutral'} dot>
                          {n.status === 'offline' ? 'Not connected' : n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <Button size="icon-sm" variant="ghost" aria-label={`Release ${n.phone_number}`} onClick={() => askRelease(n)}>
                          <Trash2 />
                        </Button>
                      </Td>
                    </Tr>
                  )
                })
              )}
            </tbody>
          </Table>
        )}
      </Card>
      {renting && <RentModal full={full} onClose={() => setRenting(false)} />}
    </>
  )
}
