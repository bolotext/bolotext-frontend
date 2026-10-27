import { useId, useState } from 'react'
import { Zap } from 'lucide-react'
import type { ProviderInfo, VoiceOption } from '@/api/types'
import { cn } from '@/lib/utils'
import { Field, Select } from '@/components/ui/input'
import { Badge, Segmented, Skeleton, Tooltip } from '@/components/ui/primitives'
import { VoicePreviewButton } from './VoicePreviewButton'
import { VoiceSelect } from './VoiceSelect'
import { hasVoicePreview } from './voicePreview'

type GenderFilter = 'all' | 'female' | 'male'

/** Provider + model dropdowns, driven entirely by GET /providers. */
export function ProviderPicker({
  providers,
  loading,
  providerId,
  modelId,
  onChange,
  disabled,
  modelNoun = 'Model',
  showFunctionCalling,
  agentLanguages,
  voiceId,
  onVoiceChange,
  language,
  onLanguageChange,
}: {
  providers: ProviderInfo[] | undefined
  loading?: boolean
  providerId: string
  modelId: string | null
  onChange: (providerId: string, modelId: string | null) => void
  disabled?: boolean
  modelNoun?: string
  showFunctionCalling?: boolean
  agentLanguages?: string[]
  /** TTS only: when `onVoiceChange` is set, shows a Voice ID select fed by the chosen model's voice_ids. */
  voiceId?: string
  /** Also receives the voice's gender ('male' | 'female') when the model's voice metadata has one. */
  onVoiceChange?: (voiceId: string, gender: string | null) => void
  /** When set, shows a language select fed by the chosen model's supported_languages (STT). */
  language?: string
  onLanguageChange?: (code: string) => void
}) {
  const id = useId()
  const [gender, setGender] = useState<GenderFilter>('all')
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    )
  }
  const provider = providers?.find((p) => p.provider_id === providerId)
  const unknownProvider = providerId && !provider
  const model = provider?.models.find((m) => m.model_id === modelId)
  const unknownModel = provider && modelId && !model
  const voices = model?.voice_ids ?? []
  // Voices with metadata (e.g. Deepgram Aura-2) get a label and a gender filter; plain id lists don't.
  const voiceOptions: VoiceOption[] = model?.voices?.length
    ? model.voices
    : voices.map((v) => ({ voice_id: v, label: v, gender: null, language: null, accent: null }))
  const filterable = voiceOptions.some((v) => v.gender)
  // Keep the current voice listed even when the filter would hide it.
  const shownVoices = voiceOptions
    .filter((v) => gender === 'all' || v.gender === gender || v.voice_id === voiceId)
    .map((v) => ({
      id: v.voice_id,
      label: filterable ? [v.label, v.language, v.accent].filter(Boolean).join(' · ') : v.label,
    }))
  const unknownVoice = onVoiceChange && model && voiceId && !voices.includes(voiceId)
  const genderOf = (m: { voices?: VoiceOption[] } | undefined, id: string) => m?.voices?.find((v) => v.voice_id === id)?.gender ?? null
  const pickFirstVoice = (m?: { voice_ids: string[]; voices?: VoiceOption[] }) => {
    if (onVoiceChange && m && !m.voice_ids.includes(voiceId ?? '')) {
      const first = m.voice_ids[0] ?? ''
      onVoiceChange(first, genderOf(m, first))
    }
  }
  const languages = model?.supported_languages ?? []
  const codes = languages.map((l) => l.code)
  const missing = (model && agentLanguages?.filter((l) => codes.length && !codes.includes(l))) ?? []

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Provider" htmlFor={`${id}-provider`}>
          <Select
            id={`${id}-provider`}
            value={provider ? providerId : ''}
            disabled={disabled}
            onChange={(e) => {
              const next = providers?.find((p) => p.provider_id === e.target.value)
              if (!next) return
              const first = next.models.find((m) => m.is_active)
              onChange(next.provider_id, first?.model_id ?? null)
              pickFirstVoice(first)
              const lang = first?.supported_languages
              if (onLanguageChange && lang?.length && !lang.some((l) => l.code === language)) onLanguageChange(lang[0].code)
            }}
          >
            {!provider && (
              <option value="" disabled>
                Select a provider
              </option>
            )}
            {providers?.map((p) => (
              <option key={p.provider_id} value={p.provider_id}>
                {p.label}
                {p.multilingual ? ' · multilingual' : ''}
              </option>
            ))}
          </Select>
        </Field>

        {(
          <Field label={modelNoun} htmlFor={`${id}-model`}>
            <Select
              id={`${id}-model`}
              value={model ? model.model_id : ''}
              disabled={disabled || !provider}
              onChange={(e) => {
                if (!provider) return
                onChange(provider.provider_id, e.target.value)
                const next = provider.models.find((m) => m.model_id === e.target.value)
                pickFirstVoice(next)
                const lang = next?.supported_languages
                if (onLanguageChange && lang?.length && !lang.some((l) => l.code === language))
                  onLanguageChange(lang[0].code)
              }}
            >
              {!model && (
                <option value="" disabled>
                  {provider ? `Select a ${modelNoun.toLowerCase()}` : 'Select a provider first'}
                </option>
              )}
              {provider?.models.map((m) => (
                <option key={m.model_id} value={m.model_id} disabled={!m.is_active}>
                  {m.label} ({m.model_id}){!m.is_active ? ' — inactive' : ''}
                  {showFunctionCalling && m.function_calling ? ' · Tools' : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {onVoiceChange && (
          <Field label="Voice ID" htmlFor={`${id}-voice`}>
            {filterable && (
              <Segmented<GenderFilter>
                className="mb-2"
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ]}
              />
            )}
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {hasVoicePreview(providerId, voices[0] ?? '') ? (
                  <VoiceSelect
                    id={`${id}-voice`}
                    providerId={providerId}
                    voices={shownVoices}
                    value={voiceId && voices.includes(voiceId) ? voiceId : ''}
                    onChange={(v) => onVoiceChange(v, genderOf(model, v))}
                    disabled={disabled || !model}
                    placeholder={model ? 'Select a voice' : 'Select a model first'}
                  />
                ) : (
                  <Select
                    id={`${id}-voice`}
                    value={voiceId && voices.includes(voiceId) ? voiceId : ''}
                    disabled={disabled || !model}
                    onChange={(e) => onVoiceChange(e.target.value, genderOf(model, e.target.value))}
                  >
                    {!(voiceId && voices.includes(voiceId)) && (
                      <option value="" disabled>
                        {model ? 'Select a voice' : 'Select a model first'}
                      </option>
                    )}
                    {shownVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {voiceId && voices.includes(voiceId) && <VoicePreviewButton providerId={providerId} voiceId={voiceId} />}
            </div>
          </Field>
        )}

        {onLanguageChange && (
          <Field label="Language" htmlFor={`${id}-language`}>
            <Select
              id={`${id}-language`}
              value={language && codes.includes(language) ? language : ''}
              disabled={disabled || !model || languages.length === 0}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              {!(language && codes.includes(language)) && (
                <option value="" disabled>
                  {model ? 'Select a language' : 'Select a model first'}
                </option>
              )}
              {languages.map((l, i) => (
                <option key={`${l.code}-${i}`} value={l.code}>
                  {l.language} ({l.code})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {unknownProvider && (
        <p className="text-xs text-warning">
          Configured provider <code className="font-mono">{providerId}</code> isn&apos;t in the provider registry.
        </p>
      )}
      {unknownVoice && (
        <p className="text-xs text-warning">
          Configured voice <code className="font-mono">{voiceId}</code> isn&apos;t offered by {model.label}.
        </p>
      )}
      {unknownModel && (
        <p className="text-xs text-warning">
          Configured {modelNoun.toLowerCase()} <code className="font-mono">{modelId}</code> isn&apos;t offered by{' '}
          {provider.label}.
        </p>
      )}

      {model && (
        <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium">{model.label}</span>
            <code className="font-mono text-[11px] text-subtle">{model.model_id}</code>
            {showFunctionCalling && model.function_calling && (
              <Tooltip content="Supports function / tool calling">
                <span>
                  <Badge tone="accent">
                    <Zap className="size-3" /> Tools
                  </Badge>
                </span>
              </Tooltip>
            )}
          </div>
          {model.description && <div className="mt-0.5 text-xs text-muted">{model.description}</div>}
          {model.supported_languages.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {model.supported_languages.map((l, i) => (
                <span
                  key={`${l.code}-${i}`}
                  className={cn(
                    'rounded px-1.5 py-px text-[10px]',
                    agentLanguages?.includes(l.code) ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted',
                  )}
                  title={l.language}
                >
                  {l.code}
                </span>
              ))}
            </div>
          )}
          {missing.length > 0 && (
            <div className="mt-1.5 text-[11px] text-warning">
              Doesn&apos;t list {missing.join(', ')} — check language support for this agent.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
