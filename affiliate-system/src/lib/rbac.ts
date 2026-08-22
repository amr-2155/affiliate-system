"use client"
import { useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { canAct, canActAny, parsePermissions, type PermissionContext } from "@/lib/permissions"

export function usePermissions() {
  const { data: session, status } = useSession()
  const user = session?.user as (Record<string, unknown> & { id?: string }) | undefined

  const ctx = useMemo<PermissionContext>(
    () => ({
      isSuperAdmin: Boolean(user?.isSuperAdmin),
      role: (user?.role as string) || null,
      permissions: user?.permissions as string[] | string | null | undefined,
    }),
    [user],
  )

  const permissions = useMemo(() => parsePermissions(ctx.permissions), [ctx.permissions])

  const can = useCallback((key: string) => canAct(ctx, key), [ctx])
  const canAny = useCallback((keys: string[]) => canActAny(ctx, keys), [ctx])

  return {
    status,
    isSuperAdmin: ctx.isSuperAdmin,
    role: ctx.role,
    permissions,
    can,
    canAny,
  }
}
