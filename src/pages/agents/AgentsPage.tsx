import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bot,
  Copy,
  ExternalLink,
  Info,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Power,
  PowerOff,
  SearchX,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useAllAgents, useUserDirectory } from '@/api/queries'
import type { AgentListItem } from '@/api/types'
import { formatDate, timeAgo } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/input'
import { Card, EmptyState, ErrorState, Segmented, Skeleton } from '@/components/ui/primitives'
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/overlay'
import { SortableTh, Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { AgentAvatar, CreateAgentModal, StatusBadge } from './shared'
import { useAgentActions } from './helpers'

type SortKey = 'name' | 'created_at' | 'updated_at' | 'status'
type StatusFilter = 'all' | 'active' | 'inactive'

function readView(): 'table' | 'grid' {
  try {
    return localStorage.getItem('bt.agents.view') === 'grid' ? 'grid' : 'table'
  } catch {
    return 'table'
  }
}

export default function AgentsPage() {
  const { abilities, user } = useAuth()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useAllAgents()
  const { map: users } = useUserDirectory()
  const actions = useAgentActions()

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = (params.get('status') as StatusFilter) || 'all'
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'updated_at', dir: 'desc' })
  const [view, setViewState] = useState(readView)
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1')

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v && v !== 'all') next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const setView = (v: 'table' | 'grid') => {
    setViewState(v)
    try {
      localStorage.setItem('bt.agents.view', v)
    } catch {
      /* ignore */
    }
  }

  const agents = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = (data ?? []).filter(
      (a) =>
        (status === 'all' || a.status === status) &&
        (!q ||
          a.agent_details.name.toLowerCase().includes(q) ||
          (a.agent_details.description ?? '').toLowerCase().includes(q) ||
          a.id.includes(q)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) => {
      const av = sort.key === 'name' ? a.agent_details.name.toLowerCase() : sort.key === 'status' ? a.status : a[sort.key]
      const bv = sort.key === 'name' ? b.agent_details.name.toLowerCase() : sort.key === 'status' ? b.status : b[sort.key]
      return av < bv ? -dir : av > bv ? dir : 0
    })
  }, [data, search, status, sort])

  const counts = useMemo(
    () => ({
      all: data?.length ?? 0,
      active: data?.filter((a) => a.status === 'active').length ?? 0,
      inactive: data?.filter((a) => a.status === 'inactive').length ?? 0,
    }),
    [data],
  )

  const scopeNote =
    abilities.role === 'DEVELOPER'
      ? 'You see agents assigned to you, including any you created.'
      : abilities.role === 'QA'
        ? 'You have view-only access to every agent in this organization.'
        : user?.is_super_admin && !user.organization_id
          ? 'Signed in without an organization context — showing agents you own.'
          : null

  const ownerName = (a: AgentListItem) => users.get(a.user_id)?.name ?? null

  const rowMenu = (a: AgentListItem) => (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Agent actions" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={() => navigate(`/agents/${a.id}`)}>
          <ExternalLink /> Open builder
        </DropdownItem>
        {abilities.editAgents && (
          <DropdownItem onSelect={() => actions.confirmToggle(a)}>
            {a.status === 'active' ? <PowerOff /> : <Power />}
            {a.status === 'active' ? 'Deactivate' : 'Activate'}
          </DropdownItem>
        )}
        {abilities.cloneAgent && (
          <DropdownItem onSelect={() => actions.clone.mutate(a.id)}>
            <Copy /> Duplicate
          </DropdownItem>
        )}
        {abilities.deleteAgent && (
          <>
            <DropdownSeparator />
            <DropdownItem danger onSelect={() => actions.confirmDelete(a)}>
              <Trash2 /> Delete
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </DropdownMenu>
  )

  const hasFilters = Boolean(search) || status !== 'all'

  return (
    <Page wide>
      <PageHeader
        title="Agents"
        description="Build, configure and promote your voice and chat agents."
        actions={
          abilities.createAgent && (
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus /> Create agent
            </Button>
          )
        }
      />

      {scopeNote && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
          <Info className="size-3.5 shrink-0" /> {scopeNote}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          value={search}
          onChange={(v) => setParam('q', v)}
          placeholder="Search by name, description or ID"
          className="md:w-80"
        />
        <Segmented<StatusFilter>
          value={status}
          onChange={(v) => setParam('status', v)}
          options={[
            {
              value: 'all',
              label: (
                <>
                  All <span className="text-subtle tabular-nums">{counts.all}</span>
                </>
              ),
            },
            {
              value: 'active',
              label: (
                <>
                  Active <span className="text-subtle tabular-nums">{counts.active}</span>
                </>
              ),
            },
            {
              value: 'inactive',
              label: (
                <>
                  Inactive <span className="text-subtle tabular-nums">{counts.inactive}</span>
                </>
              ),
            },
          ]}
        />
        <div className="flex items-center gap-2 md:ml-auto">
          {view === 'grid' && (
            <Select
              aria-label="Sort"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc']
                setSort({ key, dir })
              }}
              className="w-44"
            >
              <option value="updated_at:desc">Recently updated</option>
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
            </Select>
          )}
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: <List aria-label="Table view" /> },
              { value: 'grid', label: <LayoutGrid aria-label="Grid view" /> },
            ]}
          />
        </div>
      </div>

      {error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : !isLoading && counts.all === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot />}
            title="No agents yet"
            description={
              abilities.createAgent
                ? 'Create your first agent to start configuring its prompt, model and voice.'
                : abilities.role === 'DEVELOPER'
                  ? 'No agents have been assigned to you yet. Ask an admin to assign one, or create your own.'
                  : 'There are no agents in this organization yet.'
            }
            action={
              abilities.createAgent && (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus /> Create agent
                </Button>
              )
            }
          />
        </Card>
      ) : !isLoading && agents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX />}
            title="No matching agents"
            description="Try a different search term or status filter."
            action={hasFilters && <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>}
          />
        </Card>
      ) : view === 'table' ? (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <SortableTh label="Agent" sortKey="name" sort={sort} onSort={setSort} />
                <SortableTh label="Status" sortKey="status" sort={sort} onSort={setSort} />
                <Th className="hidden lg:table-cell">Owner</Th>
                <SortableTh label="Created" sortKey="created_at" sort={sort} onSort={setSort} className="hidden md:table-cell" />
                <SortableTh label="Last updated" sortKey="updated_at" sort={sort} onSort={setSort} />
                <Th className="w-10" />
              </tr>
            </THead>
            {isLoading ? (
              <TableSkeleton cols={6} />
            ) : (
              <tbody>
                {agents.map((a) => (
                  <Tr key={a.id} onClick={() => navigate(`/agents/${a.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <AgentAvatar id={a.id} name={a.agent_details.name} />
                        <div className="min-w-0">
                          <Link
                            to={`/agents/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block truncate font-medium text-fg hover:underline"
                          >
                            {a.agent_details.name}
                          </Link>
                          <div className="max-w-md truncate text-xs text-muted">
                            {a.agent_details.description || <span className="font-mono text-subtle">{a.id}</span>}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={a.status} />
                    </Td>
                    <Td className="hidden text-muted lg:table-cell">
                      {ownerName(a) ?? <span className="font-mono text-xs text-subtle">{a.user_id.slice(-8)}</span>}
                    </Td>
                    <Td className="hidden text-muted md:table-cell">{formatDate(a.created_at)}</Td>
                    <Td className="text-muted" title={formatDate(a.updated_at, true)}>
                      {timeAgo(a.updated_at)}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>{rowMenu(a)}</Td>
                  </Tr>
                ))}
              </tbody>
            )}
          </Table>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex gap-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                  <Skeleton className="mt-6 h-3 w-1/3" />
                </Card>
              ))
            : agents.map((a) => (
                <Card
                  key={a.id}
                  className="group relative flex flex-col p-4 transition-all hover:border-line-strong hover:shadow-pop"
                >
                  <Link to={`/agents/${a.id}`} className="absolute inset-0 rounded-xl" aria-label={a.agent_details.name} />
                  <div className="flex items-start gap-3">
                    <AgentAvatar id={a.id} name={a.agent_details.name} className="size-10 text-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{a.agent_details.name}</div>
                      <div className="mt-0.5 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted">
                        {a.agent_details.description || 'No description'}
                      </div>
                    </div>
                    <div className="relative z-10">{rowMenu(a)}</div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                    <StatusBadge status={a.status} />
                    <span title={formatDate(a.updated_at, true)}>Updated {timeAgo(a.updated_at)}</span>
                  </div>
                </Card>
              ))}
        </div>
      )}

      {!isLoading && agents.length > 0 && (
        <p className="mt-3 text-xs text-subtle">
          {agents.length} of {counts.all} agent{counts.all === 1 ? '' : 's'}
        </p>
      )}

      <CreateAgentModal open={createOpen} onOpenChange={setCreateOpen} />
    </Page>
  )
}
