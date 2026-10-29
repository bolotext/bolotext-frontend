import { CHANNELS, ChannelContext } from './channel'
import WhatsAppAgentPage from './WhatsAppAgentPage'

export default function SmsAgentPage() {
  return (
    <ChannelContext.Provider value={CHANNELS.sms}>
      <WhatsAppAgentPage />
    </ChannelContext.Provider>
  )
}
