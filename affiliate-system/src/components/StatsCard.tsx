import { LucideIcon } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

const gradients: Record<string, string> = {
  indigo: "linear-gradient(135deg, #1e40af, #3b82f6)",
  blue: "linear-gradient(135deg, #1d4ed8, #60a5fa)",
  green: "linear-gradient(135deg, #059669, #34d399)",
  yellow: "linear-gradient(135deg, #d97706, #fbbf24)",
  red: "linear-gradient(135deg, #dc2626, #f87171)",
  purple: "linear-gradient(135deg, #7c3aed, #a78bfa)",
  emerald: "linear-gradient(135deg, #047857, #6ee7b7)",
  rose: "linear-gradient(135deg, #e11d48, #fb7185)",
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = "indigo",
  isCurrency = false,
  trend,
}: {
  title: string
  value: number | string
  icon: LucideIcon
  color?: string
  isCurrency?: boolean
  trend?: { value: number; isPositive: boolean }
}) {
  return (
    <div className="card-premium p-5 animate-fadeIn">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] text-slate-500 font-medium mb-1.5">{title}</p>
          <p className="text-[26px] font-extrabold text-slate-900 tracking-tight leading-none">
            {isCurrency ? formatCurrency(value as number) : value}
          </p>
          {trend && (
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ${trend.isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        <div className="p-3 rounded-2xl text-white shadow-lg" style={{ background: gradients[color] || gradients.indigo }}>
          <Icon size={22} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}
