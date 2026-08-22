import AdminSidebar from "@/components/AdminSidebar"
import AdminHeader from "@/components/AdminHeader"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-5 md:p-7" style={{ background: "var(--brand-bg)" }}>
          {children}
        </main>
      </div>
    </div>
  )
}
