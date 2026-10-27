import { PhoneForwarded, Voicemail } from 'lucide-react'
import { agentsApi } from '@/api/endpoints'
import type { CallTransferConfig, VoicemailDetectionConfig } from '@/api/types'
import { Card, CardBody, CardHeader, Segmented, Slider, ToggleRow } from '@/components/ui/primitives'
import { Textarea } from '@/components/ui/input'
import { SaveBar, SectionTitle, SettingRow, useBuilder, useDraft, useSave } from './context'

// `others.voicemail_detection` / `call_transfer` are nullable ("unset disables
// the feature"); the editor works on concrete defaults and only the toggle
// state decides what's enabled.
const VM_DEFAULT: VoicemailDetectionConfig = { enabled: false, max_detection_retries: 2, voicemail_response: null }
const CT_DEFAULT: CallTransferConfig = {
  enabled: false,
  default_transfer_message: null,
  tta_type: 'phone',
  send_transcript_with_transfer: false,
}

export default function CallHandlingTab() {
  const { agent, readOnly } = useBuilder()
  const { draft, patch, dirty, reset } = useDraft({
    voicemail_detection: agent.others.voicemail_detection ?? VM_DEFAULT,
    call_transfer: agent.others.call_transfer ?? CT_DEFAULT,
  })
  const { save, saving } = useSave()
  const vm = draft.voicemail_detection
  const ct = draft.call_transfer
  const setVm = (p: Partial<VoicemailDetectionConfig>) => patch({ voicemail_detection: { ...vm, ...p } })
  const setCt = (p: Partial<CallTransferConfig>) => patch({ call_transfer: { ...ct, ...p } })

  return (
    <div>
      <SectionTitle title="Call handling" description="Voicemail detection and handing calls off to a human." />
      <div className="space-y-6">
        <Card>
          <CardHeader
            icon={<Voicemail />}
            title="Voicemail detection"
            description="On outbound calls, detect an answering machine and leave a message."
          />
          <CardBody>
            <ToggleRow
              title="Detect voicemail"
              checked={vm.enabled}
              onCheckedChange={(enabled) => setVm({ enabled })}
              disabled={readOnly}
            >
              <div className="divide-y divide-line">
                <SettingRow title="Detection attempts" description="Maximum attempts before giving up.">
                  <Slider
                    min={2}
                    max={5}
                    step={1}
                    value={vm.max_detection_retries}
                    onChange={(max_detection_retries) => setVm({ max_detection_retries })}
                    disabled={readOnly}
                  />
                </SettingRow>
                <SettingRow
                  title="Voicemail message"
                  description="Left on the machine when voicemail is detected. Leave empty to hang up."
                >
                  <Textarea
                    rows={3}
                    value={vm.voicemail_response ?? ''}
                    readOnly={readOnly}
                    onChange={(e) => setVm({ voicemail_response: e.target.value || null })}
                    placeholder="Hi, this is an automated assistant from [COMPANY]. Please call us back at…"
                  />
                </SettingRow>
              </div>
            </ToggleRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<PhoneForwarded />}
            title="Call transfer"
            description="Let the agent hand the call to a human specialist."
          />
          <CardBody>
            <ToggleRow
              title="Allow transfers"
              checked={ct.enabled}
              onCheckedChange={(enabled) => setCt({ enabled })}
              disabled={readOnly}
            >
              <div className="divide-y divide-line">
                <SettingRow title="Transfer via" description="How the transfer target is reached.">
                  <Segmented
                    value={ct.tta_type}
                    onChange={(tta_type) => setCt({ tta_type })}
                    disabled={readOnly}
                    options={[
                      { value: 'phone', label: 'Phone number' },
                      { value: 'sip', label: 'SIP endpoint' },
                    ]}
                  />
                </SettingRow>
                <SettingRow title="Transfer message" description="What the agent says before transferring.">
                  <Textarea
                    rows={2}
                    value={ct.default_transfer_message ?? ''}
                    readOnly={readOnly}
                    onChange={(e) => setCt({ default_transfer_message: e.target.value || null })}
                    placeholder="Please hold while I connect you to a specialist."
                  />
                </SettingRow>
                <ToggleRow
                  title="Send transcript with transfer"
                  description="Pass the conversation so far to the human agent."
                  checked={ct.send_transcript_with_transfer}
                  onCheckedChange={(send_transcript_with_transfer) => setCt({ send_transcript_with_transfer })}
                  disabled={readOnly}
                />
              </div>
            </ToggleRow>
          </CardBody>
        </Card>
      </div>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(() => agentsApi.updateOthers(agent.id, draft))} onReset={reset} />
    </div>
  )
}
