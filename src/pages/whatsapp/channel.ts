import { createContext, useContext } from 'react'

export type Channel = 'whatsapp' | 'sms'

export interface ChannelInfo {
  channel: Channel
  /** Route prefix of this channel's pages. */
  base: string
  /** Sidebar / page title. */
  title: string
  /** Used in sentences: "New WhatsApp agent", "New SMS agent". */
  noun: string
}

export const CHANNELS: Record<Channel, ChannelInfo> = {
  whatsapp: { channel: 'whatsapp', base: '/whatsapp', title: 'WhatsApp Messaging', noun: 'WhatsApp' },
  sms: { channel: 'sms', base: '/sms', title: 'Send an SMS', noun: 'SMS' },
}

/** The messaging pages serve both channels; the route decides which (WhatsApp by default). */
export const ChannelContext = createContext<ChannelInfo>(CHANNELS.whatsapp)
export const useChannel = () => useContext(ChannelContext)
