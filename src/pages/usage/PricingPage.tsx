import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, BadgeDollarSign, Pencil, Plus } from 'lucide-react'
import { usageApi } from '@/api/endpoints'
import type { ModelPrice, UsageKind } from '@/api/types'
import { KIND_LABEL } from '@/lib/usage'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/overlay'
import { Badge, Card, EmptyState, ErrorState, Segmented } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'

const blank = (kind: UsageKind = 'llm'): ModelPrice => ({
  kind,
  provider_id: '',
  model_id: '',
  currency: 'USD',
  input_per_million: null,
  cached_input_per_million: null,
  output_per_million: null,
  per_minute: null,
  per_million_chars: null,
})

const num = (v: string): number | null => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v))
const show = (v: number | null) => (v === null ? '—' : `$${v}`)

function priceSummary(p: ModelPrice) {
  if (p.kind === 'stt') return show(p.per_minute) + ' / min'
  if (p.kind === 'tts') return show(p.per_million_chars) + ' / 1M chars'
  return `in ${show(p.input_per_million)} · cached ${show(p.cached_input_per_million)} · out ${show(p.output_per_million)} / 1M tokens`
}

/** Dollar amount input. Keeps the raw text while typing so "0." and "0.0" survive; emits a number (or null). */
function PriceInput({ label, hint, value, onChange }: { label: string; hint?: string; value: number | null; onChange: (v: number | null) => void }) {
  const [raw, setRaw] = useState(value === null ? '' : String(value))
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-muted">$</span>
        <Input
          inputMode="decimal"
          placeholder="0.00"
          className="pl-6"
          value={raw}
          onChange={(e) => {
            const v = e.target.value
            if (!/^\d*\.?\d*$/.test(v)) return
            setRaw(v)
            onChange(num(v))
          }}
        />
      </div>
    </Field>
  )
}

function PriceModal({ initial, onClose }: { initial: ModelPrice | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [p, setP] = useState<ModelPrice>(initial ?? blank())
  const editing = Boolean(initial && initial.provider_id)
  const save = useMutation({
    mutationFn: () => usageApi.savePrice({ ...p, provider_id: p.provider_id.trim(), model_id: p.model_id.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Price saved')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not save price'),
  })
  const priceSet =
    p.kind === 'stt' ? p.per_minute !== null : p.kind === 'tts' ? p.per_million_chars !== null : p.input_per_million !== null || p.output_per_million !== null
  const valid = p.provider_id.trim() && p.model_id.trim() && priceSet

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? 'Edit model price' : 'Add model price'}
      description="All prices are in US dollars ($) and apply to all usage, past and future, as soon as you save."
      size="md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={save.isPending} onClick={() => save.mutate()}>
            Save price
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">
          <Segmented<UsageKind>
            value={p.kind}
            onChange={(kind) => setP({ ...blank(kind), provider_id: p.provider_id, model_id: p.model_id })}
            disabled={editing}
            options={[
              { value: 'stt', label: 'STT (by time)' },
              { value: 'llm', label: 'LLM (by tokens)' },
              { value: 'tts', label: 'TTS (by characters)' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider" hint="Same id the agent uses, e.g. openai, deepgram.">
            <Input value={p.provider_id} disabled={editing} onChange={(e) => setP({ ...p, provider_id: e.target.value })} placeholder="openai" />
          </Field>
          <Field label="Model id" hint="e.g. gpt-4o-mini, nova-3.">
            <Input value={p.model_id} disabled={editing} onChange={(e) => setP({ ...p, model_id: e.target.value })} placeholder="gpt-4o-mini" className="font-mono" />
          </Field>
        </div>
        {p.kind === 'stt' && <PriceInput key="stt" label="Price per audio minute" value={p.per_minute} onChange={(per_minute) => setP({ ...p, per_minute })} />}
        {p.kind === 'tts' && (
          <PriceInput key="tts" label="Price per 1M characters" value={p.per_million_chars} onChange={(per_million_chars) => setP({ ...p, per_million_chars })} />
        )}
        {p.kind === 'llm' && (
          <div className="grid grid-cols-3 gap-3">
            <PriceInput key="in" label="Input / 1M tokens" value={p.input_per_million} onChange={(input_per_million) => setP({ ...p, input_per_million })} />
            <PriceInput
              key="cached"
              label="Cached input / 1M"
              hint="Empty = same as input."
              value={p.cached_input_per_million}
              onChange={(cached_input_per_million) => setP({ ...p, cached_input_per_million })}
            />
            <PriceInput key="out" label="Output / 1M tokens" value={p.output_per_million} onChange={(output_per_million) => setP({ ...p, output_per_million })} />
          </div>
        )}
      </div>
    </Modal>
  )
}

function RateCard({ rate }: { rate: number | null | undefined }) {
  const qc = useQueryClient()
  const [raw, setRaw] = useState(rate ? String(rate) : '')
  const [synced, setSynced] = useState(rate)
  if (rate !== synced) {
    setSynced(rate)
    setRaw(rate ? String(rate) : '')
  }
  const value = num(raw)
  const save = useMutation({
    mutationFn: () => usageApi.saveRate(value as number),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Rate saved')
    },
    onError: (e) => toastError(e, 'Could not save rate'),
  })
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">USD → INR rate</div>
          <p className="mt-0.5 text-xs text-muted">
            Prices stay in dollars. This only adds the ₹ equivalent next to every amount on the Usage dashboard. {rate ? '' : 'Not set — ₹ amounts are hidden until you add it.'}
          </p>
        </div>
        <div className="relative w-36">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-muted">₹</span>
          <Input
            inputMode="decimal"
            className="pl-6"
            placeholder="per $1"
            value={raw}
            onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && setRaw(e.target.value)}
          />
        </div>
        <Button variant="primary" disabled={!value || value <= 0 || value === rate} loading={save.isPending} onClick={() => save.mutate()}>
          Save rate
        </Button>
      </div>
    </Card>
  )
}

