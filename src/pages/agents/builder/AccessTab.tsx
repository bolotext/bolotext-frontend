import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Info, ShieldCheck, UserMinus, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { agentsApi } from '@/api/endpoints'
import { qk, useOrgMembers, useUserDirectory } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { useConfirm } from '@/components/ui/overlay'
import { toastError } from '../helpers'
import { SectionTitle, useBuilder } from './context'

export default function AccessTab() {
  const { agent } = useBuilder()
  const { user } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [selected, setSelected] = useState('')

  const assignments = useQuery({ queryKey: qk.assignments(agent.id), queryFn: () => agentsApi.assignments(agent.id) })

  // Org admins list their own org's users (with roles). A super admin's
  // GET /users has no per-org role, so use the agent org's member list.
  const directory = useUserDirectory()
  const useMembers = Boolean(user?.is_super_admin && agent.org_id)
  const members = useOrgMembers(agent.org_id, useMembers)
  const people = useMemo(() => {
    if (useMembers) return (members.data ?? []).map((m) => ({ id: m.user_id, name: m.full_name, email: m.email, role: m.role }))
    return directory.users
      .filter((u) => u.status === 'active')
      .map((u) => ({ id: u.id, name: u.full_name, email: u.email, role: u.role }))
  }, [useMembers, members.data, directory.users])

  const assigned = assignments.data ?? []
  const developers = people.filter((p) => p.role === 'DEVELOPER' && !assigned.includes(p.id))

  const onDone = (ids: string[]) => qc.setQueryData(qk.assignments(agent.id), ids)
  const assign = useMutation({
    mutationFn: (id: string) => agentsApi.assign(agent.id, id),
    onSuccess: (ids) => {
      onDone(ids)
      setSelected('')
      toast.success('Developer assigned')
    },
    onError: (e) => toastError(e),
  })
  const unassign = useMutation({
    mutationFn: (id: string) => agentsApi.unassign(agent.id, id),
    onSuccess: (ids) => {
      onDone(ids)
      toast.success('Access removed')
    },
    onError: (e) => toastError(e),
  })

  const person = (id: string) =>
    people.find((p) => p.id === id) ?? (directory.map.get(id) ? { id, ...directory.map.get(id)!, role: null } : null)

  return (
    <div>
      <SectionTitle title="Access" description="Control which developers can see and edit this agent." />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-xs leading-relaxed text-muted">
        <Info className="mt-px size-3.5 shrink-0" />
        <span>
          Admins have full access and QA has view-only access to every agent in the organization. Developers only see agents
          assigned to them — including agents they create, which are assigned automatically.
        </span>
      </div>

      <Card>
        <CardHeader icon={<ShieldCheck />} title="Assigned developers" actions={<Badge>{assigned.length}</Badge>} />
        <CardBody className="border-b border-line">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1"
              disabled={!developers.length}
            >
              <option value="">
                {developers.length ? 'Select a developer…' : 'No unassigned developers in this organization'}
              </option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.email}
                </option>
              ))}
            </Select>
            <Button variant="primary" disabled={!selected} loading={assign.isPending} onClick={() => assign.mutate(selected)}>
              <UserPlus /> Assign
            </Button>
          </div>
        </CardBody>
        {assignments.isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : assignments.error ? (
          <ErrorState error={assignments.error} onRetry={() => assignments.refetch()} />
        ) : assigned.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck />}
            title="No developers assigned"
            description="Only admins and QA can see this agent right now."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-line">
            {assigned.map((id) => {
              const p = person(id)
              return (
                <li key={id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={p?.name ?? id} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{p?.name ?? 'Unknown user'}</div>
                    <div className="truncate text-xs text-muted">{p?.email ?? <span className="font-mono">{id}</span>}</div>
                  </div>
                  {id === agent.user_id && <Badge tone="accent">owner</Badge>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Remove ${p?.name ?? 'this user'}'s access?`,
                          description: 'They will no longer see or be able to edit this agent.',
                          confirmLabel: 'Remove access',
                        })
                      )
                        unassign.mutate(id)
                    }}
                  >
                    <UserMinus /> Remove
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
