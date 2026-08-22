"use client"
import { useCallback, useEffect, useState } from "react"

const KEY = "pinned-products"

function loadPinned(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

export function usePinned(initial?: Set<string>) {
  const [pinned, setPinned] = useState<Set<string>>(initial ? new Set(initial) : typeof window !== "undefined" ? loadPinned() : new Set())

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...pinned]))
    } catch {
      /* ignore */
    }
  }, [pinned])

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { pinned, togglePin }
}
