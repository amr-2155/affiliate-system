import { getStatusColor, getStatusText } from "@/lib/utils"

export default function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-lg whitespace-nowrap ${getStatusColor(status)} ${
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {getStatusText(status)}
    </span>
  )
}
