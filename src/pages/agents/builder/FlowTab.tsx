import { useMemo, useState } from 'react'
import { FileText, Workflow } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { Textarea } from '@/components/ui/input'
import { TagInput } from '@/components/ui/editors'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

export default function FlowTab() {
  const { agent, readOnly } = useBuilder()
  const server = useMemo(
    () => ({
      agent_type: agent.flow.agent_type,
      drop_off_scenarios: agent.flow.drop_off_scenarios,
      flow_definition: agent.flow.flow_definition ? JSON.stringify(agent.flow.flow_definition, null, 2) : '',
    }),
    [agent.flow],
  )
  const { draft, patch, dirty, reset } = useDraft(server)
  const { save, saving } = useSave()
  const [jsonError, setJsonError] = useState<string | null>(null)

  const parseDefinition = (text: string) => {
    if (!text.trim()) return { ok: true as const, value: null }
    try {
      const v = JSON.parse(text)
      if (v === null || typeof v !== 'object' || Array.isArray(v)) return { ok: false as const, error: 'Must be a JSON object' }
      return { ok: true as const, value: v as Record<string, unknown> }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  }

  const onSave = () => {
    const parsed = parseDefinition(draft.flow_definition)
    if (!parsed.ok) return
    return save(() =>
      agentsApi.updateFlow(agent.id, {
        agent_type: draft.agent_type,
        drop_off_scenarios: draft.drop_off_scenarios,
        flow_definition: draft.agent_type === 'flow' ? parsed.value : null,
      }),
    )
  }

  const types = [
    {
      value: 'single_prompt' as const,
      icon: <FileText />,
      title: 'Single prompt',
      body: 'The whole conversation is driven by the system prompt. Best for most agents.',
    },
    {
      value: 'flow' as const,
      icon: <Workflow />,
      title: 'Structured flow',
      body: 'Follow a multi-step flow definition instead of a single prompt.',
    },
  ]

  return (
    <div>
      <SectionTitle title="Conversation flow" description="How the conversation is structured and when it ends early." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Agent type" />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              {types.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => patch({ agent_type: t.value })}
                  className={cn(
                    'flex gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed',
                    draft.agent_type === t.value
                      ? 'border-accent bg-accent-soft/50 ring-1 ring-accent'
                      : 'border-line hover:bg-surface-2',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4',
                      draft.agent_type === t.value ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {t.icon}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold">{t.title}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</div>
                  </div>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {draft.agent_type === 'flow' && (
          <Card>
            <CardHeader
              title="Flow definition"
              description="Structured flow graph as a JSON object. Used only in structured-flow mode."
            />
            <CardBody>
              <Textarea
                rows={16}
                value={draft.flow_definition}
                readOnly={readOnly}
                invalid={Boolean(jsonError)}
                className="font-mono text-xs"
                placeholder={'{\n  "nodes": [],\n  "edges": []\n}'}
                onChange={(e) => {
                  patch({ flow_definition: e.target.value })
                  const r = parseDefinition(e.target.value)
                  setJsonError(r.ok ? null : r.error)
                }}
              />
              {jsonError && <p className="mt-1.5 text-xs text-danger">Invalid JSON: {jsonError}</p>}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader title="Drop-off scenarios" />
          <CardBody>
            <SettingRow
              title="End the call early when…"
              description="Named scenarios such as customer_hung_up or requested_human_agent."
            >
              <TagInput
                mono
                value={draft.drop_off_scenarios}
                onChange={(drop_off_scenarios) => patch({ drop_off_scenarios })}
                disabled={readOnly}
                placeholder="e.g. requested_human_agent"
              />
            </SettingRow>
          </CardBody>
        </Card>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        onReset={() => {
          reset()
          setJsonError(null)
        }}
        disabled={Boolean(jsonError)}
      />
    </div>
  )
}
