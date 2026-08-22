import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"

export interface ProviderCredentials {
  baseUrl?: string | null
  apiKey?: string | null
  apiSecret?: string | null
  config: Record<string, string>
}

export interface ShipmentData {
  customerName: string
  customerPhone: string
  customerAddress: string
  customerCity: string
  customerGovernorate?: string | null
  customerEmail?: string | null
  orderNumber: string
  total: number
  items: { name?: string; quantity: number; total: number }[]
  notes?: string | null
}

export interface ShipmentResult {
  ok: boolean
  providerShipmentId?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  labelUrl?: string | null
  status?: string
  error?: string
  responseBody?: string
}

export interface TestConnectionResult {
  ok: boolean
  status?: number
  error?: string
  body?: string
}

/**
 * واجهة مزوّد الشحن — كل مزوّد يُطبّقها. إضافة مزوّد جديد = ملف جديد + تسجيله
 * في REGISTRY دون أي تعديل على نظام الطلبات.
 */
export interface ShippingProviderAdapter {
  code: string
  name: string
  testConnection(creds: ProviderCredentials): Promise<TestConnectionResult>
  createShipment(creds: ProviderCredentials, data: ShipmentData): Promise<ShipmentResult>
  cancelShipment(creds: ProviderCredentials, providerShipmentId: string): Promise<ShipmentResult>
}

/** مزوّد يدوي — يعمل بدون أي خدمة خارجية (تسجيل رقم تتبع يدوياً) */
const manualAdapter: ShippingProviderAdapter = {
  code: "manual",
  name: "شحن يدوي",
  async testConnection() {
    return { ok: true }
  },
  async createShipment(creds, data) {
    const trackingNumber = generateTrackingNumber()
    return {
      ok: true,
      providerShipmentId: `M-${Date.now()}`,
      trackingNumber,
      trackingUrl: null,
      status: "CREATED",
    }
  },
  async cancelShipment() {
    return { ok: true, status: "CANCELLED" }
  },
}

/** مزوّد Bosta — اتصال حقيقي عبر REST API */
const bostaAdapter: ShippingProviderAdapter = {
  code: "bosta",
  name: "Bosta",
  async testConnection(creds) {
    const base = (creds.baseUrl || "https://app.bosta.co").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/api/v2/deliveries`, {
        method: "GET",
        headers: { Authorization: creds.apiKey || "", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      })
      return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 500) }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
  async createShipment(creds, data) {
    const base = (creds.baseUrl || "https://app.bosta.co").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/api/v2/deliveries`, {
        method: "POST",
        headers: { Authorization: creds.apiKey || "", "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PICKUP",
          spec: { reference: data.orderNumber, notes: data.notes || "" },
          pickup: { pickupAddress: data.customerAddress, pickupCity: data.customerCity },
          receiver: {
            firstName: data.customerName,
            phone: data.customerPhone,
            email: data.customerEmail || "",
          },
          cod: { amount: Math.round(data.total) },
        }),
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}`, responseBody: JSON.stringify(body) }
      return {
        ok: true,
        providerShipmentId: body?._id || body?.id || null,
        trackingNumber: body?.trackingNumber || body?.barcode || null,
        trackingUrl: body?.trackingLink || null,
        status: body?.status || "CREATED",
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
  async cancelShipment(creds, providerShipmentId) {
    const base = (creds.baseUrl || "https://app.bosta.co").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/api/v2/deliveries/${providerShipmentId}`, {
        method: "PUT",
        headers: { Authorization: creds.apiKey || "", "Content-Type": "application/json" },
        body: JSON.stringify({ state: "CANCELED" }),
        signal: AbortSignal.timeout(10000),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}`, responseBody: JSON.stringify(body) }
      return { ok: true, status: "CANCELLED" }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
}

/** مزوّد Aramex — اتصال حقيقي عبر REST API */
const aramexAdapter: ShippingProviderAdapter = {
  code: "aramex",
  name: "Aramex",
  async testConnection(creds) {
    const base = (creds.baseUrl || "https://api.aramex.com").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/shippingapi/` , {
        method: "GET",
        headers: { "X-ClientId": creds.apiKey || "", "X-ClientSecret": creds.apiSecret || "", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      })
      return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 500) }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
  async createShipment() {
    return { ok: false, error: "Aramex shipping creation requires account configuration" }
  },
  async cancelShipment() {
    return { ok: false, error: "Aramex cancellation requires account configuration" }
  },
}

