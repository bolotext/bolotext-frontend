import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, Pencil, Settings2, Upload, Users } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { AgentFormModal } from './WhatsAppPage'
import { ContactsTab } from './ContactsTab'
import { useChannel } from './channel'
import { MessageStatusTab } from './MessageStatusTab'
import { labelForUseCase } from './helpers'
import { ModeBanner } from './shared'
import { SettingsTab } from './SettingsTab'
import { UploadsTab } from './UploadsTab'

const TABS = [
  { id: 'contacts', label: 'Contacts & send', icon: <Users /> },
  { id: 'uploads', label: 'Uploads', icon: <Upload /> },
  { id: 'status', label: 'Message status', icon: <Activity /> },
  { id: 'settings', label: 'Settings', icon: <Settings2 /> },
] as const

export default function WhatsAppAgentPage() {
  const { agentId = '', tab = 'contacts' } = useParams()
  const ch = useChannel()
  const { abilities } = useAuth()
  const canWrite = abilities.role !== 'QA'
  const [editOpen, setEditOpen] = useState(false)
  const agent = useQuery({ queryKey: qk.wa.agent(agentId), queryFn: () => whatsappApi.getAgent(agentId) })
  const active = TABS.find((t) => t.id === tab)?.id ?? 'contacts'

  if (agent.error) {
    return (
      <Page>
        <ErrorState error={agent.error} onRetry={() => agent.refetch()} />
      </Page>
    )
  }
  const a = agent.data

  return (
    <Page wide>
      <PageHeader
        breadcrumbs={[{ label: ch.title, to: ch.base }, { label: a?.name ?? '…' }]}
        title={
          a ? (
            <span className="flex items-center gap-2.5">
              {a.name}
              <Badge tone={a.status === 'active' ? 'success' : 'neutral'} dot>
                {a.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </span>
          ) : (
            <Skeleton className="h-6 w-56" />
          )
        }
        description={a ? `${labelForUseCase(a.use_case)} · sender ${a.twilio_sender ?? 'platform default'}` : undefined}
        actions={
          canWrite &&
          a && (
            <Button onClick={() => setEditOpen(true)}>
              <Pencil /> Edit agent
            </Button>
          )
        }
      />
      <ModeBanner />
      {a && a.status !== 'active' && <p className="mb-4 text-[13px] text-warning">This agent is inactive, so sending is disabled.</p>}
      <nav className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={`${ch.base}/${agentId}/${t.id}`}
            className={cn(
              '-mb-px flex h-9 items-center gap-2 border-b-2 px-3 text-[13px] font-medium transition-colors [&_svg]:size-4',
              active === t.id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t.icon}
            {t.label}
          </Link>
        ))}
      </nav>
      {!a ? (
        <EmptyState title="Loading…" />
      ) : active === 'contacts' ? (
        <ContactsTab agentId={agentId} canWrite={canWrite} />
      ) : active === 'settings' ? (
        <SettingsTab agentId={agentId} canWrite={canWrite} />
      ) : active === 'status' ? (
        <MessageStatusTab agentId={agentId} />
      ) : (
        <UploadsTab agentId={agentId} canWrite={canWrite} />
      )}
      {editOpen && a && <AgentFormModal open onOpenChange={setEditOpen} agent={a} />}
    </Page>
  )
}
