import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Skeleton } from './primitives'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto scrollbar-thin', className)}>
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-line bg-surface-2/60">{children}</thead>
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn('h-9 px-4 text-left text-xs font-medium whitespace-nowrap text-muted first:pl-5 last:pr-5', className)}
      {...props}
    >
      {children}
    </th>
  )
}

export function SortableTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: K
  sort: { key: K; dir: 'asc' | 'desc' }
  onSort: (s: { key: K; dir: 'asc' | 'desc' }) => void
  className?: string
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <Th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={cn('inline-flex items-center gap-1 hover:text-fg', active && 'text-fg')}
        onClick={() => onSort({ key: sortKey, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' })}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </Th>
  )
}

export function Tr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-line last:border-0 transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-2/60',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Td({ children, className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('h-13 px-4 align-middle first:pl-5 last:pr-5', className)} {...props}>
      {children}
    </td>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-line last:border-0">
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c} className="h-13 px-4 first:pl-5 last:pr-5">
              <Skeleton className={cn('h-3.5', c === 0 ? 'w-40' : 'w-20')} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/** Offset pager for endpoints that return no total count: "next" is enabled
 * when the current page came back full. */
export function Pager({
  page,
  pageSize,
  count,
  onPage,
  loading,
}: {
  page: number
  pageSize: number
  count: number
  onPage: (p: number) => void
  loading?: boolean
}) {
  if (page === 0 && count < pageSize) return null
  const from = page * pageSize + (count ? 1 : 0)
  const to = page * pageSize + count
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-xs text-muted">
      <span>
        Showing {from}–{to}
      </span>
      <div className="flex gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={page === 0 || loading}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={count < pageSize || loading}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
