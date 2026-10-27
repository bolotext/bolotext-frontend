import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, Plus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { orgsApi } from '@/api/endpoints'
import type { OrganizationStatus } from '@/api/types'
import { formatDate, slugify } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input, SearchInput } from '@/components/ui/input'
import { Badge, Card, EmptyState, ErrorState, Segmented, Switch } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlay'
import { Pager, Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'

const PAGE_SIZE = 25

export function OrgStatusBadge({ status }: { status: OrganizationStatus }) {
  return (
    <Badge tone={status === 'active' ? 'success' : 'warning'} dot>
      {status === 'active' ? 'Active' : 'Suspended'}
    </Badge>
  )
}

function CreateOrgModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const blank = {
    name: '',
    slug: '',
    slugTouched: false,
    withAdmin: true,
    admin_full_name: '',
    admin_email: '',
  }
  const [f, setF] = useState(blank)

  const create = useMutation({
    mutationFn: () =>
      orgsApi.create({
        name: f.name.trim(),
        slug: f.slug.trim(),
        ...(f.withAdmin
          ? {
              admin_email: f.admin_email.trim(),
              admin_full_name: f.admin_full_name.trim() || null,
            }
          : {}),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['organizations'] })
      void qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('Organization created', { description: res.admin_user_id ? 'Admin account created.' : undefined })
      setF(blank)
      onOpenChange(false)
      navigate(`/organizations/${res.organization.id}`)
    },
    onError: (e) => toastError(e, 'Could not create organization'),
  })

  const adminValid = !f.withAdmin || (/\S+@\S+\.\S+/.test(f.admin_email))
  const valid = f.name.trim() && f.slug.trim() && adminValid

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New organization"
      description="Create a tenant and, optionally, its first admin."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!valid} loading={create.isPending} onClick={() => create.mutate()}>
            Create organization
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input
              autoFocus
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value, slug: f.slugTouched ? f.slug : slugify(e.target.value) })}
              placeholder="[COMPANY] Collections"
            />
          </Field>
          <Field label="Slug" hint="Unique identifier.">
            <Input
              value={f.slug}
              onChange={(e) => setF({ ...f, slug: e.target.value, slugTouched: true })}
              className="font-mono text-xs"
            />
          </Field>
        </div>
        <div className="rounded-xl border border-line p-4">
          <label className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium">Create first admin</div>
              <div className="text-xs text-muted">Bootstraps an Admin user in the same step.</div>
            </div>
            <Switch checked={f.withAdmin} onCheckedChange={(withAdmin) => setF({ ...f, withAdmin })} />
          </label>
          {f.withAdmin && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={f.admin_full_name} onChange={(e) => setF({ ...f, admin_full_name: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={f.admin_email} onChange={(e) => setF({ ...f, admin_email: e.target.value })} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function OrganizationsPage() {
  const { abilities } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState<OrganizationStatus | 'all'>('all')
  const [page, setPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])
  const filterKey = `${debounced}|${status}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(0)
  }

  const list = useQuery({
    queryKey: ['organizations', 'page', { debounced, status, page }],
    queryFn: () =>
      orgsApi.list({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: debounced || undefined,
        status: status === 'all' ? undefined : status,
      }),
    placeholderData: keepPreviousData,
  })
  const rows = list.data ?? []

  return (
    <Page wide>
      <PageHeader
        title="Organizations"
        description="Tenants on this platform. Each has its own users, roles and agents."
        actions={
          abilities.can('organization.create') && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus /> New organization
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or slug" className="sm:w-80" />
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
          ]}
        />
      </div>
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title={debounced || status !== 'all' ? 'No matching organizations' : 'No organizations yet'}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>Organization</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Created</Th>
                  <Th className="hidden md:table-cell">Updated</Th>
                </tr>
              </THead>
              {list.isLoading ? (
                <TableSkeleton cols={4} />
              ) : (
                <tbody>
                  {rows.map((o) => (
                    <Tr key={o.id} onClick={() => navigate(`/organizations/${o.id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-[13px] font-semibold">
                            {o.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{o.name}</div>
                            <div className="font-mono text-[11px] text-muted">{o.slug}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <OrgStatusBadge status={o.status} />
                      </Td>
                      <Td className="hidden text-muted md:table-cell">{formatDate(o.created_at)}</Td>
                      <Td className="hidden text-muted md:table-cell">{formatDate(o.updated_at)}</Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </Table>
            <Pager page={page} pageSize={PAGE_SIZE} count={rows.length} onPage={setPage} loading={list.isFetching} />
          </>
        )}
      </Card>
      <CreateOrgModal open={createOpen} onOpenChange={setCreateOpen} />
    </Page>
  )
}
