import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  getAffiliateChallenges,
  getAffiliateRewards,
  getLeaderboard,
} from "@/lib/incentives"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const leaderboardPeriod = searchParams.get("leaderboard") || "month"

    const [challenges, rewards, leaderboard] = await Promise.all([
      getAffiliateChallenges(userId),
      getAffiliateRewards(userId),
      getLeaderboard(leaderboardPeriod === "month" ? 10 : 10),
    ])

    return NextResponse.json({
      challenges: challenges.challenges,
      rewards,
      leaderboard,
    })
  } catch (error) {
    console.error("incentives API error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
