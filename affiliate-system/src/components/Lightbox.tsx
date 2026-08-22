"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { X, ZoomIn, ZoomOut, RotateCw, Maximize, Minimize, RefreshCw, ImageOff, ExternalLink } from "lucide-react"

type ImgStatus = "loading" | "loaded" | "error"

function ToolbarBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-9 h-9 rounded-lg flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

export default function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const [status, setStatus] = useState<ImgStatus>("loading")
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const areaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStatus("loading")
    setScale(1)
    setRotation(0)
    setRetryKey(0)
  }, [src])

  const zoom = useCallback((factor: number) => {
    setScale((s) => Math.min(4, Math.max(0.5, +(s + factor).toFixed(2))))
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {})
        } else {
          onClose()
        }
      }
      if (e.key === "+" || e.key === "=") zoom(0.25)
      if (e.key === "-") zoom(-0.25)
      if (e.key === "0") setScale(1)
    }
    window.addEventListener("keydown", onKey)

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onFsChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsChange)

    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("fullscreenchange", onFsChange)
      document.body.style.overflow = prev
    }
  }, [onClose, zoom])

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) > 4) {
        e.preventDefault()
        zoom(e.deltaY < 0 ? 0.12 : -0.12)
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoom])

  const retry = () => {
    setStatus("loading")
    setRetryKey((k) => k + 1)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label={alt || "عرض الصورة"}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gradient-to-b from-black/80 to-transparent shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status === "loaded" ? "bg-emerald-400" : status === "error" ? "bg-red-400" : "bg-amber-400 animate-pulse"}`} />
          <span className="text-[12px] text-white/85 truncate">{alt || "صورة إثبات التحويل"}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <ToolbarBtn title="تصغير (-)" onClick={() => zoom(-0.25)} disabled={scale <= 0.5}>
            <ZoomOut size={17} />
          </ToolbarBtn>
          <button
            onClick={() => setScale(1)}
            title="إعادة الحجم الأصلي (0)"
            className="w-11 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold text-white/80 hover:bg-white/15 transition-colors tabular-nums"
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolbarBtn title="تكبير (+)" onClick={() => zoom(0.25)} disabled={scale >= 4}>
            <ZoomIn size={17} />
          </ToolbarBtn>
          <ToolbarBtn title="تدوير" onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw size={17} />
          </ToolbarBtn>
          <ToolbarBtn title="شاشة كاملة" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </ToolbarBtn>
          <ToolbarBtn title="فتح في تبويب جديد" onClick={() => window.open(src, "_blank", "noopener")}>
            <ExternalLink size={17} />
          </ToolbarBtn>
          <ToolbarBtn title="إغلاق (Esc)" onClick={onClose}>
            <X size={18} />
          </ToolbarBtn>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={areaRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-6"
      >
        <div
          className="relative inline-block m-auto"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
            transition: "transform 180ms ease",
          }}
        >
          {status === "loading" && (
            <div className="min-w-[300px] min-h-[240px] flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-[3px] border-slate-700 border-t-white animate-spin" />
              <span className="text-[12px] text-slate-400">جاري تحميل الصورة...</span>
            </div>
          )}

          {status === "error" && (
            <div className="min-w-[300px] min-h-[240px] flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 px-8 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center">
                <ImageOff size={26} className="text-slate-500" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-200">تعذر تحميل الصورة</p>
                <p className="text-[11px] text-slate-500 mt-0.5">قد يكون الملف محذوفًا أو غير متاح حاليًا</p>
              </div>
              <button
                onClick={retry}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors"
              >
                <RefreshCw size={13} />
                إعادة المحاولة
              </button>
            </div>
          )}

          <img
            key={retryKey}
            src={src}
            alt={alt || "صورة"}
            draggable={false}
            decoding="async"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2))}
            className={
              status === "loaded"
                ? "block max-h-[80vh] max-w-[90vw] w-auto h-auto object-contain rounded-lg shadow-2xl select-none"
                : "hidden"
            }
          />
        </div>
      </div>

      {/* Footer hints */}
      <div className="shrink-0 px-4 py-2.5 bg-gradient-to-t from-black/80 to-transparent flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <span className="text-[11px] text-white/45">عجلة الفأرة للتكبير</span>
        <span className="text-[11px] text-white/45">نقرة مزدوجة للتكبير السريع</span>
        <span className="text-[11px] text-white/45">+/− للتكبير و 0 للإعادة</span>
        <span className="text-[11px] text-white/45">Esc للإغلاق</span>
      </div>
    </div>
  )
}
