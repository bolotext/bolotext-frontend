import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/primitives'
import { FieldMapperTab } from './FieldMapperTab'
import { useChannel } from './channel'
import { SOURCE_LABEL } from './helpers'
import { TemplatesTab } from './TemplatesTab'
import { TwilioTemplatesTab } from './TwilioTemplatesTab'

const SOURCES = ['bolotext', 'twilio'] as const

const HEADINGS = {
  customer: { title: 'Customer details', description: 'The columns of your uploaded data and the type each one is stored as.' },
  bolotext: { title: 'Created in Bolotext', description: 'Write a template here, submit it to WhatsApp, and use it once approved.' },
  sms: { title: 'Templates', description: 'Reusable message texts with {{placeholders}}. No approval is needed for SMS, so they work as soon as they are saved.' },
  twilio: { title: 'From Twilio', description: 'Templates already created in your Twilio account. Link one to use it here.' },
} as const

function MenuItem({ to, active, icon, title, hint }: { to: string; active: boolean; icon: ReactNode; title: string; hint: string }) {
  return (
    <Link
      to={to}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors [&_svg]:size-4',
        active ? 'bg-accent-soft' : 'hover:bg-surface-2',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border',
          active ? 'border-transparent bg-accent text-accent-fg' : 'border-line bg-surface text-muted group-hover:text-fg',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[13px] font-medium', active ? 'text-accent' : 'text-fg')}>{title}</span>
        <span className="block text-xs leading-snug text-muted">{hint}</span>
      </span>
    </Link>
  )
}

function SubItem({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link
      to={to}
      replace
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-8 items-center rounded-md pl-4 pr-3 text-[13px] transition-colors',
        'before:absolute before:-left-px before:top-1.5 before:h-5 before:w-0.5 before:rounded-full before:transition-colors',
        active ? 'bg-surface-2 font-medium text-fg before:bg-accent' : 'text-muted before:bg-transparent hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </Link>
  )
}

/**
 * Per-agent settings: a menu column on the left with two options —
 *  - Customer details: the field mapper for uploaded data.
 *  - Templates: created in Bolotext, or created on the Twilio platform.
 */
export function SettingsTab({ agentId, canWrite }: { agentId: string; canWrite: boolean }) {
  const [params] = useSearchParams()
  const ch = useChannel()
  const sms = ch.channel === 'sms'
  const raw = params.get('section')
  // Older links used section=fields / section=twilio.
  const section = raw === 'fields' || raw === 'customer' ? 'customer' : 'templates'
  // SMS templates are plain text kept here; the Twilio-platform source is WhatsApp only.
  const source = !sms && (raw === 'twilio' || params.get('source') === 'twilio') ? 'twilio' : 'bolotext'
  const base = `${ch.base}/${agentId}/settings`
  const heading = sms && section === 'templates' ? HEADINGS.sms : HEADINGS[section === 'customer' ? 'customer' : source]

  return (
    <div className="grid items-start gap-5 md:grid-cols-[17rem_1fr]">
      <Card className="p-2 md:sticky md:top-4">
        <nav aria-label="Settings" className="flex flex-col gap-1">
          <MenuItem
            to={`${base}?section=customer`}
            active={section === 'customer'}
            icon={<UserRound />}
            title="Customer details"
            hint="Field mapper for uploaded data"
          />
          <MenuItem
            to={`${base}?section=templates&source=${source}`}
            active={section === 'templates'}
            icon={<FileText />}
            title="Templates"
            hint="Message templates for sending"
          />
          {section === 'templates' && !sms && (
            <div className="ml-6 mb-1 flex flex-col gap-0.5 border-l border-line">
              {SOURCES.map((id) => (
                <SubItem key={id} to={`${base}?section=templates&source=${id}`} active={source === id}>
                  {SOURCE_LABEL[id]}
                </SubItem>
              ))}
            </div>
          )}
        </nav>
      </Card>
      <section className="min-w-0">
        <header className="mb-4">
          <h2 className="text-[15px] font-semibold text-fg">{heading.title}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{heading.description}</p>
        </header>
        {section === 'customer' ? (
          <FieldMapperTab agentId={agentId} canWrite={canWrite} />
        ) : source === 'twilio' ? (
          <TwilioTemplatesTab agentId={agentId} canWrite={canWrite} />
        ) : (
          <TemplatesTab agentId={agentId} canWrite={canWrite} />
        )}
      </section>
    </div>
  )
}
