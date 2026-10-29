import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileText, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { TemplateCategory, WhatsAppTemplateOut } from '@/api/types'
import { timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger, Modal, useConfirm } from '@/components/ui/overlay'
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'
import { useChannel } from './channel'
import { CATEGORY_HELP, useAgentFields } from './helpers'
import { ApprovalBadge } from './shared'

const LANGUAGES = [
  ['en', 'English'],
  ['en_US', 'English (US)'],
  ['hi', 'Hindi'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['kn', 'Kannada'],
  ['ml', 'Malayalam'],
  ['mr', 'Marathi'],
  ['bn', 'Bengali'],
  ['gu', 'Gujarati'],
]

function TemplateModal({ agentId, template, onClose }: { agentId: string; template: WhatsAppTemplateOut | 'new'; onClose: () => void }) {
  const qc = useQueryClient()
  const sms = useChannel().channel === 'sms'
  const editing = template === 'new' ? null : template
  const [name, setName] = useState(editing?.name ?? '')
  const [language, setLanguage] = useState(editing?.language ?? 'en')
  const [category, setCategory] = useState<TemplateCategory>(editing?.category ?? 'utility')
  const [body, setBody] = useState(editing?.body ?? '')
  const placeholders = ['full_name', 'message', ...useAgentFields(agentId).filter((f) => !f.locked).map((f) => f.key)]

  const save = useMutation({
    mutationFn: () => {
      const input = { name: name.trim(), language, category, body: body.trim() }
      return editing ? whatsappApi.updateTemplate(agentId, editing.id, input) : whatsappApi.createTemplate(agentId, input)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.wa.templates(agentId) })
      toast.success(editing ? 'Template updated' : sms ? 'Template saved' : 'Template created as a draft')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not save template'),
  })

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={editing ? 'Edit template' : 'New template'}
      description={sms ? 'A text with {{placeholders}} that is filled in for each contact. No approval is needed.' : 'WhatsApp only delivers business-initiated messages that use an approved template.'}
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || !body.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            {editing ? 'Save changes' : sms ? 'Save template' : 'Save draft'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className={sms ? undefined : 'grid gap-4 sm:grid-cols-2'}>
          <Field label="Name">
            <Input autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="emi_due_reminder" />
          </Field>
          {!sms && (
          <Field label="Language">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          )}
        </div>
        {!sms && (
        <Field label="Category" hint={CATEGORY_HELP[category]}>
          <Select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
            <option value="utility">Utility</option>
            <option value="marketing">Marketing</option>
            <option value="authentication">Authentication</option>
          </Select>
        </Field>
        )}
        <Field
          label="Message body"
          hint={
            <>
              Insert each contact&apos;s values with{' '}
              {placeholders.map((p, i) => (
                <span key={p}>
                  {i > 0 && ', '}
                  <code className="font-mono">{`{{${p}}}`}</code>
                </span>
              ))}
              . {body.length}/1024
            </>
          }
        >
          <Textarea
            rows={6}
            value={body}
            maxLength={1024}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hi {{full_name}}, {{message}}"
          />
        </Field>
      </div>
    </Modal>
  )
}

