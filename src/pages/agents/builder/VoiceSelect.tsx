import { useState } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoicePreviewButton } from './VoicePreviewButton'
import { stopVoicePreview, useStopPreviewOnUnmount } from './voicePreview'

/** Voice dropdown where every option has its own play button. */
export function VoiceSelect({
  id,
  providerId,
  voices,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id?: string
  providerId: string
  voices: { id: string; label: string }[]
  value: string
  onChange: (voiceId: string) => void
  disabled?: boolean
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  useStopPreviewOnUnmount()

  return (
    <Menu.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) stopVoicePreview()
      }}
    >
      <Menu.Trigger
        id={id}
        disabled={disabled}
        className={cn(
          'relative h-8.5 w-full truncate rounded-lg border border-line bg-surface pr-8 pl-3 text-left text-[13px] text-fg transition-colors',
          'hover:border-line-strong focus:border-accent focus:ring-3 focus:ring-ring focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted',
        )}
      >
        {voices.find((v) => v.id === value)?.label ?? (value || <span className="text-subtle">{placeholder}</span>)}
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-subtle" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={6}
          className="scrollbar-thin z-50 max-h-72 w-(--radix-dropdown-menu-trigger-width) min-w-52 animate-fade-in overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop focus:outline-none"
        >
          {voices.map((v) => (
            <Menu.Item
              key={v.id}
              onSelect={() => onChange(v.id)}
              className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md pr-1 pl-2 text-[13px] text-fg outline-none select-none data-[highlighted]:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate">{v.label}</span>
              {v.id === value && <Check className="size-3.5 shrink-0 text-accent" />}
              <VoicePreviewButton providerId={providerId} voiceId={v.id} size="icon-sm" />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
