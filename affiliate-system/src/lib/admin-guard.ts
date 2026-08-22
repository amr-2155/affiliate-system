import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsePermissions, canAct } from "@/lib/permissions"
import { NextResponse } from "next/server"

export interface AdminActor {
  id: string
  name: string
  email: string
  role: string
  isSuperAdmin: boolean
  permissions: string[]
}

export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await getServerSession(authOptions)
  const sid = (session?.user as any)?.id
  if (!sid) return null
  const user = await prisma.user.findUnique({ where: { id: sid } })
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    permissions: parsePermissions(user.permissions),
  }
}

export function actorCan(actor: AdminActor | null, key: string): boolean {
  if (!actor) return false
  return canAct({ isSuperAdmin: actor.isSuperAdmin, role: actor.role, permissions: actor.permissions }, key)
}

/** مصادقة دور المدير/فريق التأكيد فقط — بدون فحص صلاحية. */
export async function requireAdminActor(): Promise<AdminActor | null> {
  const actor = await getAdminActor()
  if (!actor) return null
  if (actor.role !== "ADMIN" && actor.role !== "VERIFIER") return null
  return actor
}

export async function requireAdminPermission(key: string): Promise<{ actor: AdminActor } | NextResponse> {
  const actor = await getAdminActor()
  if (!actor) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }
  if (actor.role !== "ADMIN" && actor.role !== "VERIFIER") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }
  if (!actorCan(actor, key)) {
    return NextResponse.json({ error: "ليس لديك صلاحية لهذا الإجراء" }, { status: 403 })
  }
  return { actor }
}

export async function logActivity(
  userId: string,
  action: string,
  module: string,
  details?: string,
  orderId?: string
) {
  try {
    await prisma.adminActivity.create({
      data: { userId, action, module, details: details || null, orderId: orderId || null },
    })
  } catch (e) {
    console.error("logActivity failed", e)
  }
}