export default function PricingPage() {
  const [editing, setEditing] = useState<ModelPrice | null>(null)
  const q = useQuery({ queryKey: ['usage', 'pricing'], queryFn: usageApi.pricing })
  const rows = q.data?.prices ?? []
  const missing = rows.filter((r) => r.priced === false).length

  return (
    <Page>
      <PageHeader
        title="Model pricing"
        description="What each provider model costs: STT per minute of audio, LLM per token, TTS per character. Super Admin only."
        actions={
          <Button variant="primary" onClick={() => setEditing(blank())}>
            <Plus /> Add price
          </Button>
        }
      />
      {q.data && <RateCard rate={q.data.usd_to_inr} />}
      {missing > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <AlertTriangle className="size-4" /> {missing} model(s) seen in usage have no price yet, so their cost isn&apos;t counted.
        </div>
      )}
      <Card className="overflow-hidden">
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.isLoading && rows.length === 0 ? (
          <EmptyState icon={<BadgeDollarSign />} title="No prices yet" description="Add the price of each provider model your agents use." />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Type</Th>
                <Th>Provider</Th>
                <Th>Model</Th>
                <Th>Price</Th>
                <Th className="w-24" />
              </tr>
            </THead>
            <tbody>
              {q.isLoading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : (
                rows.map((r) => (
                  <Tr key={`${r.kind}-${r.provider_id}-${r.model_id}`}>
                    <Td>
                      <Badge tone="neutral">
                        {KIND_LABEL[r.kind]}
                      </Badge>
                    </Td>
                    <Td>{r.provider_id}</Td>
                    <Td className="font-mono text-xs">{r.model_id}</Td>
                    <Td>{r.priced === false ? <Badge tone="warning">Not priced</Badge> : <span className="text-muted">{priceSummary(r)}</span>}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant={r.priced === false ? 'primary' : 'ghost'} onClick={() => setEditing(r)}>
                        <Pencil /> {r.priced === false ? 'Set price' : 'Edit'}
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <PriceModal key={`${editing.kind}-${editing.provider_id}-${editing.model_id}`} initial={editing} onClose={() => setEditing(null)} />}
    </Page>
  )
}
