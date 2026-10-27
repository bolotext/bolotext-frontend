import { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronDown, ChevronRight, GitCompare } from 'lucide-react'
import { useAgent, useEnvironments } from '@/api/queries'
import type { AgentOut, Environment } from '@/api/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { ENV_META } from '../helpers'
import { SectionTitle, useBuilder } from './context'

const SECTIONS: { key: keyof AgentOut; label: string }[] = [
  { key: 'agent_details', label: 'General' },
  { key: 'languages', label: 'Languages' },
  { key: 'prompt', label: 'Prompt' },
  // { key: 'flow', label: 'Flow' }, // Flow hidden for now
  { key: 'llm', label: 'LLM' },
  { key: 'transcriber', label: 'Speech' },
  { key: 'voice_persona', label: 'Voice' },
  { key: 'actions', label: 'Actions' },
  { key: 'mcp', label: 'MCP servers' },
  { key: 'faq', label: 'FAQ' },
  { key: 'analytics', label: 'Post-call' },
  { key: 'others', label: 'Call handling' },
  { key: 'deployment', label: 'Deployment' },
]

// Values under these keys usually carry credentials; diff them without printing them.
const SECRET_KEYS = /(^|\.)(headers\.[^.]+|auth_token)$/

function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
    if (!entries.length) out[prefix] = {}
    for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else if (Array.isArray(value) && value.some((v) => v && typeof v === 'object')) {
    if (!value.length) out[prefix] = []
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out))
  } else {
    out[prefix] = value
  }
  return out
}

function show(path: string, v: unknown) {
  if (v === undefined) return <span className="text-subtle italic">absent</span>
  if (SECRET_KEYS.test(path) && v) return <span className="text-muted">•••••• (hidden)</span>
  if (v === null) return <span className="text-subtle">null</span>
  if (typeof v === 'string') return v === '' ? <span className="text-subtle">""</span> : v
  return JSON.stringify(v)
}

function SectionDiff({ label, left, right, sectionKey }: { label: string; left: unknown; right: unknown; sectionKey: string }) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => {
    const a = flatten(left)
    const b = flatten(right)
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      .map((k) => ({ path: k, a: a[k], b: b[k] }))
  }, [left, right])
  const changed = rows.length > 0

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        disabled={!changed}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left enabled:hover:bg-surface-2/60"
      >
        {changed ? (
          open ? (
            <ChevronDown className="size-4 text-subtle" />
          ) : (
            <ChevronRight className="size-4 text-subtle" />
          )
        ) : (
          <span className="size-4" />
        )}
        <span className="flex-1 text-[13px] font-medium">{label}</span>
        {changed ? (
          <Badge tone="warning">
            {rows.length} change{rows.length === 1 ? '' : 's'}
          </Badge>
        ) : (
          <Badge>identical</Badge>
        )}
      </button>
      {open && changed && (
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="w-1/4 pb-2 font-medium">Field</th>
                <th className="w-[37.5%] pb-2 font-medium">Left</th>
                <th className="w-[37.5%] pb-2 font-medium">Right</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path} className="align-top">
                  <td className="border-t border-line py-2 pr-3 font-mono break-all text-muted">
                    {r.path.replace(new RegExp(`^${sectionKey}\\.?`), '') || sectionKey}
                  </td>
                  <td className="border-t border-line py-2 pr-3">
                    <div className="max-h-40 overflow-auto rounded bg-danger-soft/60 px-2 py-1 font-mono break-words whitespace-pre-wrap scrollbar-thin">
                      {show(r.path, r.a)}
                    </div>
                  </td>
                  <td className="border-t border-line py-2">
                    <div className="max-h-40 overflow-auto rounded bg-success-soft/60 px-2 py-1 font-mono break-words whitespace-pre-wrap scrollbar-thin">
                      {show(r.path, r.b)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EnvironmentCompare() {
  const { agent } = useBuilder()
  const { data: envs } = useEnvironments(agent.id)
  const existing = (['development', 'stage', 'production'] as Environment[]).filter(
    (e) => e === 'development' || envs?.find((x) => x.environment === e)?.exists,
  )
  const [left, setLeft] = useState<Environment>('stage')
  const [right, setRight] = useState<Environment>('development')
  const l = existing.includes(left) ? left : existing.includes('production') ? 'production' : existing[0]
  const r = existing.includes(right) ? right : 'development'
  const lq = useAgent(agent.id, l)
  const rq = useAgent(agent.id, r)

  const changedCount = useMemo(() => {
    if (!lq.data || !rq.data) return 0
    return SECTIONS.filter((s) => JSON.stringify(lq.data[s.key]) !== JSON.stringify(rq.data[s.key])).length
  }, [lq.data, rq.data])

  return (
    <Card>
      <CardHeader
        icon={<GitCompare />}
        title="Compare environments"
        description="See exactly what will change before you promote."
        actions={
          lq.data &&
          rq.data &&
          l !== r && (
            <Badge tone={changedCount ? 'warning' : 'success'}>
              {changedCount
                ? `${changedCount} section${changedCount === 1 ? '' : 's'} differ${changedCount === 1 ? 's' : ''}`
                : 'In sync'}
            </Badge>
          )
        }
      />
      {existing.length < 2 ? (
        <EmptyState
          icon={<GitCompare />}
          title="Nothing to compare yet"
          description="Promote development to stage to start comparing snapshots."
          className="py-10"
        />
      ) : (
        <>
          <CardBody className="flex flex-wrap items-center gap-2 border-b border-line py-3">
            <Select value={l} onChange={(e) => setLeft(e.target.value as Environment)} className="w-40">
              {existing.map((e) => (
                <option key={e} value={e}>
                  {ENV_META[e].label}
                </option>
              ))}
            </Select>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Swap"
              onClick={() => {
                setLeft(r)
                setRight(l)
              }}
            >
              <ArrowLeftRight />
            </Button>
            <Select value={r} onChange={(e) => setRight(e.target.value as Environment)} className="w-40">
              {existing.map((e) => (
                <option key={e} value={e}>
                  {ENV_META[e].label}
                </option>
              ))}
            </Select>
          </CardBody>
          {lq.isLoading || rq.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : lq.error || rq.error ? (
            <ErrorState error={lq.error ?? rq.error} />
          ) : l === r ? (
            <p className="p-5 text-[13px] text-muted">Pick two different environments.</p>
          ) : (
            <div className={cn(!changedCount && 'opacity-90')}>
              {SECTIONS.map((s) => (
                <SectionDiff key={s.key} sectionKey={s.key} label={s.label} left={lq.data![s.key]} right={rq.data![s.key]} />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default function VersionsTab() {
  return (
    <div>
      <SectionTitle title="Versions" description="Compare environment snapshots. Saved system-prompt versions live on the Prompt tab." />
      <div className="space-y-6">
        <EnvironmentCompare />
      </div>
    </div>
  )
}
