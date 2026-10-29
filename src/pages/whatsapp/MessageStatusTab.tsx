import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, RefreshCw, SearchX } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppMessageStatus, WhatsAppRefreshResult } from '@/api/types'
import { formatDate, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/overlay'
import { Card, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Pager, Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { formatPhone, TWILIO_STATUS, useDebounced, useWhatsAppConfig } from './helpers'
import { toastError } from '../agents/helpers'
import { Checkbox, TwilioStatusBadge } from './shared'

const PAGE_SIZE = 50
/** Fetches the current status from Twilio (for when its callbacks can't reach us) and refreshes the views. */
function useRefreshFromTwilio(agentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contactIds?: string[]) => whatsappApi.refreshMessages(agentId, contactIds),
    onSuccess: (r: WhatsAppRefreshResult) => {
      for (const key of [qk.wa.messages(agentId), qk.wa.contacts(agentId), qk.wa.stats(agentId)]) void qc.invalidateQueries({ queryKey: key })
      if (r.checked === 0 && r.simulated > 0) toast.info('These are simulated (dry-run) messages, so Twilio has nothing to report.')
      else if (r.checked === 0 && r.errors === 0) toast.info('Nothing to refresh: every message already has its final status.')
      else toast.success(`Checked ${r.checked} message${r.checked === 1 ? '' : 's'} with Twilio · ${r.updated} updated${r.errors ? ` · ${r.errors} could not be fetched` : ''}`)
    },
    onError: (e) => toastError(e, 'Could not fetch status from Twilio'),
  })
}

const IN_FLIGHT = new Set(['simulated', 'accepted', 'scheduled', 'queued', 'sending', 'sent'])

/** The status Twilio actually reported for every message, with the full event history per message. */
export function MessageStatusTab({ agentId }: { agentId: string }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<WhatsAppMessageStatus | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const search = useDebounced(q.trim())
  const { data: config } = useWhatsAppConfig()
  const refresh = useRefreshFromTwilio(agentId)

  const list = useQuery({
    queryKey: [...qk.wa.messages(agentId), { search, status, page }],
    queryFn: () => whatsappApi.messageStatus(agentId, { q: search, status, skip: page * PAGE_SIZE, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
    // Delivery callbacks arrive after the send; keep refreshing while any message is still in flight.
    refetchInterval: (query) => (query.state.data?.items.some((m) => m.status && IN_FLIGHT.has(m.status)) ? 5000 : false),
  })
  const rows = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const filtered = Boolean(search || status)
  const allOnPage = rows.length > 0 && rows.every((m) => selected.has(m.contact_id))
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const m of rows) {
        if (allOnPage) next.delete(m.contact_id)
        else next.add(m.contact_id)
      }
      return next
    })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v)
            setPage(0)
          }}
          placeholder="Search name, phone or message SID…"
          className="w-72"
        />
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(0)
          }}
          className="w-44"
        >
          <option value="">All statuses</option>
          {Object.entries(TWILIO_STATUS).map(([value, m]) => (
            <option key={value} value={value}>
              {m.label}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
          <Button
            disabled={selected.size === 0}
            title={selected.size === 0 ? 'Select one or more messages first' : undefined}
            loading={refresh.isPending}
            onClick={() => refresh.mutate([...selected].slice(0, 100), { onSuccess: () => setSelected(new Set()) })}
          >
            <RefreshCw /> {selected.size ? `Refresh status (${selected.size})` : 'Refresh status'}
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX />} title="No matching messages" description="Try a different search or filter." />
          ) : (
            <EmptyState
              icon={<Activity />}
              title="No messages sent yet"
              description="Send messages from the Contacts tab. Twilio's status for each one appears here."
            />
          )
        ) : (
          <Table>
            <THead>
              <tr>
                <Th className="w-10">
                  <Checkbox aria-label="Select all on this page" checked={allOnPage} onChange={togglePage} />
                </Th>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th>Actual status</Th>
                <Th className="hidden md:table-cell">Message SID</Th>
                <Th className="hidden lg:table-cell">Updated</Th>
                <Th className="text-right">Events</Th>
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={5} cols={7} />
              ) : (
                rows.map((m) => (
                  <Tr key={m.contact_id} onClick={() => setOpen(m)}>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${m.customer_name}`} checked={selected.has(m.contact_id)} onChange={() => toggle(m.contact_id)} />
                    </Td>
                    <Td className="font-medium">{m.customer_name}</Td>
                    <Td className="tabular-nums">{formatPhone(m.phone_number)}</Td>
                    <Td>
                      <div className="flex flex-col items-start gap-0.5">
                        <TwilioStatusBadge status={m.status} />
                        {m.error_code && <span className="text-[11px] text-danger">Error {m.error_code}</span>}
                      </div>
                    </Td>
                    <Td className="hidden font-mono text-[12px] text-muted md:table-cell">{m.message_sid ?? '—'}</Td>
                    <Td className="hidden text-muted lg:table-cell" title={formatDate(m.status_at, true)}>
                      {timeAgo(m.status_at)}
                    </Td>
                    <Td className="text-right tabular-nums text-muted">{m.events}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
        {total > PAGE_SIZE && (
          <div>
            <Pager page={page} pageSize={PAGE_SIZE} count={Math.min(PAGE_SIZE, total - page * PAGE_SIZE)} onPage={setPage} loading={list.isFetching} />
            <div className="border-t border-line px-5 py-1.5 text-right text-[11px] text-subtle">{total} messages</div>
          </div>
        )}
      </Card>
      {config?.dry_run && (
        <p className="mt-3 text-[12px] text-muted">Dry-run messages are simulated, so no delivery updates arrive from Twilio.</p>
      )}
      {open && <EventsModal agentId={agentId} message={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function EventsModal({ agentId, message, onClose }: { agentId: string; message: WhatsAppMessageStatus; onClose: () => void }) {
  const qc = useQueryClient()
  const refresh = useRefreshFromTwilio(agentId)
  const events = useQuery({
    queryKey: qk.wa.events(agentId, message.contact_id),
    queryFn: () => whatsappApi.messageEvents(agentId, message.contact_id),
  })
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={`${message.customer_name} · ${formatPhone(message.phone_number)}`}
      description={message.message_sid ?? undefined}
      footer={
        <Button
          loading={refresh.isPending}
          onClick={() => refresh.mutate([message.contact_id], { onSuccess: () => void qc.invalidateQueries({ queryKey: qk.wa.events(agentId, message.contact_id) }) })}
        >
          <RefreshCw /> Refresh from Twilio
        </Button>
      }
    >
      {events.error ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.isLoading ? (
        <p className="text-[13px] text-muted">Loading…</p>
      ) : (
        <ol className="space-y-3">
          {events.data?.map((e) => (
            <li key={e.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TwilioStatusBadge status={e.status} />
                <span className="text-[12px] text-muted" title={e.source === 'send' ? 'Recorded when the message was sent' : 'Received from Twilio'}>
                  {formatDate(e.received_at, true)} · {e.source === 'send' ? 'send' : 'Twilio callback'}
                </span>
              </div>
              {(e.error_code || e.error_message) && (
                <p className="mt-2 text-[13px] text-danger">
                  {e.error_code && <span className="font-medium">Error {e.error_code}. </span>}
                  {e.error_message}
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-[12px] text-muted">Full details</summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                  {Object.entries(e.payload).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="break-all font-mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
