import { ShieldCheck } from "lucide-react"
import HelpPageHeader from "@/components/help/HelpPageHeader"
import HelpTOC from "@/components/help/HelpTOC"
import { getSupportSettings } from "@/lib/supportSettings"

export const metadata = {
  title: "سياسة الخصوصية | مركز المساعدة",
  description: "سياسة الخصوصية في منصة التسويق بالعمولة وكيفية التعامل مع بيانات المستخدمين.",
}

const TOC = [
  { id: "intro", title: "مقدمة" },
  { id: "data", title: "البيانات التي نجمعها" },
  { id: "use", title: "كيف نستخدم بياناتك" },
  { id: "share", title: "مشاركة البيانات" },
  { id: "protect", title: "حماية البيانات" },
  { id: "retention", title: "حفظ البيانات" },
  { id: "rights", title: "حقوق المستخدم" },
  { id: "cookies", title: "ملفات تعريف الارتباط" },
  { id: "changes", title: "تعديلات السياسة" },
  { id: "contact", title: "التواصل" },
]

const SECTIONS = [
  { id: "intro", title: "مقدمة", body: "نلتزم في هذه المنصة بحماية خصوصية مستخدمينا والشفافية في كيفية جمع بياناتهم واستخدامها وحمايتها. توضح هذه السياسة الممارسات المتبعة عند استخدامك للمنصة." },
  { id: "data", title: "البيانات التي نجمعها", body: "نجمع البيانات التي تقدمها عند التسجيل مثل الاسم وبيانات التواصل، بالإضافة إلى بيانات الاستخدام مثل الطلبات والطلبات المسجلة من خلال روابط الإحالة الخاصة بك، وبيانات تقنية أساسية لتحسين تجربة الاستخدام." },
  { id: "use", title: "كيف نستخدم بياناتك", body: "تُستخدم بياناتك لتقديم الخدمات الأساسية مثل إنشاء الطلبات وحساب العمولات وصرفها، وتحسين تجربة الاستخدام، والتواصل معك بخصوص طلباتك وحسابك، وإرسال إشعارات مهمة تتعلق بالمنصة." },
  { id: "share", title: "مشاركة البيانات", body: "لا نبيع بياناتك الشخصية لأي طرف ثالث. قد نشارك الحد الأدنى الضروري من البيانات (مثل بيانات التوصيل) مع شركات الشحن والتوصيل لتنفيذ طلباتك فقط." },
  { id: "protect", title: "حماية البيانات", body: "نطبق إجراءات أمنية وتقنية مناسبة لحماية بياناتك من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف، وتقتصر صلاحية الوصول للبيانات على من يحتاجها لتقديم الخدمة." },
  { id: "retention", title: "حفظ البيانات", body: "نحتفظ ببياناتك طوال فترة استخدامك للمنصة وبما تقتضيه المتطلبات التشغيلية أو القانونية، ويمكنك طلب حذف حسابك وبياناتك في أي وقت بالتواصل مع فريق الدعم." },
  { id: "rights", title: "حقوق المستخدم", body: "يحق لك الاطلاع على بياناتك وتصحيحها أو طلب حذفها أو تقييد معالجتها، كما يمكنك إلغاء الاشتراك في أي تواصل تسويقي في أي وقت." },
  { id: "cookies", title: "ملفات تعريف الارتباط (Cookies)", body: "قد نستخدم ملفات تعريف الارتباط لأغراض التشغيل الأساسية مثل الحفاظ على تسجيل دخولك وتحسين أداء المنصة، ويمكنك إدارة ذلك من إعدادات المتصفح." },
  { id: "changes", title: "تعديلات السياسة", body: "قد نُحدّث هذه السياسة من وقت لآخر، وسيتم نشر أي تعديلات في هذه الصفحة مع تحديث تاريخ المراجعة، ويُعتبر استمرار استخدامك للمنصة موافقة على السياسة المحدثة." },
  { id: "contact", title: "التواصل", body: (whatsapp: string) => `لأي استفسار بخصوص هذه السياسة أو بياناتك الشخصية، تواصل معنا عبر واتساب على الرقم ${whatsapp} خلال ساعات العمل الرسمية.` },
]

export default async function PrivacyPage() {
  const support = await getSupportSettings()
  return (
    <div>
      <HelpPageHeader
        icon={ShieldCheck}
        title="سياسة الخصوصية"
        subtitle="نوضح هنا كيفية جمع بياناتك واستخدامها وحمايتها، وحرصنا على خصوصية مستخدمينا."
        tint="#0284c7"
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
                  <span className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 text-[12px] font-extrabold flex items-center justify-center shrink-0">
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
