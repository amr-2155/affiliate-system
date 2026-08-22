"use client"
import { useEffect, useState, useMemo } from "react"
import { Truck, Loader2, MapPin, Clock, Package, Search, ArrowUpDown, ArrowDown, ArrowUp, DollarSign, Zap } from "lucide-react"

interface ShippingRate {
  id: string
  governorate: string
  rate: number
  freeAbove?: number
  estimatedDays: number
}

type SortKey = "name" | "rate-asc" | "rate-desc" | "days"

function getRateLevel(rate: number, avg: number) {
  if (rate <= avg * 0.7) return { label: "اقتصادي", color: "bg-emerald-50 text-emerald-700 ring-emerald-200/60", dot: "bg-emerald-500" }
  if (rate <= avg * 1.3) return { label: "متوسط", color: "bg-amber-50 text-amber-700 ring-amber-200/60", dot: "bg-amber-500" }
  return { label: "مرتفع", color: "bg-red-50 text-red-700 ring-red-200/60", dot: "bg-red-500" }
}

export default function ShippingPage() {
  const [rates, setRates] = useState<ShippingRate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("name")

  useEffect(() => {
    fetch("/api/shipping")
      .then((res) => res.json())
      .then((data) => {
        setRates(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const avgRate = useMemo(() => {
    if (rates.length === 0) return 0
    return rates.reduce((sum, r) => sum + r.rate, 0) / rates.length
  }, [rates])

  const minRate = useMemo(() => rates.length > 0 ? Math.min(...rates.map(r => r.rate)) : 0, [rates])
  const maxRate = useMemo(() => rates.length > 0 ? Math.max(...rates.map(r => r.rate)) : 0, [rates])
  const avgDays = useMemo(() => {
    if (rates.length === 0) return 0
    return Math.round(rates.reduce((sum, r) => sum + r.estimatedDays, 0) / rates.length)
  }, [rates])

  const filteredRates = useMemo(() => {
    let result = rates
    if (search) {
      const q = search.trim()
      result = result.filter(r => r.governorate.includes(q))
    }
    switch (sort) {
      case "rate-asc": result = [...result].sort((a, b) => a.rate - b.rate); break
      case "rate-desc": result = [...result].sort((a, b) => b.rate - a.rate); break
      case "days": result = [...result].sort((a, b) => a.estimatedDays - b.estimatedDays); break
      default: result = [...result].sort((a, b) => a.governorate.localeCompare(b.governorate, "ar"))
    }
    return result
  }, [rates, search, sort])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <Truck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">أسعار الشحن</h1>
            <p className="text-[12px] text-slate-500">{rates.length} محافظة — متوسط الشحن {Math.round(avgRate)} ج.م</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {!loading && rates.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><MapPin size={15} className="text-blue-600" /></div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">المحافظات</p>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{rates.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><ArrowDown size={15} className="text-emerald-600" /></div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">أقل سعر</p>
            </div>
            <p className="text-2xl font-extrabold text-emerald-600">{minRate} ج.م</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><ArrowUp size={15} className="text-amber-600" /></div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">أعلى سعر</p>
            </div>
            <p className="text-2xl font-extrabold text-amber-600">{maxRate} ج.م</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><Clock size={15} className="text-indigo-600" /></div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">متوسط التوصيل</p>
            </div>
            <p className="text-2xl font-extrabold text-indigo-600">{avgDays} <span className="text-sm font-semibold">يوم</span></p>
          </div>
        </div>
      )}

      {/* Search + Sort */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم المحافظة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <span className="text-slate-400 text-xs">✕</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown size={14} className="text-slate-400 shrink-0" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
            >
              <option value="name">أبجدي</option>
              <option value="rate-asc">السعر: من الأقل</option>
              <option value="rate-desc">السعر: من الأعلى</option>
              <option value="days">مدة التوصيل</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="w-24 h-4 bg-slate-100 rounded-lg" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between"><div className="w-16 h-3 bg-slate-100 rounded" /><div className="w-20 h-5 bg-slate-100 rounded" /></div>
                <div className="flex justify-between"><div className="w-20 h-3 bg-slate-100 rounded" /><div className="w-16 h-3 bg-slate-100 rounded" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredRates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Truck size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">{search ? "لا توجد نتائج" : "لا توجد أسعار شحن"}</p>
          <p className="text-slate-400 text-sm">{search ? `لا توجد محافظة باسم "${search}"` : "لم يتم إعداد أسعار الشحن بعد"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredRates.map(rate => {
            const level = getRateLevel(rate.rate, avgRate)
            return (
              <div key={rate.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all group">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `linear-gradient(135deg, ${rate.rate <= avgRate * 0.7 ? "#05966910" : rate.rate <= avgRate * 1.3 ? "#d9770610" : "#dc262610"}, ${rate.rate <= avgRate * 0.7 ? "#10b98110" : rate.rate <= avgRate * 1.3 ? "#f59e0b10" : "#ef444410"})` }}>
                      <MapPin size={18} className={rate.rate <= avgRate * 0.7 ? "text-emerald-600" : rate.rate <= avgRate * 1.3 ? "text-amber-600" : "text-red-600"} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900">{rate.governorate}</h3>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ring-1 ${level.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${level.dot}`} />
                        {level.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rate - Prominent */}
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-[28px] font-extrabold text-slate-900 tabular-nums leading-none">{rate.rate}</span>
                  <span className="text-[13px] font-semibold text-slate-400">ج.م</span>
                </div>

                {/* Details */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} />
                      مدة التوصيل
                    </span>
                    <span className="text-[12px] font-semibold text-slate-700">{rate.estimatedDays} أيام عمل</span>
                  </div>
                  {rate.freeAbove && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-400 flex items-center gap-1.5">
                        <Zap size={12} />
                        شحن مجاني فوق
                      </span>
                      <span className="text-[12px] font-bold text-emerald-600">{rate.freeAbove.toLocaleString("ar-EG")} ج.م</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
