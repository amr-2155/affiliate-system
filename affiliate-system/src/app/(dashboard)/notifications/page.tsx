"use client"
import { Bell } from "lucide-react"
import NotificationCenter from "@/components/NotificationCenter"
import { useAppStore } from "@/lib/store"

export default function NotificationsPage() {
  const setUnreadCount = useAppStore((s) => s.setUnreadCount)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4f46e5, #818cf8)" }}>
          <Bell size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">الإشعارات</h1>
          <p className="text-[12px] text-slate-500">كل الأحداث الخاصة بك في مكان واحد — اضغط على أي إشعار للانتقال مباشرة</p>
        </div>
      </div>

      <NotificationCenter syncUnread={setUnreadCount} />
    </div>
  )
}
