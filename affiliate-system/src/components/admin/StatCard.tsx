"use client"
import type { LucideIcon } from "lucide-react"
import { TrendingUp } from "lucide-react"
import type { ReactNode } from "react"

interface StatCardProps {
  label: string
  value: ReactNode
  icon: LucideIcon
  tint: string
  hint?: string
}

export default function StatCard({ label, value, icon: Icon, tint, hint }: StatCardProps) {
  return (
    <div className="relative group bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 tracking-wide">{label}</p>
          <p className="text-2xl sm:text-[26px] font-extrabold mt-1.5 truncate tabular-nums text-slate-900 leading-none">{value}</p>
          {hint && (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mt-2">
              <TrendingUp size={12} className="text-emerald-500" />
              {hint}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${tint}14` }}
        >
          <Icon size={19} style={{ color: tint }} />
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, transparent, ${tint}, transparent)` }} />
    </div>
  )
}
