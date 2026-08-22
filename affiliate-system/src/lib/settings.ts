import { prisma } from "@/lib/prisma"

export async function getSetting(key: string, fallback = ""): Promise<string> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } })
    return row ? row.value : fallback
  } catch {
    return fallback
  }
}

export async function isSettingEnabled(key: string, fallback = true): Promise<boolean> {
  const value = await getSetting(key)
  if (value === "") return fallback
  return value !== "false" && value !== "0"
}
