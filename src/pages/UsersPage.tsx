import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MoreHorizontal, Pencil, Plus, UserX, Users as UsersIcon, UserCheck } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { orgsApi, usersApi } from '@/api/endpoints'
import type { OrgRole, Role, UserOut, UserStatus } from '@/api/types'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/permissions'
import { formatDate, timeAgo } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input, SearchInput, Select } from '@/components/ui/input'
import { Avatar, Badge, Card, EmptyState, ErrorState, Segmented } from '@/components/ui/primitives'
import {
  Drawer,
  DropdownContent,
  DropdownItem,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
  Modal,
  useConfirm,
} from '@/components/ui/overlay'
import { Pager, Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from './agents/helpers'

const PAGE_SIZE = 25
const ORG_ROLES: OrgRole[] = ['ADMIN', 'DEVELOPER', 'QA']

export function RoleBadge({ role, superAdmin }: { role: Role | null; superAdmin?: boolean }) {
  if (superAdmin) return <Badge tone="danger">Super Admin</Badge>
  if (!role) return <span className="text-xs text-subtle">—</span>
  const tone = role === 'ADMIN' ? 'accent' : role === 'DEVELOPER' ? 'info' : role === 'QA' ? 'warning' : 'danger'
  return <Badge tone={tone}>{ROLE_LABEL[role]}</Badge>
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const tone = status === 'active' ? 'success' : status === 'invited' ? 'info' : 'neutral'
  return (
    <Badge tone={tone} dot>
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function RolePicker({ value, onChange }: { value: OrgRole; onChange: (r: OrgRole) => void }) {
  return (
    <div className="grid gap-2">
      {ORG_ROLES.map((r) => (
        <label
          key={r}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${value === r ? 'border-accent bg-accent-soft/50' : 'border-line hover:bg-surface-2'}`}
        >
          <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={value === r} onChange={() => onChange(r)} />
          <div>
            <div className="text-[13px] font-medium">{ROLE_LABEL[r]}</div>
            <div className="text-xs text-muted">{ROLE_DESCRIPTION[r]}</div>
          </div>
        </label>
      ))}
    </div>
  )
}

export function CreateUserModal({
  open,
  onOpenChange,
  fixedOrgId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Pre-select (and lock) the organization, e.g. from an org detail page. */
  fixedOrgId?: string
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isSuper = Boolean(user?.is_super_admin)
  const orgs = useQuery({
    queryKey: ['organizations', 'all'],
    queryFn: () => orgsApi.list({ limit: 200 }),
    enabled: open && isSuper && !fixedOrgId,
  })
  const blank = { email: '', full_name: '', role: 'DEVELOPER' as OrgRole, organization_id: fixedOrgId ?? '' }
  const [form, setForm] = useState(blank)

  const create = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        role: form.role,
        organization_id: isSuper ? form.organization_id : null,
      }),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      void qc.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('User created', { description: `${u.full_name} can now sign in with their Google account.` })
      setForm(blank)
      onOpenChange(false)
    },
    onError: (e) => toastError(e, 'Could not create user'),
  })

  const valid =
    /\S+@\S+\.\S+/.test(form.email) && form.full_name.trim() && (!isSuper || form.organization_id)

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add user"
      description="Creates an account and adds it to the organization with the chosen role."
      size="lg"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={create.isPending} onClick={() => create.mutate()}>
            Create user
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        {isSuper && !fixedOrgId && (
          <Field label="Organization">
            <Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>
              <option value="">Select organization…</option>
              {orgs.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Role">
          <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />
        </Field>
      </div>
    </Modal>
  )
}

function EditUserDrawer({ target, onClose }: { target: UserOut | null; onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [form, setForm] = useState({ full_name: '', role: 'DEVELOPER' as OrgRole, status: 'active' as UserStatus })
  const [lastId, setLastId] = useState<string | null>(null)
  if (target && target.id !== lastId) {
    setLastId(target.id)
    setForm({
      full_name: target.full_name,
      role: target.role && target.role !== 'SUPER_ADMIN' ? target.role : 'DEVELOPER',
      status: target.status,
    })
  }
  // A super admin's user list has no org context (role is null), so role
  // edits go through the organization's member list instead.
  const canEditRole = Boolean(target?.role) && !target?.is_super_admin
  const isSelf = target?.id === user?.id

  const update = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof usersApi.update>[1] = {}
      if (form.full_name.trim() !== target!.full_name) body.full_name = form.full_name.trim()
      if (canEditRole && form.role !== target!.role) body.role = form.role
      if (form.status !== target!.status) body.status = form.status
      return usersApi.update(target!.id, body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
      onClose()
    },
    onError: (e) => toastError(e, 'Could not update user'),
  })

  const valid = form.full_name.trim()

  return (
    <Drawer
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title="Edit user"
      description={target?.email}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={update.isPending} onClick={() => update.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      {target && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={target.full_name} className="size-10 text-sm" />
            <div>
              <div className="font-medium">{target.full_name}</div>
              <div className="text-xs text-muted">
                Joined {formatDate(target.created_at)} · last login {timeAgo(target.last_login_at)}
              </div>
            </div>
          </div>
          <Field label="Full name">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Role">
            {canEditRole ? (
              <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} />
            ) : (
              <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
                {target.is_super_admin
                  ? 'Super admins have platform-wide access.'
                  : 'Roles are per organization — change this user’s role from the organization’s Members list.'}
              </p>
            )}
          </Field>
          <Field label="Status">
            <Segmented
              value={form.status}
              onChange={(status) => setForm({ ...form, status })}
              disabled={isSelf}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'invited', label: 'Invited' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
          </Field>
        </div>
      )}
    </Drawer>
  )
}

export default function UsersPage() {
  const { user, abilities, currentOrg } = useAuth()
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<UserStatus | 'all'>('all')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<UserOut | null>(null)
  const q = useDebounced(search)
  // Back to the first page whenever the query changes.
  const filterKey = `${q}|${status}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(0)
  }

  const list = useQuery({
    queryKey: ['users', 'page', { q, status, page }],
    queryFn: () =>
      usersApi.list({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: q || undefined,
        status: status === 'all' ? undefined : status,
      }),
    placeholderData: keepPreviousData,
  })

  const setUserStatus = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      enable ? usersApi.update(id, { status: 'active' }) : usersApi.disable(id),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(u.status === 'disabled' ? 'User disabled' : 'User re-enabled')
    },
    onError: (e) => toastError(e),
  })

  const rows = list.data ?? []

  return (
    <Page wide>
      <PageHeader
        title="Users"
        description={
          user?.is_super_admin ? 'Every user on the platform.' : `People in ${currentOrg?.name ?? 'your organization'}.`
        }
        actions={
          abilities.can('user.create') && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus /> Add user
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email" className="sm:w-80" />
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'invited', label: 'Invited' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<UsersIcon />}
            title={q || status !== 'all' ? 'No matching users' : 'No users yet'}
            description={
              q || status !== 'all' ? 'Try a different search or filter.' : 'Add teammates to start collaborating on agents.'
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Last login</Th>
                  <Th className="hidden lg:table-cell">Created</Th>
                  <Th className="w-10" />
                </tr>
              </THead>
              {list.isLoading ? (
                <TableSkeleton cols={6} />
              ) : (
                <tbody>
                  {rows.map((u) => (
                    <Tr key={u.id} onClick={abilities.can('user.update') ? () => setEditing(u) : undefined}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 truncate font-medium">
                              {u.full_name}
                              {u.id === user?.id && <Badge>you</Badge>}
                            </div>
                            <div className="truncate text-xs text-muted">{u.email}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <RoleBadge role={u.role} superAdmin={u.is_super_admin} />
                      </Td>
                      <Td>
                        <UserStatusBadge status={u.status} />
                      </Td>
                      <Td className="hidden text-muted md:table-cell" title={formatDate(u.last_login_at, true)}>
                        {timeAgo(u.last_login_at)}
                      </Td>
                      <Td className="hidden text-muted lg:table-cell">{formatDate(u.created_at)}</Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        {(abilities.can('user.update') || abilities.can('user.delete')) && u.id !== user?.id && (
                          <DropdownMenu>
                            <DropdownTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="User actions">
                                <MoreHorizontal />
                              </Button>
                            </DropdownTrigger>
                            <DropdownContent>
                              {abilities.can('user.update') && (
                                <DropdownItem onSelect={() => setEditing(u)}>
                                  <Pencil /> Edit
                                </DropdownItem>
                              )}
                              {u.status === 'disabled'
                                ? abilities.can('user.update') && (
                                    <DropdownItem onSelect={() => setUserStatus.mutate({ id: u.id, enable: true })}>
                                      <UserCheck /> Re-enable
                                    </DropdownItem>
                                  )
                                : abilities.can('user.delete') && (
                                    <>
                                      <DropdownSeparator />
                                      <DropdownItem
                                        danger
                                        onSelect={async () => {
                                          if (
                                            await confirm({
                                              title: `Disable ${u.full_name}?`,
                                              description:
                                                'They will be signed out everywhere and blocked from signing in. Their account and history are kept.',
                                              confirmLabel: 'Disable user',
                                            })
                                          )
                                            setUserStatus.mutate({ id: u.id, enable: false })
                                        }}
                                      >
                                        <UserX /> Disable
                                      </DropdownItem>
                                    </>
                                  )}
                            </DropdownContent>
                          </DropdownMenu>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </Table>
            <Pager page={page} pageSize={PAGE_SIZE} count={rows.length} onPage={setPage} loading={list.isFetching} />
          </>
        )}
      </Card>

      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} />
      <EditUserDrawer target={editing} onClose={() => setEditing(null)} />
    </Page>
  )
}
