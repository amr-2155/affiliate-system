"use client"
import { Crown } from "lucide-react"

interface AvatarProps {
  name?: string | null
  isSuperAdmin?: boolean
  size?: "sm" | "md" | "lg" | "xl"
  status?: "ACTIVE" | "INACTIVE" | string | null
  showStatus?: boolean
}

const SIZES = {
  sm: "w-9 h-9 text-[13px]",
  md: "w-10 h-10 text-[15px]",
  lg: "w-12 h-12 text-[17px]",
  xl: "w-16 h-16 text-[22px]",
}

const STATUS_DOT = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
  xl: "w-3.5 h-3.5",
}

export default function Avatar({ name, isSuperAdmin, size = "md", status, showStatus }: AvatarProps) {
  const initial = (name || "؟").trim().charAt(0)
  return (
    <div className="relative shrink-0">
      <div
        className={`${SIZES[size]} rounded-xl flex items-center justify-center font-bold text-white select-none ${
          isSuperAdmin ? "bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-200" : "bg-gradient-to-br from-indigo-600 to-blue-500 shadow-md shadow-indigo-200"
        }`}
      >
        {isSuperAdmin ? <Crown size={size === "xl" ? 22 : size === "lg" ? 18 : 14} /> : initial}
      </div>
      {showStatus && status && (
        <span
          className={`absolute -bottom-0.5 -left-0.5 ${STATUS_DOT[size]} rounded-full ring-2 ring-white ${
            status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      )}
    </div>
  )
}
