import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhoneCall, SearchX } from 'lucide-react'
import { callLogsApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { CallLogOut, CallLogSummary, JourneyItem } from '@/api/types'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { SearchInput, Select } from '@/components/ui/input'
import { Modal } from '@/components/ui/overlay'
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { Pager, Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'

const PAGE_SIZE = 25
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const STATUS_TONE: Record<string, Tone> = { completed: 'success', missed: 'warning', busy: 'warning', failed: 'danger' }
const SOURCE_LABEL: Record<string, string> = { phone: 'Phone', website: 'Website', personalized_link: 'Personalized link' }

const label = (s: string | null) => (s ? (SOURCE_LABEL[s] ?? s.replace(/_/g, ' ')) : '—')

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted">—</span>
  return (
    <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** History of finished calls for this agent, posted by the voice runtime when each call ends. */
export default function CallLogsTab() {
  const { agentId = '' } = useParams()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [kind, setKind] = useState<'' | 'test' | 'live'>('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<CallLogSummary | null>(null)
  const search = useDebounced(q.trim())
  const reset = () => setPage(0)

  const list = useQuery({
    queryKey: [...qk.callLogs(agentId), { search, status, source, kind, page }],
    queryFn: () =>
      callLogsApi.list(agentId, {
        q: search || undefined,
        status: status || undefined,
        source: source || undefined,
        test: kind === '' ? undefined : kind === 'test',
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  })
  const rows = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const filtered = Boolean(search || status || source || kind)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">Call logs</h2>
        <p className="mt-0.5 text-[13px] text-muted">Every finished call of this agent, with its conversation, token usage and how it ended.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v)
            reset()
          }}
          placeholder="Search session, phone or web token…"
          className="w-72"
        />
        <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), reset())} className="w-36">
          <option value="">All statuses</option>
          {['completed', 'missed', 'busy', 'failed'].map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <Select aria-label="Source" value={source} onChange={(e) => (setSource(e.target.value), reset())} className="w-44">
          <option value="">All sources</option>
          {Object.entries(SOURCE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select aria-label="Test or live" value={kind} onChange={(e) => (setKind(e.target.value as typeof kind), reset())} className="w-36">
          <option value="">Test + live</option>
          <option value="live">Live calls</option>
          <option value="test">Test calls</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={<SearchX />} title="No matching calls" description="Try a different search or filter." />
          ) : (
            <EmptyState icon={<PhoneCall />} title="No calls yet" description="Calls appear here after they end, whether they were tests or real calls." />
          )
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Started</Th>
                <Th>Source</Th>
                <Th className="hidden md:table-cell">From → To</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th className="hidden lg:table-cell">Ended by</Th>
                <Th className="hidden text-right sm:table-cell">Turns</Th>
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : (
                rows.map((c) => (
                  <Tr key={c.id} onClick={() => setOpen(c)}>
                    <Td>
                      <div className="font-medium text-fg" title={formatDate(c.started_at, true)}>
                        {timeAgo(c.started_at ?? c.created_at)}
                      </div>
                      <div className="text-xs text-muted">{c.test ? 'Test call' : 'Live call'}</div>
                    </Td>
                    <Td>
                      <div>{label(c.source)}</div>
                      <div className="text-xs text-muted capitalize">{c.direction ?? '—'}</div>
                    </Td>
                    <Td className="hidden font-mono text-xs text-muted md:table-cell">
                      {c.from_phone || c.to_phone ? `${c.from_phone ?? '—'} → ${c.to_phone ?? '—'}` : (c.web_uuid ?? '—')}
                    </Td>
                    <Td className="tabular-nums">{c.duration ?? '—'}</Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td className="hidden text-xs text-muted lg:table-cell">{c.hangup_reason?.replace(/_/g, ' ') ?? '—'}</Td>
                    <Td className="hidden text-right tabular-nums text-muted sm:table-cell">{c.messages}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
        {total > PAGE_SIZE && (
          <div>
            <Pager page={page} pageSize={PAGE_SIZE} count={Math.min(PAGE_SIZE, total - page * PAGE_SIZE)} onPage={setPage} loading={list.isFetching} />
            <div className="border-t border-line px-5 py-1.5 text-right text-[11px] text-subtle">{total} calls</div>
          </div>
        )}
      </Card>
      {open && <CallDetailModal agentId={agentId} call={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{name}</dt>
      <dd className="mt-0.5 truncate text-[13px] text-fg">{children || '—'}</dd>
    </div>
  )
}

const USAGE: [string, string, string?][] = [
  ['llm_input_token', 'LLM input tokens'],
  ['llm_output_token', 'LLM output tokens'],
  ['llm_prompt_cached_tokens', 'Cached prompt tokens'],
  ['stt_audio_duration', 'STT audio', 's'],
  ['tts_characters_count', 'TTS characters'],
  ['average_e2e_latency', 'Avg end-to-end latency', 'ms'],
  ['average_stt_latency', 'Avg STT latency', 'ms'],
  ['average_llm_latency', 'Avg LLM latency', 'ms'],
  ['average_tts_latency', 'Avg TTS latency', 'ms'],
  ['average_rag_latency', 'Avg knowledge-base latency', 'ms'],
  ['average_tool_call_latency', 'Avg tool-call latency', 'ms'],
]

function offset(item: JourneyItem, start: number | undefined) {
  if (item.created_at === undefined || start === undefined) return null
  const s = Math.max(0, Math.round(item.created_at - start))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Turn({ item, start }: { item: JourneyItem; start: number | undefined }) {
  const at = offset(item, start)
  if (item.type === 'message') {
    const agent = item.role !== 'user'
    return (
      <li className={cn('flex flex-col', agent ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap',
            agent ? 'rounded-tl-sm bg-surface-2 text-fg' : 'rounded-tr-sm bg-accent-soft text-fg',
          )}
        >
          {(item.content ?? []).join(' ')}
        </div>
        <div className="mt-0.5 flex gap-2 px-1 text-[11px] text-subtle">
          <span>{agent ? 'Agent' : 'Customer'}</span>
          {at && <span>{at}</span>}
          {item.interrupted && <span className="text-warning">interrupted</span>}
        </div>
      </li>
    )
  }
  // Anything else the runtime records (config updates, tool calls, …): a quiet, expandable line.
  const rest = Object.fromEntries(Object.entries(item).filter(([k]) => !['id', 'type', 'created_at'].includes(k)))
  const type = item.type
  return (
    <li className="text-center">
      <details className="inline-block max-w-full text-left">
        <summary className="cursor-pointer rounded-full bg-surface-2 px-3 py-0.5 text-[11px] text-muted">
          {(type ?? 'event').replace(/_/g, ' ')}
          {at && ` · ${at}`}
        </summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-surface-2 p-2 text-[11px] whitespace-pre-wrap">{JSON.stringify(rest, null, 2)}</pre>
      </details>
    </li>
  )
}

function CallDetailModal({ agentId, call, onClose }: { agentId: string; call: CallLogSummary; onClose: () => void }) {
  const detail = useQuery({ queryKey: [...qk.callLogs(agentId), call.id], queryFn: () => callLogsApi.get(agentId, call.id) })
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          {label(call.source)} call <StatusBadge status={call.status} />
          {call.test && <Badge tone="info">Test</Badge>}
        </span>
      }
      description={formatDate(call.started_at, true)}
    >
      {detail.error ? (
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      ) : !detail.data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <CallDetail c={detail.data} />
      )}
    </Modal>
  )
}

function CallDetail({ c }: { c: CallLogOut }) {
  const i = c.interaction
  const journey = i.interaction_journey ?? []
  const start = journey.reduce<number | undefined>((m, j) => (j.created_at !== undefined && (m === undefined || j.created_at < m) ? j.created_at : m), undefined)
  const usage = i.token_usage ?? {}
  const hangup = i.details?.hangup_reason as Record<string, unknown> | undefined
  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Fact name="Duration">{c.duration}</Fact>
        <Fact name="Direction">
          <span className="capitalize">{c.direction}</span>
        </Fact>
        <Fact name="From">{c.from_phone}</Fact>
        <Fact name="To">{c.to_phone}</Fact>
        <Fact name="Session">
          <span className="font-mono text-xs">{c.session_id}</span>
        </Fact>
        <Fact name="Web token">
          <span className="font-mono text-xs">{c.web_uuid}</span>
        </Fact>
        <Fact name="Recording">
          <span className="font-mono text-xs">{c.recording_sid}</span>
        </Fact>
        <Fact name="Ended by">{c.hangup_reason?.replace(/_/g, ' ')}</Fact>
      </dl>

      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-fg">Token usage &amp; latency</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line p-4 sm:grid-cols-4">
          {USAGE.filter(([k]) => usage[k] !== undefined).map(([k, name, unit]) => (
            <Fact key={k} name={name}>
              {usage[k] < 0 ? 'n/a' : `${usage[k].toLocaleString()}${unit ? ` ${unit}` : ''}`}
            </Fact>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-fg">Conversation</h3>
        {journey.length === 0 ? (
          <p className="text-[13px] text-muted">No conversation was recorded for this call.</p>
        ) : (
          <ol className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-line p-4">
            {journey.map((item, n) => (
              <Turn key={item.id ?? n} item={item} start={start} />
            ))}
          </ol>
        )}
      </section>

      <details>
        <summary className="cursor-pointer text-[13px] font-medium text-muted">Raw stored data</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-surface-2 p-3 text-[11px] whitespace-pre-wrap">
          {JSON.stringify({ ...i, interaction_journey: `${journey.length} items (shown above)`, hangup_reason: hangup }, null, 2)}
        </pre>
      </details>
    </div>
  )
}
