import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Input } from './input'

// ---------- Modal ----------
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-zoom-in flex-col',
            'rounded-xl border border-line bg-surface shadow-pop focus:outline-none',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <DialogPrimitive.Title className="text-[15px] font-semibold text-fg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{String(title)}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 scrollbar-thin">{children}</div>}
          {footer && (
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-surface-2/50 px-5 py-3">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ---------- Drawer (right sheet) ----------
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/30" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full animate-slide-in-right flex-col border-l border-line bg-surface shadow-pop focus:outline-none',
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-semibold text-fg">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-[13px] text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{String(title)}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-thin">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ---------- Confirm dialog (imperative) ----------
interface ConfirmOptions {
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  /** Require typing this exact text before confirming (for irreversible actions). */
  typeToConfirm?: string
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>
const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    setTyped('')
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = (result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }

  const blocked = Boolean(opts?.typeToConfirm) && typed !== opts?.typeToConfirm

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogPrimitive.Root open={Boolean(opts)} onOpenChange={(o) => !o && close(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[55] animate-fade-in bg-black/40 backdrop-blur-[2px]" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-[55] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-zoom-in rounded-xl border border-line bg-surface p-5 shadow-pop focus:outline-none">
            <div className="flex gap-3.5">
              {opts?.tone !== 'primary' && (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle className="size-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[15px] font-semibold text-fg">{opts?.title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  {opts?.description ?? 'Are you sure?'}
                </DialogPrimitive.Description>
                {opts?.typeToConfirm && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs text-muted">
                      Type <span className="font-mono font-semibold text-fg">{opts.typeToConfirm}</span> to confirm
                    </p>
                    <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => close(false)}>Cancel</Button>
              <Button variant={opts?.tone === 'primary' ? 'primary' : 'danger'} disabled={blocked} onClick={() => close(true)}>
                {opts?.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}

// ---------- Dropdown menu ----------
export const DropdownMenu = Menu.Root
export const DropdownTrigger = Menu.Trigger

export function DropdownContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'center'
  className?: string
}) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-50 min-w-44 animate-fade-in rounded-lg border border-line bg-surface p-1 shadow-pop focus:outline-none',
          className,
        )}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  )
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none [&_svg]:size-4',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        danger ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-fg data-[highlighted]:bg-surface-2 [&_svg]:text-muted',
      )}
    >
      {children}
    </Menu.Item>
  )
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <Menu.Label className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">{children}</Menu.Label>
  )
}

export function DropdownSeparator() {
  return <Menu.Separator className="my-1 h-px bg-line" />
}
