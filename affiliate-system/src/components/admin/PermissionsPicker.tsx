"use client"
import { useMemo, useState } from "react"
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Users,
  Wallet,
  UserCog,
  ShieldCheck,
  Bell,
  Settings,
  ContactRound,
  Search,
  Check,
  CheckSquare,
  Square,
  Lock,
  X,
  ChevronDown,
  Info,
} from "lucide-react"
import { PERMISSIONS, PERMISSION_MODULES } from "@/lib/permissions"

const MODULE_ICONS: Record<string, any> = {
  "layout-dashboard": LayoutDashboard,
  package: Package,
  tag: Tag,
  "shopping-cart": ShoppingCart,
  users: Users,
  wallet: Wallet,
  "user-cog": UserCog,
  "shield-check": ShieldCheck,
  bell: Bell,
  settings: Settings,
  contact: ContactRound,
}

interface PermissionsPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  locked?: boolean
}

export default function PermissionsPicker({ value, onChange, disabled, locked }: PermissionsPickerProps) {
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(PERMISSION_MODULES.map((m) => m.id)))

  const allKeys = useMemo(() => PERMISSIONS.map((p) => p.key), [])
  const selected = new Set(value)
  const q = query.trim().toLowerCase()

  const modules = useMemo(
    () => PERMISSION_MODULES.filter((m) => PERMISSIONS.some((p) => p.module === m.id)),
    [],
  )

  const toggle = (key: string) => {
    if (disabled) return
    onChange(selected.has(key) ? value.filter((k) => k !== key) : [...value, key])
  }

  const toggleModule = (moduleId: string) => {
    if (disabled) return
    const keys = PERMISSIONS.filter((p) => p.module === moduleId).map((p) => p.key)
    const allSelected = keys.every((k) => selected.has(k))
    onChange(allSelected ? value.filter((k) => !keys.includes(k)) : Array.from(new Set([...value, ...keys])))
  }

  const selectAll = () => {
    if (disabled) return
    onChange(allKeys)
  }

  const clearAll = () => {
    if (disabled) return
    onChange([])
  }

  const toggleGroup = (moduleId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  const groupState = (moduleId: string): "all" | "partial" | "none" => {
    const keys = PERMISSIONS.filter((p) => p.module === moduleId)
    const count = keys.filter((p) => selected.has(p.key)).length
    if (count === 0) return "none"
    if (count === keys.length) return "all"
    return "partial"
  }

  if (locked) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center border border-dashed border-violet-200 bg-violet-50/40 rounded-2xl">
        <span className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center">
          <Lock size={18} className="text-violet-600" />
        </span>
        <div>
          <p className="text-[13px] font-bold text-slate-800">المدير العام</p>
          <p className="text-[12px] text-slate-500 mt-1 max-w-xs">يملك المدير العام جميع الصلاحيات تلقائياً ولا يمكن تعديلها.</p>
        </div>
      </div>
    )
  }

  const renderPermissionCard = (key: string, label: string, description: string) => {
    const isSel = selected.has(key)
    return (
      <div key={key} className="group relative">
        <button
          type="button"
          onClick={() => toggle(key)}
          disabled={disabled}
          className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition-all ${
            isSel
              ? "border-indigo-200 bg-indigo-50/60 shadow-sm"
              : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${
              isSel ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
            }`}
          >
            {isSel && <Check size={11} className="text-white" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[12px] font-bold ${isSel ? "text-indigo-700" : "text-slate-700"}`}>{label}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5 leading-relaxed">{description}</span>
          </span>
          <Info size={12} className="shrink-0 mt-0.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
        </button>
        {/* Tooltip: معرف الصلاحية الفني */}
        <div className="absolute z-30 top-1/2 -translate-y-1/2 left-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10px] font-mono font-bold shadow-lg shadow-slate-300/50" dir="ltr">
            {key}
          </span>
        </div>
      </div>
    )
  }

  const renderGroup = (moduleId: string) => {
    const perms = q
      ? PERMISSIONS.filter((p) => p.module === moduleId && (p.label.includes(q) || p.key.toLowerCase().includes(q) || p.description.includes(q)))
      : PERMISSIONS.filter((p) => p.module === moduleId)
    if (perms.length === 0) return null

    const m = PERMISSION_MODULES.find((x) => x.id === moduleId)
    if (!m) return null
    const Icon = MODULE_ICONS[m.icon] || ShieldCheck
    const state = groupState(moduleId)
    const count = perms.filter((p) => selected.has(p.key)).length
    const isOpen = expanded.has(moduleId)

    return (
      <div key={moduleId} className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
        {/* Accordion header */}
        <div
          className={`flex items-center gap-3 px-3.5 sm:px-4 py-3 border-b transition-colors ${
            isOpen ? "border-slate-100 bg-slate-50/70" : "border-transparent hover:bg-slate-50"
          }`}
        >
          <button
            type="button"
            onClick={() => toggleGroup(moduleId)}
            className="flex items-center gap-3 flex-1 min-w-0 text-right"
          >
            <span className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${state === "all" ? "bg-indigo-600 border-indigo-600 text-white" : state === "partial" ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-400"}`}>
              <Icon size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-slate-800">{m.label}</span>
                <span className={`text-[10px] font-extrabold rounded-md px-1.5 py-0.5 tabular-nums ${count > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"}`}>
                  {count}/{perms.length}
                </span>
              </span>
              <span className="block text-[11px] text-slate-400 truncate">{m.description}</span>
            </span>
            <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {/* تحديد / إلغاء لكل مجموعة */}
          <button
            type="button"
            onClick={() => toggleModule(moduleId)}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              state === "all" ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {state === "all" ? <Check size={12} /> : state === "partial" ? <Square size={11} /> : <CheckSquare size={12} />}
            {state === "all" ? "تم التحديد" : state === "partial" ? "تحديد الكل" : "تحديد الكل"}
          </button>
        </div>

        {/* Accordion body */}
        {isOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
            {perms.map((p) => renderPermissionCard(p.key, p.label, p.description))}
          </div>
        )}
      </div>
    )
  }

  const shownModules = q ? modules.filter((m) => PERMISSIONS.some((p) => p.module === m.id && (p.label.includes(q) || p.key.toLowerCase().includes(q) || p.description.includes(q)))) : modules

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن صلاحية بالاسم أو الوصف..."
          className="w-full pr-9 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 transition-colors">
            <X size={13} className="text-slate-400" />
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold text-slate-500">
          المحدد: <span className="text-indigo-600 font-extrabold tabular-nums">{value.length}</span> / {allKeys.length}
        </p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={selectAll} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-bold transition-colors">
            <CheckSquare size={13} /> تحديد الكل
          </button>
          <button type="button" onClick={clearAll} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] font-bold transition-colors">
            <Square size={13} /> مسح الكل
          </button>
        </div>
      </div>

      {/* Accordion groups */}
      <div className="space-y-2.5">
        {shownModules.map((m) => renderGroup(m.id))}
        {shownModules.length === 0 && (
          <div className="text-center py-8 text-[12px] text-slate-400">لا توجد صلاحيات مطابقة لبحثك</div>
        )}
      </div>
    </div>
  )
}
