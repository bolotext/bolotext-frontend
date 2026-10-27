import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hasVoicePreview, toggleVoicePreview, useIsVoicePlaying } from './voicePreview'

/** Play/stop button for one voice. Renders nothing when the provider has no preview samples. */
export function VoicePreviewButton({
  providerId,
  voiceId,
  size = 'icon',
}: {
  providerId: string
  voiceId: string
  size?: 'icon' | 'icon-sm'
}) {
  const playing = useIsVoicePlaying(providerId, voiceId)
  if (!hasVoicePreview(providerId, voiceId)) return null
  return (
    <Button
      variant={size === 'icon' ? 'outline' : 'ghost'}
      size={size}
      onClick={(e) => {
        e.stopPropagation()
        toggleVoicePreview(providerId, voiceId)
      }}
      onPointerUp={(e) => e.stopPropagation()}
      disabled={!voiceId}
      aria-label={playing ? `Stop preview of ${voiceId}` : `Play preview of ${voiceId}`}
      title={playing ? 'Stop preview' : 'Play preview'}
    >
      {playing ? <Pause /> : <Play />}
    </Button>
  )
}
