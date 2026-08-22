import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

const secret = process.env.NEXTAUTH_SECRET
if (!secret || secret.length < 32) {
  throw new Error(
    "FATAL: NEXTAUTH_SECRET is missing or too short. " +
    "Set a secure random string (>= 32 chars) in your environment variables."
  )
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || user.status !== "ACTIVE") {
          throw new Error("Invalid credentials")
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error("Invalid credentials")
        }

        prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {})

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
          permissions: user.permissions,
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        ;(token as any).role = (user as any).role
        ;(token as any).id = user.id
        ;(token as any).commissionRate = (user as any).commissionRate
        ;(token as any).isSuperAdmin = (user as any).isSuperAdmin
        ;(token as any).permissions = (user as any).permissions
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = (token as any).role
        ;(session.user as any).id = (token as any).id
        ;(session.user as any).commissionRate = (token as any).commissionRate
        ;(session.user as any).isSuperAdmin = (token as any).isSuperAdmin
        ;(session.user as any).permissions = (token as any).permissions
      }
      return session
    }
  },
  pages: {
    signIn: "/login"
  },
  secret,
}
