import { z } from "zod"

/**
 * Phase 3: central request validation schemas.
 *
 * Every public mutation route should parse its body through one of these (or a
 * local schema built the same way) BEFORE touching Prisma. Parse errors are
 * returned as 400 with the first message — never leak stack/internals.
 */

export const registerSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(80, "الاسم طويل جدًا"),
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح").max(254),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(128),
  phone: z.string().trim().max(20).optional(),
  ref: z.string().trim().max(64).optional(),
})

export const orderItemSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().positive().optional(),
  note: z.string().max(500).optional(),
})

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2, "اسم العميل مطلوب").max(120),
  customerPhone: z.string().trim().min(6, "رقم هاتف العميل غير صالح").max(20),
  customerEmail: z.string().trim().email("بريد العميل غير صالح").max(254).optional().or(z.literal("")),
  customerAddress: z.string().trim().min(5, "العنوان مطلوب").max(300),
  customerCity: z.string().trim().min(2, "المدينة مطلوبة").max(80),
  customerGovernorate: z.string().trim().max(80).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(orderItemSchema).min(1, "أضف منتجًا واحدًا على الأقل").max(50),
})

export const withdrawalCreateSchema = z.object({
  amount: z.number().positive("المبلغ غير صحيح").max(1_000_000),
  method: z.enum(["BANK_TRANSFER", "VODAFONE_CASH", "INSTAPAY", "OTHER"]),
  accountName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(60).optional(),
  bankName: z.string().trim().max(120).optional(),
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  avatar: z.string().max(500).optional(),
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل").max(128).optional(),
})

/** Admin affiliate update — whitelist only; never accepts password/role/balance. */
export const adminAffiliateUpdateSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  commissionRate: z.number().min(0, "نسبة العمولة غير صالحة").max(100, "نسبة العمولة غير صالحة").optional(),
})

export const webhookCreateSchema = z.object({
  name: z.string().trim().min(2, "الاسم مطلوب").max(80),
  url: z.string().trim().url("رابط غير صالح").max(2000),
  secret: z.string().trim().min(16, "المفتاح السري يجب أن يكون 16 حرفًا على الأقل").max(128).optional(),
  enabled: z.boolean().optional(),
  events: z.array(z.string().max(64)).min(1, "اختر حدثًا واحدًا على الأقل").max(32),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
})

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "بيانات غير صالحة"
}
