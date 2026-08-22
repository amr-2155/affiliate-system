import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-5 md:p-7" style={{ background: "var(--brand-bg)" }}>
          {children}
          <Footer />
        </main>
      </div>
    </div>
  )
}
