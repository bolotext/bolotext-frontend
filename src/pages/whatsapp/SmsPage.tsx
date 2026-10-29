import { CHANNELS, ChannelContext } from './channel'
import WhatsAppPage from './WhatsAppPage'

export default function SmsPage() {
  return (
    <ChannelContext.Provider value={CHANNELS.sms}>
      <WhatsAppPage />
    </ChannelContext.Provider>
  )
}
