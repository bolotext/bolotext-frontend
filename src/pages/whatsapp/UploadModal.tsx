import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Eye, EyeOff, FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppField, WhatsAppUploadResult } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/overlay'
import { toastError } from '../agents/helpers'
import { useChannel } from './channel'
import { useAgentFields } from './helpers'
import { CheckRow } from './shared'

const MAX_BYTES = 5 * 1024 * 1024

const SAMPLE_VALUE = { string: 'sample', number: '1500', long: '1500', boolean: 'yes', checkbox: 'yes', date: '2026-11-05' }

/** Two example rows for the agent's columns; shared by the on-screen template and the downloaded CSV. */
function sampleRows(fields: WhatsAppField[]) {
  const row = (name: string, phone: string) =>
    fields.map((f) => (f.key === 'full_name' ? name : f.key === 'phone_number' ? phone : SAMPLE_VALUE[f.type]))
  return [row('Asha Verma', '9876543210'), row('Ravi Kumar', '+919812345678')]
}

function TemplatePreview({ fields }: { fields: WhatsAppField[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line scrollbar-thin">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-surface-2/60">
          <tr>
            {fields.map((f) => (
              <th key={f.key} className="px-3 py-2 text-left align-top whitespace-nowrap">
                <div className="font-mono font-medium text-fg">
                  {f.key}
                  {f.required && <span className="ml-0.5 text-danger" title="Required">*</span>}
                </div>
                <div className="font-normal text-muted">{f.type}{f.required ? ' · required' : ' · optional'}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sampleRows(fields).map((r, i) => (
            <tr key={i} className="border-t border-line text-muted">
              {r.map((v, j) => (
                <td key={j} className="px-3 py-1.5 font-mono whitespace-nowrap">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function downloadSample(fields: WhatsAppField[], prefix: string) {
  const sample = [fields.map((f) => f.key).join(','), ...sampleRows(fields).map((r) => r.join(','))].join('\n') + '\n'
  const url = URL.createObjectURL(new Blob([sample], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${prefix}-contacts-sample.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

export function UploadModal({
  agentId,
  open,
  onOpenChange,
  onUploaded,
}: {
  agentId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onUploaded?: (batchId: string) => void
}) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const fields = useAgentFields(agentId)
  const ch = useChannel()
  const [file, setFile] = useState<{ name: string; text: string; rows: number } | null>(null)
  const [consent, setConsent] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  const [result, setResult] = useState<WhatsAppUploadResult | null>(null)

  const pick = async (f: File | undefined) => {
    if (!f) return
    if (f.size > MAX_BYTES) return void toast.error('File is larger than 5 MB')
    const text = await f.text()
    setFile({ name: f.name, text, rows: Math.max(text.split(/\r?\n/).filter((l) => l.trim()).length - 1, 0) })
    setResult(null)
  }

  const upload = useMutation({
    mutationFn: () => whatsappApi.uploadCsv(agentId, file!.name, file!.text, consent),
    onSuccess: (r) => {
      setResult(r)
      void qc.invalidateQueries({ queryKey: qk.wa.contacts(agentId) })
      void qc.invalidateQueries({ queryKey: qk.wa.batches(agentId) })
      void qc.invalidateQueries({ queryKey: qk.wa.stats(agentId) })
      toast.success(`Imported ${r.batch.valid_rows} contacts`)
      onUploaded?.(r.batch.id)
    },
    onError: (e) => toastError(e, 'Upload failed'),
  })

  const close = (v: boolean) => {
    if (!v) {
      setFile(null)
      setConsent(false)
      setResult(null)
      setShowTemplate(false)
    }
    onOpenChange(v)
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Upload contacts (CSV)"
      description={`Columns: ${fields.map((f) => f.key).join(', ')}. Phone numbers without a country code are treated as Indian (+91).`}
      size="lg"
      footer={
        result ? (
          <Button variant="primary" onClick={() => close(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={() => close(false)}>Cancel</Button>
            <Button variant="primary" disabled={!file || !consent || file.rows === 0} loading={upload.isPending} onClick={() => upload.mutate()}>
              Import {file ? `${file.rows} rows` : ''}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {!result && (
          <>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => void pick(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2/50 px-4 py-8 text-center transition-colors hover:bg-surface-2"
            >
              <FileSpreadsheet className="size-6 text-muted" />
              {file ? (
                <>
                  <span className="text-[13px] font-medium text-fg">{file.name}</span>
                  <span className="text-xs text-muted">{file.rows} data rows · click to choose a different file</span>
                </>
              ) : (
                <>
                  <span className="text-[13px] font-medium text-fg">Choose a CSV file</span>
                  <span className="text-xs text-muted">Up to 5,000 rows</span>
                </>
              )}
            </button>
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setShowTemplate((v) => !v)}>
                {showTemplate ? <EyeOff /> : <Eye />} {showTemplate ? 'Hide template' : 'View template'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => downloadSample(fields, ch.channel)}>
                <Download /> Download sample CSV
              </Button>
            </div>
            {showTemplate && (
              <div className="space-y-1.5">
                <TemplatePreview fields={fields} />
                <p className="text-xs text-muted">
                  The header row must match these column names exactly. <span className="text-danger">*</span> marks columns that must be filled in every row
                  (set in Settings → Customer details).
                </p>
              </div>
            )}
            <CheckRow
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              label={`These recipients have opted in to receive ${ch.noun} messages from us.`}
            >
              <span className="mt-0.5 block text-xs text-muted">
                Required. {ch.channel === 'sms' ? 'Messaging people without consent breaches TRAI rules and privacy law (DPDP Act).' : 'Messaging people without consent breaches WhatsApp policy and privacy law (DPDP Act, TRAI).'}
              </span>
            </CheckRow>
          </>
        )}
        {result && (
          <div className="space-y-3">
            <div className="rounded-lg border border-line bg-surface-2/60 px-4 py-3 text-[13px]">
              <span className="font-medium text-fg">{result.batch.valid_rows} imported</span>
              <span className="text-muted">
                {' '}
                · {result.batch.invalid_rows} skipped · {result.batch.total_rows} rows in file
              </span>
            </div>
            {result.errors.length > 0 && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-warning">
                  <TriangleAlert className="size-3.5" /> Skipped rows
                </div>
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line p-2 text-xs scrollbar-thin">
                  {result.errors.map((e) => (
                    <li key={e.row} className="flex gap-2">
                      <span className="w-14 shrink-0 font-mono text-subtle">Line {e.row}</span>
                      <span className="text-muted">{e.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
