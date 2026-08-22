"use client"
import {
  Target,
  Lightbulb,
  Sparkles,
  Magnet,
  Link2,
  Clapperboard,
  Megaphone,
  Shield,
  Gift,
  TestTube2,
  Radio,
  CalendarDays,
  Scale,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import CopyButton from "@/components/CopyButton"
import type { GeneratedStrategy, StrategyItem } from "@/lib/strategy"

type IconType = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>

const SECTION_META: Record<string, { icon: IconType; tint: string; bg: string }> = {
  compliance: { icon: Scale, tint: "#b45309", bg: "from-amber-50 to-yellow-100/60" },
  "target-audience": { icon: Target, tint: "#2563eb", bg: "from-blue-50 to-blue-100/50" },
  problem: { icon: Lightbulb, tint: "#d97706", bg: "from-amber-50 to-amber-100/50" },
  "selling-points": { icon: Sparkles, tint: "#7c3aed", bg: "from-violet-50 to-violet-100/50" },
  angles: { icon: Magnet, tint: "#db2777", bg: "from-pink-50 to-pink-100/50" },
  hooks: { icon: Link2, tint: "#059669", bg: "from-emerald-50 to-emerald-100/50" },
  "video-ideas": { icon: Clapperboard, tint: "#dc2626", bg: "from-red-50 to-red-100/50" },
  ctas: { icon: Megaphone, tint: "#ea580c", bg: "from-orange-50 to-orange-100/50" },
  objections: { icon: Shield, tint: "#0d9488", bg: "from-teal-50 to-teal-100/50" },
  offers: { icon: Gift, tint: "#eab308", bg: "from-yellow-50 to-yellow-100/50" },
  "test-plan": { icon: TestTube2, tint: "#0891b2", bg: "from-cyan-50 to-cyan-100/50" },
  "best-channel": { icon: Radio, tint: "#4f46e5", bg: "from-indigo-50 to-indigo-100/50" },
  "plan-7days": { icon: CalendarDays, tint: "#16a34a", bg: "from-green-50 to-green-100/50" },
}

function itemText(item: StrategyItem): string {
  return typeof item === "string" ? item : `${item.question}\n↳ ${item.answer}`
}

function ItemCopy({ item }: { item: StrategyItem }) {
  return <CopyButton text={itemText(item)} success="تم نسخ النص" />
}

export default function StrategyPlan({ strategy }: { strategy: GeneratedStrategy }) {
  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {strategy.product.image ? (
          <img src={strategy.product.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900 truncate">{strategy.product.nameAr}</p>
          <p className="text-[11px] text-slate-500">
            سعر {formatCurrency(strategy.product.price)} · عمولة {formatCurrency(strategy.product.commission)} · {strategy.product.categoryNameAr || "منتج"}
          </p>
        </div>
        <CopyButton text={strategyToTextForCopy(strategy)} label="نسخ الخطة" className="bg-blue-50 text-blue-700 hover:bg-blue-100 shrink-0" />
      </div>

      {/* Sections */}
      {strategy.sections.map((sec) => {
        const meta = SECTION_META[sec.key] || { icon: Sparkles, tint: "#64748b", bg: "from-slate-50 to-slate-100/50" }
        return (
          <div key={sec.key} className="rounded-2xl border border-slate-100 overflow-hidden">
            <div className={`bg-gradient-to-l ${meta.bg} px-4 py-3 flex items-center gap-2.5`}>
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0" style={{ color: meta.tint }}>
                <meta.icon size={15} />
              </div>
              <h3 className="text-[13px] font-bold text-slate-800 flex-1">{sec.emoji} {sec.title}</h3>
              <CopyButton
                text={sec.items.map(itemText).join("\n")}
                success="تم نسخ القسم"
                className="bg-white shadow-sm"
                label="نسخ"
              />
            </div>
            <div className="divide-y divide-slate-50">
              {sec.items.map((item, i) =>
                typeof item === "string" ? (
                  <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 group hover:bg-slate-50/60 transition-colors">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-[10px] font-extrabold text-slate-500 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {i + 1}
                    </span>
                    <p className="text-[12.5px] text-slate-700 leading-relaxed flex-1">{item}</p>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <ItemCopy item={item} />
                    </span>
                  </div>
                ) : (
                  <div key={i} className="px-4 py-3 group hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-md bg-red-50 text-[10px] font-extrabold text-red-500 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-[12.5px] font-bold text-slate-800 leading-relaxed">{item.question}</p>
                        <p className="text-[12px] text-slate-600 leading-relaxed mt-1"><span className="font-bold text-emerald-600">الرد: </span>{item.answer}</p>
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <ItemCopy item={item} />
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function strategyToTextForCopy(s: GeneratedStrategy): string {
  const lines: string[] = [`${s.title}`, `المنتج: ${s.product.nameAr} | السعر: ${formatCurrency(s.product.price)} | عمولة الوحدة: ${formatCurrency(s.product.commission)}`, ""]
  for (const sec of s.sections) {
    lines.push(`${sec.emoji} ${sec.title}`)
    for (const item of sec.items) lines.push(`• ${itemText(item)}`)
    lines.push("")
  }
  return lines.join("\n")
}
