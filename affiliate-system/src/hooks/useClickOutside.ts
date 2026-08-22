"use client"
import { useEffect, useRef, useState } from "react"

export function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [onClose])

  return ref
}

export function useDropdown<T extends HTMLElement>() {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<T>(() => setOpen(false))
  return { open, setOpen, ref }
}
