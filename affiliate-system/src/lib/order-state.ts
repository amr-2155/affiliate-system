export const ORDER_FLOW = [
  "PENDING",
  "UNDER_REVIEW",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COLLECTED",
] as const

export const TERMINAL_STATUSES = ["CANCELLED", "RETURNED", "REJECTED"] as const

/** الحالات التي يسمح للمسوق بتعديل الطلب فيها فقط. */
export const AFFILIATE_EDITABLE_STATUSES = ["PENDING", "UNDER_REVIEW"] as const

export function isAffiliateEditable(status: string): boolean {
  return (AFFILIATE_EDITABLE_STATUSES as readonly string[]).includes(status)
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/** انتقال منطقي: إلى الأمام في مسار الطلب أو إلى حالة نهائية — لا رجوع ولا خروج من الحالة النهائية. */
export function canTransitionOrder(from: string, to: string): boolean {
  if (from === to) return true
  if (isTerminalStatus(from)) return false
  const flow = ORDER_FLOW as readonly string[]
  const fromIdx = flow.indexOf(from)
  const toIdx = flow.indexOf(to)
  if (fromIdx !== -1 && toIdx !== -1) return toIdx > fromIdx
  if (toIdx === -1 && isTerminalStatus(to)) return true
  return false
}
