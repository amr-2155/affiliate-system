"use client"
import { createContext, useContext, useEffect, useState, ReactNode } from "react"

type ThemeMode = "light" | "dark"

interface ThemeModeContextValue {
  mode: ThemeMode
  toggle: () => void
  setMode: (m: ThemeMode) => void
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "light",
  toggle: () => {},
  setMode: () => {},
})

export const useThemeMode = () => useContext(ThemeModeContext)

const STORAGE_KEY = "theme-mode"

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light") return stored
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  } catch {
    return "light"
  }
}

export default function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light")

  useEffect(() => {
    setMode(getInitialMode())
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (mode === "dark") root.classList.add("dark")
    else root.classList.remove("dark")
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {}
  }, [mode])

  const toggle = () => setMode((m) => (m === "dark" ? "light" : "dark"))

  return (
    <ThemeModeContext.Provider value={{ mode, toggle, setMode }}>{children}</ThemeModeContext.Provider>
  )
}
