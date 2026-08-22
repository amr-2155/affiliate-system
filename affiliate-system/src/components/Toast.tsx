"use client"
import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react"

type ToastType = "success" | "error" | "warning" | "info"
interface Toast { id: string; message: string; type: ToastType }

const ToastContext = createContext<{
  toast: (message: string, type?: ToastType) => void
}>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
    error: <XCircle size={18} className="text-red-500 shrink-0" />,
    warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
    info: <Info size={18} className="text-blue-500 shrink-0" />,
  }

  const bgColors = {
    success: "border-emerald-200 bg-emerald-50",
    error: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    info: "border-blue-200 bg-blue-50",
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-slide-in ${bgColors[t.type]}`}>
            {icons[t.type]}
            <p className="text-sm font-medium text-slate-800 flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="p-0.5 rounded hover:bg-white/50 transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
