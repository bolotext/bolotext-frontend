import { useMemo } from 'react'
import { agentsApi } from '@/api/endpoints'
import { useProviders } from '@/api/queries'
import { Card, CardBody, CardHeader, ErrorState, Slider } from '@/components/ui/primitives'
import { ProviderPicker } from './ProviderPicker'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

export default function ModelTab() {
  const { agent, readOnly } = useBuilder()
  const { data: providers, isLoading, error, refetch } = useProviders()
  const server = useMemo(
    () => ({
      provider_id: agent.llm.provider_id,
      model_id: agent.llm.model_id,
      temperature: agent.llm.temperature,
      max_tokens: agent.llm.max_tokens,
    }),
    [agent.llm],
  )
  const { draft, patch, dirty, reset } = useDraft(server)
  const { save, saving } = useSave()

  return (
    <div>
      <SectionTitle title="Language model" description="The LLM that generates the agent’s responses." />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Provider & model"
            description="Models marked Tools support function calling, required for custom actions and MCP."
          />
          <CardBody>
            {error ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : (
              <ProviderPicker
                providers={providers?.llm}
                loading={isLoading}
                providerId={draft.provider_id}
                modelId={draft.model_id}
                onChange={(provider_id, model_id) => patch({ provider_id, model_id: model_id ?? '' })}
                disabled={readOnly}
                showFunctionCalling
                agentLanguages={agent.languages}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Generation" />
          <CardBody className="divide-y divide-line">
            <SettingRow
              title="Temperature"
              description="Higher values give more varied responses; lower values are more deterministic. Voice agents usually work best between 0 and 0.5."
            >
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={draft.temperature}
                onChange={(temperature) => patch({ temperature })}
                disabled={readOnly}
                format={(v) => v.toFixed(1)}
                marks={['Precise', 'Creative']}
              />
            </SettingRow>
            <SettingRow
              title="Max tokens"
              description="Upper bound on tokens generated per response. Keep it short for snappy voice turns."
            >
              <Slider
                min={100}
                max={500}
                step={50}
                value={draft.max_tokens}
                onChange={(max_tokens) => patch({ max_tokens })}
                disabled={readOnly}
                marks={['Brief', 'Detailed']}
              />
            </SettingRow>
          </CardBody>
        </Card>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => save(() => agentsApi.updateLLM(agent.id, draft))}
        onReset={reset}
        disabled={draft.max_tokens < 1}
      />
    </div>
  )
}
