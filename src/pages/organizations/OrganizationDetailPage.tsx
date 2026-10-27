import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Pause, Play, Plus, UserMinus, UserPlus, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { fetchAllUsers, orgsApi } from '@/api/endpoints'
import { qk, useOrgMembers } from '@/api/queries'
import type { OrgRole } from '@/api/types'
import { formatDate } from '@/lib/utils'
import { ROLE_LABEL } from '@/lib/permissions'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input, SearchInput, Select } from '@/components/ui/input'
import { Avatar, Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'
import { CreateUserModal, RolePicker } from '../UsersPage'
import { OrgStatusBadge } from './OrganizationsPage'

function AddMemberModal({
  orgId,
  open,
  onOpenChange,
  memberIds,
}: {
  orgId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  memberIds: string[]
}) {
  const qc = useQueryClient()
  const users = useQuery({ queryKey: qk.users, queryFn: fetchAllUsers, enabled: open })
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<OrgRole>('DEVELOPER')
  const candidates = (users.data ?? []).filter((u) => !u.is_super_admin && u.status !== 'disabled' && !memberIds.includes(u.id))

  const add = useMutation({
    mutationFn: () => orgsApi.addMember(orgId, userId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(orgId) })
      toast.success('Member added')
      setUserId('')
      onOpenChange(false)
    },
    onError: (e) => toastError(e, 'Could not add member'),
  })

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add existing user"
      description="Give a user who already has an account a role in this organization."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!userId} loading={add.isPending} onClick={() => add.mutate()}>
            Add member
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="User">
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={users.isLoading}>
            <option value="">{users.isLoading ? 'Loading…' : candidates.length ? 'Select a user…' : 'No eligible users'}</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Role">
          <RolePicker value={role} onChange={setRole} />
        </Field>
      </div>
    </Modal>
  )
}

