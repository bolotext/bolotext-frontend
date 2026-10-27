import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BookMarked, Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { agentsApi } from '@/api/endpoints'
import { qk, useUserDirectory } from '@/api/queries'
import type { SystemPromptVersionOut } from '@/api/types'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { Modal, useConfirm } from '@/components/ui/overlay'
import { toastError } from '../helpers'

// agents_service/prompt/version_model.py MAX_SYSTEM_PROMPT_VERSIONS
export const MAX_PROMPT_VERSIONS = 5

// eslint-disable-next-line react-refresh/only-export-components
export function usePromptVersions(agentId: string) {
  return useQuery({ queryKey: qk.promptVersions(agentId), queryFn: () => agentsApi.promptVersions(agentId) })
}

export function SaveVersionModal({
  agentId,
  open,
  onOpenChange,
  initialText,
}: {
  agentId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  initialText: string
}) {
  const qc = useQueryClient()
  const { data: versions } = usePromptVersions(agentId)
  const [key, setKey] = useState('')
  const [desc, setDesc] = useState('')
  const [text, setText] = useState(initialText)
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setText(initialText)
      setKey(`prompt_v${(versions?.length ?? 0) + 1}`)
      setDesc('')
    }
  }

  const create = useMutation({
    mutationFn: () =>
      agentsApi.createPromptVersion(agentId, {
        prompt_key: key.trim(),
        prompt_description: desc.trim() || null,
        system_prompt: text,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.promptVersions(agentId) })
      toast.success('Saved to prompt library')
      onOpenChange(false)
    },
    onError: (e) => toastError(e, 'Could not save version'),
  })

  const dup = versions?.some((v) => v.prompt_key === key.trim())
  const full = (versions?.length ?? 0) >= MAX_PROMPT_VERSIONS

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Save to prompt library"
      description="Library entries are reusable snapshots. Saving one doesn't change the live prompt."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!key.trim() || !text.trim() || dup || full}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Save version
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {full && (
          <div className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
            The library is full ({MAX_PROMPT_VERSIONS} versions). Delete a version first.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key" hint="Unique within this agent." error={dup ? 'This key is already used' : undefined}>
            <Input value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-xs" />
          </Field>
          <Field label="Description" hint="Optional — tone, use case, etc.">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Softer tone for renewals" />
          </Field>
        </div>
        <Field label="System prompt">
          <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
        </Field>
      </div>
    </Modal>
  )
}

function VersionRow({
  agentId,
  version,
  canEdit,
  onUse,
  useLabel,
}: {
  agentId: string
  version: SystemPromptVersionOut
  canEdit: boolean
  onUse?: (text: string) => void
  useLabel: string
}) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const { map: users } = useUserDirectory()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(version.system_prompt)

  const replace = useMutation({
    mutationFn: () => agentsApi.replacePromptVersion(agentId, version.prompt_key, text),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.promptVersions(agentId) })
      toast.success('Version updated')
      setEditing(false)
    },
    onError: (e) => toastError(e),
  })
  const remove = useMutation({
    mutationFn: () => agentsApi.deletePromptVersion(agentId, version.prompt_key),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.promptVersions(agentId) })
      toast.success('Version deleted')
    },
    onError: (e) => toastError(e),
  })

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="size-4 text-subtle" /> : <ChevronRight className="size-4 text-subtle" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold">{version.prompt_key}</span>
              {version.updated_at !== version.created_at && <Badge>edited</Badge>}
            </div>
            <div className="truncate text-xs text-muted">
              {version.prompt_description || 'No description'} · {users.get(version.created_by)?.name ?? 'Unknown'} ·{' '}
              <span title={formatDate(version.updated_at, true)}>{timeAgo(version.updated_at)}</span>
            </div>
          </div>
        </button>
        {onUse && (
          <Button size="sm" onClick={() => onUse(version.system_prompt)}>
            <Check /> {useLabel}
          </Button>
        )}
        {canEdit && (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Edit version"
              onClick={() => {
                setOpen(true)
                setEditing(true)
                setText(version.system_prompt)
              }}
            >
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete version"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete "${version.prompt_key}"?`,
                    description: 'This removes the entry from the library. The live prompt is not affected.',
                    confirmLabel: 'Delete',
                  })
                )
                  remove.mutate()
              }}
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>
      {open && (
        <div className="border-t border-line p-3.5">
          {editing ? (
            <div className="space-y-2">
              <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={replace.isPending}
                  disabled={!text.trim()}
                  onClick={() => replace.mutate()}
                >
                  Save text
                </Button>
              </div>
            </div>
          ) : (
            <pre className="max-h-72 overflow-auto rounded-md bg-surface-2 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap scrollbar-thin">
              {version.system_prompt}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function PromptLibrary({
  agentId,
  onUse,
  useLabel = 'Use',
  currentText,
  compact,
}: {
  agentId: string
  onUse?: (text: string) => void
  useLabel?: string
  currentText?: string
  compact?: boolean
}) {
  const { abilities } = useAuth()
  const { data, isLoading, error, refetch } = usePromptVersions(agentId)
  const [saveOpen, setSaveOpen] = useState(false)
  const count = data?.length ?? 0

  return (
    <div>
      <div className={cn('mb-3 flex items-center justify-between gap-3', compact && 'mb-4')}>
        <div className="text-xs text-muted">
          {count} of {MAX_PROMPT_VERSIONS} versions saved
        </div>
        {abilities.editAgents && currentText !== undefined && (
          <Button size="sm" disabled={count >= MAX_PROMPT_VERSIONS} onClick={() => setSaveOpen(true)}>
            <Plus /> Save current prompt
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : count === 0 ? (
        <EmptyState
          icon={<BookMarked />}
          title="No saved versions"
          description="Save snapshots of your system prompt to compare approaches or roll back quickly."
          className="rounded-lg border border-dashed border-line py-10"
        />
      ) : (
        <div className="space-y-2">
          {data!.map((v) => (
            <VersionRow
              key={v.prompt_key}
              agentId={agentId}
              version={v}
              canEdit={abilities.editAgents}
              onUse={onUse}
              useLabel={useLabel}
            />
          ))}
        </div>
      )}
      {currentText !== undefined && (
        <SaveVersionModal agentId={agentId} open={saveOpen} onOpenChange={setSaveOpen} initialText={currentText} />
      )}
    </div>
  )
}
