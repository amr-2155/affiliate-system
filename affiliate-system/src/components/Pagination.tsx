"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const getPages = () => {
    const pages: (number | "...")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push("...")
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} className="text-slate-600" />
      </button>

      {getPages().map((page, i) =>
        page === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-slate-400 text-sm">...</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[34px] h-[34px] rounded-lg text-[13px] font-semibold transition-all ${
              currentPage === page
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-200"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} className="text-slate-600" />
      </button>
    </div>
  )
}