export default function OrganizationDetailPage() {
  const { orgId = '' } = useParams()
  const { abilities } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const org = useQuery({ queryKey: ['organizations', orgId], queryFn: () => orgsApi.get(orgId) })
  const members = useOrgMembers(orgId)
  const [name, setName] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const update = useMutation({
    mutationFn: (body: { name?: string; status?: 'active' | 'suspended' }) => orgsApi.update(orgId, body),
    onSuccess: (o) => {
      qc.setQueryData(['organizations', orgId], o)
      void qc.invalidateQueries({ queryKey: ['organizations'] })
      setName(null)
      toast.success('Organization updated')
    },
    onError: (e) => toastError(e),
  })
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) => orgsApi.updateMember(orgId, userId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(orgId) })
      toast.success('Role updated')
    },
    onError: (e) => toastError(e),
  })
  const remove = useMutation({
    mutationFn: (userId: string) => orgsApi.removeMember(orgId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.members(orgId) })
      toast.success('Member removed')
    },
    onError: (e) => toastError(e),
  })

  const shown = useMemo(
    () => (members.data ?? []).filter((m) => !filter || `${m.full_name} ${m.email}`.toLowerCase().includes(filter.toLowerCase())),
    [members.data, filter],
  )
  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of members.data ?? []) c[m.role] = (c[m.role] ?? 0) + 1
    return c
  }, [members.data])

  if (org.isLoading)
    return (
      <Page>
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </Page>
    )
  if (org.error || !org.data)
    return (
      <Page>
        <Card>
          <ErrorState error={org.error} onRetry={() => org.refetch()} />
        </Card>
      </Page>
    )

  const o = org.data
  const canUpdate = abilities.can('organization.update')

  return (
    <Page wide>
      <PageHeader
        breadcrumbs={[{ label: 'Organizations', to: '/organizations' }, { label: o.name }]}
        title={
          <span className="flex items-center gap-3">
            {o.name} <OrgStatusBadge status={o.status} />
          </span>
        }
        description={<span className="font-mono text-xs">{o.slug}</span>}
        actions={
          canUpdate &&
          (o.status === 'active' ? (
            <Button
              onClick={async () => {
                if (
                  await confirm({
                    title: `Suspend ${o.name}?`,
                    description: 'The organization will be marked suspended. You can reactivate it at any time.',
                    confirmLabel: 'Suspend',
                  })
                )
                  update.mutate({ status: 'suspended' })
              }}
            >
              <Pause /> Suspend
            </Button>
          ) : (
            <Button onClick={() => update.mutate({ status: 'active' })} loading={update.isPending}>
              <Play /> Reactivate
            </Button>
          ))
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <CardHeader
            icon={<Users />}
            title="Members"
            description={`${members.data?.length ?? 0} people`}
            actions={
              <>
                {abilities.can('membership.create') && (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <UserPlus /> Add existing
                  </Button>
                )}
                {abilities.can('user.create') && (
                  <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus /> New user
                  </Button>
                )}
              </>
            }
          />
          {(members.data?.length ?? 0) > 6 && (
            <CardBody className="border-b border-line py-3">
              <SearchInput value={filter} onChange={setFilter} placeholder="Filter members" className="sm:w-72" />
            </CardBody>
          )}
          {members.error ? (
            <ErrorState error={members.error} onRetry={() => members.refetch()} />
          ) : !members.isLoading && shown.length === 0 ? (
            <EmptyState icon={<Users />} title={filter ? 'No matching members' : 'No members yet'} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th className="hidden md:table-cell">Joined</Th>
                  <Th className="w-10" />
                </tr>
              </THead>
              {members.isLoading ? (
                <TableSkeleton cols={4} rows={4} />
              ) : (
                <tbody>
                  {shown.map((m) => (
                    <Tr key={m.user_id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={m.full_name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{m.full_name}</div>
                            <div className="truncate text-xs text-muted">{m.email}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {abilities.can('membership.update') && m.role !== 'SUPER_ADMIN' ? (
                          <Select
                            value={m.role}
                            onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value as OrgRole })}
                            className="w-36"
                          >
                            {(['ADMIN', 'DEVELOPER', 'QA'] as OrgRole[]).map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Badge>{ROLE_LABEL[m.role]}</Badge>
                        )}
                      </Td>
                      <Td className="hidden text-muted md:table-cell">{formatDate(m.created_at)}</Td>
                      <Td>
                        {abilities.can('membership.delete') && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove member"
                            onClick={async () => {
                              if (
                                await confirm({
                                  title: `Remove ${m.full_name} from ${o.name}?`,
                                  description: 'Their role in this organization is removed. The user account itself is kept.',
                                  confirmLabel: 'Remove',
                                })
                              )
                                remove.mutate(m.user_id)
                            }}
                          >
                            <UserMinus />
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Building2 />} title="Details" />
            <CardBody className="space-y-4">
              <Field label="Name">
                <div className="flex gap-2">
                  <Input value={name ?? o.name} onChange={(e) => setName(e.target.value)} readOnly={!canUpdate} />
                  {name !== null && name.trim() && name !== o.name && (
                    <Button variant="primary" loading={update.isPending} onClick={() => update.mutate({ name: name.trim() })}>
                      Save
                    </Button>
                  )}
                </div>
              </Field>
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-xs text-muted">Created</dt>
                  <dd>{formatDate(o.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Updated</dt>
                  <dd>{formatDate(o.updated_at)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted">ID</dt>
                  <dd className="font-mono text-xs">{o.id}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Roles" />
            <ul className="divide-y divide-line">
              {(['ADMIN', 'DEVELOPER', 'QA'] as const).map((r) => (
                <li key={r} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                  {ROLE_LABEL[r]}
                  <span className="text-muted tabular-nums">{roleCounts[r] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <AddMemberModal
        orgId={orgId}
        open={addOpen}
        onOpenChange={setAddOpen}
        memberIds={(members.data ?? []).map((m) => m.user_id)}
      />
      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} fixedOrgId={orgId} />
    </Page>
  )
}
