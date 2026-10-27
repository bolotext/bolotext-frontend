import { useMemo, useState } from 'react'
import { Database, GripVertical, MessageCircleQuestion, Plus, Trash2 } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import type { AgentOut } from '@/api/types'
import { isEqual } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, SearchInput, Textarea } from '@/components/ui/input'
import { TagInput } from '@/components/ui/editors'
import { Badge, Card, CardBody, CardHeader, EmptyState, Switch } from '@/components/ui/primitives'
import { SaveBar, SectionTitle, useBuilder, useDraft, useSave } from './context'

export default function KnowledgeTab() {
  const { agent, readOnly } = useBuilder()
  const server = useMemo(
    () => ({ faq: agent.faq, knowledge_base_ids: agent.llm.knowledge_base_ids }),
    [agent.faq, agent.llm.knowledge_base_ids],
  )
  const { draft, patch, dirty, reset } = useDraft(server)
  const { save, saving } = useSave()
  const [filter, setFilter] = useState('')

  const pairs = draft.faq.pairs
  const setPairs = (next: typeof pairs) => patch({ faq: { ...draft.faq, pairs: next } })
  const incomplete = pairs.some((p) => !p.question.trim() || !p.answer.trim())
  const shown = pairs
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !filter || `${p.question} ${p.answer}`.toLowerCase().includes(filter.toLowerCase()))

  const onSave = () =>
    save(async () => {
      let res: AgentOut | undefined
      if (!isEqual(draft.faq, server.faq))
        res = await agentsApi.updateFAQ(agent.id, {
          enabled: draft.faq.enabled,
          pairs: draft.faq.pairs.map((p) => ({ question: p.question.trim(), answer: p.answer.trim() })),
        })
      if (!isEqual(draft.knowledge_base_ids, server.knowledge_base_ids))
        res = await agentsApi.updateLLM(agent.id, { knowledge_base_ids: draft.knowledge_base_ids })
      return res
    })

  return (
    <div>
      <SectionTitle title="Knowledge" description="Scripted answers and knowledge sources the agent can draw on." />
      <div className="space-y-6">
        <Card>
          <CardHeader
            icon={<MessageCircleQuestion />}
            title="FAQ"
            description="Question/answer pairs for common caller questions."
            actions={
              <label className="flex items-center gap-2 text-xs text-muted">
                {draft.faq.enabled ? 'Enabled' : 'Disabled'}
                <Switch
                  checked={draft.faq.enabled}
                  onCheckedChange={(enabled) => patch({ faq: { ...draft.faq, enabled } })}
                  disabled={readOnly}
                />
              </label>
            }
          />
          <CardBody className="space-y-3">
            {pairs.length > 3 && <SearchInput value={filter} onChange={setFilter} placeholder="Filter questions…" />}
            {pairs.length === 0 ? (
              <EmptyState
                icon={<MessageCircleQuestion />}
                title="No FAQ entries"
                description="Add the questions callers ask most, phrased the way they’d say them."
                className="rounded-lg border border-dashed border-line py-10"
                action={
                  !readOnly && (
                    <Button onClick={() => setPairs([{ question: '', answer: '' }])}>
                      <Plus /> Add first question
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {shown.map(({ p, i }) => (
                  <div key={i} className="group flex gap-2 rounded-lg border border-line bg-surface-2/40 p-3">
                    <div className="flex flex-col items-center pt-2 text-subtle">
                      <GripVertical className="size-3.5" />
                      <span className="mt-1 font-mono text-[10px]">{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={p.question}
                        readOnly={readOnly}
                        placeholder="Question, e.g. What are your branch timings?"
                        className="font-medium"
                        invalid={!p.question.trim() && dirty}
                        onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
                      />
                      <Textarea
                        rows={2}
                        value={p.answer}
                        readOnly={readOnly}
                        placeholder="Answer the agent should give"
                        invalid={!p.answer.trim() && dirty}
                        onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                      />
                    </div>
                    {!readOnly && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove question"
                        onClick={() => setPairs(pairs.filter((_, j) => j !== i))}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-accent hover:text-accent"
                    onClick={() => setPairs([...pairs, { question: '', answer: '' }])}
                  >
                    <Plus /> Add question
                  </Button>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Database />}
            title="Knowledge bases"
            description="IDs of knowledge bases the LLM retrieves context from when responding."
            actions={<Badge>{draft.knowledge_base_ids.length} linked</Badge>}
          />
          <CardBody>
            <TagInput
              mono
              value={draft.knowledge_base_ids}
              onChange={(knowledge_base_ids) => patch({ knowledge_base_ids })}
              disabled={readOnly}
              placeholder="Paste a knowledge base ID and press Enter"
            />
            <p className="mt-2 text-xs text-muted">
              Knowledge bases aren&apos;t managed by this service yet — link them here by ID. Stored on the agent’s LLM settings.
            </p>
          </CardBody>
        </Card>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        onReset={reset}
        disabled={incomplete}
        hint={incomplete ? 'Every FAQ entry needs a question and an answer' : undefined}
      />
    </div>
  )
}
