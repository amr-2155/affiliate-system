import { LifeBuoy } from "lucide-react"
import HelpPageHeader from "@/components/help/HelpPageHeader"
import ContactContent from "@/components/help/ContactContent"

export const metadata = {
  title: "تواصل معنا | مركز المساعدة",
  description: "قنوات التواصل مع فريق دعم منصة التسويق بالعمولة: واتساب الدعم وصفحة وجروب فيسبوك.",
}

export default function ContactPage() {
  return (
    <div>
      <HelpPageHeader
        icon={LifeBuoy}
        title="تواصل معنا"
        subtitle="اختر القناة الأنسب لك وسيتواصل معك فريق الدعم في أقرب وقت."
        tint="#059669"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <ContactContent />
      </div>
    </div>
  )
}
