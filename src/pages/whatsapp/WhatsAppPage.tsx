import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppAgentOut } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { timeAgo } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger, Modal, useConfirm } from '@/components/ui/overlay'
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'
import { useChannel } from './channel'
import { labelForUseCase, USE_CASES } from './helpers'
import { ModeBanner, SettingsButton } from './shared'

export function AgentFormModal({
  open,
  onOpenChange,
  agent,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agent?: WhatsAppAgentOut
  onSaved?: (a: WhatsAppAgentOut) => void
}) {
  const qc = useQueryClient()
  const ch = useChannel()
  const [name, setName] = useState(agent?.name ?? '')
  const [description, setDescription] = useState(agent?.description ?? '')
  const [useCase, setUseCase] = useState(agent?.use_case ?? 'payment-reminder')
  const [sender, setSender] = useState(agent?.twilio_sender ?? '')

  const save = useMutation({
    mutationFn: () => {
      const body = {
        channel: ch.channel,
        name: name.trim(),
        description: description.trim() || null,
        use_case: useCase,
        twilio_sender: sender.trim() || null,
      }
      return agent ? whatsappApi.updateAgent(agent.id, body) : whatsappApi.createAgent(body)
    },
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: qk.wa.agents })
      void qc.invalidateQueries({ queryKey: qk.wa.agent(a.id) })
      toast.success(agent ? 'Agent updated' : 'Agent created')
      onOpenChange(false)
      onSaved?.(a)
    },
    onError: (e) => toastError(e, agent ? 'Could not update agent' : 'Could not create agent'),
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={agent ? `Edit ${ch.noun} agent` : `New ${ch.noun} agent`}
      description="One agent per messaging use case. It owns its own templates and contacts."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            {agent ? 'Save changes' : 'Create agent'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. EMI payment reminders" />
        </Field>
        <Field label="Use case">
          <Select value={useCase} onChange={(e) => setUseCase(e.target.value)}>
            {USE_CASES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" hint="Optional.">
          <Textarea rows={2} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field
          label={`${ch.noun} sender`}
          hint={
            ch.channel === 'sms'
              ? 'An SMS-capable Twilio number (e.g. +12025550123) or a Messaging Service SID (MG…). Leave empty to use the organization default.'
              : 'A WhatsApp-enabled Twilio number in international format (e.g. +14155238886 for the sandbox). Leave empty to use the organization default.'
          }
        >
          <Input value={sender} maxLength={40} onChange={(e) => setSender(e.target.value)} placeholder={ch.channel === 'sms' ? '+12025550123' : '+14155238886'} />
        </Field>
      </div>
    </Modal>
  )
}

export default function WhatsAppPage() {
  const navigate = useNavigate()
  const ch = useChannel()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { abilities } = useAuth()
  const canWrite = abilities.role !== 'QA'
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<WhatsAppAgentOut | null>(null)
  const list = useQuery({ queryKey: [...qk.wa.agents, ch.channel], queryFn: () => whatsappApi.listAgents(ch.channel) })

  const remove = useMutation({
    mutationFn: (a: WhatsAppAgentOut) => whatsappApi.deleteAgent(a.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.wa.agents })
      toast.success('Agent deleted')
    },
    onError: (e) => toastError(e, 'Could not delete agent'),
  })

  const askDelete = async (a: WhatsAppAgentOut) => {
    const ok = await confirm({
      title: `Delete “${a.name}”?`,
      description: 'Its templates, uploaded contacts and delivery history are deleted too. This cannot be undone.',
      confirmLabel: 'Delete agent',
    })
    if (ok) remove.mutate(a)
  }

  const rows = list.data ?? []
  const newButton = canWrite && (
    <Button variant="primary" onClick={() => setCreateOpen(true)}>
      <Plus /> New {ch.noun} agent
    </Button>
  )
  const headerActions = (
    <>
      <SettingsButton />
      {newButton}
    </>
  )

  return (
    <Page>
      <PageHeader
        title={ch.title}
        description={
          ch.channel === 'sms'
            ? 'Send text messages to uploaded contacts, one agent per use case.'
            : 'Send WhatsApp Business messages to uploaded contacts, one agent per use case.'
        }
        actions={headerActions}
      />
      <ModeBanner />
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<MessageSquare />}
            title={`No ${ch.noun} agents yet`}
            description={
              ch.channel === 'sms'
                ? 'Create an agent, upload a CSV of contacts and send.'
                : 'Create an agent, add an approved template, upload a CSV of contacts and send.'
            }
            action={newButton}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Agent</Th>
                <Th>Use case</Th>
                <Th className="hidden md:table-cell">Sender</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
                <Th className="w-10" />
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={4} cols={6} />
              ) : (
                rows.map((a) => (
                  <Tr key={a.id} onClick={() => navigate(`${ch.base}/${a.id}`)}>
                    <Td>
                      <div className="font-medium text-fg">{a.name}</div>
                      {a.description && <div className="max-w-md truncate text-xs text-muted">{a.description}</div>}
                    </Td>
                    <Td>{labelForUseCase(a.use_case)}</Td>
                    <Td className="hidden font-mono text-xs text-muted md:table-cell">{a.twilio_sender ?? 'Platform default'}</Td>
                    <Td>
                      <Badge tone={a.status === 'active' ? 'success' : 'neutral'} dot>
                        {a.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    <Td className="text-muted">{timeAgo(a.updated_at)}</Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="Agent actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownTrigger>
                          <DropdownContent align="end">
                            <DropdownItem onSelect={() => setEditing(a)}>
                              <Pencil /> Edit
                            </DropdownItem>
                            <DropdownItem danger onSelect={() => askDelete(a)}>
                              <Trash2 /> Delete
                            </DropdownItem>
                          </DropdownContent>
                        </DropdownMenu>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
      {createOpen && (
        <AgentFormModal open onOpenChange={setCreateOpen} onSaved={(a) => navigate(`${ch.base}/${a.id}`)} />
      )}
      {editing && <AgentFormModal open onOpenChange={(v) => !v && setEditing(null)} agent={editing} />}
    </Page>
  )
}
