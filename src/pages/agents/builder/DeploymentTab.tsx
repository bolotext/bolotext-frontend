import { ArrowRight, Globe, MessageSquare, PhoneOutgoing } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import { useAuth } from '@/auth/AuthContext'
import { useEnvironments } from '@/api/queries'
import type { Environment } from '@/api/types'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { TagInput } from '@/components/ui/editors'
import { Badge, Card, CardBody, CardHeader, Skeleton, ToggleRow } from '@/components/ui/primitives'
import { ENV_META } from '../helpers'
import { TelephonyPanel } from './TelephonyPanel'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

const ORIGIN = /^https?:\/\/[^/\s]+$/i

export default function DeploymentTab() {
  const { agent, env, readOnly } = useBuilder()
  const { abilities } = useAuth()
  const { draft, patch, dirty, reset } = useDraft(agent.deployment)
  const { save, saving } = useSave()
  const { data: envs, isLoading } = useEnvironments(agent.id)
  const voice = agent.agent_details.bot_type.includes('voice')
  const chat = agent.agent_details.bot_type.includes('chat')

  return (
    <div>
      <SectionTitle title="Deployment" description="Where the agent is reachable, and what's live in each environment." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Release pipeline" description="Use Promote in the header to move a tested snapshot forward." />
          <CardBody>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
                {(['development', 'stage', 'production'] as Environment[]).map((e, i) => {
                  const info = envs?.find((x) => x.environment === e)
                  return (
                    <div key={e} className="contents">
                      {i > 0 && <ArrowRight className="mx-auto size-4 shrink-0 rotate-90 text-subtle md:rotate-0" />}
                      <div
                        className={cn(
                          'flex-1 rounded-xl border p-4',
                          info?.exists ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-2/40',
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <Badge tone={info?.exists ? ENV_META[e].tone : 'neutral'} dot>
                            {ENV_META[e].label}
                          </Badge>
                          {e === 'development' && <span className="text-[11px] text-subtle">editable</span>}
                        </div>
                        <div className="mt-3 text-[13px] font-medium" title={formatDate(info?.updated_at, true)}>
                          {info?.exists ? `Updated ${timeAgo(info.updated_at)}` : 'Not promoted yet'}
                        </div>
                        <div className="text-xs text-muted">{info?.exists ? formatDate(info.updated_at, true) : '—'}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Telephony"
            description={voice ? undefined : 'Voice isn’t enabled as a channel on the General tab.'}
          />
          <CardBody>
            <TelephonyPanel agentId={agent.id} env={env} canManage={abilities.editAgents} />
            <div className="divide-y divide-line">
            {env !== 'production' && (
              <ToggleRow
                title={
                  <span className="flex items-center gap-2">
                    <PhoneOutgoing className="size-4 text-muted" /> Outbound calls
                  </span>
                }
                description="Allow this agent to place outbound calls. Outbound campaigns must follow TRAI consent/DND rules."
                checked={draft.outbound_calling_enabled}
                onCheckedChange={(outbound_calling_enabled) => patch({ outbound_calling_enabled })}
                disabled={readOnly}
              />
            )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Chat widget"
            description={chat ? undefined : 'Chat isn’t enabled as a channel on the General tab.'}
          />
          <CardBody>
            <ToggleRow
              title={
                <span className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-muted" /> Embeddable widget
                </span>
              }
              description="Make this agent reachable from a website chat widget."
              checked={draft.chat_widget_enabled}
              onCheckedChange={(chat_widget_enabled) => patch({ chat_widget_enabled })}
              disabled={readOnly}
            >
              <SettingRow
                title={
                  <span className="flex items-center gap-2">
                    <Globe className="size-4 text-muted" /> Allowed origins
                  </span>
                }
                description="Sites allowed to embed the widget. Empty allows none."
              >
                <TagInput
                  mono
                  value={draft.valid_origins}
                  onChange={(valid_origins) => patch({ valid_origins })}
                  disabled={readOnly}
                  placeholder="https://app.example.com"
                  validate={(v) => (ORIGIN.test(v) ? null : 'Use an origin like https://app.example.com (no path)')}
                />
              </SettingRow>
              <SettingRow
                title="Embed snippet"
                description="Voice widget for your site (uses the production config). Optional data-metadata keys reach the agent as custom variables. Save and promote to production first."
              >
                <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2/60 p-3 font-mono text-xs whitespace-pre-wrap">
                  {`<script src="${window.location.origin}/embed.js"\n  data-agent-id="${agent.id}"\n  data-metadata='{"plan":"pro"}'></script>`}
                </pre>
              </SettingRow>
            </ToggleRow>
          </CardBody>
        </Card>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => save(() => agentsApi.updateDeployment(agent.id, draft))}
        onReset={reset}
      />
    </div>
  )
}