export function TemplatesTab({ agentId, canWrite }: { agentId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const sms = useChannel().channel === 'sms'
  const confirm = useConfirm()
  const [editing, setEditing] = useState<WhatsAppTemplateOut | 'new' | null>(null)
  const list = useQuery({ queryKey: qk.wa.templates(agentId), queryFn: () => whatsappApi.listTemplates(agentId) })
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.wa.templates(agentId) })

  const submit = useMutation({
    mutationFn: (t: WhatsAppTemplateOut) => whatsappApi.submitTemplate(agentId, t.id),
    onSuccess: () => {
      refresh()
      toast.success('Submitted for WhatsApp approval — this can take a while. Use “Refresh status” to check.')
    },
    onError: (e) => toastError(e, 'Could not submit template'),
  })
  const sync = useMutation({
    mutationFn: (t: WhatsAppTemplateOut) => whatsappApi.syncTemplate(agentId, t.id),
    onSuccess: (t) => {
      refresh()
      toast.success(`Status: ${t.approval_status}`)
    },
    onError: (e) => toastError(e, 'Could not refresh status'),
  })
  const remove = useMutation({
    mutationFn: (t: WhatsAppTemplateOut) => whatsappApi.deleteTemplate(agentId, t.id),
    onSuccess: () => {
      refresh()
      toast.success('Template deleted')
    },
    onError: (e) => toastError(e, 'Could not delete template'),
  })

  const askDelete = async (t: WhatsAppTemplateOut) => {
    const ok = await confirm({ title: `Delete “${t.name}”?`, description: sms ? 'This cannot be undone.' : 'It is also removed from Twilio. This cannot be undone.', confirmLabel: 'Delete template' })
    if (ok) remove.mutate(t)
  }

  const rows = (list.data ?? []).filter((t) => t.source === 'bolotext')
  const addButton = canWrite && (
    <Button variant="primary" onClick={() => setEditing('new')}>
      <Plus /> New template
    </Button>
  )

  return (
    <>
      <div className="mb-4 flex justify-end">{addButton}</div>
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState icon={<FileText />} title="No templates yet" description={sms ? 'Save a text with {{placeholders}} to reuse it when sending.' : "Add a template and submit it for approval to message customers who haven't written to you in the last 24 hours."} action={addButton} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Template</Th>
                <Th className="hidden md:table-cell">Message</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Updated</Th>
                <Th className="w-44" />
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={3} cols={5} />
              ) : (
                rows.map((t) => (
                  <Tr key={t.id}>
                    <Td>
                      <div className="font-medium text-fg">{t.name}</div>
                      <div className="text-xs text-muted">
                        {t.language} · {t.category}
                      </div>
                    </Td>
                    <Td className="hidden max-w-sm md:table-cell">
                      <div className="line-clamp-2 text-xs text-muted">{t.body}</div>
                    </Td>
                    <Td>
                      {sms ? <Badge tone="success" dot>Ready to use</Badge> : <ApprovalBadge status={t.approval_status} />}
                      {t.rejection_reason && <div className="mt-1 max-w-48 truncate text-xs text-danger" title={t.rejection_reason}>{t.rejection_reason}</div>}
                    </Td>
                    <Td className="hidden text-muted sm:table-cell">{timeAgo(t.updated_at)}</Td>
                    <Td className="text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-1">
                          {!sms && (t.approval_status === 'draft' || t.approval_status === 'rejected') && (
                            <Button size="sm" variant="primary" loading={submit.isPending && submit.variables?.id === t.id} onClick={() => submit.mutate(t)}>
                              <Send /> Submit
                            </Button>
                          )}
                          {!sms && t.approval_status === 'pending' && (
                            <Button size="sm" loading={sync.isPending && sync.variables?.id === t.id} onClick={() => sync.mutate(t)}>
                              <RefreshCw /> Refresh status
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownTrigger asChild>
                              <Button size="icon-sm" variant="ghost" aria-label="Template actions">
                                <MoreHorizontal />
                              </Button>
                            </DropdownTrigger>
                            <DropdownContent align="end">
                              <DropdownItem disabled={!sms && (t.approval_status === 'pending' || t.approval_status === 'approved')} onSelect={() => setEditing(t)}>
                                <Pencil /> Edit
                              </DropdownItem>
                              {!sms && t.approval_status === 'approved' && (
                                <DropdownItem onSelect={() => sync.mutate(t)}>
                                  <RefreshCw /> Refresh status
                                </DropdownItem>
                              )}
                              <DropdownItem danger onSelect={() => askDelete(t)}>
                                <Trash2 /> Delete
                              </DropdownItem>
                            </DropdownContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <TemplateModal agentId={agentId} template={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
