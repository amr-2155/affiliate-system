import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const role = (token as any).role as string | undefined
  const pathname = req.nextUrl.pathname

  const adminRoles = ["ADMIN", "VERIFIER"]
  if (pathname.startsWith("/admin") && !adminRoles.includes(role || "")) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  if (!pathname.startsWith("/admin") && role === "ADMIN") {
    // Admin users can access affiliate routes too
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/orders/:path*",
    "/favorites/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/withdrawals/:path*",
    "/suggestions/:path*",
    "/shipping/:path*",
    "/admin/:path*",
  ],
}
