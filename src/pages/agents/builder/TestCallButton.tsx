import { useState } from 'react'
import { ArrowLeft, Globe, Phone, Smartphone } from 'lucide-react'
import { webCallApi } from '@/api/endpoints'
import type { Environment } from '@/api/types'
import { VoiceCall } from '@/components/voice/VoiceCall'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/overlay'
import { ENV_META, toastError } from '../helpers'

type Mode = 'web' | 'phone' | null

function Choice({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-muted [&>svg]:size-4">{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </button>
  )
}

/** Header "Test call" button: opens a side panel to pick Web or Phone test, for the environment selected in the builder. */
export function TestCallButton({ agentId, env }: { agentId: string; env: Environment }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const close = (o: boolean) => {
    setOpen(o)
    if (!o) setMode(null)
  }
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Phone /> Test call
      </Button>
      <Drawer
        open={open}
        onOpenChange={close}
        width="max-w-sm"
        title="Test call"
        description={`Uses the ${ENV_META[env].label} version of this agent.`}
      >
        {mode === null && (
          <div className="space-y-3">
            <Choice icon={<Globe />} title="Web test" description="Talk to the agent from your browser." onClick={() => setMode('web')} />
            <Choice icon={<Smartphone />} title="Phone test" description="Call the agent on a phone number." onClick={() => setMode('phone')} />
          </div>
        )}
        {mode !== null && (
          <>
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => setMode(null)}>
              <ArrowLeft /> Back
            </Button>
            {mode === 'web' ? (
              <div className="flex justify-center py-6">
                <VoiceCall
                  key={`${agentId}-${env}`}
                  onError={(e) => toastError(e, 'Call failed')}
                  fetchToken={() =>
                    webCallApi.token(agentId, {
                      environment: env,
                      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  }
                />
              </div>
            ) : (
              <div />
            )}
          </>
        )}
      </Drawer>
    </>
  )
}
