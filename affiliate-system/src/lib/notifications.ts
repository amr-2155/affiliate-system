import { prisma } from "@/lib/prisma"

/** أنواع الإشعارات الموحدة — تُستخدم في كل مكان بدل نصوص مبعثرة عرضة للخطأ. */
export const NOTIFICATION_TYPE = {
  ORDER: "ORDER",
  EARNINGS: "EARNINGS",
  WITHDRAWAL: "WITHDRAWAL",
  STOCK: "STOCK",
  REWARD: "REWARD",
  AFFILIATE: "AFFILIATE",
  INFO: "INFO",
  SYSTEM: "SYSTEM",
} as const

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE]

export interface NotificationInput {
  userId: string
  title: string
  message: string
  type: NotificationType
  link?: string | null
  relatedId?: string | null
}

/**
 * إنشاء إشعار واحد دون أن يُفشِل العملية الأساسية إطلاقًا.
 * أي خطأ في الإشعار (مثل قفل قاعدة البيانات) يُسجَّل فقط ولا يُحوَّل إلى 500
 * — فالمنتج/الطلب/السحب اكتمل فعلًا ويجب ألا يظهر للمستخدم كفشل.
 */
export async function notify(input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({ data: input })
  } catch (e) {
    console.error("[notifications] failed to create notification", input.type, input.userId, e)
  }
}

/** إشعار جماعي لنفس الرسالة — لا يُفشِل العملية الأساسية. */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotificationInput, "userId">,
): Promise<void> {
  if (userIds.length === 0) return
  const unique = [...new Set(userIds)]
  try {
    await prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, ...input })),
    })
  } catch (e) {
    console.error("[notifications] failed to create notifications", input.type, unique.length, e)
  }
}
