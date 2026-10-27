import { useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

/** Sample URL for a voice, or null when the provider/voice has no preview sample. */
function previewUrl(providerId: string, voiceId: string): string | null {
  if (!voiceId) return null
  if (providerId === 'openai') return `https://cdn.openai.com/API/docs/audio/${encodeURIComponent(voiceId)}.wav`
  // Samples exist only for English Aura-2 voices (aura-2-{voice}-en -> Aura-2-{voice}.wav); other languages 404.
  const aura = providerId === 'deepgram' && /^aura-2-([a-z]+)-en$/.exec(voiceId)
  if (aura) return `https://static.deepgram.com/examples/Aura-2-${aura[1]}.wav`
  return null
}

export const hasVoicePreview = (providerId: string, voiceId: string) => previewUrl(providerId, voiceId) !== null

// One shared player so only a single sample plays at a time across the page.
let audio: HTMLAudioElement | null = null
let playingKey: string | null = null
const listeners = new Set<() => void>()

const setPlaying = (key: string | null) => {
  playingKey = key
  listeners.forEach((l) => l())
}

export function stopVoicePreview() {
  audio?.pause()
  audio = null
  setPlaying(null)
}

export function toggleVoicePreview(providerId: string, voiceId: string) {
  const key = `${providerId}:${voiceId}`
  const wasPlaying = playingKey === key
  stopVoicePreview()
  const url = previewUrl(providerId, voiceId)
  if (wasPlaying || !url) return
  const next = new Audio(url)
  next.onended = () => audio === next && stopVoicePreview()
  next.onerror = () => {
    if (audio !== next) return
    stopVoicePreview()
    toast.error(`Couldn't load a preview for voice "${voiceId}"`)
  }
  audio = next
  setPlaying(key)
  next.play().catch(() => {})
}

export function useIsVoicePlaying(providerId: string, voiceId: string) {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => playingKey === `${providerId}:${voiceId}`,
  )
}

/** Stops any playing sample when the calling component goes away. */
export function useStopPreviewOnUnmount() {
  useEffect(() => stopVoicePreview, [])
}
