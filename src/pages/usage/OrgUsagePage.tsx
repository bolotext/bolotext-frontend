import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usageApi } from '@/api/endpoints'
import { KIND_LABEL, defaultRange, usageLabel } from '@/lib/usage'
import { Page, PageHeader } from '@/components/layout/Page'
import { Badge, Card, CardBody, CardHeader, ErrorState } from '@/components/ui/primitives'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '@/components/ui/table'
import { DailyCostChart, FilterBar, KindCards, Money, type Filters } from './shared'

export default function OrgUsagePage() {
  const { orgId = '' } = useParams()
  const [sp] = useSearchParams()
  const def = defaultRange(30)
  const [f, setF] = useState<Filters>({ from: sp.get('from') ?? def.from, to: sp.get('to') ?? def.to, test: sp.get('test') === '1' })
  const q = useQuery({
    queryKey: ['usage', 'org', orgId, f],
    queryFn: () => usageApi.organization(orgId, { from: f.from, to: f.to, include_test: f.test }),
  })
  const d = q.data

  return (
    <Page wide>
      <PageHeader
        title={d?.org_name ?? 'Organization usage'}
        description="Usage and cost for this organization, by provider model."
        breadcrumbs={[{ label: 'Usage', to: '/usage' }, { label: d?.org_name ?? '…' }]}
      />
      <FilterBar value={f} onChange={setF} />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          {d && <KindCards summary={d.total} currency={d.currency} rate={d.usd_to_inr} />}
          <Card className="mb-6">
            <CardHeader title="Daily cost" />
            <CardBody>{d ? <DailyCostChart data={d.daily} currency={d.currency} rate={d.usd_to_inr} /> : <div className="h-36" />}</CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Provider models" description="Usage grouped by the provider and model the calls ran on." />
            <Table>
              <THead>
                <tr>
                  <Th>Type</Th>
                  <Th>Provider</Th>
                  <Th>Model</Th>
                  <Th>Usage</Th>
                  <Th className="text-right">Cost</Th>
                </tr>
              </THead>
              <tbody>
                {!d ? (
                  <TableSkeleton rows={3} cols={5} />
                ) : (
                  d.models.map((m) => (
                    <Tr key={`${m.kind}-${m.provider_id}-${m.model_id}`}>
                      <Td>
                        <Badge tone="neutral">{KIND_LABEL[m.kind]}</Badge>
                      </Td>
                      <Td>{m.provider_id}</Td>
                      <Td className="font-mono text-xs">{m.model_id}</Td>
                      <Td className="text-muted">{usageLabel(m.kind, m.usage)}</Td>
                      <Td className="text-right">
                        {m.cost === null ? (
                          <Link to="/pricing" className="text-warning hover:underline">
                            Set price
                          </Link>
                        ) : (
                          <span className="font-medium"><Money usd={m.cost} rate={d.usd_to_inr} currency={d.currency} stacked /></span>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </Page>
  )
}
