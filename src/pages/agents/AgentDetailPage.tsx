import { useState, type ComponentType, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Activity,
  BookOpen,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FlaskConical,
  GitBranch,
  History,
  LayoutDashboard,
  Mic,
  MoreHorizontal,
  PhoneForwarded,
  Power,
  PowerOff,
  Rocket,
  Settings2,
  ShieldCheck,
  Trash2,
  Volume2,
  Wrench,
  // Workflow, // Flow tab hidden for now
  FileText,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { agentsApi } from '@/api/endpoints'
import { useAgent, useEnvironments } from '@/api/queries'
import type { Environment } from '@/api/types'
import type { Abilities } from '@/lib/permissions'
import { cn, copyToClipboard, timeAgo } from '@/lib/utils'
import { Page } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import {
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
  useConfirm,
} from '@/components/ui/overlay'
import { AgentAvatar, StatusBadge } from './shared'
import { ENV_META, toastError, useAgentActions } from './helpers'
import { BuilderProvider, DirtyProvider, useDirtyRegistry } from './builder/context'
import OverviewTab from './builder/OverviewTab'
import GeneralTab from './builder/GeneralTab'
import PromptTab from './builder/PromptTab'
// Flow tab hidden for now — uncomment this import and the tab entry below to show it again.
// import FlowTab from './builder/FlowTab'
import ModelTab from './builder/ModelTab'
import SpeechTab from './builder/SpeechTab'
import VoiceTab from './builder/VoiceTab'
import ToolsTab from './builder/ToolsTab'
import KnowledgeTab from './builder/KnowledgeTab'
import AnalyticsTab from './builder/AnalyticsTab'
import CallHandlingTab from './builder/CallHandlingTab'
import DeploymentTab from './builder/DeploymentTab'
import TestTab from './builder/TestTab'
import VersionsTab from './builder/VersionsTab'
import AccessTab from './builder/AccessTab'

interface TabDef {
  id: string
  label: string
  icon: ReactNode
  component: ComponentType
  visible?: (a: Abilities) => boolean
}

const TAB_GROUPS: { label: string; tabs: TabDef[] }[] = [
  {
    label: '',
    tabs: [
      {
        id: 'overview',
        label: 'Overview',
        icon: <LayoutDashboard />,
        component: OverviewTab,
      },
    ],
  },
  {
    label: 'Build',
    tabs: [
      {
        id: 'general',
        label: 'General',
        icon: <Settings2 />,
        component: GeneralTab,
      },
      {
        id: 'prompt',
        label: 'Prompt',
        icon: <FileText />,
        component: PromptTab,
      },
      // { id: 'flow', label: 'Flow', icon: <Workflow />, component: FlowTab },
      {
        id: 'knowledge',
        label: 'Knowledge',
        icon: <BookOpen />,
        component: KnowledgeTab,
      },
      { id: 'tools', label: 'Tools', icon: <Wrench />, component: ToolsTab },
    ],
  },
  {
    label: 'Models',
    tabs: [
      { id: 'model', label: 'LLM', icon: <Brain />, component: ModelTab },
      { id: 'speech', label: 'Speech', icon: <Mic />, component: SpeechTab },
      { id: 'voice', label: 'Voice', icon: <Volume2 />, component: VoiceTab },
    ],
  },
  {
    label: 'Behavior',
    tabs: [
      {
        id: 'call-handling',
        label: 'Call handling',
        icon: <PhoneForwarded />,
        component: CallHandlingTab,
      },
      {
        id: 'analytics',
        label: 'Post-call',
        icon: <Activity />,
        component: AnalyticsTab,
      },
    ],
  },
  {
    label: 'Ship',
    tabs: [
      { id: 'test', label: 'Test', icon: <FlaskConical />, component: TestTab },
      {
        id: 'deployment',
        label: 'Deployment',
        icon: <Rocket />,
        component: DeploymentTab,
      },
      {
        id: 'versions',
        label: 'Versions',
        icon: <History />,
        component: VersionsTab,
      },
      {
        id: 'access',
        label: 'Access',
        icon: <ShieldCheck />,
        component: AccessTab,
        visible: (a) => a.manageAssignments,
      },
    ],
  },
]

const ENVS: Environment[] = ['development', 'stage', 'production']

export default function AgentDetailPage() {
  const { agentId = '', tab = 'overview' } = useParams()
  const [params, setParams] = useSearchParams()
  const env = (ENVS.includes(params.get('env') as Environment) ? params.get('env') : 'development') as Environment
  const { abilities } = useAuth()
  const agentQuery = useAgent(agentId, env)
  const devQuery = useAgent(agentId, 'development')

  const groups = TAB_GROUPS.map((g) => ({
    ...g,
    tabs: g.tabs.filter((t) => !t.visible || t.visible(abilities)),
  })).filter((g) => g.tabs.length)
  const active = groups.flatMap((g) => g.tabs).find((t) => t.id === tab) ?? groups[0].tabs[0]

  const setEnv = (e: Environment) => {
    const next = new URLSearchParams(params)
    if (e === 'development') next.delete('env')
    else next.set('env', e)
    setParams(next)
  }

  if (devQuery.isLoading) return <DetailSkeleton />
  if (devQuery.error || !devQuery.data) {
    const notFound =
      (devQuery.error as { code?: number } | null)?.code === 404 || (devQuery.error as { code?: number } | null)?.code === 500
    return (
      <Page>
        <Card>
          {notFound ? (
            <EmptyState
              icon={<Bot />}
              title="Agent not found"
              description="It may have been deleted, or you may not have access to it in this organization."
              action={
                <Link to="/agents">
                  <Button>Back to agents</Button>
                </Link>
              }
            />
          ) : (
            <ErrorState error={devQuery.error} onRetry={() => devQuery.refetch()} />
          )}
        </Card>
      </Page>
    )
  }

  const readOnly = env === 'production' || !abilities.editAgents
  const ActiveTab = active.component

  return (
    <DirtyProvider>
      <Page wide className="pb-16">
        <AgentHeader agentId={agentId} env={env} onEnvChange={setEnv} />

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <nav className="-mx-4 flex shrink-0 gap-1 overflow-x-auto px-4 pb-1 scrollbar-thin lg:sticky lg:top-6 lg:mx-0 lg:w-48 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
            {groups.map((g) => (
              <div key={g.label || 'root'} className="flex gap-1 lg:mb-3 lg:flex-col">
                {g.label && (
                  <div className="hidden px-2.5 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase lg:block">
                    {g.label}
                  </div>
                )}
                {g.tabs.map((t) => (
                  <TabLink key={t.id} agentId={agentId} tab={t} active={t.id === active.id} env={env} />
                ))}
              </div>
            ))}
          </nav>

          <div className="min-w-0 flex-1">
            {agentQuery.isLoading ? (
              <Card className="space-y-4 p-6">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </Card>
            ) : agentQuery.error || !agentQuery.data ? (
              <Card>
                {(agentQuery.error as { code?: number } | null)?.code === 404 ? (
                  <EmptyState
                    icon={<GitBranch />}
                    title={`Nothing in ${ENV_META[env].label.toLowerCase()} yet`}
                    description={
                      env === 'stage'
                        ? 'Promote development to stage to create the first stage snapshot.'
                        : 'Promote stage to production to create the first production snapshot.'
                    }
                    action={<Button onClick={() => setEnv('development')}>View development</Button>}
                  />
                ) : (
                  <ErrorState error={agentQuery.error} onRetry={() => agentQuery.refetch()} />
                )}
              </Card>
            ) : (
              <BuilderProvider agent={agentQuery.data} env={env} readOnly={readOnly}>
                <ReadOnlyBanner env={env} onEnvChange={setEnv} />
                <ActiveTab key={`${active.id}:${env}`} />
              </BuilderProvider>
            )}
          </div>
        </div>
      </Page>
    </DirtyProvider>
  )
}

function TabLink({ agentId, tab, active, env }: { agentId: string; tab: TabDef; active: boolean; env: Environment }) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { isDirty } = useDirtyRegistry()
  const href = `/agents/${agentId}/${tab.id}${env !== 'development' ? `?env=${env}` : ''}`
  return (
    <Link
      to={href}
      onClick={async (e) => {
        if (active) return
        if (isDirty()) {
          e.preventDefault()
          const ok = await confirm({
            title: 'Discard unsaved changes?',
            description: 'You have edits on this tab that haven’t been saved.',
            confirmLabel: 'Discard',
          })
          if (ok) navigate(href)
        }
      }}
      className={cn(
        'flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors [&_svg]:size-4',
        active ? 'bg-surface text-fg shadow-card ring-1 ring-line' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {tab.icon}
      {tab.label}
    </Link>
  )
}

function ReadOnlyBanner({ env, onEnvChange }: { env: Environment; onEnvChange: (e: Environment) => void }) {
  const { abilities } = useAuth()
  if (env === 'production') {
    return (
      <div className="mb-5 flex flex-col gap-2 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] sm:flex-row sm:items-center">
        <Eye className="size-4 shrink-0 text-warning" />
        <span className="flex-1 text-fg">
          Viewing the read-only <strong>{ENV_META[env].label}</strong> snapshot. Production changes only arrive by promotion from
          stage.
        </span>
        <Button size="sm" onClick={() => onEnvChange('development')}>
          Switch to development
        </Button>
      </div>
    )
  }
  if (!abilities.editAgents) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-surface-2/70 px-4 py-3 text-[13px] text-muted">
        <Eye className="size-4 shrink-0" /> View-only — your role can inspect this agent but not change it.
      </div>
    )
  }
  return null
}

