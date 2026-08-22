import { FileText } from "lucide-react"
import HelpPageHeader from "@/components/help/HelpPageHeader"
import HelpTOC from "@/components/help/HelpTOC"
import { getSupportSettings } from "@/lib/supportSettings"

export const metadata = {
  title: "الشروط والأحكام | مركز المساعدة",
  description: "شروط وأحكام استخدام منصة التسويق بالعمولة.",
}

const TOC = [
  { id: "intro", title: "مقدمة" },
  { id: "account", title: "التسجيل وحساب المستخدم" },
  { id: "affiliate", title: "التسويق بالعمولة" },
  { id: "orders", title: "الطلبات والدفع والشحن" },
  { id: "conduct", title: "سلوك المستخدم" },
  { id: "ip", title: "الملكية الفكرية" },
  { id: "liability", title: "إخلاء المسؤولية" },
  { id: "updates", title: "تعديل الشروط" },
  { id: "contact", title: "التواصل" },
]

const SECTIONS = [
  { id: "intro", title: "مقدمة", body: "باستخدامك لهذه المنصة فأنت توافق على الشروط والأحكام التالية. يرجى قراءتها بعناية قبل التسجيل أو استخدام أي من خدمات المنصة. إذا كنت لا توافق على هذه الشروط، يرجى عدم استخدام المنصة." },
  { id: "account", title: "التسجيل وحساب المستخدم", body: "للاستفادة من خدمات المنصة كمسوّق بالعمولة، يجب إنشاء حساب صحيح وحديث. أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة المرور، وعن جميع الأنشطة التي تتم من خلاله، مع إمكانية إيقاف أي حساب يخالف هذه الشروط." },
  { id: "affiliate", title: "التسويق بالعمولة", body: "يحصل المسوّق على عمولة عن الطلبات المؤكدة والمستوفية للشروط من خلال روابط الإحالة الخاصة به. تُحتسب العمولات وفقًا للإعدادات المعلنة في لوحة المسوّق، ويُصرف رصيد العمولات وفقًا لسياسة السحب المتبعة في المنصة." },
  { id: "orders", title: "الطلبات والدفع والشحن", body: "تُنفذ الطلبات وفقًا لسياسة الشحن والتوصيل الموضحة في مركز المساعدة، وتشمل فريق التأكيد والتواصل، والدفع عند الاستلام مع معاينة المنتج قبل الدفع بحضور مندوب الشحن، ومحاولات التسليم، ورسوم رفض الاستلام عند الرفض دون مشكلة بالمنتج." },
  { id: "conduct", title: "سلوك المستخدم", body: "يلتزم المستخدم باستخدام المنصة لأغراض مشروعة فقط، وعدم استخدام وسائل احتيالية أو مضللة أو ممارسات تتعارض مع سياسات المنصة، بما في ذلك الطلبات الوهمية أو إساءة استخدام نظام الإحالة." },
  { id: "ip", title: "الملكية الفكرية", body: "جميع محتويات المنصة من نصوص ورسومات وشعارات وبرمجيات هي ملك للمنصة أو لمرخصيها، ولا يجوز استخدامها أو نسخها دون إذن مسبق." },
  { id: "liability", title: "إخلاء المسؤولية", body: "تقدم المنصة خدماتها بجودة معقولة ووفق المتاح. لا تتحمل المنصة مسؤولية أي أضرار غير مباشرة ناتجة عن استخدام المنصة، مع الالتزام بتعويض المستخدم عن أي ضرر مباشر يثبت أن سببه خلل من المنصة." },
  { id: "updates", title: "تعديل الشروط", body: "قد تقوم المنصة بتحديث هذه الشروط من وقت لآخر، ويُعتبر استمرارك في استخدام المنصة بعد التحديث موافقة على الشروط المعدلة. يُنصح بمراجعة هذه الصفحة دوريًا." },
  { id: "contact", title: "التواصل", body: (whatsapp: string) => `لأي استفسار حول هذه الشروط، يمكنك التواصل معنا عبر واتساب على الرقم ${whatsapp} خلال ساعات العمل الرسمية.` },
]

export default async function TermsPage() {
  const support = await getSupportSettings()
  return (
    <div>
      <HelpPageHeader
        icon={FileText}
        title="الشروط والأحكام"
        subtitle="الشروط المنظمة لاستخدام منصة التسويق بالعمولة والاستفادة من خدماتها."
        tint="#d97706"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Mobile TOC */}
        <div className="lg:hidden mb-8">
          <HelpTOC items={TOC} />
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-8">
          <div className="space-y-4 min-w-0">
            {SECTIONS.map((section, idx) => (
              <section key={section.id} id={section.id} className="card-premium p-6 scroll-mt-24 animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 text-[12px] font-extrabold flex items-center justify-center shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-[15px] font-extrabold text-slate-900">{section.title}</h2>
                </div>
                <p className="text-[13px] leading-7 text-slate-500 pr-10">{typeof section.body === "function" ? section.body(support.whatsapp) : section.body}</p>
              </section>
            ))}
          </div>

          <aside className="hidden lg:block">
            <HelpTOC items={TOC} />
          </aside>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-8">
          آخر تحديث: يوليو 2026
        </p>
      </div>
    </div>
  )
}
