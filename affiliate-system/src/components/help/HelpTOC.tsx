import { ListOrdered } from "lucide-react"

export interface TocItem {
  id: string
  title: string
}

export default function HelpTOC({ items }: { items: TocItem[] }) {
  return (
    <nav className="card-premium p-5 lg:sticky lg:top-24">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <ListOrdered size={15} className="text-blue-600" />
        </div>
        <h2 className="text-[13px] font-extrabold text-slate-800">جدول المحتويات</h2>
      </div>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
