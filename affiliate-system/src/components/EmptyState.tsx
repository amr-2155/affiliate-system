export default function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className = "",
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`text-center py-14 px-6 bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p className="text-[15px] font-bold text-slate-700">{title}</p>
      {subtitle && <p className="text-[12px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
