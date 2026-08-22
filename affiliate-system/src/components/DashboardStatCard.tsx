import Link from "next/link"
import { TrendingUp, TrendingDown, ArrowUpLeft } from "lucide-react"

export default function DashboardStatCard({
  label,
  value,
  icon: Icon,
  tint,
  growth,
  sub,
  href,
}: {
  label: string
  value: string | number
  icon: any
  tint: string
  growth?: number | null
  sub?: string
  href?: string
}) {
  const content = (
    <div className="group relative h-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-200/60 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{label}</p>
          <p className="text-xl sm:text-[22px] font-extrabold mt-1 truncate tabular-nums text-slate-900">{value}</p>
          {growth !== undefined && growth !== null ? (
            <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold ${growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(growth).toFixed(1)}%
              <span className="text-slate-400 font-medium">عن الفترة السابقة</span>
            </span>
          ) : sub ? (
            <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>
          ) : null}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200" style={{ background: `${tint}14` }}>
          <Icon size={19} style={{ color: tint }} />
        </div>
      </div>
      {href && (
        <span className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-slate-300">
          <ArrowUpLeft size={14} />
        </span>
      )}
    </div>
  )

  if (!href) return content
  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  )
}
