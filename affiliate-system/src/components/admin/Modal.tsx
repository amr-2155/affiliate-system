"use client"
import { useEffect, type ReactNode } from "react"
import { X, ChevronDown } from "lucide-react"
import { useState } from "react"

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
} as const

interface ModalProps {
  title: string
  subtitle?: ReactNode
  icon?: ReactNode
  gradient?: string
  size?: keyof typeof SIZES
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ title, subtitle, icon, gradient = "linear-gradient(135deg, #312e81, #6366f1)", size = "md", onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content ${SIZES[size]} animate-fade-in flex flex-col max-h-[92vh]`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        {/* Header */}
        <div className="relative shrink-0 h-[74px] overflow-hidden rounded-t-3xl" style={{ background: gradient }}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-6 w-32 h-32 rounded-full bg-white/5" />
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/15 text-white hover:bg-white/25 active:bg-white/30 transition-colors z-10"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-0 inset-x-0 px-6 pb-4 flex items-center gap-3 text-white">
            {icon && <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 backdrop-blur-sm">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-[15px] font-extrabold leading-tight">{title}</h2>
              {subtitle && <p className="text-[11px] text-white/75 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">{footer}</div>
        )}
      </div>
    </div>
  )
}

interface ModalSectionProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function ModalSection({ title, subtitle, icon, badge, defaultOpen = true, children }: ModalSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border border-slate-100 rounded-2xl overflow-hidden bg-white transition-shadow hover:shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-50/70 hover:bg-slate-50 transition-colors text-right">
        {icon && <span className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-indigo-600 shrink-0">{icon}</span>}
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-slate-800">{title}</span>
          {subtitle && <span className="block text-[11px] text-slate-400 mt-0.5">{subtitle}</span>}
        </span>
        {badge}
        <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="p-4 sm:p-5 animate-fade-in">{children}</div>}
    </section>
  )
}
