import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BookMarked, Braces, FlaskConical, Info, Languages, Plus, Save, Sparkles, Webhook } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { agentsApi } from '@/api/endpoints'
import type { AgentOut, DynamicMessageSettings, HttpMethod, LanguageSwitchMode } from '@/api/types'
import { extractVariables, isEqual } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/input'
import { KeyValueEditor } from '@/components/ui/editors'
import { Badge, Card, CardBody, CardHeader, Segmented, Slider, Spinner, Switch, ToggleRow } from '@/components/ui/primitives'
import { Drawer } from '@/components/ui/overlay'
import { PromptEditor } from './PromptEditor'
import { PromptLibrary, SaveVersionModal } from './PromptLibrary'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim())
const VAR_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const LS_MODES: { value: LanguageSwitchMode; label: string; hint: string }[] = [
  { value: 'explicit', label: 'Explicit', hint: 'Switch only when the caller asks to change language.' },
  { value: 'implicit', label: 'Implicit', hint: 'Auto-detect the caller’s language and follow it.' },
  { value: 'custom', label: 'Custom', hint: 'Use your own language-switch prompt verbatim.' },
]

export default function PromptTab() {
  const { agent, readOnly } = useBuilder()
  const { abilities } = useAuth()
  const p = agent.prompt
  const server = useMemo(
    () => ({
      welcome_message: p.welcome_message,
      system_prompt: p.system_prompt,
      ending_message: p.ending_message,
      pre_call_variables: p.pre_call_variables,
      pre_call_variables_enabled: p.pre_call_variables_enabled,
      language_switch_mode: p.language_switch_mode,
      language_switch_prompt: p.language_switch_prompt ?? '',
      min_words_for_lang_switch: p.min_words_for_lang_switch,
      dynamic: p.dynamic_message,
    }),
    [p],
  )
  const { draft, patch, dirty, reset } = useDraft(server)
  const { save, saving } = useSave()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [saveVersionOpen, setSaveVersionOpen] = useState(false)
  const [lsPreviewOpen, setLsPreviewOpen] = useState(false)

  const declared = Object.keys(draft.pre_call_variables)
  // Backend validates welcome/ending references only (not system_prompt).
  const gated = extractVariables(draft.welcome_message, draft.ending_message)
  const undeclared = gated.filter((v) => !declared.includes(v))
  const inSystem = extractVariables(draft.system_prompt).filter((v) => !declared.includes(v))
  const badKeys = declared.filter((k) => !VAR_NAME.test(k))
  const dynamicInvalid = draft.dynamic.dynamic_message_enabled && !isUrl(draft.dynamic.url ?? '')
  const customMissing = draft.language_switch_mode === 'custom' && !draft.language_switch_prompt.trim()

  const onSave = () =>
    save(async () => {
      let res: AgentOut | undefined
      const msgKeys = ['welcome_message', 'system_prompt', 'ending_message'] as const
      const messages = Object.fromEntries(msgKeys.filter((k) => draft[k] !== server[k]).map((k) => [k, draft[k]]))
      const varsChanged =
        !isEqual(draft.pre_call_variables, server.pre_call_variables) ||
        draft.pre_call_variables_enabled !== server.pre_call_variables_enabled
      // Every prompt save is validated against the declared variables, so
      // declare new ones first (as a superset), then save text, then prune.
      const union = { ...server.pre_call_variables, ...draft.pre_call_variables }
      if (varsChanged) res = await agentsApi.setPreCallVariables(agent.id, union, draft.pre_call_variables_enabled)
      if (Object.keys(messages).length) res = await agentsApi.updatePromptMessages(agent.id, messages)
      if (varsChanged && !isEqual(union, draft.pre_call_variables))
        res = await agentsApi.setPreCallVariables(agent.id, draft.pre_call_variables, draft.pre_call_variables_enabled)
      const lsKeys = ['language_switch_mode', 'language_switch_prompt', 'min_words_for_lang_switch'] as const
      if (lsKeys.some((k) => draft[k] !== server[k])) {
        res = await agentsApi.updateLanguageSwitch(agent.id, {
          language_switch_mode: draft.language_switch_mode,
          language_switch_prompt: draft.language_switch_prompt.trim() || null,
          min_words_for_lang_switch: draft.min_words_for_lang_switch,
        })
      }
      if (!isEqual(draft.dynamic, server.dynamic))
        res = await agentsApi.updateDynamicMessage(agent.id, { ...draft.dynamic, url: draft.dynamic.url?.trim() || null })
      return res
    })

  const setDynamic = (p: Partial<DynamicMessageSettings>) => patch({ dynamic: { ...draft.dynamic, ...p } })

  const declareMissing = () =>
    patch({
      pre_call_variables: {
        ...draft.pre_call_variables,
        ...Object.fromEntries([...undeclared, ...inSystem].map((v) => [v, ''])),
      },
    })

  // Voice agents must disclose they're AI — a nudge, not a save blocker.
  const disclosesAI = /\b(AI|artificial intelligence|virtual assistant|automated (assistant|agent)|bot)\b/i.test(
    `${draft.welcome_message} ${draft.system_prompt}`,
  )
  const blocking = undeclared.length > 0 || badKeys.length > 0 || customMissing || dynamicInvalid
  const words = draft.system_prompt.trim() ? draft.system_prompt.trim().split(/\s+/).length : 0

  return (
    <div>
      <SectionTitle
        title="Prompt"
        description="What the agent says and how it behaves. Use {{variable}} placeholders for per-call data."
        actions={
          <>
            <Link to={`/agents/${agent.id}/test`}>
              <Button>
                <FlaskConical /> Preview
              </Button>
            </Link>
          </>
        }
      />

      {!disclosesAI && (draft.welcome_message || draft.system_prompt) && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-info/25 bg-info-soft px-4 py-3 text-[13px] text-fg">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <span>
            Neither the welcome message nor the system prompt tells callers they&apos;re speaking with an AI. Voice agents should
            disclose this — e.g. “this is an AI assistant calling from …”.
          </span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Welcome message" description="The first thing the agent says when the call connects." />
            <CardBody>
              <PromptEditor
                rows={2}
                value={draft.welcome_message}
                onChange={(welcome_message) => patch({ welcome_message })}
                readOnly={readOnly}
                declared={declared}
                placeholder="Hi {{customer_name}}, this is Neha calling from…"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="System prompt"
              description="Persona, goals, guardrails and conversation rules."
              actions={
                <div className="flex items-center gap-2">
                  <span className="mr-1 hidden text-xs text-muted tabular-nums sm:inline">
                    {words} words · {draft.system_prompt.length} chars
                  </span>
                  <Button size="sm" onClick={() => setLibraryOpen(true)}>
                    <BookMarked /> Versions
                  </Button>
                  {!readOnly && abilities.editAgents && (
                    <Button size="sm" disabled={!draft.system_prompt.trim()} onClick={() => setSaveVersionOpen(true)}>
                      <Save /> Save as version
                    </Button>
                  )}
                </div>
              }
            />
            <CardBody>
              <PromptEditor
                rows={18}
                mono
                value={draft.system_prompt}
                onChange={(system_prompt) => patch({ system_prompt })}
                readOnly={readOnly}
                declared={declared}
                placeholder={
                  '## Role\nYou are a polite, concise voice assistant for [COMPANY].\n\n## Goals\n- …\n\n## Rules\n- Always disclose that you are an AI assistant.\n- …'
                }
              />
              {inSystem.length > 0 && (
                <p className="mt-2 text-xs text-muted">
                  {inSystem.map((v) => `{{${v}}}`).join(', ')} {inSystem.length === 1 ? 'isn’t' : 'aren’t'} declared. That's
                  allowed in the system prompt, but it will only resolve if each call supplies a value.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ending message" description="Said when the agent closes the call." />
            <CardBody>
              <PromptEditor
                rows={2}
                value={draft.ending_message}
                onChange={(ending_message) => patch({ ending_message })}
                readOnly={readOnly}
                declared={declared}
                placeholder="Thank you for your time, {{customer_name}}. Have a great day."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<Webhook />}
              title="Dynamic message"
              description="Fetch live content from an external API mid-call (e.g. an order status) and speak it."
            />
            <CardBody>
              <ToggleRow
                title="Enable dynamic message"
                checked={draft.dynamic.dynamic_message_enabled}
                onCheckedChange={(dynamic_message_enabled) => setDynamic({ dynamic_message_enabled })}
                disabled={readOnly}
              >
                <div className="divide-y divide-line">
                  <SettingRow title="Endpoint">
                    <div className="flex gap-2">
                      <Select
                        value={draft.dynamic.method}
                        onChange={(e) => setDynamic({ method: e.target.value as HttpMethod })}
                        disabled={readOnly}
                        className="w-28"
                      >
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </Select>
                      <Input
                        value={draft.dynamic.url ?? ''}
                        onChange={(e) => setDynamic({ url: e.target.value })}
                        readOnly={readOnly}
                        invalid={dynamicInvalid}
                        className="flex-1 font-mono text-xs"
                        placeholder="https://api.example.com/message"
                      />
                    </div>
                    {dynamicInvalid && <p className="mt-1 text-xs text-danger">A valid http(s) URL is required when enabled</p>}
                  </SettingRow>
                  <SettingRow title="Headers" description="Sent with every request. Values are masked.">
                    <KeyValueEditor
                      value={draft.dynamic.headers}
                      onChange={(headers) => setDynamic({ headers })}
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

        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<Braces />}
              title="Pre-call variables"
              description="Defaults for {{placeholders}}. A call’s own values override these."
            />
            <CardBody className="space-y-4">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[13px]">Apply defaults</span>
                <Switch
                  checked={draft.pre_call_variables_enabled}
                  onCheckedChange={(v) => patch({ pre_call_variables_enabled: v })}
                  disabled={readOnly}
                />
              </label>
              <KeyValueEditor
                value={draft.pre_call_variables}
                onChange={(pre_call_variables) => patch({ pre_call_variables })}
                disabled={readOnly}
                keyPlaceholder="name"
                valuePlaceholder="default value"
                addLabel="Add variable"
                keyPattern={VAR_NAME}
              />
              {undeclared.length > 0 && (
                <div className="rounded-lg border border-danger/25 bg-danger-soft p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-danger">
                    <AlertTriangle className="size-3.5" /> Undeclared in welcome/ending
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {undeclared.map((v) => (
                      <code key={v} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-danger">
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                  {!readOnly && (
                    <Button size="sm" variant="ghost" className="mt-2 -ml-2 text-danger" onClick={declareMissing}>
                      <Plus /> Declare {undeclared.length + inSystem.length > 1 ? 'all' : 'it'}
                    </Button>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<Languages />}
              title="Language switching"
              description={
                agent.languages.length < 2
                  ? 'Only applies once the agent has two or more languages.'
                  : `Between ${agent.languages.join(', ')}.`
              }
            />
            <CardBody className="space-y-4">
              <Segmented
                className="w-full [&>button]:flex-1 [&>button]:justify-center"
                value={draft.language_switch_mode}
                onChange={(language_switch_mode) => patch({ language_switch_mode })}
                disabled={readOnly}
                options={LS_MODES.map((m) => ({ value: m.value, label: m.label }))}
              />
              <p className="text-xs text-muted">{LS_MODES.find((m) => m.value === draft.language_switch_mode)?.hint}</p>
              <Field label="Minimum words before switching" hint="Words the caller must say in another language first.">
                <Slider
                  min={2}
                  max={10}
                  step={1}
                  value={draft.min_words_for_lang_switch}
                  onChange={(min_words_for_lang_switch) => patch({ min_words_for_lang_switch })}
                  disabled={readOnly}
                  format={(v) => `${v}`}
                />
              </Field>
              {draft.language_switch_mode === 'custom' && (
                <Field label="Custom prompt" error={customMissing ? 'Required in custom mode' : undefined}>
                  <PromptEditor
                    rows={6}
                    mono
                    value={draft.language_switch_prompt}
                    onChange={(language_switch_prompt) => patch({ language_switch_prompt })}
                    readOnly={readOnly}
                  />
                </Field>
              )}
              <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setLsPreviewOpen(true)}>
                <Sparkles /> Preview rendered prompt
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        onReset={reset}
        disabled={blocking}
        hint={blocking ? 'Fix the highlighted issues before saving' : undefined}
      />

      <SaveVersionModal
        agentId={agent.id}
        open={saveVersionOpen}
        onOpenChange={setSaveVersionOpen}
        initialText={draft.system_prompt}
      />

      <Drawer
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        title="Prompt versions"
        description="Saved system-prompt versions for this agent. Load one into the editor, or save the current text as a new version."
        width="max-w-2xl"
      >
        <PromptLibrary
          agentId={agent.id}
          currentText={draft.system_prompt}
          useLabel="Load into editor"
          onUse={
            readOnly
              ? undefined
              : (text) => {
                  patch({ system_prompt: text })
                  setLibraryOpen(false)
                }
          }
        />
      </Drawer>

      <LanguageSwitchPreviewDrawer agentId={agent.id} open={lsPreviewOpen} onOpenChange={setLsPreviewOpen} dirty={dirty} />
    </div>
  )
}

function LanguageSwitchPreviewDrawer({
  agentId,
  open,
  onOpenChange,
  dirty,
}: {
  agentId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  dirty: boolean
}) {
  const { data, isFetching, error } = useQuery({
    queryKey: ['agent', agentId, 'ls-preview'],
    queryFn: () => agentsApi.languageSwitchPreview(agentId),
    enabled: open,
    staleTime: 0,
  })
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Language-switch prompt"
      description="Exactly what is sent to the language-switch LLM call."
      width="max-w-2xl"
    >
      {dirty && (
        <div className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Preview reflects the saved configuration — save your changes to see them here.
        </div>
      )}
      {isFetching ? (
        <Spinner />
      ) : error ? (
        <p className="text-[13px] text-danger">{String((error as Error).message)}</p>
      ) : data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{data.mode}</Badge>
            {data.languages.map((l) => (
              <Badge key={l}>{l}</Badge>
            ))}
          </div>
          {data.prompt ? (
            <pre className="rounded-lg border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {data.prompt}
            </pre>
          ) : (
            <p className="rounded-lg border border-dashed border-line p-4 text-[13px] text-muted">
              Language switching is a no-op for this agent — it needs at least two recognized languages, or a custom prompt in
              custom mode.
            </p>
          )}
        </div>
      ) : null}
    </Drawer>
  )
}
