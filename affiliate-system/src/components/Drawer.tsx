"use client"
import { useEffect } from "react"
import { X } from "lucide-react"

export default function Drawer({
  open,
  onClose,
  title,
  icon: Icon,
  tint,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  open: boolean
  onClose: () => void
  title: string
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  tint: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div
        className={`absolute top-0 left-0 h-full ${maxWidth} w-full max-w-full bg-white shadow-2xl flex flex-col animate-slide-in`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tint}14` }}>
              <Icon size={15} style={{ color: tint }} />
            </div>
            <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="إغلاق"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0">{footer}</div>}
      </div>
    </div>
  )
}
