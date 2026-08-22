export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-slate-200 relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 animate-shimmer rounded-xl" />
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card-premium p-5 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <Skeleton className="h-5 w-1/4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50 last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
      <TableSkeleton />
    </div>
  )
}
