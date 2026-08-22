import { prisma } from "@/lib/prisma"
import {
  SUPPORT_WHATSAPP,
  SUPPORT_WHATSAPP_URL,
  SUPPORT_WHATSAPP_KEY,
  FACEBOOK_PAGE_URL_KEY,
  FACEBOOK_GROUP_URL_KEY,
  buildWhatsAppUrl,
} from "@/lib/helpCenter"

export interface SupportSettings {
  whatsapp: string
  whatsappUrl: string
  facebookPage: string
  facebookGroup: string
}

export async function getSupportSettings(): Promise<SupportSettings> {
  try {
    const keys = [SUPPORT_WHATSAPP_KEY, FACEBOOK_PAGE_URL_KEY, FACEBOOK_GROUP_URL_KEY]
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
    const map: Record<string, string> = {}
    rows.forEach((r) => { map[r.key] = r.value })

    const whatsapp = map[SUPPORT_WHATSAPP_KEY]?.trim() || SUPPORT_WHATSAPP

    return {
      whatsapp,
      whatsappUrl: buildWhatsAppUrl(whatsapp),
      facebookPage: map[FACEBOOK_PAGE_URL_KEY]?.trim() || "",
      facebookGroup: map[FACEBOOK_GROUP_URL_KEY]?.trim() || "",
    }
  } catch {
    return { whatsapp: SUPPORT_WHATSAPP, whatsappUrl: SUPPORT_WHATSAPP_URL, facebookPage: "", facebookGroup: "" }
  }
}
