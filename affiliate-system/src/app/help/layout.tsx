import HelpHeader from "@/components/HelpHeader"
import Footer from "@/components/Footer"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "مركز المساعدة",
  description: "مركز مساعدة منصة التسويق بالعمولة: الشحن والتوصيل، الاستبدال والاسترجاع، الأسئلة الشائعة، الشروط والأحكام، سياسة الخصوصية، وتواصل معنا.",
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--brand-bg)" }}>
      <HelpHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
