"use client"
import { useEffect, useState } from "react"
import { MessageCircle, Facebook, Users, Clock, PhoneCall } from "lucide-react"
import { FACEBOOK_PAGE_URL_KEY, FACEBOOK_GROUP_URL_KEY, SUPPORT_WHATSAPP, SUPPORT_WHATSAPP_URL, SUPPORT_WHATSAPP_KEY, buildWhatsAppUrl } from "@/lib/helpCenter"

const CONTACT_TINTS = {
  whatsapp: "#059669",
  facebook: "#2563eb",
  group: "#7c3aed",
}

export default function ContactContent() {
  const [facebookPage, setFacebookPage] = useState("")
  const [facebookGroup, setFacebookGroup] = useState("")
  const [whatsapp, setWhatsapp] = useState(SUPPORT_WHATSAPP)
  const [whatsappUrl, setWhatsappUrl] = useState(SUPPORT_WHATSAPP_URL)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d[FACEBOOK_PAGE_URL_KEY]) setFacebookPage(d[FACEBOOK_PAGE_URL_KEY])
        if (d[FACEBOOK_GROUP_URL_KEY]) setFacebookGroup(d[FACEBOOK_GROUP_URL_KEY])
        if (d[SUPPORT_WHATSAPP_KEY]) {
          setWhatsapp(d[SUPPORT_WHATSAPP_KEY])
          setWhatsappUrl(buildWhatsAppUrl(d[SUPPORT_WHATSAPP_KEY]))
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const channels = [
    {
      key: "whatsapp",
      icon: MessageCircle,
      tint: CONTACT_TINTS.whatsapp,
      title: "واتساب الدعم",
      desc: "أسرع طريقة للتواصل مع فريق الدعم.",
      value: whatsapp,
      href: whatsappUrl,
      badge: "مفضل" as string | null,
    },
    ...(facebookPage
      ? [{
          key: "facebook",
          icon: Facebook,
          tint: CONTACT_TINTS.facebook,
          title: "صفحة فيسبوك",
          desc: "تابعنا على صفحتنا الرسمية.",
          value: "انتقل إلى الصفحة",
          href: facebookPage,
          badge: null as string | null,
        }]
      : []),
    ...(facebookGroup
      ? [{
          key: "group",
          icon: Users,
          tint: CONTACT_TINTS.group,
          title: "جروب فيسبوك",
          desc: "انضم لجروبنا للتواصل والمتابعة.",
          value: "انضم إلى الجروب",
          href: facebookGroup,
          badge: null as string | null,
        }]
      : []),
  ]

  return (
    <div className="space-y-10">
      {/* Channels */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!loaded ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card-premium p-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-shimmer mb-4" />
                <div className="h-4 w-32 bg-slate-100 animate-shimmer rounded-md mb-2" />
                <div className="h-3 w-44 bg-slate-100 animate-shimmer rounded-md" />
              </div>
            ))
          ) : (
            channels.map((channel) => (
              <a
                key={channel.key}
                href={channel.href}
                target="_blank"
                rel="noopener noreferrer"
                className="card-premium p-6 flex items-start gap-4 group"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: `${channel.tint}12` }}>
                  <channel.icon size={22} style={{ color: channel.tint }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-[15px] font-extrabold text-slate-800 group-hover:text-blue-700 transition-colors">{channel.title}</h2>
                    {channel.badge && (
                      <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full">{channel.badge}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-400 mb-2">{channel.desc}</p>
                  <p className="text-[13px] font-bold text-blue-600" dir="ltr">{channel.value}</p>
                </div>
              </a>
            ))
          )}
        </div>
      </section>

      {/* Support info */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-premium p-6 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Clock size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-extrabold text-slate-800 mb-1">ساعات العمل</h3>
            <p className="text-[13px] leading-6 text-slate-500">
              يتوفر فريق الدعم خلال ساعات العمل الرسمية، وسيتم الرد على رسائلك في أقرب وقت ممكن.
            </p>
          </div>
        </div>
        <div className="card-premium p-6 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <PhoneCall size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-extrabold text-slate-800 mb-1">رقم الدعم</h3>
            <p className="text-[13px] leading-6 text-slate-500">
              يمكنك التواصل عبر واتساب على الرقم{" "}
              <span className="font-bold text-slate-700" dir="ltr">{whatsapp}</span>.
            </p>
          </div>
        </div>
      </section>

      {/* WhatsApp CTA */}
      <section className="relative overflow-hidden rounded-2xl p-8 sm:p-10 text-center">
        <div className="absolute inset-0 animate-gradient" style={{ background: "linear-gradient(135deg, #0f172a 0%, #065f46 50%, #059669 100%)", backgroundSize: "200% 200%" }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={26} className="text-emerald-300" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">جاهز للإجابة على استفساراتك</h2>
          <p className="text-[13px] text-white/75 max-w-md mx-auto mb-6">
            أرسل لنا رسالتك على واتساب وسيقوم فريق الدعم بمساعدتك في أقرب وقت.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-emerald-700 text-[14px] font-extrabold hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-lg"
          >
            <MessageCircle size={18} />
            افتح محادثة واتساب
            <span dir="ltr" className="font-mono">{whatsapp}</span>
          </a>
        </div>
      </section>
    </div>
  )
}
