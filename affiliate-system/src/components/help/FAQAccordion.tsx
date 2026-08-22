"use client"
import { useState } from "react"
import { Search, Plus, Minus, MessageCircle } from "lucide-react"
import { SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_URL } from "@/lib/helpCenter"

export interface FaqItem {
  q: string
  a: string
}

export default function FAQAccordion({ items, whatsapp = SUPPORT_WHATSAPP, whatsappUrl = SUPPORT_WHATSAPP_URL }: { items: FaqItem[]; whatsapp?: string; whatsappUrl?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [query, setQuery] = useState("")

  const filtered = items.filter((item) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return item.q.toLowerCase().includes(term) || item.a.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-5">
      <div className="relative max-w-md">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في الأسئلة الشائعة..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card-premium p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-blue-500" />
          </div>
          <p className="text-sm font-bold text-slate-700">لا توجد نتائج مطابقة</p>
          <p className="text-[12px] text-slate-400 mt-1">جرّب كلمات بحث مختلفة</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-600 hover:text-white transition-colors"
          >
            <MessageCircle size={15} />
            اسألنا على واتساب <span dir="ltr">{whatsapp}</span>
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <div key={item.q} className={`card-premium overflow-hidden ${isOpen ? "!border-blue-200" : ""}`}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-right transition-colors hover:bg-slate-50/60"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isOpen ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}>
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </div>
                  <span className={`text-[14px] font-bold flex-1 ${isOpen ? "text-blue-700" : "text-slate-800"}`}>{item.q}</span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pr-[60px] animate-fade-in">
                    <p className="text-[13px] leading-7 text-slate-500 whitespace-pre-line">{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
