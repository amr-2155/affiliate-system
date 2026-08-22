import { formatCurrency } from "@/lib/utils"

export function DashboardPanel({
  title,
  icon: Icon,
  tint,
  action,
  children,
  className = "",
}: {
  title: string
  icon: any
  tint: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${tint}12` }}>
            <Icon size={14} style={{ color: tint }} />
          </div>
          <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-2 sm:p-3">{children}</div>
    </div>
  )
}

export function DashboardEmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
        <Icon size={22} className="text-slate-300" />
      </div>
      <p className="text-[13px] font-semibold text-slate-600">{title}</p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function DashboardChartTip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const isMoney = item.dataKey === "revenue" || item.dataKey === "commission"
  const value = isMoney ? formatCurrency(item.value) : item.value.toLocaleString("ar-EG")
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg px-3 py-2 text-[12px]" dir="rtl">
      <p className="font-bold text-slate-800 mb-0.5">{labelFormatter ? labelFormatter(label) : label}</p>
      <p className="text-slate-500">
        {isMoney ? "القيمة" : "العدد"}: <span className="font-bold text-slate-800 tabular-nums">{value}</span>
      </p>
    </div>
  )
}

export function DashboardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-4 animate-pulse ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-100 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="w-20 h-2.5 bg-slate-100 rounded-lg" />
          <div className="w-32 h-4 bg-slate-100 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
