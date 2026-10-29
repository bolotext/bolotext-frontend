import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Upload } from 'lucide-react'
import { whatsappApi } from '@/api/endpoints'
import { qk } from '@/api/queries'
import type { WhatsAppBatchOut } from '@/api/types'
import { formatDate, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/ui/overlay'
import { Card, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { toastError } from '../agents/helpers'
import { useChannel } from './channel'
import { UploadModal } from './UploadModal'

export function UploadsTab({ agentId, canWrite }: { agentId: string; canWrite: boolean }) {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const ch = useChannel()
  const [uploadOpen, setUploadOpen] = useState(false)
  const list = useQuery({ queryKey: qk.wa.batches(agentId), queryFn: () => whatsappApi.listBatches(agentId) })

  const remove = useMutation({
    mutationFn: (b: WhatsAppBatchOut) => whatsappApi.deleteBatch(agentId, b.id),
    onSuccess: () => {
      for (const key of [qk.wa.batches(agentId), qk.wa.contacts(agentId), qk.wa.stats(agentId)]) void qc.invalidateQueries({ queryKey: key })
      toast.success('Upload and its contacts deleted')
    },
    onError: (e) => toastError(e, 'Could not delete upload'),
  })

  const askDelete = async (b: WhatsAppBatchOut) => {
    const ok = await confirm({
      title: `Delete “${b.filename}”?`,
      description: `This removes all ${b.valid_rows} contacts imported from this file, including their delivery status.`,
      confirmLabel: 'Delete upload',
    })
    if (ok) remove.mutate(b)
  }

  const rows = list.data ?? []
  const uploadButton = canWrite && (
    <Button variant="primary" onClick={() => setUploadOpen(true)}>
      <Upload /> Upload CSV
    </Button>
  )

  return (
    <>
      <div className="mb-4 flex justify-end">{uploadButton}</div>
      <Card className="overflow-hidden">
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.isLoading && rows.length === 0 ? (
          <EmptyState icon={<Upload />} title="No uploads yet" description="Upload a CSV with full_name and phone_number (more columns via Settings → Customer details)." action={uploadButton} />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>File</Th>
                <Th>Imported</Th>
                <Th>Skipped</Th>
                <Th>Uploaded</Th>
                <Th className="w-12" />
              </tr>
            </THead>
            <tbody>
              {list.isLoading ? (
                <TableSkeleton rows={3} cols={5} />
              ) : (
                rows.map((b) => (
                  <Tr key={b.id} onClick={() => navigate(`${ch.base}/${agentId}/contacts?batch=${b.id}`)}>
                    <Td className="font-medium">{b.filename}</Td>
                    <Td className="tabular-nums">{b.valid_rows}</Td>
                    <Td className="tabular-nums text-muted">{b.invalid_rows}</Td>
                    <Td className="text-muted" title={formatDate(b.created_at, true)}>
                      {timeAgo(b.created_at)}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      {canWrite && (
                        <Button size="icon-sm" variant="ghost" aria-label="Delete upload" onClick={() => askDelete(b)}>
                          <Trash2 />
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
      {uploadOpen && <UploadModal agentId={agentId} open onOpenChange={setUploadOpen} />}
    </>
  )
}
