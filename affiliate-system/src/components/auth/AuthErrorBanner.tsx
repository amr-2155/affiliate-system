"use client"
import { AlertCircle, X } from "lucide-react"

interface AuthErrorBannerProps {
  message: string
  onDismiss: () => void
}

export default function AuthErrorBanner({ message, onDismiss }: AuthErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-[13px] px-4 py-3 rounded-xl font-medium animate-slide-in"
    >
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="إغلاق الرسالة"
        className="p-0.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100/60 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}
