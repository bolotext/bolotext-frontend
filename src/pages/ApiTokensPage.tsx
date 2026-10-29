import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Copy, KeyRound, Plus } from 'lucide-react'
import { apiTokensApi } from '@/api/endpoints'
import type { ApiTokenCreated, ApiTokenOut } from '@/api/types'
import { formatDate, timeAgo } from '@/lib/utils'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Badge, Card, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from './agents/helpers'

const qk = ['api-tokens'] as const

function CreateTokenModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (t: ApiTokenCreated) => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: () => apiTokensApi.create(name.trim()),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: qk })
      setName('')
      onCreated(t)
    },
    onError: (e) => toastError(e, 'Could not create token'),
  })
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Create API token"
      description="A non-expiring token for a service (such as the voice agent) to read agent configs. It stays valid until you revoke it."
      size="sm"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} loading={create.isPending} onClick={() => create.mutate()}>
            Create token
          </Button>
        </>
      }
    >
      <Field label="Name" hint="Something that tells you where it's used, e.g. voice-agent-production.">
        <Input
          autoFocus
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && !create.isPending && create.mutate()}
        />
      </Field>
    </Modal>
  )
}

/** Shows the full token once; it can't be retrieved again after this closes. */
function TokenRevealModal({ token, onClose }: { token: ApiTokenCreated | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the token and copy it manually')
    }
  }
  return (
    <Modal
      open={Boolean(token)}
      onOpenChange={(o) => !o && onClose()}
      title="Copy your API token"
      description="This is the only time the full token is shown. Store it in a secret manager; if it's lost, revoke it and create a new one."
      size="md"
      footer={
        <Button variant="primary" onClick={onClose}>
          I’ve saved it
        </Button>
      }
    >
      {token && (
        <div className="space-y-3">
          <div className="text-xs text-muted">{token.name}</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs break-all select-all">
              {token.token}
            </code>
            <Button size="icon" onClick={copy} aria-label="Copy token">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <p className="text-xs text-muted">
            Send it as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code> to{' '}
            <code className="font-mono">GET /api/v1/agents/config?agent_id=…&amp;environment=…</code> to read agent configs, and to{' '}
            <code className="font-mono">POST /api/v1/call-logs</code> to upload finished calls. It can do nothing else.
          </p>
        </div>
      )}
    </Modal>
  )
}

export default function ApiTokensPage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [createOpen, setCreateOpen] = useState(false)
  const [revealed, setRevealed] = useState<ApiTokenCreated | null>(null)
  const list = useQuery({ queryKey: qk, queryFn: apiTokensApi.list })

  const revoke = useMutation({
    mutationFn: (t: ApiTokenOut) => apiTokensApi.revoke(t.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk })
      toast.success('Token revoked')
    },
    onError: (e) => toastError(e, 'Could not revoke token'),
  })

  const askRevoke = async (t: ApiTokenOut) => {
    const ok = await confirm({
      title: `Revoke “${t.name}”?`,
      description: 'Anything using this token will stop working immediately. This cannot be undone.',
      confirmLabel: 'Revoke token',
    })
    if (ok) revoke.mutate(t)
  }

  const rows = list.data ?? []

  return (
    <Page>
      <PageHeader
        title="API tokens"
        description="Non-expiring tokens that let a service read agent configs. Only Super Admins can create or revoke them."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus /> Create token
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="No API tokens yet"
            description="Create one for the voice agent to fetch agent configs."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus /> Create token
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Name</Th>
                <Th>Token</Th>
                <Th>Created</Th>
                <Th>Status</Th>
                <Th className="w-24" />
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={3} cols={5} />
              ) : (
                rows.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-medium">{t.name}</Td>
                    <Td>
                      <code className="font-mono text-xs text-muted">{t.token_prefix}…</code>
                    </Td>
                    <Td className="text-muted" title={formatDate(t.created_at, true)}>
                      {timeAgo(t.created_at)}
                    </Td>
                    <Td>
                      {t.revoked ? (
                        <Badge tone="neutral" dot>
                          Revoked {timeAgo(t.revoked_at)}
                        </Badge>
                      ) : (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      {!t.revoked && (
                        <Button size="sm" variant="ghost" onClick={() => askRevoke(t)}>
                          Revoke
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
      <CreateTokenModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(t) => {
          setCreateOpen(false)
          setRevealed(t)
        }}
      />
      <TokenRevealModal token={revealed} onClose={() => setRevealed(null)} />
    </Page>
  )
}
