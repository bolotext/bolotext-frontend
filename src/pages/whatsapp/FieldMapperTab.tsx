import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppFieldInput, WhatsAppFieldType } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Card } from '@/components/ui/primitives'
import { toastError } from '../agents/helpers'
import { FIELD_TYPES, useAgentFields } from './helpers'
import { Checkbox } from './shared'

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/
const RESERVED = new Set(['full_name', 'customer_name', 'phone_number', 'message', 'id', 'data'])

/** Defines the columns (key + MongoDB data type) of this agent's uploaded data. */
export function FieldMapperTab({ agentId, canWrite }: { agentId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const saved = useAgentFields(agentId)
  const savedCustom = saved.filter((f) => !f.locked)
  const [rows, setRows] = useState<WhatsAppFieldInput[] | null>(null)
  const custom = rows ?? savedCustom
  const builtin = saved.filter((f) => f.locked)

  const edit = (i: number, patch: Partial<WhatsAppFieldInput>) => setRows(custom.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const keys = custom.map((r) => r.key.trim())
  const problem = (i: number) => {
    const k = keys[i]
    if (!k) return 'Key is required'
    if (!KEY_RE.test(k)) return 'Lowercase letters, digits and _; start with a letter'
    if (RESERVED.has(k)) return 'Built-in name'
    if (keys.indexOf(k) !== i) return 'Duplicate key'
    return null
  }
  const invalid = custom.some((_, i) => problem(i))
  const dirty = rows !== null && JSON.stringify(rows.map((r) => ({ ...r, key: r.key.trim() }))) !== JSON.stringify(savedCustom.map(({ key, type, required }) => ({ key, type, required })))

  const save = useMutation({
    mutationFn: () => whatsappApi.saveFieldMapper(agentId, custom.map((r) => ({ key: r.key.trim(), type: r.type, required: r.required }))),
    onSuccess: (a) => {
      qc.setQueryData(qk.wa.agent(agentId), a)
      setRows(null)
      toast.success('Field mapper saved')
    },
    onError: (e) => toastError(e, 'Could not save field mapper'),
  })

  return (
    <Card className="p-5">
      <p className="mb-4 max-w-2xl text-[13px] text-muted">
        Each CSV cell is validated and stored in MongoDB with the type you choose. Keys work as <code className="font-mono">{'{{key}}'}</code>{' '}
        placeholders in templates, and the CSV header must match the key. Existing contacts are not changed.
      </p>
      <div className="grid grid-cols-[1fr_9rem_5.5rem_2rem] items-center gap-x-3 gap-y-2 text-[13px]">
        <div className="text-xs font-medium text-muted">Key</div>
        <div className="text-xs font-medium text-muted">Data type</div>
        <div className="text-xs font-medium text-muted">Required</div>
        <div />
        {builtin.map((f) => (
          <div key={f.key} className="contents">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 font-mono text-[13px]">
              {f.key}
              <Lock className="ml-auto size-3.5 text-subtle" />
            </div>
            <div className="flex h-9 items-center rounded-lg border border-line bg-surface-2 px-3 text-muted">
              {FIELD_TYPES.find((t) => t.value === f.type)?.label}
            </div>
            <div className="text-muted">Always</div>
            <div />
          </div>
        ))}
        {custom.map((r, i) => (
          <div key={i} className="contents">
            <div>
              <Input
                value={r.key}
                maxLength={40}
                disabled={!canWrite}
                placeholder="amount_due"
                className="font-mono"
                aria-invalid={r.key !== '' && Boolean(problem(i))}
                onChange={(e) => edit(i, { key: e.target.value.toLowerCase() })}
              />
              {r.key !== '' && problem(i) && <div className="mt-0.5 text-[11px] text-danger">{problem(i)}</div>}
            </div>
            <Select value={r.type} disabled={!canWrite} onChange={(e) => edit(i, { type: e.target.value as WhatsAppFieldType })}>
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <div>
              <Checkbox aria-label={`${r.key || 'Field'} required`} checked={r.required} disabled={!canWrite} onChange={(e) => edit(i, { required: e.target.checked })} />
            </div>
            {canWrite ? (
              <Button size="sm" variant="ghost" aria-label="Remove field" onClick={() => setRows(custom.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            ) : (
              <div />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-subtle">{FIELD_TYPES.map((t) => `${t.label}: ${t.hint}`).join(' · ')}</p>
      {canWrite && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button disabled={custom.length >= 30} onClick={() => setRows([...custom, { key: '', type: 'string', required: false }])}>
            <Plus /> Add field
          </Button>
          <div className="flex gap-2">
            {dirty && <Button onClick={() => setRows(null)}>Discard</Button>}
            <Button variant="primary" disabled={!dirty || invalid} loading={save.isPending} onClick={() => save.mutate()}>
              Save field mapper
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
