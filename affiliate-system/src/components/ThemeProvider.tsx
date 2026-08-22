"use client"
import { createContext, useContext, useEffect, ReactNode } from "react"

interface ThemeSettings {
  [key: string]: string
}

const ThemeContext = createContext<ThemeSettings>({})
export const useTheme = () => useContext(ThemeContext)

const defaults: Record<string, string> = {
  "brand-primary": "#1e40af",
  "brand-primary-light": "#3b82f6",
  "brand-primary-dark": "#1e3a8a",
  "brand-accent": "#f59e0b",
  "brand-accent-light": "#fbbf24",
  "brand-bg": "#f0f4f8",
  "brand-text": "#0f172a",
  "brand-text-secondary": "#64748b",
  "brand-surface": "#ffffff",
  "brand-success": "#059669",
  "brand-danger": "#dc2626",
  "site-name": "AFFILIATE",
  "site-name-ar": "نظام التسويق",
  "logo-url": "",
}

function hexToHsl(hex: string): string {
  hex = hex.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

function lighten(hex: string, amount: number): string {
  hex = hex.replace("#", "")
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.min(255, r + Math.round((255 - r) * amount))
  g = Math.min(255, g + Math.round((255 - g) * amount))
  b = Math.min(255, b + Math.round((255 - b) * amount))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

function darken(hex: string, amount: number): string {
  hex = hex.replace("#", "")
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)
  r = Math.max(0, Math.round(r * (1 - amount)))
  g = Math.max(0, Math.round(g * (1 - amount)))
  b = Math.max(0, Math.round(b * (1 - amount)))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

export function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement
  const get = (key: string) => settings[key] || defaults[key] || ""

  const primary = get("brand-primary")
  const accent = get("brand-accent")

  root.style.setProperty("--brand-primary", primary)
  root.style.setProperty("--brand-primary-light", get("brand-primary-light") || lighten(primary, 0.3))
  root.style.setProperty("--brand-primary-dark", get("brand-primary-dark") || darken(primary, 0.2))
  root.style.setProperty("--brand-accent", accent)
  root.style.setProperty("--brand-accent-light", get("brand-accent-light") || lighten(accent, 0.2))
  root.style.setProperty("--brand-bg", get("brand-bg"))
  root.style.setProperty("--brand-text", get("brand-text"))
  root.style.setProperty("--brand-text-secondary", get("brand-text-secondary"))
  root.style.setProperty("--brand-surface", get("brand-surface"))
  root.style.setProperty("--brand-success", get("brand-success"))
  root.style.setProperty("--brand-danger", get("brand-danger"))
  root.style.setProperty("--brand-gradient", `linear-gradient(135deg, ${primary} 0%, ${get("brand-primary-light") || lighten(primary, 0.3)} 50%, ${get("brand-accent") || accent} 100%)`)
  root.style.setProperty("--sidebar-bg", `linear-gradient(180deg, ${darken(primary, 0.6)} 0%, ${darken(primary, 0.4)} 50%, ${darken(primary, 0.6)} 100%)`)
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          applyTheme(data)
        }
      })
      .catch(() => {})
  }, [])

  return <>{children}</>
}
