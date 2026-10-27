import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bot, Braces, Info, Play, ScrollText } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import type { TestRenderResponse } from '@/api/types'
import { extractVariables } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui/primitives'
import { toastError } from '../helpers'
import { SectionTitle, useBuilder } from './context'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Highlights placeholders left in rendered text: undeclared `{{var}}` and the
 * backend's `<var>` fallback for declared variables with no value. */
function Highlighted({ text, missing }: { text: string; missing: string[] }) {
  const alts = ['\\{\\{\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*\\}\\}', ...missing.map((m) => escape(`<${m}>`))]
  const re = new RegExp(`(${alts.join('|')})`, 'g')
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-warning-soft px-0.5 text-warning" title="Unresolved — no value supplied">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  )
}

export default function TestTab() {
  const { agent, env } = useBuilder()
  const p = agent.prompt
  const variables = useMemo(
    () => [
      ...new Set([
        ...Object.keys(p.pre_call_variables),
        ...extractVariables(p.welcome_message, p.system_prompt, p.ending_message),
      ]),
    ],
    [p],
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [result, setResult] = useState<TestRenderResponse | null>(null)

  const render = useMutation({
    mutationFn: () => agentsApi.testRender(agent.id, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''))),
    onSuccess: setResult,
    onError: (e) => toastError(e, 'Preview failed'),
  })

  // render_test falls back to a literal `<var>` when neither a sample value
  // nor an (enabled) default supplies one; undeclared `{{var}}` stay as-is.
  const missing = result
    ? Object.entries(result.sample_values_used)
        .filter(([k, v]) => v === `<${k}>`)
        .map(([k]) => k)
    : []
  const unresolved = result
    ? [...new Set([...missing, ...extractVariables(result.welcome_message, result.system_prompt, result.ending_message)])]
    : []
  const hasDefault = (v: string) => p.pre_call_variables_enabled && Boolean(p.pre_call_variables[v])

  return (
    <div>
      <SectionTitle
        title="Test"
        description="Render the prompt exactly as a call would receive it, with sample values for each variable."
      />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-xs text-muted">
        <Info className="mt-px size-3.5 shrink-0" />
        <span>
          Renders the saved <strong className="text-fg">development</strong> prompt — nothing is saved and no call is placed.
          {env !== 'development' && ' (You are viewing another environment; the preview still uses development.)'} Live test calls
          aren&apos;t available from this backend yet.
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader icon={<Braces />} title="Sample values" description="Override defaults for this preview only." />
          <CardBody className="space-y-3">
            {variables.length === 0 ? (
              <p className="text-[13px] text-muted">This prompt has no variables.</p>
            ) : (
              variables.map((v) => (
                <div key={v}>
                  <div className="mb-1 flex items-center justify-between">
                    <code className="font-mono text-xs">{`{{${v}}}`}</code>
                    {hasDefault(v) ? (
                      <span className="text-[11px] text-subtle">default set</span>
                    ) : (
                      <Badge tone="warning">{v in p.pre_call_variables ? 'no default' : 'undeclared'}</Badge>
                    )}
                  </div>
                  <Input
                    value={values[v] ?? ''}
                    placeholder={hasDefault(v) ? p.pre_call_variables[v] : 'Value'}
                    onChange={(e) => setValues({ ...values, [v]: e.target.value })}
                  />
                </div>
              ))
            )}
            <Button variant="primary" className="w-full" loading={render.isPending} onClick={() => render.mutate()}>
              <Play /> Render preview
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ScrollText />}
            title="Rendered prompt"
            actions={
              result &&
              (unresolved.length ? (
                <Badge tone="warning">{unresolved.length} unresolved</Badge>
              ) : (
                <Badge tone="success">All variables resolved</Badge>
              ))
            }
          />
          {!result ? (
            <EmptyState
              icon={<Play />}
              title="Run a preview"
              description="Fill in sample values and render to see the final text."
            />
          ) : (
            <CardBody className="space-y-6">
              <div>
                <div className="mb-2 text-xs font-medium text-muted">Conversation bookends</div>
                <div className="space-y-3 rounded-xl bg-surface-2/60 p-4">
                  {[
                    ['Opens with', result.welcome_message],
                    ['Closes with', result.ending_message],
                  ].map(([label, text]) => (
                    <div key={label} className="flex gap-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
                        <Bot className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] text-subtle">{label}</div>
                        <div className="rounded-2xl rounded-tl-sm border border-line bg-surface px-3.5 py-2 text-[13px] leading-relaxed shadow-card">
                          {text ? (
                            <Highlighted text={text} missing={missing} />
                          ) : (
                            <span className="text-subtle italic">empty</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-muted">System prompt</div>
                <pre className="max-h-[480px] overflow-auto rounded-xl border border-line bg-surface-2/60 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap scrollbar-thin">
                  {result.system_prompt ? (
                    <Highlighted text={result.system_prompt} missing={missing} />
                  ) : (
                    <span className="text-subtle italic">empty</span>
                  )}
                </pre>
              </div>
              {Object.keys(result.sample_values_used).length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted">Values used</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(result.sample_values_used).map(([k, v]) => (
                      <span key={k} className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11px]">
                        {k} ={' '}
                        <span className={missing.includes(k) ? 'text-warning' : 'text-accent'}>
                          {missing.includes(k) ? 'no value' : v}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          )}
        </Card>
      </div>
    </div>
  )
}
