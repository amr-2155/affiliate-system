import Link from "next/link"
import { ChevronLeft, Home } from "lucide-react"

interface HelpPageHeaderProps {
  icon: any
  title: string
  subtitle: string
  tint?: string
}

export default function HelpPageHeader({ icon: Icon, title, subtitle, tint = "#1e40af" }: HelpPageHeaderProps) {
  return (
    <div className="border-b border-slate-200/60 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <nav className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-6">
          <Link href="/help" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
            <Home size={13} />
            مركز المساعدة
          </Link>
          <ChevronLeft size={14} className="text-slate-300" />
          <span className="text-slate-600 font-semibold">{title}</span>
        </nav>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${tint}12` }}>
            <Icon size={24} style={{ color: tint }} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-sm text-slate-500 mt-1.5 leading-6">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
