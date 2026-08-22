import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** وقت الخادم الحقيقي الحالي — مصدر واحد للتواريخ الافتراضية في النماذج لتجنب اختلاف التوقيت. */
export async function GET() {
  return NextResponse.json({
    now: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  })
}
