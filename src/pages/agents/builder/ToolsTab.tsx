import { useMemo, useState } from 'react'
import { AlertTriangle, Globe, Pencil, Plug, Plus, Trash2, Wrench } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import { useProviders } from '@/api/queries'
import type { ActionParam, AgentAction, AgentOut, MCPServer } from '@/api/types'
import { cn, isEqual } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, SecretInput, Select, Textarea } from '@/components/ui/input'
import { KeyValueEditor, TagInput } from '@/components/ui/editors'
import { Badge, Card, CardHeader, EmptyState, Switch } from '@/components/ui/primitives'
import { Drawer, useConfirm } from '@/components/ui/overlay'
import { SaveBar, SectionTitle, useBuilder, useDraft, useSave } from './context'

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim())

function MethodBadge({ method }: { method: string }) {
  const tone = method === 'GET' ? 'info' : method === 'DELETE' ? 'danger' : 'accent'
  return (
    <Badge tone={tone} className="font-mono">
      {method}
    </Badge>
  )
}

// ---------- Action editor ----------
const emptyAction: AgentAction = { name: '', description: '', endpoint_url: '', method: 'POST', params: [], headers: {} }

function ActionDrawer({
  open,
  onOpenChange,
  initial,
  existingNames,
  onSubmit,
  readOnly,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: AgentAction | null
  existingNames: string[]
  onSubmit: (a: AgentAction) => void
  readOnly: boolean
}) {
  const [form, setForm] = useState<AgentAction>(initial ?? emptyAction)
  const [lastInitial, setLastInitial] = useState(initial)
  const [lastOpen, setLastOpen] = useState(open)
  if (initial !== lastInitial || open !== lastOpen) {
    setLastInitial(initial)
    setLastOpen(open)
    if (open) setForm(initial ?? emptyAction)
  }
  const nameTaken = form.name.trim() !== initial?.name && existingNames.includes(form.name.trim())
  const nameBad = form.name.trim() !== '' && !NAME_RE.test(form.name.trim())
  const paramNames = form.params.map((p) => p.name.trim())
  const paramsBad = form.params.some((p, i) => !p.name.trim() || !p.description.trim() || paramNames.indexOf(p.name.trim()) !== i)
  const valid = form.name.trim() && !nameTaken && !nameBad && form.description.trim() && isUrl(form.endpoint_url) && !paramsBad

  const setParam = (i: number, p: Partial<ActionParam>) =>
    setForm({ ...form, params: form.params.map((x, j) => (j === i ? { ...x, ...p } : x)) })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-2xl"
      title={readOnly ? form.name : initial ? 'Edit action' : 'New action'}
      description="An HTTP endpoint the LLM can call mid-conversation (function calling)."
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
                  name: form.name.trim(),
                  description: form.description.trim(),
                  endpoint_url: form.endpoint_url.trim(),
                  params: form.params.map((p) => ({ ...p, name: p.name.trim(), description: p.description.trim() })),
                })
                onOpenChange(false)
              }}
            >
              {initial ? 'Update action' : 'Add action'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <Field
          label="Name"
          hint="The function name the LLM calls. Letters, digits, _ and -."
          error={
            nameTaken
              ? 'Another action already uses this name'
              : nameBad
                ? 'Use letters, digits, _ or -; start with a letter'
                : undefined
          }
        >
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            readOnly={readOnly}
            className="font-mono text-xs"
            placeholder="lookup_account"
          />
        </Field>
        <Field label="Description" hint="Tell the LLM what this does and when to call it.">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            readOnly={readOnly}
            placeholder="Looks up the caller’s account balance by account number. Call after verifying identity."
          />
        </Field>
        <Field label="Endpoint" error={form.endpoint_url && !isUrl(form.endpoint_url) ? 'Enter a full http(s) URL' : undefined}>
          <div className="flex gap-2">
            <Select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as 'GET' | 'POST' })}
              disabled={readOnly}
              className="w-28"
            >
              <option>POST</option>
              <option>GET</option>
            </Select>
            <Input
              value={form.endpoint_url}
              onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
              readOnly={readOnly}
              className="flex-1 font-mono text-xs"
              placeholder="https://api.example.com/accounts/lookup"
            />
          </div>
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Parameters</div>
              <div className="text-xs text-muted">Values the LLM must extract from the conversation.</div>
            </div>
            {!readOnly && (
              <Button
                size="sm"
                onClick={() =>
                  setForm({ ...form, params: [...form.params, { name: '', type: 'string', description: '', required: true }] })
                }
              >
                <Plus /> Add parameter
              </Button>
            )}
          </div>
          {form.params.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-subtle">No parameters</p>
          ) : (
            <div className="space-y-2">
              {form.params.map((p, i) => (
                <div key={i} className="rounded-lg border border-line bg-surface-2/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={p.name}
                      onChange={(e) => setParam(i, { name: e.target.value })}
                      readOnly={readOnly}
                      placeholder="name"
                      className="w-40 font-mono text-xs"
                      invalid={paramNames.indexOf(p.name.trim()) !== i}
                    />
                    <Select
                      value={p.type}
                      onChange={(e) => setParam(i, { type: e.target.value as ActionParam['type'] })}
                      disabled={readOnly}
                      className="w-28"
                    >
                      <option>string</option>
                      <option>number</option>
                      <option>boolean</option>
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <Switch
                        size="sm"
                        checked={p.required}
                        onCheckedChange={(required) => setParam(i, { required })}
                        disabled={readOnly}
                      />{' '}
                      Required
                    </label>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto"
                        aria-label="Remove parameter"
                        onClick={() => setForm({ ...form, params: form.params.filter((_, j) => j !== i) })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={p.description}
                    onChange={(e) => setParam(i, { description: e.target.value })}
                    readOnly={readOnly}
                    placeholder="Describe this parameter for the LLM"
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Headers" hint="Sent with every call, e.g. an API key. Values are masked on screen.">
          <KeyValueEditor
            value={form.headers}
            onChange={(headers) => setForm({ ...form, headers })}
            disabled={readOnly}
            keyPlaceholder="Header"
            valuePlaceholder="Value"
            secretValues
            addLabel="Add header"
          />
        </Field>
      </div>
    </Drawer>
  )
}

// ---------- MCP editor ----------
const emptyServer: MCPServer = {
  server_id: '',
  name: '',
  url: '',
  transport: 'streamable_http',
  auth_token: null,
  enabled: true,
  allowed_tools: [],
}

function McpDrawer({
  open,
  onOpenChange,
  initial,
  existingIds,
  onSubmit,
  readOnly,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: MCPServer | null
  existingIds: string[]
  onSubmit: (s: MCPServer) => void
  readOnly: boolean
}) {
  const [form, setForm] = useState<MCPServer>(initial ?? emptyServer)
  const [lastInitial, setLastInitial] = useState(initial)
  const [lastOpen, setLastOpen] = useState(open)
  if (initial !== lastInitial || open !== lastOpen) {
    setLastInitial(initial)
    setLastOpen(open)
    if (open) setForm(initial ?? emptyServer)
  }
  const idTaken = form.server_id.trim() !== initial?.server_id && existingIds.includes(form.server_id.trim())
  const valid = form.server_id.trim() && !idTaken && form.name.trim() && isUrl(form.url)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-xl"
      title={readOnly ? form.name : initial ? 'Edit MCP server' : 'Connect MCP server'}
      description="External Model Context Protocol server whose tools the agent can use."
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
                  server_id: form.server_id.trim(),
                  name: form.name.trim(),
                  url: form.url.trim(),
                  auth_token: form.auth_token?.trim() || null,
                })
                onOpenChange(false)
              }}
            >
              {initial ? 'Update server' : 'Add server'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              readOnly={readOnly}
              placeholder="CRM tools"
            />
          </Field>
          <Field label="Server ID" hint="Unique within this agent." error={idTaken ? 'Already used' : undefined}>
            <Input
              value={form.server_id}
              onChange={(e) => setForm({ ...form, server_id: e.target.value })}
              readOnly={readOnly}
              className="font-mono text-xs"
              placeholder="crm"
            />
          </Field>
        </div>
        <Field label="Server URL" error={form.url && !isUrl(form.url) ? 'Enter a full http(s) URL' : undefined}>
          <Input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            readOnly={readOnly}
            className="font-mono text-xs"
            placeholder="https://mcp.example.com/mcp"
          />
        </Field>
        <Field label="Transport">
          <Select
            value={form.transport}
            onChange={(e) => setForm({ ...form, transport: e.target.value as MCPServer['transport'] })}
            disabled={readOnly}
          >
            <option value="streamable_http">Streamable HTTP</option>
            <option value="sse">Server-sent events (SSE)</option>
          </Select>
        </Field>
        <Field label="Auth token" hint="Bearer token / API key sent to the server, if required.">
          <SecretInput
            value={form.auth_token ?? ''}
            onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
            readOnly={readOnly}
            placeholder="Optional"
          />
        </Field>
        <Field label="Allowed tools" hint="Restrict which tools the agent may call. Empty allows every tool the server exposes.">
          <TagInput
            mono
            value={form.allowed_tools}
            onChange={(allowed_tools) => setForm({ ...form, allowed_tools })}
            disabled={readOnly}
            placeholder="tool_name"
          />
        </Field>
        <label className="flex items-center justify-between rounded-lg border border-line p-3">
          <span className="text-[13px] font-medium">Enabled</span>
          <Switch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} disabled={readOnly} />
        </label>
      </div>
    </Drawer>
  )
}

