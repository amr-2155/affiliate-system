"use client"
import { Sun, Moon } from "lucide-react"
import { useThemeMode } from "@/components/ThemeModeProvider"

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode()
  const isDark = mode === "dark"

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
      title={isDark ? "الوضع النهاري" : "الوضع الليلي"}
      className={`p-2.5 rounded-xl transition-all active:scale-95 ${isDark ? "text-amber-400 hover:bg-slate-800 hover:text-amber-300" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  )
}
