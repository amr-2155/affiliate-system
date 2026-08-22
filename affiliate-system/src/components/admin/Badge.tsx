"use client"
import type { ReactNode } from "react"

export type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral" | "violet" | "indigo" | "sky"

const VARIANTS: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  sky: "bg-blue-50 text-blue-700 ring-blue-600/20",
}

const DOTS: Record<BadgeVariant, string> = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
  violet: "bg-violet-500",
  indigo: "bg-indigo-500",
  sky: "bg-blue-500",
}

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  icon?: ReactNode
  dot?: boolean
  className?: string
}

export default function Badge({ children, variant = "neutral", icon, dot, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${VARIANTS[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOTS[variant]}`} />}
      {icon}
      {children}
    </span>
  )
}
