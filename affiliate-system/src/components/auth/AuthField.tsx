"use client"
import { useState, useId, type ReactNode } from "react"
import { Eye, EyeOff, AlertCircle } from "lucide-react"

interface AuthFieldProps {
  id?: string
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  icon?: ReactNode
  dir?: "ltr" | "rtl"
  error?: string
  autoComplete?: string
  inputMode?: "text" | "email" | "tel" | "numeric"
  isPassword?: boolean
}

export default function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  dir,
  error,
  autoComplete,
  inputMode,
  isPassword,
}: AuthFieldProps) {
  const autoId = useId()
  const fieldId = id || autoId
  const showToggle = isPassword || type === "password"
  const [visible, setVisible] = useState(false)
  const inputType = showToggle ? (visible ? "text" : "password") : type

  return (
    <div>
      <label htmlFor={fieldId} className="block text-[13px] font-semibold text-slate-700 mb-2">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={fieldId}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={!!error}
          className={`auth-input ${icon ? "with-icon" : ""} ${showToggle ? "with-toggle" : ""} ${error ? "input-error" : ""}`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-red-600 font-medium mt-1.5">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
