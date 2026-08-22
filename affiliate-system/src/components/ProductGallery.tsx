"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X, ZoomIn, Package } from "lucide-react"

export default function ProductGallery({ images, alt = "" }: { images: string[]; alt?: string }) {
  const [selected, setSelected] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [origin, setOrigin] = useState({ x: 50, y: 50 })
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])

  const list = useMemo(() => images.filter(Boolean), [images])
  const total = list.length
  const current = list[selected]
  const [fine, setFine] = useState(false)
  useEffect(() => {
    setFine(window.matchMedia?.("(pointer: fine)").matches ?? false)
  }, [])

  const prev = useCallback(() => setSelected((i) => (i - 1 + total) % total), [total])
  const next = useCallback(() => setSelected((i) => (i + 1) % total), [total])

  useEffect(() => {
    thumbRefs.current[selected]?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" })
  }, [selected])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false)
      if (e.key === "ArrowLeft") next()
      if (e.key === "ArrowRight") prev()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [lightbox, next, prev])

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const markBroken = (i: number) => setBroken((s) => new Set(s).add(i))

  const Placeholder = () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Package size={64} className="text-slate-300" />
    </div>
  )

  const main = (
    <div
      className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 select-none"
      onMouseMove={fine ? onMove : undefined}
      onMouseEnter={fine ? () => setZoom(true) : undefined}
      onMouseLeave={fine ? () => setZoom(false) : undefined}
      onClick={() => setLightbox(true)}
    >
      {current && !broken.has(selected) ? (
        <img
          src={current}
          alt={alt}
          draggable={false}
          className={`w-full h-full object-cover cursor-zoom-in transition-transform duration-200 ease-out ${zoom ? "scale-150" : "scale-100"}`}
          style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
          onError={() => markBroken(selected)}
        />
      ) : (
        <Placeholder />
      )}

      <span className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-slate-900/60 backdrop-blur text-white text-[11px] font-bold tabular-nums">
        {selected + 1} / {total}
      </span>
      <span className="absolute top-3 left-3 w-8 h-8 rounded-lg bg-white/85 backdrop-blur flex items-center justify-center shadow-sm">
        <ZoomIn size={15} className="text-slate-500" />
      </span>

      {total > 1 && !zoom && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur rounded-full shadow-md hover:bg-white transition-colors"
            aria-label="الصورة السابقة"
          >
            <ChevronRight size={18} className="text-slate-700" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/90 backdrop-blur rounded-full shadow-md hover:bg-white transition-colors"
            aria-label="الصورة التالية"
          >
            <ChevronLeft size={18} className="text-slate-700" />
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {main}

      {total > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 snap-x" dir="rtl">
          {list.map((img, i) => (
            <button
              key={i}
              ref={(el) => { thumbRefs.current[i] = el }}
              onClick={() => setSelected(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all snap-start
                ${selected === i ? "border-blue-500 shadow-md ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}
            >
              {!broken.has(i) ? (
                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => markBroken(i)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100">
                  <Package size={18} className="text-slate-300" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {lightbox && total > 0 && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-[12px] font-bold tabular-nums">
              {selected + 1} / {total}
            </span>
            <button onClick={() => setLightbox(false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="إغلاق">
              <X size={20} />
            </button>
          </div>

          {total > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="الصورة السابقة"
              >
                <ChevronRight size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="الصورة التالية"
              >
                <ChevronLeft size={24} />
              </button>
            </>
          )}

          <div className="max-w-4xl w-full flex-1 flex items-center justify-center min-h-0" onClick={(e) => e.stopPropagation()}>
            {current && !broken.has(selected) ? (
              <img src={current} alt={alt} className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl" onClick={() => setLightbox(false)} />
            ) : (
              <Placeholder />
            )}
          </div>

          {total > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto max-w-full pb-1" dir="rtl">
              {list.map((img, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setSelected(i) }}
                  className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${selected === i ? "border-blue-400" : "border-white/20 hover:border-white/50"}`}
                >
                  {!broken.has(i) ? (
                    <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => markBroken(i)} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800"><Package size={16} className="text-slate-500" /></div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
