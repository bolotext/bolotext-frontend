import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, Phone } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { AgentListItem, AgentStatus, Environment } from '@/api/types'
import { errorDetails, errorMessage } from '@/lib/utils'
import { useConfirm } from '@/components/ui/overlay'

// Non-component agent helpers (kept apart from shared.tsx so Fast Refresh works).

export const ENV_META: Record<Environment, { label: string; short: string; tone: 'info' | 'warning' | 'success' }> = {
  development: { label: 'Development', short: 'Dev', tone: 'info' },
  stage: { label: 'Stage', short: 'Stage', tone: 'warning' },
  production: { label: 'Production', short: 'Prod', tone: 'success' },
}

/** Error toast that includes pydantic field errors / missing sections. */
export function toastError(e: unknown, title?: string) {
  const details = errorDetails(e)
  toast.error(title ?? errorMessage(e), {
    description: title ? [errorMessage(e), ...details].join('\n') : details.join('\n') || undefined,
  })
}

/** Status toggle, clone and delete — shared by the list and detail pages. */
export function useAgentActions() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const invalidate = (id?: string) => {
    void qc.invalidateQueries({ queryKey: qk.agents })
    if (id) void qc.invalidateQueries({ queryKey: ['agent', id] })
  }

  const status = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AgentStatus }) => agentsApi.setStatus(id, status),
    onSuccess: (a) => {
      invalidate(a.id)
      toast.success(a.status === 'active' ? 'Agent activated' : 'Agent deactivated')
    },
    onError: (e) => toastError(e),
  })

  const clone = useMutation({
    mutationFn: (id: string) => agentsApi.clone(id),
    onSuccess: (a) => {
      invalidate()
      toast.success('Agent cloned', {
        description: a.agent_details.name,
        action: { label: 'Open', onClick: () => navigate(`/agents/${a.id}`) },
      })
    },
    onError: (e) => toastError(e),
  })

  const remove = useMutation({
    mutationFn: (id: string) => agentsApi.remove(id),
    onSuccess: (a) => {
      qc.removeQueries({ queryKey: ['agent', a.id] })
      invalidate()
      toast.success('Agent deleted')
    },
    onError: (e) => toastError(e),
  })

  const confirmDelete = async (agent: Pick<AgentListItem, 'id' | 'agent_details'>) => {
    const ok = await confirm({
      title: 'Delete agent permanently?',
      description: (
        <>
          This hard-deletes <strong className="text-fg">{agent.agent_details.name}</strong> including its development, stage and
          production configs, saved prompt versions and assignments. This can&apos;t be undone.
        </>
      ),
      confirmLabel: 'Delete agent',
      typeToConfirm: agent.agent_details.name,
    })
    if (ok) await remove.mutateAsync(agent.id).catch(() => undefined)
    return ok
  }

  const confirmToggle = async (agent: Pick<AgentListItem, 'id' | 'status' | 'agent_details'>) => {
    if (agent.status === 'active') {
      const ok = await confirm({
        title: 'Deactivate agent?',
        description: `${agent.agent_details.name} will be marked inactive. You can reactivate it at any time.`,
        confirmLabel: 'Deactivate',
      })
      if (!ok) return
    }
    status.mutate({ id: agent.id, status: agent.status === 'active' ? 'inactive' : 'active' })
  }

  return { status, clone, remove, confirmDelete, confirmToggle }
}

export const CHANNELS = [
  { value: 'voice', label: 'Voice', icon: Phone, hint: 'Phone calls (inbound / outbound)' },
  { value: 'chat', label: 'Chat', icon: MessageSquare, hint: 'Embeddable chat widget' },
] as const

// Backend stores region as a free-form string (default 'asia'); keep this list in sync with supported deployments.
export const REGIONS = [
  { value: 'asia', label: 'Asia' },
  { value: 'europe', label: 'Europe' },
  { value: 'north-america', label: 'North America' },
  { value: 'middle-east', label: 'Middle East' },
] as const

export function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  } catch {
    return ['Asia/Kolkata', 'UTC']
  }
}