/** مزوّد Zajil — اتصال حقيقي عبر REST API */
const zajilAdapter: ShippingProviderAdapter = {
  code: "zajil",
  name: "Zajil Express",
  async testConnection(creds) {
    const base = (creds.baseUrl || "https://api.zajil.com").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/api/v1/ping`, {
        method: "GET",
        headers: { "X-Api-Key": creds.apiKey || "", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      })
      return { ok: res.ok, status: res.status, body: (await res.text()).slice(0, 500) }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
  async createShipment(creds, data) {
    const base = (creds.baseUrl || "https://api.zajil.com").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/api/v1/shipments`, {
        method: "POST",
        headers: { "X-Api-Key": creds.apiKey || "", "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: data.orderNumber,
          recipient: { name: data.customerName, phone: data.customerPhone, address: data.customerAddress, city: data.customerCity },
          cod: Math.round(data.total),
          notes: data.notes || "",
        }),
        signal: AbortSignal.timeout(15000),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}`, responseBody: JSON.stringify(body) }
      return {
        ok: true,
        providerShipmentId: body?.shipmentId || body?.id || null,
        trackingNumber: body?.trackingNumber || null,
        trackingUrl: body?.trackingUrl || null,
        status: body?.status || "CREATED",
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
  async cancelShipment(creds, providerShipmentId) {
    const base = (creds.baseUrl || "https://api.zajil.com").replace(/\/$/, "")
    try {
      const res = await fetch(`${base}/api/v1/shipments/${providerShipmentId}/cancel`, {
        method: "POST",
        headers: { "X-Api-Key": creds.apiKey || "", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) return { ok: false, error: body?.message || `HTTP ${res.status}`, responseBody: JSON.stringify(body) }
      return { ok: true, status: "CANCELLED" }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Network error" }
    }
  },
}

const REGISTRY: Record<string, ShippingProviderAdapter> = {
  manual: manualAdapter,
  bosta: bostaAdapter,
  aramex: aramexAdapter,
  zajil: zajilAdapter,
}

export function getAdapter(code: string): ShippingProviderAdapter | null {
  return REGISTRY[code] || null
}

export function listAdapterCodes(): { code: string; name: string }[] {
  return Object.values(REGISTRY).map((a) => ({ code: a.code, name: a.name }))
}

export function parseProviderConfig(config: string | null | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(config || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function generateTrackingNumber(): string {
  const stamp = Date.now().toString().slice(-6)
  const rand = crypto.randomInt(1000, 9999)
  return `TRK${stamp}${rand}`
}

/** تشغيل شحنة من طلب عبر المزوّد المختار */
export async function createShipmentForOrder(orderId: string, providerId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { nameAr: true, name: true } } } },
      shipments: true,
    },
  })
  const provider = await prisma.shippingProvider.findUnique({ where: { id: providerId } })
  if (!order) return { ok: false, error: "الطلب غير موجود" }
  if (!provider) return { ok: false, error: "مزوّد الشحن غير موجود" }
  if (!provider.enabled) return { ok: false, error: "مزوّد الشحن غير مفعّل" }

  const adapter = getAdapter(provider.code)
  if (!adapter) return { ok: false, error: "مزوّد غير معروف" }

  // منع إنشاء شحنة مكررة لنفس الطلب عبر نفس المزوّد
  const existing = await prisma.shipment.findFirst({
    where: { orderId, providerId, status: { not: "CANCELLED" } },
  })
  if (existing) return { ok: false, error: "يوجد شحنة سابقة لهذا الطلب عبر هذا المزوّد", shipment: existing }

  const creds: ProviderCredentials = {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    apiSecret: provider.apiSecret,
    config: parseProviderConfig(provider.config),
  }

  const result = await adapter.createShipment(creds, {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    customerCity: order.customerCity,
    customerGovernorate: order.customerGovernorate,
    customerEmail: order.customerEmail,
    orderNumber: order.orderNumber,
    total: order.total,
    notes: order.notes,
    items: order.items.map((i) => ({ name: i.product?.nameAr || i.product?.name, quantity: i.quantity, total: i.total })),
  })

  const shipment = await prisma.shipment.create({
    data: {
      orderId: order.id,
      providerId: provider.id,
      providerShipmentId: result.providerShipmentId || null,
      trackingNumber: result.trackingNumber || null,
      trackingUrl: result.trackingUrl || null,
      labelUrl: result.labelUrl || null,
      status: result.ok ? result.status || "CREATED" : "FAILED",
      error: result.error || null,
      lastStatusAt: new Date(),
    },
  })

  if (result.ok) {
    await prisma.order.update({
      where: { id: order.id },
      data: { trackingNumber: result.trackingNumber || order.trackingNumber, status: order.status === "PENDING" ? "PROCESSING" : order.status },
    })
  }

  return { ok: result.ok, shipment, error: result.error }
}

export { formatCurrency }
