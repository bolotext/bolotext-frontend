import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Bot, Building2, Cpu, Plus, Power, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { fetchAllUsers, orgsApi } from '@/api/endpoints'
import { useAllAgents, useProviders } from '@/api/queries'
import { FEATURES } from '@/lib/features'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/permissions'
import { timeAgo } from '@/lib/utils'
import { Page } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { AgentAvatar, CreateAgentModal, StatusBadge } from './agents/shared'

function Stat({
  icon,
  label,
  value,
  sub,
  to,
  loading,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  sub?: ReactNode
  to?: string
  loading?: boolean
}) {
  const body = (
    <Card className="h-full p-4 transition-all hover:border-line-strong">
      <div className="flex items-center gap-2 text-xs font-medium text-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {loading ? <Skeleton className="h-7 w-12" /> : value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Home for organizations without Voice Agents: shortcuts to whatever they do have. */
function ProductsHome() {
  const { user, currentOrg, hasFeature } = useAuth()
  const mine = FEATURES.filter((f) => hasFeature(f.id))
  return (
    <Page wide>
      <div className="mb-8">
        <p className="text-[13px] text-muted">{currentOrg?.name ?? ''}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {greeting()}, {user?.full_name?.split(' ')[0]}
        </h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((f) => (
          <Link key={f.id} to={f.path}>
            <Card className="h-full p-4 transition-all hover:border-line-strong">
              <div className="flex items-center justify-between text-[13px] font-medium">
                {f.label}
                <ArrowRight className="size-4 text-muted" />
              </div>
              <p className="mt-1 text-xs text-muted">{f.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </Page>
  )
}

export default function DashboardPage() {
  const { hasFeature } = useAuth()
  return hasFeature('voice_agents') ? <VoiceDashboard /> : <ProductsHome />
}

function VoiceDashboard() {
  const { user, abilities, currentOrg } = useAuth()
  const agents = useAllAgents()
  const providers = useProviders()
  const users = useQuery({ queryKey: ['users'], queryFn: fetchAllUsers, enabled: abilities.viewUsers })
  const orgs = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: () => orgsApi.list({ limit: 200 }),
    enabled: abilities.viewOrganizations,
  })
  const [createOpen, setCreateOpen] = useState(false)

  const stats = useMemo(() => {
    const list = agents.data ?? []
    return {
      total: list.length,
      active: list.filter((a) => a.status === 'active').length,
      recent: [...list].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 6),
    }
  }, [agents.data])

  const modelCount = providers.data
    ? {
        llm: providers.data.llm.reduce((n, p) => n + p.models.filter((m) => m.is_active).length, 0),
        stt: providers.data.stt.reduce((n, p) => n + p.models.filter((m) => m.is_active).length, 0),
        tts: providers.data.tts.reduce((n, p) => n + p.models.filter((m) => m.is_active).length, 0),
      }
    : null

  return (
    <Page wide>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-muted">{currentOrg?.name ?? (user?.is_super_admin ? 'Platform' : '')}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            {greeting()}, {user?.full_name.split(' ')[0]}
          </h1>
        </div>
        {abilities.createAgent && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus /> Create agent
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          to="/agents"
          icon={<Bot />}
          label={abilities.role === 'DEVELOPER' ? 'Your agents' : 'Agents'}
          value={stats.total}
          loading={agents.isLoading}
          sub={`${stats.active} active`}
        />
        <Stat
          to="/agents?status=active"
          icon={<Power />}
          label="Active"
          value={stats.active}
          loading={agents.isLoading}
          sub={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of agents` : '—'}
        />
        {abilities.viewUsers ? (
          <Stat
            to="/users"
            icon={<Users />}
            label="Users"
            value={users.data?.length ?? 0}
            loading={users.isLoading}
            sub={`${users.data?.filter((u) => u.status === 'active').length ?? 0} active`}
          />
        ) : (
          <Stat
            icon={<ShieldCheck />}
            label="Your role"
            value={abilities.role ? ROLE_LABEL[abilities.role] : '—'}
            sub="View-only agent access"
          />
        )}
        {abilities.viewOrganizations ? (
          <Stat
            to="/organizations"
            icon={<Building2 />}
            label="Organizations"
            value={orgs.data?.length ?? 0}
            loading={orgs.isLoading}
            sub={`${orgs.data?.filter((o) => o.status === 'active').length ?? 0} active`}
          />
        ) : (
          <Stat
            to="/providers"
            icon={<Cpu />}
            label="Available models"
            value={modelCount ? modelCount.llm + modelCount.stt + modelCount.tts : 0}
            loading={providers.isLoading}
            sub={modelCount ? `${modelCount.llm} LLM · ${modelCount.stt} STT · ${modelCount.tts} voices` : undefined}
          />
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Recently updated agents"
            actions={
              <Link to="/agents" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                View all <ArrowRight className="size-3" />
              </Link>
            }
          />
          {agents.error ? (
            <ErrorState error={agents.error} onRetry={() => agents.refetch()} />
          ) : agents.isLoading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-3.5 flex-1" />
                </div>
              ))}
            </div>
          ) : stats.recent.length === 0 ? (
            <EmptyState
              icon={<Bot />}
              title="No agents yet"
              description={
                abilities.createAgent ? 'Create your first agent to get started.' : 'Nothing has been shared with you yet.'
              }
              action={
                abilities.createAgent && (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus /> Create agent
                  </Button>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {stats.recent.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/agents/${a.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/60"
                  >
                    <AgentAvatar id={a.id} name={a.agent_details.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{a.agent_details.name}</div>
                      <div className="truncate text-xs text-muted">{a.agent_details.description || 'No description'}</div>
                    </div>
                    <StatusBadge status={a.status} />
                    <span className="hidden w-24 text-right text-xs text-muted sm:block">{timeAgo(a.updated_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Your access" />
            <div className="space-y-3 p-5">
              {abilities.role && <Badge tone="accent">{ROLE_LABEL[abilities.role]}</Badge>}
              <p className="text-[13px] leading-relaxed text-muted">{abilities.role ? ROLE_DESCRIPTION[abilities.role] : ''}</p>
              <ul className="space-y-1.5 text-[13px]">
                {[
                  ['Create agents', abilities.createAgent],
                  ['Edit & promote agents', abilities.editAgents],
                  ['Assign developers to agents', abilities.manageAssignments],
                  ['Manage users', abilities.can('user.create')],
                  ['Manage organizations', abilities.can('organization.update')],
                ].map(([label, ok]) => (
                  <li key={label as string} className="flex items-center gap-2">
                    <span className={ok ? 'text-success' : 'text-subtle'}>{ok ? '✓' : '–'}</span>
                    <span className={ok ? '' : 'text-muted'}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Model catalog"
              actions={
                <Link to="/providers" className="text-xs font-medium text-accent hover:underline">
                  Browse
                </Link>
              }
            />
            <div className="grid grid-cols-3 divide-x divide-line">
              {(['llm', 'stt', 'tts'] as const).map((k) => (
                <div key={k} className="p-4 text-center">
                  <div className="text-lg font-semibold tabular-nums">
                    {providers.isLoading ? <Skeleton className="mx-auto h-6 w-8" /> : (providers.data?.[k].length ?? 0)}
                  </div>
                  <div className="text-[11px] text-muted">{k === 'llm' ? 'LLM' : k === 'stt' ? 'STT' : 'TTS'} providers</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <CreateAgentModal open={createOpen} onOpenChange={setCreateOpen} />
    </Page>
  )
}
