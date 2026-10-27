import { agentsApi } from '@/api/endpoints'
import { useProviders } from '@/api/queries'
import { Card, CardBody, CardHeader, ErrorState, Slider, ToggleRow } from '@/components/ui/primitives'
// import { Input } from '@/components/ui/input' // needed again if the Tier field is re-enabled
import { ProviderPicker } from './ProviderPicker'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

export default function SpeechTab() {
  const { agent, readOnly } = useBuilder()
  const { data: providers, isLoading, error, refetch } = useProviders()
  const { draft, patch, dirty, reset } = useDraft(agent.transcriber)
  const { save, saving } = useSave()

  return (
    <div>
      <SectionTitle
        title="Speech recognition"
        description="How the agent hears callers: ASR provider, turn-taking and noise handling."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Transcriber" />
          <CardBody className="space-y-5">
            {error ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : (
              <ProviderPicker
                providers={providers?.stt}
                loading={isLoading}
                providerId={draft.provider_id}
                modelId={draft.model_id}
                onChange={(provider_id, model_id) => patch({ provider_id, model_id })}
                language={draft.language}
                onLanguageChange={(language) => patch({ language })}
                disabled={readOnly}
                agentLanguages={agent.languages}
              />
            )}
            {/* Tier hidden for now
            <SettingRow
              title="Tier"
              description="Provider-specific quality/cost tier, e.g. balanced. Leave empty for the default."
            >
              <Input
                value={draft.tier ?? ''}
                onChange={(e) => patch({ tier: e.target.value || null })}
                readOnly={readOnly}
                placeholder="default"
              />
            </SettingRow>
            */}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Turn-taking" description="When the agent stops talking and when it decides the caller is done." />
          <CardBody className="divide-y divide-line">
            <ToggleRow
              title="Allow interruptions"
              description="Callers can barge in while the agent is speaking."
              checked={draft.allow_interruptions}
              onCheckedChange={(allow_interruptions) => patch({ allow_interruptions })}
              disabled={readOnly}
            >
              <SettingRow
                title="Minimum time before barge-in"
                description="Agent must have spoken at least this long before an interruption is honored."
              >
                <Slider
                  min={0}
                  max={5}
                  step={0.1}
                  value={draft.min_time_to_barge}
                  onChange={(min_time_to_barge) => patch({ min_time_to_barge })}
                  disabled={readOnly}
                  format={(v) => `${v.toFixed(1)}s`}
                />
              </SettingRow>
            </ToggleRow>
            <ToggleRow
              title="Smart pause"
              description="Adapt end-of-speech detection to the caller’s pace."
              checked={draft.smart_pause}
              onCheckedChange={(smart_pause) => patch({ smart_pause })}
              disabled={readOnly}
            />
            <div className="grid gap-5 py-4 last:pb-0">
              <div>
                <div className="mb-1.5 text-[13px] font-medium">End-of-utterance silence</div>
                <Slider
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={draft.speech_segmentation_silence_timeout}
                    onChange={(v) => patch({ speech_segmentation_silence_timeout: v })}
                    disabled={readOnly}
                    format={(v) => `${v.toFixed(1)}s`}
                  />
                <p className="mt-1 text-xs text-muted">Silence that marks the end of a turn.</p>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-medium">Initial silence timeout</div>
                <Slider
                    min={10}
                    max={30}
                    step={1}
                    value={draft.initial_silence_timeout}
                    onChange={(v) => patch({ initial_silence_timeout: v })}
                    disabled={readOnly}
                    format={(v) => `${v}s`}
                  />
                <p className="mt-1 text-xs text-muted">Wait for the caller to start speaking.</p>
              </div>
              <div>
                <div className="mb-1.5 text-[13px] font-medium">Max speech duration</div>
                <Slider
                    min={10}
                    max={60}
                    step={1}
                    value={draft.max_speech_duration}
                    onChange={(v) => patch({ max_speech_duration: v })}
                    disabled={readOnly}
                    format={(v) => `${v}s`}
                  />
                <p className="mt-1 text-xs text-muted">Longest single utterance before it’s cut.</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Audio & transcript" />
          <CardBody className="divide-y divide-line">
            <ToggleRow
              title="Background noise filtering"
              description="Filter background noise before transcription."
              checked={draft.background_noise_filtering}
              onCheckedChange={(background_noise_filtering) => patch({ background_noise_filtering })}
              disabled={readOnly}
            >
              <SettingRow title="Suppression level" description="Higher suppresses more aggressively.">
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={draft.noise_suppression_level}
                  onChange={(noise_suppression_level) => patch({ noise_suppression_level })}
                  disabled={readOnly}
                  marks={['Light', 'Aggressive']}
                />
              </SettingRow>
            </ToggleRow>
            <ToggleRow
              title="Inverse text normalization"
              description={'Convert spoken forms to written, e.g. “twenty” → “20”.'}
              checked={draft.inverse_text_normalization}
              onCheckedChange={(inverse_text_normalization) => patch({ inverse_text_normalization })}
              disabled={readOnly}
            />
            <ToggleRow
              title="Keypad input (DTMF)"
              description="Recognize keypad tones during the call."
              checked={draft.enable_dtmf}
              onCheckedChange={(enable_dtmf) => patch({ enable_dtmf })}
              disabled={readOnly}
            />
          </CardBody>
        </Card>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => save(() => agentsApi.updateTranscriber(agent.id, draft))}
        onReset={reset}
      />
    </div>
  )
}
