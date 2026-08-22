"use client"
import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { useToast } from "@/components/Toast"

export default function CopyButton({
  text,
  label,
  success = "تم النسخ",
  className = "",
}: {
  text: string
  label?: string
  success?: string
  className?: string
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast(success, "success")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="نسخ"
      className={`inline-flex items-center justify-center gap-1.5 transition-all ${
        copied ? "text-emerald-600 bg-emerald-50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
      } ${label ? "px-3 py-2 rounded-lg text-[11px] font-bold" : "w-8 h-8 rounded-lg"} ${className}`}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {label ? <span>{copied ? "تم النسخ" : label}</span> : null}
    </button>
  )
}
