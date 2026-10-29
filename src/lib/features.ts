import type { Feature } from '@/api/types'

export interface FeatureInfo {
  id: Feature
  label: string
  description: string
  /** Where the feature lives in the app. */
  path: string
}

export const FEATURES: FeatureInfo[] = [
  { id: 'voice_agents', label: 'Voice Agents', description: 'Build and run voice agents, with their prompts, providers and deployments.', path: '/agents' },
  { id: 'whatsapp', label: 'WhatsApp Messaging', description: 'Send WhatsApp Business messages and templates to uploaded contacts.', path: '/whatsapp' },
  { id: 'sms', label: 'Send an SMS', description: 'Send text messages to uploaded contacts.', path: '/sms' },
]

export const ALL_FEATURES: Feature[] = FEATURES.map((f) => f.id)
