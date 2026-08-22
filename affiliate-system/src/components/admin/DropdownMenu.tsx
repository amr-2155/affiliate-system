"use client"
import { useEffect, useRef, useState, type ReactNode } from "react"

export interface DropdownItem {
  key: string
  label: string
  icon?: ReactNode
  tint?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  onClick?: () => void
}

interface DropdownMenuProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: "left" | "right"
  width?: string
  ariaLabel?: string
}

export default function DropdownMenu({ trigger, items, align = "left", width = "w-60", ariaLabel }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const close = () => {
    setOpen(false)
    setIndex(-1)
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close()
        btnRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const enabled = items.filter((i) => !i.disabled && !i.separator)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setIndex((i) => (i + 1) % enabled.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setIndex((i) => (i - 1 + enabled.length) % enabled.length)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const item = enabled[index]
      if (item) {
        item.onClick?.()
        close()
      }
    }
  }

  return (
    <div className="relative" ref={ref} onKeyDown={onKeyDown}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-all"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full mt-1.5 ${width} bg-white rounded-xl border border-slate-100 shadow-xl shadow-slate-200/60 py-1.5 z-30 max-h-[22rem] overflow-y-auto animate-fade-in`}
        >
          {items.map((item, i) => {
            if (item.separator) {
              return <div key={`sep-${i}`} className="my-1.5 h-px bg-slate-100" />
            }
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  item.onClick?.()
                  close()
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-right text-[12px] font-semibold transition-colors ${
                  index === i ? "bg-slate-50" : ""
                } ${item.danger ? "text-red-600" : "text-slate-700"} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
