import { useState } from 'react'
import { ListChecks, Plus, Tags, Trash2, Webhook } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import type { ExtractionField, HttpMethod, PostCallTriggerSettings } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { KeyValueEditor, TagInput } from '@/components/ui/editors'
import { Badge, Card, CardBody, CardHeader, Switch, ToggleRow } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlay'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

const FIELD_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const emptyField: ExtractionField = {
  field_name: '',
  field_description: '',
  field_type: 'string',
  enum_values: null,
  is_required: false,
}

function FieldModal({
  open,
  onOpenChange,
  initial,
  taken,
  onSubmit,
  readOnly,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: ExtractionField | null
  taken: string[]
  onSubmit: (f: ExtractionField) => void
  readOnly: boolean
}) {
  const [form, setForm] = useState(initial ?? emptyField)
  const [last, setLast] = useState<[boolean, ExtractionField | null]>([open, initial])
  if (last[0] !== open || last[1] !== initial) {
    setLast([open, initial])
    if (open) setForm(initial ?? emptyField)
  }
  const dup = form.field_name.trim() !== initial?.field_name && taken.includes(form.field_name.trim())
  const bad = form.field_name.trim() !== '' && !FIELD_NAME.test(form.field_name.trim())
  const enumMissing = form.field_type === 'enum' && !(form.enum_values?.length ?? 0)
  const valid = form.field_name.trim() && !dup && !bad && form.field_description.trim() && !enumMissing

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'Edit extraction field' : 'Add extraction field'}
      description="A structured data point extracted from the transcript after each call."
      footer={
        !readOnly && (
          <>
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!valid}
              onClick={() => {
                onSubmit({
                  ...form,
                  field_name: form.field_name.trim(),
                  field_description: form.field_description.trim(),
                  enum_values: form.field_type === 'enum' ? form.enum_values : null,
                })
                onOpenChange(false)
              }}
            >
              {initial ? 'Update field' : 'Add field'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Field name" error={dup ? 'Already used' : bad ? 'Letters, digits and _ only' : undefined}>
            <Input
              value={form.field_name}
              readOnly={readOnly}
              onChange={(e) => setForm({ ...form, field_name: e.target.value })}
              className="font-mono text-xs"
              placeholder="promised_payment_date"
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.field_type}
              disabled={readOnly}
              onChange={(e) => setForm({ ...form, field_type: e.target.value as ExtractionField['field_type'] })}
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="enum">Enum</option>
            </Select>
          </Field>
        </div>
        <Field label="Description" hint="Tell the LLM exactly what to extract.">
          <Textarea
            rows={3}
            value={form.field_description}
            readOnly={readOnly}
            onChange={(e) => setForm({ ...form, field_description: e.target.value })}
          />
        </Field>
        {form.field_type === 'enum' && (
          <Field label="Allowed values" error={enumMissing ? 'Add at least one value' : undefined}>
            <TagInput value={form.enum_values ?? []} onChange={(v) => setForm({ ...form, enum_values: v })} disabled={readOnly} />
          </Field>
        )}
        <label className="flex items-center justify-between rounded-lg border border-line p-3">
          <div>
            <div className="text-[13px] font-medium">Required</div>
            <div className="text-xs text-muted">Flag extraction as incomplete if this can’t be determined.</div>
          </div>
          <Switch
            checked={form.is_required}
            onCheckedChange={(is_required) => setForm({ ...form, is_required })}
            disabled={readOnly}
          />
        </label>
      </div>
    </Modal>
  )
}

