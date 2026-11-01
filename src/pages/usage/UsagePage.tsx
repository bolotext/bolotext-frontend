import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronRight } from 'lucide-react'
import { usageApi } from '@/api/endpoints'
import { defaultRange, usageLabel } from '@/lib/usage'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader, EmptyState, ErrorState } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { DailyCostChart, FilterBar, KindCards, Money, UnpricedNote, type Filters } from './shared'

export default function UsagePage() {
  const navigate = useNavigate()
  const [f, setF] = useState<Filters>({ ...defaultRange(30), test: false })
  const q = useQuery({
    queryKey: ['usage', 'overview', f],
    queryFn: () => usageApi.overview({ from: f.from, to: f.to, include_test: f.test }),
  })
  const data = q.data
  const open = (orgId: string) => navigate(`/usage/${orgId}?from=${f.from}&to=${f.to}&test=${f.test ? 1 : 0}`)

  return (
    <Page wide>
      <PageHeader title="Usage" description="STT, LLM and TTS usage and cost across every organization. Super Admin only." />
      <FilterBar value={f} onChange={setF} />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {data && <KindCards summary={data.total} currency={data.currency} rate={data.usd_to_inr} />}
          <Card className="mb-6">
            <CardHeader title="Daily cost" />
            <CardBody>{data ? <DailyCostChart data={data.daily} currency={data.currency} rate={data.usd_to_inr} /> : <div className="h-36" />}</CardBody>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Organizations" description="Click an organization for its breakdown by provider model." />
            {data && data.organizations.length === 0 ? (
              <EmptyState icon={<BarChart3 />} title="No usage in this period" description="Usage appears as calls finish and their logs are stored." />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <Th>Organization</Th>
                    <Th>STT</Th>
                    <Th>LLM</Th>
                    <Th>TTS</Th>
                    <Th className="text-right">Cost</Th>
                    <Th className="w-8" />
                  </tr>
                </THead>
                <tbody>
                  {!data ? (
                    <TableSkeleton rows={5} cols={6} />
                  ) : (
                    data.organizations.map((o) => (
                      <Tr key={o.org_id} onClick={() => open(o.org_id)}>
                        <Td className="font-medium">{o.org_name}</Td>
                        {o.kinds.map((k) => (
                          <Td key={k.kind} className="text-muted">
                            <div className="text-fg"><Money usd={k.cost} rate={data.usd_to_inr} currency={data.currency} stacked /></div>
                            <div className="text-xs">{usageLabel(k.kind, k.usage)}</div>
                          </Td>
                        ))}
                        <Td className="text-right">
                          <div className="font-semibold"><Money usd={o.cost} rate={data.usd_to_inr} currency={data.currency} stacked /></div>
                          <UnpricedNote show={o.has_unpriced} />
                        </Td>
                        <Td>
                          <ChevronRight className="size-4 text-subtle" />
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </Page>
  )
}
