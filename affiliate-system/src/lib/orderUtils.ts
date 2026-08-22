import { formatCurrency, formatDate, getStatusText } from "@/lib/utils"
import { ORDER_FLOW, TERMINAL_STATUSES as TERMINAL } from "@/lib/order-state"

export { ORDER_FLOW } from "@/lib/order-state"

export function buildOrderTimeline(status: string) {
  const isTerminal = (TERMINAL as readonly string[]).includes(status)
  const currentIdx = (ORDER_FLOW as readonly string[]).indexOf(status)
  return ORDER_FLOW.map((s, i) => ({
    status: s,
    label: getStatusText(s),
    done: !isTerminal && i < currentIdx,
    active: !isTerminal && i === currentIdx,
    terminal: isTerminal,
  }))
}

export function waLink(phone: string, text = "") {
  const clean = (phone || "").replace(/\D/g, "")
  const full = clean.startsWith("2") ? clean : `2${clean}`
  const base = `https://wa.me/${full}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function telLink(phone: string) {
  return `tel:${(phone || "").replace(/\D/g, "")}`
}

interface OrderLike {
  orderNumber: string
  status: string
  total: number
  customerName: string
  customerPhone: string
  customerCity?: string
  items: { product?: { nameAr?: string }; nameAr?: string; quantity: number; total: number }[]
}

export function orderSummaryText(order: OrderLike): string {
  const lines = [
    `طلب ${order.orderNumber}`,
    `الحالة: ${getStatusText(order.status)}`,
    "",
    "المنتجات:",
    ...(order.items || []).map(
      (i) => `• ${i.product?.nameAr || i.nameAr || ""} × ${i.quantity} — ${formatCurrency(i.total)}`
    ),
    "",
    `الإجمالي: ${formatCurrency(order.total)}`,
  ]
  return lines.join("\n")
}

export function shareOrder(order: OrderLike) {
  const data = { title: `طلب ${order.orderNumber}`, text: orderSummaryText(order) }
  if (navigator.share) {
    navigator.share(data).catch(() => {})
  } else {
    navigator.clipboard.writeText(data.text).catch(() => {})
  }
}

export function printOrder(order: OrderLike & {
  shippingCost?: number
  subtotal?: number
  customerAddress?: string
  customerGovernorate?: string | null
  paymentStatus?: string
  createdAt?: string
  notes?: string
}) {
  const w = window.open("", "_blank", "width=760,height=640")
  if (!w) return
  const items = (order.items || [])
    .map(
      (i) => `<tr>
        <td>${i.product?.nameAr || i.nameAr || ""}</td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:left">${formatCurrency(i.total)}</td>
      </tr>`
    )
    .join("")
  w.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>طلب ${order.orderNumber}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;color:#0f172a;padding:28px;max-width:640px;margin:0 auto}
      h1{font-size:18px;margin:0} .muted{color:#64748b;font-size:12px;margin-top:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th{background:#f1f5f9;text-align:right;padding:8px} td{padding:8px;border-bottom:1px solid #e2e8f0}
      .totals{margin-top:12px;font-size:13px} .totals div{display:flex;justify-content:space-between;padding:4px 0}
      .total{font-size:16px;font-weight:bold;border-top:2px solid #0f172a;margin-top:6px;padding-top:8px}
      .section{margin-top:16px;font-size:13px;line-height:1.8}
      .sec-title{font-weight:bold;font-size:13px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
    </style></head><body>
    <h1>طلب ${order.orderNumber}</h1>
    <p class="muted">${formatDate(order.createdAt || new Date())} — ${getStatusText(order.status)} · الدفع: ${getStatusText(order.paymentStatus || "")}</p>
    <div class="section"><div class="sec-title">بيانات العميل</div>
      ${order.customerName}<br/>${order.customerPhone}<br/>${order.customerAddress || ""}${order.customerCity ? `, ${order.customerCity}` : ""}${order.customerGovernorate ? ` — ${order.customerGovernorate}` : ""}
    </div>
    <div class="section"><div class="sec-title">المنتجات</div>
      <table><thead><tr><th>المنتج</th><th style="text-align:center">الكمية</th><th style="text-align:left">الإجمالي</th></tr></thead><tbody>${items}</tbody></table>
    </div>
    <div class="totals">
      <div><span>المجموع الفرعي</span><span>${formatCurrency(order.subtotal || 0)}</span></div>
      <div><span>الشحن</span><span>${formatCurrency(order.shippingCost || 0)}</span></div>
      <div class="total"><span>الإجمالي</span><span>${formatCurrency(order.total)}</span></div>
    </div>
    ${order.notes ? `<div class="section"><div class="sec-title">ملاحظات</div>${order.notes}</div>` : ""}
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 200)
}

export function recreateOrder(order: {
  items: { product?: { id: string }; productId?: string; quantity: number }[]
}) {
  const items = (order.items || [])
    .filter((i) => i.product?.id || i.productId)
    .map((i) => ({ productId: i.product?.id || i.productId, quantity: i.quantity }))
  try {
    localStorage.setItem("recreate-order", JSON.stringify(items))
  } catch { /* ignore */ }
  window.location.href = "/cart"
}