export default function AnalyticsTab() {
  const { agent, readOnly } = useBuilder()
  const { draft, patch, dirty, reset } = useDraft(agent.analytics)
  const { save, saving } = useSave()
  const [edit, setEdit] = useState<{ open: boolean; index: number | null }>({ open: false, index: null })

  const trigger = draft.post_call_trigger
  const setTrigger = (p: Partial<PostCallTriggerSettings>) => patch({ post_call_trigger: { ...trigger, ...p } })
  const triggerInvalid = trigger.post_call_trigger_enabled && !/^https?:\/\/\S+$/i.test(trigger.url ?? '')

  return (
    <div>
      <SectionTitle
        title="Post-call"
        description="What happens after a call ends: classification, data extraction and webhooks."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader
            icon={<Tags />}
            title="Call disposition"
            description="Classify each ended call into a disposition category."
          />
          <CardBody>
            <ToggleRow
              title="Classify calls"
              checked={draft.disposition_enabled}
              onCheckedChange={(disposition_enabled) => patch({ disposition_enabled })}
              disabled={readOnly}
            >
              <Field label="Disposition instructions" hint="List the categories and how the LLM should choose between them.">
                <Textarea
                  rows={6}
                  value={draft.disposition_prompt ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => patch({ disposition_prompt: e.target.value || null })}
                  className="font-mono text-xs"
                  placeholder={
                    'Classify the call as one of:\n- PROMISE_TO_PAY\n- CALLBACK_REQUESTED\n- WRONG_NUMBER\n- NOT_INTERESTED'
                  }
                />
              </Field>
            </ToggleRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ListChecks />}
            title="Data extraction"
            description="Pull structured fields out of the transcript, e.g. for CRM sync."
            actions={
              <label className="flex items-center gap-2 text-xs text-muted">
                {draft.post_call_extraction_enabled ? 'Enabled' : 'Disabled'}
                <Switch
                  checked={draft.post_call_extraction_enabled}
                  onCheckedChange={(post_call_extraction_enabled) => patch({ post_call_extraction_enabled })}
                  disabled={readOnly}
                />
              </label>
            }
          />
          {draft.extraction_fields.length > 0 && (
            <ul className="divide-y divide-line">
              {draft.extraction_fields.map((f, i) => (
                <li key={`${f.field_name}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEdit({ open: true, index: i })}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-medium">{f.field_name}</span>
                      <Badge tone="info">{f.field_type}</Badge>
                      {f.is_required && <Badge tone="warning">required</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {f.field_description}
                      {f.field_type === 'enum' && f.enum_values?.length ? ` · ${f.enum_values.join(' | ')}` : ''}
                    </div>
                  </button>
                  {!readOnly && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove field"
                      onClick={() => patch({ extraction_fields: draft.extraction_fields.filter((_, j) => j !== i) })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <CardBody className={draft.extraction_fields.length ? 'border-t border-line py-3' : ''}>
            {draft.extraction_fields.length === 0 && <p className="mb-3 text-[13px] text-muted">No fields defined.</p>}
            {!readOnly && (
              <Button size="sm" onClick={() => setEdit({ open: true, index: null })}>
                <Plus /> Add field
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Webhook />} title="Post-call webhook" description="HTTP callback invoked once a call ends." />
          <CardBody>
            <ToggleRow
              title="Send webhook"
              checked={trigger.post_call_trigger_enabled}
              onCheckedChange={(post_call_trigger_enabled) => setTrigger({ post_call_trigger_enabled })}
              disabled={readOnly}
            >
              <div className="divide-y divide-line">
                <SettingRow title="Endpoint">
                  <div className="flex gap-2">
                    <Select
                      value={trigger.method}
                      onChange={(e) => setTrigger({ method: e.target.value as HttpMethod })}
                      disabled={readOnly}
                      className="w-28"
                    >
                      {['POST', 'PUT', 'PATCH', 'GET', 'DELETE'].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </Select>
                    <Input
                      value={trigger.url ?? ''}
                      onChange={(e) => setTrigger({ url: e.target.value || null })}
                      readOnly={readOnly}
                      invalid={triggerInvalid}
                      className="flex-1 font-mono text-xs"
                      placeholder="https://hooks.example.com/call-ended"
                    />
                  </div>
                  {triggerInvalid && <p className="mt-1 text-xs text-danger">A valid http(s) URL is required when enabled</p>}
                </SettingRow>
                <SettingRow title="Headers" description="e.g. an auth header for your endpoint. Values are masked.">
                  <KeyValueEditor
                    value={trigger.headers}
                    onChange={(headers) => setTrigger({ headers })}
                    disabled={readOnly}
                    keyPlaceholder="Header"
                    secretValues
                    addLabel="Add header"
                  />
                </SettingRow>
              </div>
            </ToggleRow>
          </CardBody>
        </Card>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => save(() => agentsApi.updateAnalytics(agent.id, draft))}
        onReset={reset}
        disabled={triggerInvalid}
      />
      <FieldModal
        open={edit.open}
        onOpenChange={(open) => setEdit((s) => ({ ...s, open }))}
        initial={edit.index !== null ? draft.extraction_fields[edit.index] : null}
        taken={draft.extraction_fields.map((f) => f.field_name)}
        readOnly={readOnly}
        onSubmit={(f) =>
          patch({
            extraction_fields:
              edit.index !== null
                ? draft.extraction_fields.map((x, j) => (j === edit.index ? f : x))
                : [...draft.extraction_fields, f],
          })
        }
      />
    </div>
  )
}
