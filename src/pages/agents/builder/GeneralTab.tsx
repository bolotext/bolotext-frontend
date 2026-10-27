import { useMemo } from 'react'
import { agentsApi } from '@/api/endpoints'
import type { AgentOut } from '@/api/types'
import { isEqual } from '@/lib/utils'
import { Card, CardBody, CardHeader } from '@/components/ui/primitives'
import { Field, Input, SearchableSelect, Select, Textarea } from '@/components/ui/input'
import { ChannelPicker, LanguagePicker } from '../shared'
import { REGIONS, timezones } from '../helpers'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

export default function GeneralTab() {
  const { agent, readOnly } = useBuilder()
  const tzs = useMemo(() => timezones(), [])
  const server = useMemo(
    () => ({
      name: agent.agent_details.name,
      description: agent.agent_details.description ?? '',
      region: agent.agent_details.region,
      timezone: agent.agent_details.timezone,
      bot_type: agent.agent_details.bot_type,
      languages: agent.languages,
    }),
    [agent],
  )
  const { draft, patch, dirty, reset } = useDraft(server)
  const { save, saving } = useSave()

  const valid = draft.name.trim() && draft.bot_type.length > 0 && draft.languages.length > 0

  const onSave = () =>
    save(async () => {
      let res: AgentOut | undefined
      const { languages, ...details } = draft
      const detailKeys = ['name', 'description', 'region', 'timezone', 'bot_type'] as const
      if (detailKeys.some((k) => !isEqual(draft[k], server[k]))) {
        res = await agentsApi.updateDetails(agent.id, {
          ...details,
          name: details.name.trim(),
          description: details.description.trim() || null,
        })
      }
      if (!isEqual(languages, server.languages)) res = await agentsApi.setLanguages(agent.id, languages)
      return res
    })

  return (
    <div>
      <SectionTitle title="General" description="Identity, channels and locale for this agent." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Identity" />
          <CardBody className="space-y-4">
            <Field label="Agent name" error={!draft.name.trim() ? 'Name is required' : undefined}>
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} readOnly={readOnly} />
            </Field>
            <Field label="Description" hint="Shown in the agent list. Not sent to the model.">
              <Textarea
                rows={3}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                readOnly={readOnly}
                placeholder="What does this agent do?"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Channels & languages" />
          <CardBody className="divide-y divide-line">
            <SettingRow title="Channels" description="Where this agent operates. Channel-specific toggles live under Deployment.">
              <ChannelPicker value={draft.bot_type} onChange={(bot_type) => patch({ bot_type })} disabled={readOnly} />
            </SettingRow>
            <SettingRow
              title="Languages"
              description="Languages the agent can speak. With two or more, language switching applies (see Prompt)."
            >
              <LanguagePicker value={draft.languages} onChange={(languages) => patch({ languages })} disabled={readOnly} />
            </SettingRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Locale" />
          <CardBody className="divide-y divide-line">
            <SettingRow title="Region" description="Deployment region the agent runs in.">
              <Select value={draft.region} onChange={(e) => patch({ region: e.target.value })} disabled={readOnly}>
                {!REGIONS.some((r) => r.value === draft.region) && <option value={draft.region}>{draft.region}</option>}
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow title="Timezone" description="Used for scheduling and time-sensitive behavior.">
              <SearchableSelect
                value={draft.timezone}
                onChange={(timezone) => patch({ timezone })}
                options={tzs}
                disabled={readOnly}
              />
            </SettingRow>
          </CardBody>
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={reset} disabled={!valid} />
    </div>
  )
}