function AgentHeader({
  agentId,
  env,
  onEnvChange,
}: {
  agentId: string
  env: Environment
  onEnvChange: (e: Environment) => void
}) {
  const { abilities } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { data: agent } = useAgent(agentId, 'development')
  const { data: envs } = useEnvironments(agentId)
  const actions = useAgentActions()
  const [copied, setCopied] = useState(false)

  const promote = useMutation({
    mutationFn: (target: 'stage' | 'production') =>
      target === 'stage' ? agentsApi.moveToStage(agentId) : agentsApi.moveToProd(agentId),
    onSuccess: (_, target) => {
      void qc.invalidateQueries({ queryKey: ['agent', agentId] })
      toast.success(target === 'stage' ? 'Promoted to stage' : 'Promoted to production', {
        action: { label: 'View', onClick: () => onEnvChange(target) },
      })
    },
    onError: (e, target) => toastError(e, target === 'production' ? 'Cannot promote to production' : 'Promotion failed'),
  })

  if (!agent) return null
  const envInfo = (e: Environment) => envs?.find((x) => x.environment === e)
  const stageExists = envInfo('stage')?.exists

  const onPromote = async (target: 'stage' | 'production') => {
    const ok = await confirm({
      tone: 'primary',
      title: target === 'stage' ? 'Promote development → stage?' : 'Promote stage → production?',
      description:
        target === 'stage'
          ? 'The stage environment will be overwritten with a snapshot of the current development config, including any edits made directly in stage.'
          : 'Production will be overwritten with the current stage snapshot. This is what makes your tested changes live.',
      confirmLabel: target === 'stage' ? 'Promote to stage' : 'Promote to production',
    })
    if (ok) promote.mutate(target)
  }

  return (
    <div>
      <nav className="mb-4 flex items-center gap-1 text-xs text-muted">
        <Link to="/agents" className="hover:text-fg">
          Agents
        </Link>
        <span className="text-subtle">/</span>
        <span className="truncate text-fg">{agent.agent_details.name}</span>
      </nav>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <AgentAvatar id={agent.id} name={agent.agent_details.name} className="size-11 rounded-xl text-base" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{agent.agent_details.name}</h1>
              <StatusBadge status={agent.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <button
                type="button"
                className="inline-flex items-center gap-1 font-mono hover:text-fg"
                onClick={async () => {
                  await copyToClipboard(agent.id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1200)
                }}
              >
                {agent.id}
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              </button>
              <span>Updated {timeAgo(agent.updated_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Environment switcher */}
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button>
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    env === 'development' ? 'bg-info' : env === 'stage' ? 'bg-warning' : 'bg-success',
                  )}
                />
                {ENV_META[env].label} <ChevronDown className="!size-3.5 opacity-70" />
              </Button>
            </DropdownTrigger>
            <DropdownContent className="w-56">
              <DropdownLabel>Environment</DropdownLabel>
              {ENVS.map((e) => {
                const info = envInfo(e)
                const exists = e === 'development' || info?.exists
                return (
                  <DropdownItem key={e} disabled={!exists} onSelect={() => onEnvChange(e)}>
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        exists ? (e === 'development' ? 'bg-info' : e === 'stage' ? 'bg-warning' : 'bg-success') : 'bg-subtle',
                      )}
                    />
                    <span className="flex-1">{ENV_META[e].label}</span>
                    {env === e ? (
                      <Check className="size-3.5" />
                    ) : (
                      !exists && <span className="text-[11px] text-subtle">no snapshot</span>
                    )}
                  </DropdownItem>
                )
              })}
            </DropdownContent>
          </DropdownMenu>

          {abilities.promoteAgent && env !== 'production' && (
            <Button
              variant="primary"
              loading={promote.isPending}
              disabled={env === 'stage' && !stageExists}
              onClick={() => onPromote(env === 'development' ? 'stage' : 'production')}
            >
              <Rocket /> {env === 'development' ? 'Promote to Stage' : 'Promote to Production'}
            </Button>
          )}

          {(abilities.editAgents || abilities.cloneAgent) && (
            <DropdownMenu>
              <DropdownTrigger asChild>
                <Button size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownTrigger>
              <DropdownContent>
                {abilities.editAgents && (
                  <DropdownItem onSelect={() => actions.confirmToggle(agent)}>
                    {agent.status === 'active' ? <PowerOff /> : <Power />}
                    {agent.status === 'active' ? 'Deactivate' : 'Activate'}
                  </DropdownItem>
                )}
                {abilities.cloneAgent && (
                  <DropdownItem onSelect={() => actions.clone.mutate(agent.id)}>
                    <Copy /> Duplicate
                  </DropdownItem>
                )}
                {abilities.deleteAgent && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem
                      danger
                      onSelect={async () => {
                        const deleted = await actions.confirmDelete(agent)
                        if (deleted) navigate('/agents')
                      }}
                    >
                      <Trash2 /> Delete agent
                    </DropdownItem>
                  </>
                )}
              </DropdownContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <Page wide>
      <Skeleton className="mb-4 h-3 w-40" />
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="mt-8 flex gap-6">
        <div className="hidden w-48 space-y-2 lg:block">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
        <Card className="flex-1 space-y-4 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </Card>
      </div>
    </Page>
  )
}
