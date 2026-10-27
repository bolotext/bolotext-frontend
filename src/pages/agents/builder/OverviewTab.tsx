import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Circle,
  Globe2,
  MessageSquare,
  Mic,
  Phone,
  Activity,
  Volume2,
  Wrench,
} from 'lucide-react'
import { useEnvironments, useProviders, useUserDirectory } from '@/api/queries'
import type { AgentOut, Environment, ProviderInfo } from '@/api/types'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { languageLabel } from '@/lib/languages'
import { Badge, Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives'
import { ENV_META } from '../helpers'
import { useBuilder } from './context'

/** Mirrors agents_service _missing_sections — the production promotion gate. */
// eslint-disable-next-line react-refresh/only-export-components
export function readinessChecks(a: AgentOut) {
  return [
    {
      key: 'prompt',
      tab: 'prompt',
      label: 'Prompt',
      detail: 'Welcome message, system prompt and ending message are all set',
      ok: Boolean(a.prompt.welcome_message && a.prompt.system_prompt && a.prompt.ending_message),
    },
    {
      key: 'transcriber',
      tab: 'speech',
      label: 'Speech recognition',
      detail: 'An STT provider is selected',
      ok: Boolean(a.transcriber.provider_id),
    },
    {
      key: 'llm',
      tab: 'model',
      label: 'Language model',
      detail: 'An LLM provider and model are selected',
      ok: Boolean(a.llm.provider_id && a.llm.model_id),
    },
    {
      key: 'voice_persona',
      tab: 'voice',
      label: 'Voice',
      detail: 'A TTS provider and voice are selected',
      ok: Boolean(a.voice_persona.provider_id && a.voice_persona.voice_id),
    },
  ]
}

// eslint-disable-next-line react-refresh/only-export-components
export function labelFor(list: ProviderInfo[] | undefined, providerId: string, modelId?: string | null) {
  const p = list?.find((x) => x.provider_id === providerId)
  const m = p?.models.find((x) => x.model_id === modelId)
  return { provider: p?.label ?? providerId, model: m?.label ?? modelId ?? '' }
}

function SummaryTile({
  icon,
  title,
  value,
  sub,
  to,
  empty,
}: {
  icon: ReactNode
  title: string
  value: ReactNode
  sub?: ReactNode
  to: string
  empty?: boolean
}) {
  const [params] = useSearchParams()
  return (
    <Link
      to={`${to}${params.toString() ? `?${params}` : ''}`}
      className="group flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-all hover:border-line-strong hover:shadow-pop"
    >
      <div className="flex items-center justify-between text-muted">
        <div className="flex items-center gap-2 text-xs font-medium [&_svg]:size-3.5">
          {icon}
          {title}
        </div>
        <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className={cn('mt-2.5 truncate text-[13px] font-semibold', empty && 'font-normal text-subtle')}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </Link>
  )
}

export default function OverviewTab() {
  const { agent, env } = useBuilder()
  const { data: providers } = useProviders()
  const { data: envs, isLoading: envLoading } = useEnvironments(agent.id)
  const { map: users } = useUserDirectory()
  const base = `/agents/${agent.id}`

  const checks = readinessChecks(agent)
  const done = checks.filter((c) => c.ok).length
  const llm = labelFor(providers?.llm, agent.llm.provider_id, agent.llm.model_id)
  const stt = labelFor(providers?.stt, agent.transcriber.provider_id, agent.transcriber.model_id)
  const tts = labelFor(providers?.tts, agent.voice_persona.provider_id, agent.voice_persona.model_id)
  const toolCount =
    agent.actions.actions.length + agent.mcp.servers.length + (agent.prompt.dynamic_message.dynamic_message_enabled ? 1 : 0)
  const channels = [
    agent.deployment.inbound_calling_enabled && 'Inbound',
    agent.deployment.outbound_calling_enabled && 'Outbound',
    agent.deployment.chat_widget_enabled && 'Chat widget',
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Production readiness"
            description="Production promotion requires these sections to be configured."
            actions={
              <Badge tone={done === checks.length ? 'success' : 'warning'}>
                {done}/{checks.length} complete
              </Badge>
            }
          />
          <div className="px-5 pt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full transition-all', done === checks.length ? 'bg-success' : 'bg-accent')}
                style={{ width: `${(done / checks.length) * 100}%` }}
              />
            </div>
          </div>
          <ul className="divide-y divide-line px-2 py-2">
            {checks.map((c) => (
              <li key={c.key}>
                <Link
                  to={`${base}/${c.tab}${env !== 'development' ? `?env=${env}` : ''}`}
                  className="group flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-surface-2/70"
                >
                  {c.ok ? (
                    <CheckCircle2 className="size-4.5 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-4.5 shrink-0 text-line-strong" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{c.label}</div>
                    <div className="text-xs text-muted">{c.detail}</div>
                  </div>
                  {!c.ok && <span className="text-xs font-medium text-accent opacity-0 group-hover:opacity-100">Configure</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Environments" description="Dev and stage can be edited directly; prod only changes by promotion." />
          <CardBody className="space-y-0 p-0">
            {envLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <Skeleton className="h-4 w-full" />
                  </div>
                ))
              : (['development', 'stage', 'production'] as Environment[]).map((e, i) => {
                  const info = envs?.find((x) => x.environment === e)
                  return (
                    <div key={e} className="relative flex items-center gap-3 px-5 py-3.5">
                      {i < 2 && <span className="absolute top-9 bottom-[-6px] left-[27px] w-px bg-line" />}
                      <span
                        className={cn(
                          'relative z-10 size-3 rounded-full ring-4 ring-surface',
                          !info?.exists
                            ? 'bg-line-strong'
                            : e === 'development'
                              ? 'bg-info'
                              : e === 'stage'
                                ? 'bg-warning'
                                : 'bg-success',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[13px] font-medium">
                          {ENV_META[e].label}
                          {env === e && <Badge tone="accent">viewing</Badge>}
                        </div>
                        <div className="text-xs text-muted" title={formatDate(info?.updated_at, true)}>
                          {info?.exists ? `Updated ${timeAgo(info.updated_at)}` : 'Not promoted yet'}
                        </div>
                      </div>
                    </div>
                  )
                })}
          </CardBody>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Configuration</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile
            to={`${base}/model`}
            icon={<Brain />}
            title="LLM"
            value={llm.model || 'Not configured'}
            sub={agent.llm.provider_id ? `${llm.provider} · temp ${agent.llm.temperature}` : undefined}
            empty={!agent.llm.model_id}
          />
          <SummaryTile
            to={`${base}/speech`}
            icon={<Mic />}
            title="Speech recognition"
            value={stt.model || stt.provider || 'Not configured'}
            sub={agent.transcriber.provider_id ? stt.provider : undefined}
            empty={!agent.transcriber.provider_id}
          />
          <SummaryTile
            to={`${base}/voice`}
            icon={<Volume2 />}
            title="Voice"
            value={tts.model || 'Not configured'}
            sub={agent.voice_persona.provider_id ? `${tts.provider} · ${agent.voice_persona.rate_of_speech}×` : undefined}
            empty={!agent.voice_persona.voice_id}
          />
          <SummaryTile
            to={`${base}/general`}
            icon={<Globe2 />}
            title="Languages"
            value={agent.languages.map(languageLabel).join(', ')}
            sub={`${agent.languages.length} language${agent.languages.length === 1 ? '' : 's'} · switch: ${agent.prompt.language_switch_mode}`}
          />
          <SummaryTile
            to={`${base}/deployment`}
            icon={agent.agent_details.bot_type.includes('chat') ? <MessageSquare /> : <Phone />}
            title="Channels"
            value={channels.length ? channels.join(', ') : 'None enabled'}
            sub={agent.agent_details.bot_type.join(' + ')}
            empty={!channels.length}
          />
          <SummaryTile
            to={`${base}/tools`}
            icon={<Wrench />}
            title="Tools"
            value={toolCount ? `${toolCount} configured` : 'None'}
            sub={`${agent.actions.actions.length} actions · ${agent.mcp.servers.length} MCP servers`}
            empty={!toolCount}
          />
          <SummaryTile
            to={`${base}/knowledge`}
            icon={<BookOpen />}
            title="Knowledge"
            value={agent.faq.enabled ? `${agent.faq.pairs.length} FAQ pairs` : 'FAQ off'}
            sub={`${agent.llm.knowledge_base_ids.length} knowledge base${agent.llm.knowledge_base_ids.length === 1 ? '' : 's'} linked`}
            empty={!agent.faq.enabled && !agent.llm.knowledge_base_ids.length}
          />
          <SummaryTile
            to={`${base}/analytics`}
            icon={<Activity />}
            title="Post-call"
            value={
              [
                agent.analytics.disposition_enabled && 'Disposition',
                agent.analytics.post_call_extraction_enabled && 'Extraction',
                agent.analytics.post_call_trigger.post_call_trigger_enabled && 'Webhook',
              ]
                .filter(Boolean)
                .join(', ') || 'Nothing enabled'
            }
            sub={`${agent.analytics.extraction_fields.length} extraction fields`}
            empty={
              !agent.analytics.disposition_enabled &&
              !agent.analytics.post_call_extraction_enabled &&
              !agent.analytics.post_call_trigger.post_call_trigger_enabled
            }
          />
        </div>
      </div>

      <Card>
        <CardHeader title="Details" />
        <dl className="grid gap-x-8 gap-y-4 p-5 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Agent ID', <span className="font-mono text-xs">{agent.id}</span>],
            ['Owner', users.get(agent.user_id)?.name ?? <span className="font-mono text-xs">{agent.user_id}</span>],
            ['Organization ID', agent.org_id ? <span className="font-mono text-xs">{agent.org_id}</span> : 'Personal'],
            ['Region', agent.agent_details.region],
            ['Timezone', agent.agent_details.timezone],
            // Flow hidden for now
            // ['Flow type', agent.flow.agent_type === 'flow' ? 'Structured flow' : 'Single prompt'],
            ['Created', formatDate(agent.created_at, true)],
            ['Snapshot updated', formatDate(agent.updated_at, true)],
          ].map(([k, v], i) => (
            <div key={i}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 truncate">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}
