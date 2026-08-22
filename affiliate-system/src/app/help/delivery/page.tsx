import { Truck, Clock, Banknote, PackageCheck, PhoneCall, XCircle, CheckCircle2, MessageCircle, Headset } from "lucide-react"
import HelpPageHeader from "@/components/help/HelpPageHeader"
import HelpTOC from "@/components/help/HelpTOC"
import {
  DELIVERY_RANGE,
  DELIVERY_ATTEMPTS,
  DELIVERY_ATTEMPT_DAYS,
  REFUSAL_FEE,
} from "@/lib/helpCenter"
import { getSupportSettings } from "@/lib/supportSettings"

export const metadata = {
  title: "الشحن والتوصيل | مركز المساعدة",
  description: "سياسة الشحن والتوصيل في منصة التسويق بالعمولة: فريق التأكيد، مدة التوصيل، الدفع عند الاستلام، محاولات التسليم، ورسوم رفض الاستلام.",
}

const TOC = [
  { id: "steps", title: "كيف يتم توصيل طلبك؟" },
  { id: "confirmation", title: "فريق التأكيد والتواصل" },
  { id: "facts", title: "معلومات أساسية" },
  { id: "attempts", title: "سياسة محاولات التسليم" },
  { id: "refusal", title: "رسوم رفض الاستلام" },
]

const STEPS = [
  { icon: PackageCheck, title: "تأكيد الطلب", desc: "يتواصل فريق التأكيد مع العميل في أسرع وقت خلال ساعات العمل لتأكيد الطلب." },
  { icon: Truck, title: "الشحن الفوري", desc: "يتم شحن الطلب مباشرة بعد تأكيده دون أي تأخير." },
  { icon: Clock, title: "مدة التوصيل", desc: `يصل الطلب خلال ${DELIVERY_RANGE} (عدا يوم الجمعة).` },
  { icon: Banknote, title: "الاستلام والدفع", desc: "يستطيع العميل معاينة المنتج قبل الدفع بحضور مندوب الشحن." },
]

const KEY_FACTS = [
  { label: "مدة التوصيل", value: DELIVERY_RANGE, note: "عدا يوم الجمعة" },
  { label: "الشحن", value: "فوري", note: "بعد تأكيد الطلب مباشرة" },
  { label: "الدفع", value: "عند الاستلام", note: "معاينة المنتج قبل الدفع" },
  { label: "محاولات التسليم", value: DELIVERY_ATTEMPTS, note: `لمدة تصل إلى ${DELIVERY_ATTEMPT_DAYS}` },
]

export default async function DeliveryPage() {
  const support = await getSupportSettings()
  return (
    <div>
      <HelpPageHeader
        icon={Truck}
        title="الشحن والتوصيل"
        subtitle="كل ما تحتاج معرفته عن فريق التأكيد، مدة التوصيل، محاولات التسليم، وطرق الدفع في متجرنا."
        tint="#2563eb"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Mobile TOC */}
        <div className="lg:hidden mb-8">
          <HelpTOC items={TOC} />
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-8">
          <div className="space-y-10 min-w-0">
            {/* Steps */}
            <section id="steps" className="scroll-mt-24">
              <h2 className="text-xl font-extrabold text-slate-900 mb-5">كيف يتم توصيل طلبك؟</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STEPS.map((step, idx) => (
                  <div key={step.title} className="card-premium p-5 flex items-start gap-4 animate-fade-in" style={{ animationDelay: `${idx * 70}ms` }}>
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                        <step.icon size={20} className="text-blue-600" />
                      </div>
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-brand-gradient text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {idx + 1}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-extrabold text-slate-800 mb-1">{step.title}</h3>
                      <p className="text-[13px] leading-6 text-slate-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Confirmation team */}
            <section id="confirmation" className="scroll-mt-24">
              <div className="card-premium p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Headset size={20} className="text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-extrabold text-slate-900 mb-2">فريق التأكيد والتواصل</h2>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-500">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-1" />
                        يبدأ فريق التأكيد التواصل مع العميل في أسرع وقت خلال ساعات العمل الرسمية لتأكيد الطلب.
                      </li>
                      <li className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-500">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-1" />
                        يتم التواصل عبر الهاتف وواتساب لضمان وصول الطلب بسلاسة.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Key facts */}
            <section id="facts" className="scroll-mt-24">
              <h2 className="text-xl font-extrabold text-slate-900 mb-5">معلومات أساسية</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {KEY_FACTS.map((fact) => (
                  <div key={fact.label} className="card-premium p-5 text-center">
                    <p className="text-[11px] font-bold text-slate-400 mb-2">{fact.label}</p>
                    <p className="text-base font-extrabold text-slate-900">{fact.value}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{fact.note}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Delivery attempts */}
            <section id="attempts" className="scroll-mt-24">
              <div className="card-premium p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <PhoneCall size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 mb-2">سياسة محاولات التسليم</h2>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-500">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-1" />
                        يتم إجراء من {DELIVERY_ATTEMPTS} يوميًا لمدة تصل إلى {DELIVERY_ATTEMPT_DAYS}.
                      </li>
                      <li className="flex items-start gap-2.5 text-[13px] leading-6 text-slate-500">
                        <XCircle size={16} className="text-red-500 shrink-0 mt-1" />
                        إذا تعذر الوصول للعميل خلال هذه الفترة يتم إلغاء الطلب تلقائيًا.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Refusal fee */}
            <section id="refusal" className="scroll-mt-24">
              <div className="card-premium p-6 sm:p-8 !border-red-200/70">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <XCircle size={20} className="text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 mb-2">رسوم رفض الاستلام</h2>
                    <p className="text-[13px] leading-7 text-slate-500">
                      في حالة رفض استلام الطلب بعد المعاينة دون وجود مشكلة بالمنتج أو الطلب، يتم تحصيل{" "}
                      <span className="font-extrabold text-red-600">{REFUSAL_FEE}</span> رسوم شحن.
                    </p>
                    <p className="text-[12px] text-slate-400 mt-2">
                      أما في حال وجود مشكلة حقيقية في المنتج أو عدم مطابقته للطلب، فأنت غير مسؤول عن أي رسوم.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Contact CTA */}
            <section className="card-premium p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-1 text-center sm:text-right">
                <h2 className="text-lg font-extrabold text-slate-900 mb-1">سؤال عن طلبك أو الشحن؟</h2>
                <p className="text-[13px] text-slate-500">راسلنا على واتساب وسنرد عليك خلال ساعات العمل الرسمية.</p>
              </div>
              <a
                href={support.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md shrink-0"
              >
                <MessageCircle size={16} />
                <span dir="ltr">{support.whatsapp}</span>
              </a>
            </section>
          </div>

          {/* Desktop TOC */}
          <aside className="hidden lg:block">
            <HelpTOC items={TOC} />
          </aside>
        </div>
      </div>
    </div>
  )
}
