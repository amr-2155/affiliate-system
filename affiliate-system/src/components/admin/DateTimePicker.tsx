"use client"
import { useEffect, useRef, useState } from "react"
import { CalendarDays, Clock, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, Zap } from "lucide-react"
import { formatDateTime } from "@/lib/utils"

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]

function firstDayOfWeek(): number {
  try {
    const info = (new (Intl as any).Locale("ar-EG")).weekInfo
    if (info && typeof info.firstDay === "number") return info.firstDay % 7
  } catch {
    /* ignore */
  }
  return 6 // السبت — شائع في المنطقة
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function buildMonthCells(year: number, month: number, weekStart: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() - weekStart + 7) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

interface DateTimePickerProps {
  value: Date | null
  onChange: (d: Date) => void
  /** الوقت الحالي الحقيقي (من الخادم) — يستخدم لزر "الآن". */
  now: Date | null
  /** لا يسمح باختيار تاريخ قبل هذا التاريخ. */
  minDate?: Date | null
  placeholder?: string
  error?: boolean
  id?: string
  /** سطر إضافي يظهر داخل المنتقي (مثل: مدة الفرق بالايام). */
  info?: string
}

export default function DateTimePicker({ value, onChange, now, minDate, placeholder = "اختر التاريخ والوقت", error, id, info }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => {
    const base = value || now || new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)

  const weekStart = firstDayOfWeek()
  const base = value || now || new Date()
  const hh = base.getHours()
  const mm = base.getMinutes()

  useEffect(() => {
    if (open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        const width = 316
        const estimate = 480
        const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8)
        const useBelow = rect.bottom + 8 + estimate <= window.innerHeight
        setPos(
          useBelow
            ? { top: rect.bottom + 8, left }
            : { bottom: Math.max(8, window.innerHeight - rect.top + 8), left },
        )
      }
    } else {
      setPos(null)
    }
  }, [open, view.month, view.year])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const setDatePart = (d: Date) => {
    onChange(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm))
  }

  const setTimePart = (h: number, m: number) => {
    onChange(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m))
  }

  const minDay = minDate ? startOfDay(minDate) : null
  const minYear = minDay ? minDay.getFullYear() : new Date().getFullYear()
  const years: number[] = []
  for (let y = Math.min(minYear, view.year) - 4; y <= Math.max(view.year, minYear) + 6; y++) years.push(y)
  const prevDisabled = minDay ? new Date(view.year, view.month - 1, 1) < minDay : false

  const todayStr = startOfDay(new Date()).getTime()

  return (
    <div className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border rounded-xl text-[12px] transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:bg-white ${
          error ? "border-red-300 text-red-600" : "border-slate-200 text-slate-800 hover:border-slate-300"
        } ${open ? "ring-2 ring-amber-500 border-transparent bg-white" : ""}`}
      >
        <span className={`flex items-center gap-2 min-w-0 ${value ? "text-slate-800" : "text-slate-400"}`}>
          <CalendarDays size={14} className={error ? "text-red-400" : "text-amber-500"} />
          <span className="truncate font-semibold">{value ? formatDateTime(value) : placeholder}</span>
        </span>
        <Clock size={14} className="text-slate-300 shrink-0" />
      </button>

      {open && pos && (
        <div
          ref={popRef}
          className="fixed z-[70] w-[316px] max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          style={{ ...(pos.top !== undefined ? { top: pos.top } : {}), ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}), left: pos.left }}
        >
          {/* الترويسة: الشهر والسنة والتنقل */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-gradient-to-l from-amber-500 to-orange-600">
            <button type="button" onClick={() => shiftMonth(-1)} disabled={prevDisabled} title="الشهر السابق"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/20 transition-colors disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-1.5">
              <select
                value={view.month}
                onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
                className="bg-white/15 text-white text-[12px] font-bold rounded-lg px-2 py-1.5 focus:outline-none border border-white/20"
              >
                {MONTHS_AR.map((m, i) => <option key={m} value={i} className="text-slate-800">{m}</option>)}
              </select>
              <select
                value={view.year}
                onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
                className="bg-white/15 text-white text-[12px] font-bold rounded-lg px-2 py-1.5 focus:outline-none border border-white/20"
              >
                {years.map((y) => <option key={y} value={y} className="text-slate-800">{y}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => shiftMonth(1)} title="الشهر التالي"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/20 transition-colors">
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* أيام الأسبوع */}
          <div className="grid grid-cols-7 gap-0.5 px-3 pt-2.5">
            {Array.from({ length: 7 }, (_, i) => {
              const day = (weekStart + i) % 7
              return <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][day]}</div>
            })}
          </div>

          {/* شبكة الأيام */}
          <div className="grid grid-cols-7 gap-0.5 px-3 py-2">
            {buildMonthCells(view.year, view.month, weekStart).map((d, i) => {
              if (!d) return <div key={i} />
              const ts = d.getTime()
              const disabled = minDay ? d < minDay : false
              const selected = value && startOfDay(value).getTime() === ts
              const isToday = ts === todayStr
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDatePart(d)}
                  className={`relative h-9 rounded-lg text-[12px] font-semibold transition-all flex items-center justify-center ${
                    disabled ? "text-slate-200 cursor-not-allowed" : selected ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm" : isToday ? "text-amber-600 bg-amber-50 ring-1 ring-amber-200" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {info && (
            <div className="flex items-center justify-center gap-1.5 px-3 pb-2 -mt-1">
              <CalendarDays size={12} className="text-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-amber-700">{info}</span>
            </div>
          )}

          {/* الوقت */}
          <div className="px-3 pb-2.5 border-t border-slate-100 pt-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={12} className="text-amber-500" />
              <span className="text-[11px] font-bold text-slate-600">الوقت</span>
              <span className="text-[10px] text-slate-400 font-bold mr-auto tabular-nums">{pad(hh)}:{pad(mm)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 flex-1 bg-slate-50 rounded-xl border border-slate-200 px-2 py-1">
                <button type="button" onClick={() => setTimePart((hh + 1) % 24, mm)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 transition-colors">
                  <ChevronUp size={15} />
                </button>
                <div className="flex-1 text-center">
                  <span className="block text-[10px] text-slate-400 font-bold">ساعة</span>
                  <span className="block text-[16px] font-extrabold text-slate-800 tabular-nums">{pad(hh)}</span>
                </div>
                <button type="button" onClick={() => setTimePart((hh + 23) % 24, mm)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 transition-colors">
                  <ChevronDown size={15} />
                </button>
              </div>
              <span className="text-slate-300 font-bold text-[14px]">:</span>
              <div className="flex items-center gap-1 flex-1 bg-slate-50 rounded-xl border border-slate-200 px-2 py-1">
                <button type="button" onClick={() => setTimePart(hh, (mm + 1) % 60)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 transition-colors">
                  <ChevronUp size={15} />
                </button>
                <div className="flex-1 text-center">
                  <span className="block text-[10px] text-slate-400 font-bold">دقيقة</span>
                  <span className="block text-[16px] font-extrabold text-slate-800 tabular-nums">{pad(mm)}</span>
                </div>
                <button type="button" onClick={() => setTimePart(hh, (mm + 59) % 60)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 transition-colors">
                  <ChevronDown size={15} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => { if (now) onChange(new Date(now.getTime())); setView({ year: (now || new Date()).getFullYear(), month: (now || new Date()).getMonth() }) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
              >
                <Zap size={12} /> الآن
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-l from-amber-500 to-orange-600 hover:brightness-105 transition-all"
              >
                <Check size={12} /> تم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
