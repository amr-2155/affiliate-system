import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { clientIp, enforceRateLimit, RateLimitError } from "@/lib/api/rate-limit"

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
const ALLOWED_FOLDERS = ["products", "orders", "avatars", "logos", "withdrawals"]
const MAX_FILE_SIZE = 5 * 1024 * 1024
const UPLOAD_RATE = { limit: 30, windowMs: 10 * 60 * 1000 }

/**
 * Phase 3: content sniffing — the declared MIME type is client-controlled,
 * so we verify the actual bytes match a known image signature.
 */
function detectImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg"
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e &&
    buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a &&
    buf[6] === 0x1a && buf[7] === 0x0a
  ) return ".png"
  // GIF: GIF87a / GIF89a
  if (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a") return ".gif"
  // WEBP: RIFF....WEBP
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) return ".webp"
  return null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
    }

    try {
      enforceRateLimit(`upload:${session.user.id}:${clientIp(req)}`, UPLOAD_RATE.limit, UPLOAD_RATE.windowMs)
    } catch (e) {
      if (e instanceof RateLimitError) {
        return NextResponse.json(
          { error: e.message },
          { status: 429, headers: { "Retry-After": String(e.retryAfterSeconds) } },
        )
      }
      throw e
    }

    const formData = await req.formData()
    const file = formData.get("file") as File
    const folder = (formData.get("folder") as string) || "products"

    if (!file) {
      return NextResponse.json({ error: "لا يوجد ملف" }, { status: 400 })
    }

    if (!ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: "مجلد غير مسموح" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "حجم الملف يتجاوز الحد الأقصى (5 ميجا)" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Trust the bytes, not the declared MIME type or the filename.
    const sniffedExt = detectImageType(buffer)
    if (!sniffedExt) {
      return NextResponse.json(
        { error: "نوع الملف غير مدعوم. الصور المدعومة: jpg, png, webp, gif" },
        { status: 400 },
      )
    }

    const ext = path.extname(file.name).toLowerCase() || sniffedExt
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "امتداد الملف غير مدعوم" }, { status: 400 })
    }
    // Mismatch between claimed extension and real content → reject.
    if (ext !== sniffedExt && !(ext === ".jpeg" && sniffedExt === ".jpg")) {
      return NextResponse.json({ error: "محتوى الملف لا يطابق امتداده" }, { status: 400 })
    }

    const safeFolder = path.normalize(folder).replace(/^(\.\.[/\\])+/, "")
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${sniffedExt}`
    const uploadDir = path.join(process.cwd(), "uploads", safeFolder)
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filename), buffer)

    const url = `/api/uploads/${safeFolder}/${filename}`
    return NextResponse.json({ url, filename })
  } catch (error) {
    console.error("Upload error")
    return NextResponse.json({ error: "خطأ في الرفع" }, { status: 500 })
  }
}
