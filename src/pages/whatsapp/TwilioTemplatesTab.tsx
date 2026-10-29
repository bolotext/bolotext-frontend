import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link2, RefreshCw, Unlink } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppTwilioTemplate } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/input'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'
import { useAgentFields } from './helpers'
import { TwilioApprovalBadge } from './shared'

/** Templates that were created on the Twilio platform: link one to use it for sends. */
export function TwilioTemplatesTab({ agentId, canWrite }: { agentId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [linking, setLinking] = useState<WhatsAppTwilioTemplate | null>(null)
  const list = useQuery({ queryKey: qk.wa.twilioTemplates(agentId), queryFn: () => whatsappApi.twilioTemplates(agentId) })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.wa.twilioTemplates(agentId) })
    void qc.invalidateQueries({ queryKey: qk.wa.templates(agentId) })
  }
  const sync = useMutation({
    mutationFn: (id: string) => whatsappApi.syncTemplate(agentId, id),
    onSuccess: (t) => {
      refresh()
      toast.success(`Status: ${t.approval_status}`)
    },
    onError: (e) => toastError(e, 'Could not refresh status'),
  })
  const unlink = useMutation({
    mutationFn: (id: string) => whatsappApi.deleteTemplate(agentId, id),
    onSuccess: () => {
      refresh()
      toast.success('Template unlinked')
    },
    onError: (e) => toastError(e, 'Could not unlink template'),
  })
  const askUnlink = async (t: WhatsAppTwilioTemplate) => {
    const ok = await confirm({
      title: `Unlink “${t.name}”?`,
      description: 'It stays in your Twilio account; it just can no longer be picked when sending from this agent.',
      confirmLabel: 'Unlink',
    })
    if (ok && t.template_id) unlink.mutate(t.template_id)
  }

  const rows = list.data ?? []
  const syncing = (t: WhatsAppTwilioTemplate) => sync.isPending && sync.variables === t.template_id

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Pick which contact field fills each variable when you link one. It stays managed in Twilio.</p>
        <Button onClick={() => void list.refetch()} loading={list.isFetching && !list.isLoading}>
          <RefreshCw /> Reload from Twilio
        </Button>
      </div>
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState icon={<Link2 />} title="No templates in Twilio" description="Create a Content template in the Twilio console, then reload." />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Template</Th>
                <Th className="hidden md:table-cell">Message</Th>
                <Th>WhatsApp status</Th>
                <Th className="w-48" />
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={3} cols={4} />
              ) : (
                rows.map((t) => (
                  <Tr key={t.sid}>
                    <Td>
                      <div className="font-medium text-fg">{t.name}</div>
                      <div className="font-mono text-[11px] text-muted">{t.sid}</div>
                    </Td>
                    <Td className="hidden max-w-sm md:table-cell">
                      <div className="line-clamp-2 text-xs text-muted">{t.body || '—'}</div>
                      {t.variables.length > 0 && <div className="mt-0.5 text-[11px] text-subtle">Variables: {t.variables.join(', ')}</div>}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <TwilioApprovalBadge status={t.approval_status} />
                        {t.template_id && <Badge tone="info">Linked</Badge>}
                      </div>
                    </Td>
                    <Td className="text-right">
                      {canWrite &&
                        (t.template_id ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" loading={syncing(t)} onClick={() => sync.mutate(t.template_id!)}>
                              <RefreshCw /> Status
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void askUnlink(t)}>
                              <Unlink /> Unlink
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => setLinking(t)}>
                            <Link2 /> Link
                          </Button>
                        ))}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
      {linking && <LinkModal agentId={agentId} template={linking} onClose={() => setLinking(null)} onLinked={refresh} />}
    </>
  )
}

function LinkModal({ agentId, template, onClose, onLinked }: { agentId: string; template: WhatsAppTwilioTemplate; onClose: () => void; onLinked: () => void }) {
  const options = ['full_name', 'message', ...useAgentFields(agentId).filter((f) => !f.locked).map((f) => f.key)]
  // Suggest a different field per variable, in order; the user can change any of them.
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(template.variables.map((v, i) => [v, options[i % options.length]])))
  const link = useMutation({
    mutationFn: () => whatsappApi.importTemplate(agentId, template.sid, mapping),
    onSuccess: () => {
      onLinked()
      toast.success('Template linked')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not link template'),
  })
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Link “${template.name}”`}
      description="Choose which contact field fills each variable of this Twilio template."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={link.isPending} onClick={() => link.mutate()}>
            Link template
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[13px] text-muted">{template.body}</div>
        {template.variables.length === 0 ? (
          <p className="text-[13px] text-muted">This template has no variables, so every contact gets the same message.</p>
        ) : (
          template.variables.map((v) => (
            <Field key={v} label={`{{${v}}}`}>
              <Select value={mapping[v]} onChange={(e) => setMapping({ ...mapping, [v]: e.target.value })}>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
          ))
        )}
      </div>
    </Modal>
  )
}
