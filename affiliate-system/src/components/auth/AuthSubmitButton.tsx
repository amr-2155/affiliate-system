"use client"
import { type ReactNode, type MouseEvent } from "react"
import { Loader2 } from "lucide-react"

interface AuthSubmitButtonProps {
  loading: boolean
  loadingText: string
  children: ReactNode
}

function createRipple(e: MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget
  const rect = btn.getBoundingClientRect()
  const span = document.createElement("span")
  span.className = "btn-ripple"
  const size = Math.max(rect.width, rect.height) * 2
  span.style.width = `${size}px`
  span.style.height = `${size}px`
  span.style.left = `${e.clientX - rect.left - size / 2}px`
  span.style.top = `${e.clientY - rect.top - size / 2}px`
  btn.appendChild(span)
  setTimeout(() => span.remove(), 600)
}

export default function AuthSubmitButton({ loading, loadingText, children }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      onClick={createRipple}
      className="btn-login"
    >
      {loading ? (
        <>
          <Loader2 size={19} className="animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