// ---------- Tab ----------
export default function ToolsTab() {
  const { agent, readOnly } = useBuilder()
  const confirm = useConfirm()
  const { data: providers } = useProviders()
  const server = useMemo(
    () => ({ actions: agent.actions.actions, servers: agent.mcp.servers }),
    [agent],
  )
  const { draft, patch, dirty, reset } = useDraft(server)
  const { save, saving } = useSave()
  const [actionEdit, setActionEdit] = useState<{ open: boolean; index: number | null }>({ open: false, index: null })
  const [mcpEdit, setMcpEdit] = useState<{ open: boolean; index: number | null }>({ open: false, index: null })

  const model = providers?.llm
    .find((p) => p.provider_id === agent.llm.provider_id)
    ?.models.find((m) => m.model_id === agent.llm.model_id)
  const noFunctionCalling = model && !model.function_calling && (draft.actions.length > 0 || draft.servers.length > 0)

  const onSave = () =>
    save(async () => {
      let res: AgentOut | undefined
      if (!isEqual(draft.actions, server.actions)) res = await agentsApi.updateActions(agent.id, draft.actions)
      if (!isEqual(draft.servers, server.servers)) res = await agentsApi.updateMCP(agent.id, draft.servers)
      return res
    })

  return (
    <div>
      <SectionTitle
        title="Tools & integrations"
        description="Give the agent abilities beyond conversation: call APIs, use MCP tools and fetch live data."
      />
      {noFunctionCalling && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[13px] text-fg">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          The selected LLM ({model?.label}) doesn&apos;t support function calling, so these tools won&apos;t be callable. Choose a
          model marked “Tools” on the LLM tab.
        </div>
      )}
      <div className="space-y-6">
        <Card>
          <CardHeader
            icon={<Wrench />}
            title="Custom actions"
            description="HTTP functions the LLM can invoke during a call."
            actions={
              !readOnly && (
                <Button size="sm" onClick={() => setActionEdit({ open: true, index: null })}>
                  <Plus /> Add action
                </Button>
              )
            }
          />
          {draft.actions.length === 0 ? (
            <EmptyState
              icon={<Wrench />}
              title="No actions yet"
              description="Add an action to let the agent look up data or take actions in your systems."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-line">
              {draft.actions.map((a, i) => (
                <li key={`${a.name}-${i}`} className="flex items-center gap-3 px-5 py-3.5">
                  <MethodBadge method={a.method} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px] font-medium">{a.name}</div>
                    <div className="truncate text-xs text-muted">{a.description}</div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-subtle">{a.endpoint_url}</div>
                  </div>
                  <span className="hidden text-xs text-muted sm:block">
                    {a.params.length} param{a.params.length === 1 ? '' : 's'}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit action"
                    onClick={() => setActionEdit({ open: true, index: i })}
                  >
                    <Pencil />
                  </Button>
                  {!readOnly && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove action"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Remove action "${a.name}"?`,
                            description: 'The change applies when you save.',
                            confirmLabel: 'Remove',
                          })
                        )
                          patch({ actions: draft.actions.filter((_, j) => j !== i) })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={<Plug />}
            title="MCP servers"
            description="Connect Model Context Protocol servers and use their tools."
            actions={
              !readOnly && (
                <Button size="sm" onClick={() => setMcpEdit({ open: true, index: null })}>
                  <Plus /> Connect server
                </Button>
              )
            }
          />
          {draft.servers.length === 0 ? (
            <EmptyState
              icon={<Plug />}
              title="No MCP servers"
              description="Connect an MCP server to expose its tools to this agent."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-line">
              {draft.servers.map((s, i) => (
                <li key={`${s.server_id}-${i}`} className="flex items-center gap-3 px-5 py-3.5">
                  <div
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg',
                      s.enabled ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle',
                    )}
                  >
                    <Globe className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px] font-medium">
                      {s.name}
                      <code className="font-mono text-[11px] text-subtle">{s.server_id}</code>
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted">{s.url}</div>
                    <div className="mt-0.5 text-[11px] text-subtle">
                      {s.transport === 'sse' ? 'SSE' : 'Streamable HTTP'} ·{' '}
                      {s.allowed_tools.length ? `${s.allowed_tools.length} allowed tools` : 'all tools'}
                      {s.auth_token ? ' · authenticated' : ''}
                    </div>
                  </div>
                  <Switch
                    checked={s.enabled}
                    disabled={readOnly}
                    onCheckedChange={(enabled) =>
                      patch({ servers: draft.servers.map((x, j) => (j === i ? { ...x, enabled } : x)) })
                    }
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit server"
                    onClick={() => setMcpEdit({ open: true, index: i })}
                  >
                    <Pencil />
                  </Button>
                  {!readOnly && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove server"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Disconnect "${s.name}"?`,
                            description: 'The change applies when you save.',
                            confirmLabel: 'Remove',
                          })
                        )
                          patch({ servers: draft.servers.filter((_, j) => j !== i) })
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={reset} />

      <ActionDrawer
        open={actionEdit.open}
        onOpenChange={(open) => setActionEdit((s) => ({ ...s, open }))}
        initial={actionEdit.index !== null ? draft.actions[actionEdit.index] : null}
        existingNames={draft.actions.map((a) => a.name)}
        readOnly={readOnly}
        onSubmit={(a) =>
          patch({
            actions:
              actionEdit.index !== null ? draft.actions.map((x, j) => (j === actionEdit.index ? a : x)) : [...draft.actions, a],
          })
        }
      />
      <McpDrawer
        open={mcpEdit.open}
        onOpenChange={(open) => setMcpEdit((s) => ({ ...s, open }))}
        initial={mcpEdit.index !== null ? draft.servers[mcpEdit.index] : null}
        existingIds={draft.servers.map((s) => s.server_id)}
        readOnly={readOnly}
        onSubmit={(s) =>
          patch({
            servers: mcpEdit.index !== null ? draft.servers.map((x, j) => (j === mcpEdit.index ? s : x)) : [...draft.servers, s],
          })
        }
      />
    </div>
  )
}
