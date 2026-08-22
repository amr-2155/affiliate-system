import { RefreshCcw, Eye, ShieldCheck, BadgeCheck, XCircle, MessageCircle, PackageOpen } from "lucide-react"
import HelpPageHeader from "@/components/help/HelpPageHeader"
import { REFUSAL_FEE } from "@/lib/helpCenter"
import { getSupportSettings } from "@/lib/supportSettings"

export const metadata = {
  title: "الاستبدال والاسترجاع | مركز المساعدة",
  description: "سياسة الاستبدال والاسترجاع في منصة التسويق بالعمولة: معاينة المنتج قبل الدفع، رفض الاستلام، ورسوم الرفض.",
}

const PROCESS = [
  { icon: PackageOpen, title: "استلم طلبك", desc: "يصل الطلب إليك مع مندوب التوصيل للبدء في المعاينة." },
  { icon: Eye, title: "عاين المنتج", desc: "افحص المنتج جيدًا وتأكد من مطابقته للطلب قبل الدفع." },
  { icon: RefreshCcw, title: "استبدل أو رُد", desc: "إذا وجدت مشكلة، يمكنك رفض الاستلام أو التواصل مع الدعم لاستبدال المنتج." },
]

const NO_FEE_CASES = [
  "وجود عيب أو تلف في المنتج عند الاستلام",
  "اختلاف المنتج عن ما تم طلبه",
  "نقص في مكونات الطلب أو المنتج",
]

export default async function ReturnsPage() {
  const support = await getSupportSettings()
  return (
    <div>
      <HelpPageHeader
        icon={RefreshCcw}
        title="الاستبدال والاسترجاع"
        subtitle="نحرص على راحتك: معاينة كاملة قبل الدفع، ومرونة في الاستبدال والاسترجاع عند وجود أي مشكلة."
        tint="#7c3aed"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Process */}
        <section>
          <h2 className="text-xl font-extrabold text-slate-900 mb-5">خطوات الاستبدال والاسترجاع</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PROCESS.map((step, idx) => (
              <div key={step.title} className="card-premium p-6 text-center animate-fade-in" style={{ animationDelay: `${idx * 70}ms` }}>
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                  <step.icon size={22} className="text-violet-600" />
                </div>
                <span className="text-[10px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">الخطوة {idx + 1}</span>
                <h3 className="text-[14px] font-extrabold text-slate-800 mt-2 mb-1">{step.title}</h3>
                <p className="text-[12px] leading-6 text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Inspection before payment */}
        <section className="card-premium p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">حقك في المعاينة قبل الدفع</h2>
              <p className="text-[13px] leading-7 text-slate-500">
                بما أن الدفع يتم عند الاستلام، يحق لك معاينة المنتج والتأكد من سلامته ومطابقته للطلب قبل دفع أي مبلغ.
                هذه المعاينة تضمن عدم تحملك أي مسؤولية عن عيوب أو أخطاء ليست من اختيارك.
              </p>
            </div>
          </div>
        </section>

        {/* No-fee refusal */}
        <section className="card-premium p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <BadgeCheck size={20} className="text-violet-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">متى يكون رفض الاستلام مجانيًا؟</h2>
              <p className="text-[13px] text-slate-500 mb-4">
                يمكنك رفض الاستلام أو استبدال المنتج دون أي رسوم إذا كان سبب الرفض مرتبطًا بالمنتج نفسه، مثل:
              </p>
              <ul className="space-y-2.5">
                {NO_FEE_CASES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-500">
                    <BadgeCheck size={16} className="text-emerald-500 shrink-0 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Refusal fee */}
        <section className="card-premium p-6 sm:p-8 !border-red-200/70">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <XCircle size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">متى تُفرض رسوم رفض الاستلام؟</h2>
              <p className="text-[13px] leading-7 text-slate-500">
                في حالة رفض استلام الطلب بعد المعاينة دون وجود مشكلة بالمنتج أو الطلب، يتم تحصيل{" "}
                <span className="font-extrabold text-red-600">{REFUSAL_FEE}</span> رسوم شحن.
              </p>
              <p className="text-[12px] text-slate-400 mt-2">
                هذه الرسوم تغطي تكلفة الشحن والتسليم التي تمت على مدار محاولات التوصيل.
              </p>
            </div>
          </div>
        </section>

        {/* How to return */}
        <section className="card-premium p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <RefreshCcw size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-slate-900 mb-2">كيف أستبدل أو أسترجع منتجًا؟</h2>
              <p className="text-[13px] leading-7 text-slate-500">
                راسلنا عبر واتساب وأخبرنا برقم الطلب وسبب الاستبدال أو الاسترجاع، وسيوجهك فريق الدعم لخطوات
                إرجاع المنتج واستلام البديل، مع متابعة كاملة حتى اكتمال العملية.
              </p>
              <a
                href={support.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-5 py-3 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md"
              >
                <MessageCircle size={16} />
                تواصل مع الدعم — <span dir="ltr">{support.whatsapp}</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
