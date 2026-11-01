import '@livekit/components-styles'
import { useState } from 'react'
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useVoiceAssistant,
} from '@livekit/components-react'
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import type { WebCallToken } from '@/api/types'
import { Button } from '@/components/ui/button'

type Phase = 'idle' | 'connecting' | 'live'

const STATE_LABEL: Record<string, string> = {
  disconnected: 'Connecting…',
  connecting: 'Connecting…',
  initializing: 'Starting agent…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
}

function InCall({ onHangUp }: { onHangUp: () => void }) {
  const { state, audioTrack } = useVoiceAssistant()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-16 w-full max-w-xs">
        <BarVisualizer state={state} track={audioTrack} barCount={7} style={{ height: '100%' }} />
      </div>
      <div className="text-[13px] text-muted" aria-live="polite">
        {STATE_LABEL[state] ?? state}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}>
          {isMicrophoneEnabled ? <Mic /> : <MicOff />} {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        </Button>
        <Button variant="danger" onClick={onHangUp}>
          <PhoneOff /> End call
        </Button>
      </div>
    </div>
  )
}

/**
 * Browser voice call to a LiveKit agent. `fetchToken` is called on Start and
 * returns the connection details; which agent answers is decided entirely by
 * the participant metadata inside that token (see backend web_call service).
 */
export function VoiceCall({
  fetchToken,
  onError,
  startLabel = 'Start call',
}: {
  fetchToken: () => Promise<WebCallToken>
  onError?: (e: unknown) => void
  startLabel?: string
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [conn, setConn] = useState<WebCallToken | null>(null)

  const end = () => {
    setPhase('idle')
    setConn(null)
  }
  const start = async () => {
    setPhase('connecting')
    try {
      setConn(await fetchToken())
    } catch (e) {
      setPhase('idle')
      onError?.(e)
    }
  }

  if (!conn) {
    return (
      <Button variant="primary" loading={phase === 'connecting'} onClick={start}>
        <Phone /> {startLabel}
      </Button>
    )
  }
  return (
    <LiveKitRoom
      serverUrl={conn.server_url}
      token={conn.participant_token}
      connect
      audio
      video={false}
      onConnected={() => setPhase('live')}
      onDisconnected={end}
      onError={(e) => {
        onError?.(e)
        end()
      }}
    >
      <RoomAudioRenderer />
      {phase === 'live' ? <InCall onHangUp={end} /> : <div className="text-[13px] text-muted">Connecting…</div>}
    </LiveKitRoom>
  )
}
