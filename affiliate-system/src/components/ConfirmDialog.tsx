"use client"
import { AlertTriangle } from "lucide-react"

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "تأكيد",
  confirmClass = "",
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  confirmClass?: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            إلغاء
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors ${confirmClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
