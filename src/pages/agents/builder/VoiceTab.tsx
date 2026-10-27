import { agentsApi } from '@/api/endpoints'
import { useProviders } from '@/api/queries'
import type { VoicePersonaSection } from '@/api/types'
import { Card, CardBody, CardHeader, ErrorState, Segmented, Slider, ToggleRow } from '@/components/ui/primitives'
import { Input } from '@/components/ui/input'
import { ProviderPicker } from './ProviderPicker'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

type Gender = NonNullable<VoicePersonaSection['gender']> | 'unset'

export default function VoiceTab() {
  const { agent, readOnly } = useBuilder()
  const { data: providers, isLoading, error, refetch } = useProviders()
  const { draft, patch, dirty, reset } = useDraft(agent.voice_persona)
  const { save, saving } = useSave()

  return (
    <div>
      <SectionTitle title="Voice" description="How the agent sounds: text-to-speech provider, voice and pacing." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Voice" description="Pick a TTS provider, model and voice ID." />
          <CardBody>
            {error ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : (
              <ProviderPicker
                providers={providers?.tts}
                loading={isLoading}
                providerId={draft.provider_id}
                modelId={draft.model_id}
                onChange={(provider_id, model_id) => patch({ provider_id, model_id })}
                voiceId={draft.voice_id}
                onVoiceChange={(voice_id) => patch({ voice_id })}
                disabled={readOnly}
                modelNoun="Model"
                agentLanguages={agent.languages}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Persona" />
          <CardBody className="divide-y divide-line">
            <SettingRow title="Gender" description="Helps pick and filter voices.">
              <Segmented<Gender>
                value={draft.gender ?? 'unset'}
                onChange={(g) => patch({ gender: g === 'unset' ? null : g })}
                disabled={readOnly}
                options={[
                  { value: 'unset', label: 'Unset' },
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'neutral', label: 'Neutral' },
                ]}
              />
            </SettingRow>
            <SettingRow title="Speaking rate" description="1.0× is the provider’s normal pace.">
              <Slider
                min={0.5}
                max={2}
                step={0.05}
                value={draft.rate_of_speech}
                onChange={(rate_of_speech) => patch({ rate_of_speech })}
                disabled={readOnly}
                format={(v) => `${v.toFixed(2)}×`}
                marks={['Slower', 'Faster']}
              />
            </SettingRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ambience" />
          <CardBody>
            <ToggleRow
              title="Ambient background sound"
              description="Mix a subtle background sound into the agent’s speech for a more natural call."
              checked={draft.use_ambient_sound}
              onCheckedChange={(use_ambient_sound) => patch({ use_ambient_sound })}
              disabled={readOnly}
            >
              <div className="divide-y divide-line">
                <SettingRow title="Sound type" description="e.g. office">
                  <Input
                    value={draft.ambient_sound_type ?? ''}
                    onChange={(e) => patch({ ambient_sound_type: e.target.value || null })}
                    readOnly={readOnly}
                    placeholder="office"
                  />
                </SettingRow>
                <SettingRow title="Volume">
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    value={draft.ambient_sound_volume}
                    onChange={(ambient_sound_volume) => patch({ ambient_sound_volume })}
                    disabled={readOnly}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </SettingRow>
              </div>
            </ToggleRow>
          </CardBody>
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(() => agentsApi.updateVoice(agent.id, draft))} onReset={reset} />
    </div>
  )
}
