import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { setWriteEnv } from '@/api/client'
import { qk } from '@/api/queries'
import type { AgentOut, Environment } from '@/api/types'
import { cn, isEqual } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toastError } from '../helpers'

// ---------- unsaved-changes registry (page level, shared by nav + tabs) ----------
interface DirtyRegistry {
  setDirty: (key: string, dirty: boolean) => void
  isDirty: () => boolean
}
const DirtyContext = createContext<DirtyRegistry | null>(null)

export function DirtyProvider({ children }: { children: ReactNode }) {
  const keys = useRef(new Set<string>())
  const [value] = useState<DirtyRegistry>(() => ({
    setDirty: (key, dirty) => {
      if (dirty) keys.current.add(key)
      else keys.current.delete(key)
    },
    isDirty: () => keys.current.size > 0,
  }))

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (keys.current.size) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  return <DirtyContext.Provider value={value}>{children}</DirtyContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDirtyRegistry() {
  const ctx = useContext(DirtyContext)
  if (!ctx) throw new Error('useDirtyRegistry must be used inside <DirtyProvider>')
  return ctx
}

// ---------- builder context ----------
interface BuilderContextValue {
  agent: AgentOut
  env: Environment
  readOnly: boolean
  /** Push a server-returned AgentOut into the cache after a section save. */
  applyAgent: (agent: AgentOut) => void
}

const BuilderContext = createContext<BuilderContextValue | null>(null)

export function BuilderProvider({
  agent,
  env,
  readOnly,
  children,
}: {
  agent: AgentOut
  env: Environment
  readOnly: boolean
  children: ReactNode
}) {
  const qc = useQueryClient()
  const applyAgent = useCallback(
    (next: AgentOut) => {
      qc.setQueryData(qk.agent(next.id, next.environment), next)
      void qc.invalidateQueries({ queryKey: qk.environments(next.id) })
      void qc.invalidateQueries({ queryKey: qk.agents })
    },
    [qc],
  )
  useEffect(() => {
    setWriteEnv(env === 'stage' ? 'stage' : 'development')
    return () => setWriteEnv('development')
  }, [env])
  return <BuilderContext.Provider value={{ agent, env, readOnly, applyAgent }}>{children}</BuilderContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBuilder() {
  const ctx = useContext(BuilderContext)
  if (!ctx) throw new Error('useBuilder must be used inside <BuilderProvider>')
  return ctx
}

/**
 * Local draft of a slice of the agent. Re-syncs from the server value
 * whenever that changes (after a save, or switching environment), and
 * registers its dirty state so tab navigation can warn about unsaved edits.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useDraft<T>(server: T) {
  const { setDirty } = useDirtyRegistry()
  const key = useId()
  const [draft, setDraft] = useState<T>(server)
  const [base, setBase] = useState<T>(server)
  if (!isEqual(base, server)) {
    setBase(server)
    setDraft(server)
  }
  const dirty = !isEqual(draft, server)
  useEffect(() => {
    setDirty(key, dirty)
    return () => setDirty(key, false)
  }, [key, dirty, setDirty])

  const patch = useCallback((p: Partial<T>) => setDraft((d) => ({ ...d, ...p })), [])
  const reset = useCallback(() => setDraft(server), [server])
  return { draft, setDraft, patch, dirty, reset }
}

/**
 * Runs a section save: calls `run`, applies the returned agent to the
 * cache and toasts. Returns whether it succeeded.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSave() {
  const { applyAgent } = useBuilder()
  const [saving, setSaving] = useState(false)
  const save = useCallback(
    async (run: () => Promise<AgentOut | void>, success = 'Changes saved') => {
      setSaving(true)
      try {
        const res = await run()
        if (res) applyAgent(res)
        toast.success(success)
        return true
      } catch (e) {
        toastError(e, 'Could not save changes')
        return false
      } finally {
        setSaving(false)
      }
    },
    [applyAgent],
  )
  return { save, saving }
}

/** Sticky footer shown while a section has unsaved changes. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  disabled,
  hint,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
  disabled?: boolean
  hint?: ReactNode
}) {
  const { readOnly } = useBuilder()
  if (readOnly) return null
  return (
    <div
      className={cn(
        'sticky bottom-4 z-20 mt-6 transition-all duration-200',
        dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
      )}
    >
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/95 px-4 py-2.5 shadow-pop backdrop-blur">
        <span className="size-2 rounded-full bg-warning" />
        <span className="flex-1 text-[13px] text-muted">{hint ?? 'You have unsaved changes'}</span>
        <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
          <RotateCcw /> Discard
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} loading={saving} disabled={disabled}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

/** Two-column settings row: label/description left, control right. */
export function SettingRow({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8', className)}>
      <div>
        <div className="text-[13px] font-medium text-fg">{title}</div>
        {description && <div className="mt-0.5 text-xs leading-relaxed text-muted">{description}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function SectionTitle({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}
