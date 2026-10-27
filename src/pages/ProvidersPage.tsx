import { useMemo, useState } from 'react'
import { Brain, Cpu, Mic, Volume2, Zap } from 'lucide-react'
import { useProviders } from '@/api/queries'
import type { ProviderCatalog } from '@/api/types'
import { Page, PageHeader } from '@/components/layout/Page'
import { SearchInput } from '@/components/ui/input'
import { Badge, Card, EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui/primitives'

type Kind = keyof ProviderCatalog

const KINDS: { value: Kind; label: string; icon: typeof Brain; noun: string }[] = [
  { value: 'llm', label: 'LLM', icon: Brain, noun: 'models' },
  { value: 'stt', label: 'Speech-to-text', icon: Mic, noun: 'models' },
  { value: 'tts', label: 'Text-to-speech', icon: Volume2, noun: 'voices' },
]

export default function ProvidersPage() {
  const { data, isLoading, error, refetch } = useProviders()
  const [kind, setKind] = useState<Kind>('llm')
  const [q, setQ] = useState('')

  const providers = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data?.[kind] ?? [])
      .map((p) => ({
        ...p,
        models: p.models.filter(
          (m) =>
            !term ||
            p.label.toLowerCase().includes(term) ||
            m.label.toLowerCase().includes(term) ||
            m.model_id.toLowerCase().includes(term) ||
            m.supported_languages.some(
              (l) => l.code.toLowerCase().includes(term) || l.language.toLowerCase().includes(term),
            ) ||
            m.voice_ids.some((v) => v.toLowerCase().includes(term)),
        ),
      }))
      .filter((p) => p.models.length)
  }, [data, kind, q])

  const meta = KINDS.find((k) => k.value === kind)!

  return (
    <Page wide>
      <PageHeader
        title="Models & voices"
        description="Providers available to agents on this deployment. Read-only — managed by the platform."
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented
          value={kind}
          onChange={setKind}
          options={KINDS.map((k) => ({
            value: k.value,
            label: (
              <>
                <k.icon /> {k.label}
                {data && <span className="text-subtle tabular-nums">{data[k.value].length}</span>}
              </>
            ),
          }))}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search model, provider or language code"
          className="sm:ml-auto sm:w-80"
        />
      </div>

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="space-y-3 p-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Cpu />}
            title="Nothing found"
            description={q ? 'No providers match your search.' : 'No providers are registered for this capability.'}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.provider_id} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold text-accent">
                  {p.label.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{p.label}</div>
                  <div className="font-mono text-[11px] text-subtle">{p.provider_id}</div>
                </div>
                <div className="flex gap-1.5">
                  {p.multilingual && <Badge tone="info">Multilingual</Badge>}
                  {kind === 'llm' && p.supports_function_calling && (
                    <Badge tone="accent">
                      <Zap className="size-3" /> Tools
                    </Badge>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-line">
                {p.models.map((m) => (
                  <li key={m.model_id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{m.label}</span>
                      <code className="font-mono text-[11px] text-subtle">{m.model_id}</code>
                      {!m.is_active && <Badge>inactive</Badge>}
                      {kind === 'llm' && m.function_calling && <Badge tone="accent">function calling</Badge>}
                    </div>
                    {m.description && <p className="mt-0.5 text-xs text-muted">{m.description}</p>}
                    {m.voice_ids.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.voice_ids.map((v) => (
                          <span key={v} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.supported_languages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.supported_languages.map((l) => (
                          <span
                            key={l.code}
                            className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
                            title={l.language}
                          >
                            {l.language} <span className="font-mono opacity-70">{l.code}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-line bg-surface-2/40 px-5 py-2 text-[11px] text-muted">
                {p.models.length} {meta.noun}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  )
}
