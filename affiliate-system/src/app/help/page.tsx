import Link from "next/link"
import { LifeBuoy, MessageCircle, ArrowLeft } from "lucide-react"
import HelpTopicGrid from "@/components/help/HelpTopicGrid"
import { getSupportSettings } from "@/lib/supportSettings"

export const metadata = {
  title: "مركز المساعدة",
  description: "كل ما تحتاج معرفته حول الشحن والتوصيل، الاستبدال والاسترجاع، الأسئلة الشائعة، الشروط والأحكام وسياسة الخصوصية في منصة التسويق بالعمولة.",
}

export default async function HelpPage() {
  const support = await getSupportSettings()
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-gradient animate-gradient" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #3b82f6 100%)", backgroundSize: "200% 200%" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 85% 20%, rgba(139,92,246,0.35) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(245,158,11,0.2) 0%, transparent 45%)" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white/90 text-[12px] font-bold mb-6 animate-fade-in">
            <LifeBuoy size={13} />
            مركز المساعدة
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4 animate-fade-in" style={{ animationDelay: "80ms" }}>
            كيف يمكننا مساعدتك اليوم؟
          </h1>
          <p className="text-[15px] leading-7 text-white/75 max-w-xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "160ms" }}>
            تصفح المواضيع الشائعة حول الشحن، الاستبدال، الأسئلة الشائعة والمزيد — أو تواصل مع فريق الدعم مباشرة.
          </p>
          <div className="animate-fade-in" style={{ animationDelay: "240ms" }}>
            <HelpTopicGrid />
          </div>
        </div>
      </div>

      {/* Quick contact CTA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-2 pb-16">
        <div className="card-premium p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
            <MessageCircle size={26} className="text-emerald-600" />
          </div>
          <div className="flex-1 text-center sm:text-right">
            <h3 className="text-lg font-extrabold text-slate-900">لم تجد ما تبحث عنه؟</h3>
            <p className="text-[13px] text-slate-500 mt-1">
              فريق الدعم جاهز للرد على استفساراتك عبر واتساب خلال ساعات العمل الرسمية.
            </p>
          </div>
          <Link
            href={support.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md shrink-0"
          >
            <MessageCircle size={16} />
            تواصل معنا الآن
            <span dir="ltr" className="font-mono">{support.whatsapp}</span>
          </Link>
        </div>

        <Link href="/login" className="group flex items-center justify-center gap-1.5 mt-8 text-[13px] font-bold text-blue-600 hover:text-blue-800 transition-colors">
          العودة إلى لوحة المسوق
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
