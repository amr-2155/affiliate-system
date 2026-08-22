import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"]
const ALLOWED_FOLDERS = ["products", "orders", "avatars", "logos", "withdrawals"]
const MAX_FILE_SIZE = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
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

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "نوع الملف غير مدعوم. الصور المدعومة: jpg, png, webp, gif" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "حجم الملف يتجاوز الحد الأقصى (5 ميجا)" }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase() || ".jpg"
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "امتداد الملف غير مدعوم" }, { status: 400 })
    }

    const safeFolder = path.normalize(folder).replace(/^(\.\.[/\\])+/, "")
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
    const uploadDir = path.join(process.cwd(), "uploads", safeFolder)
    await mkdir(uploadDir, { recursive: true })
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, buffer)

    console.log(`Upload OK: ${filename} (${buffer.length} bytes) to ${filepath}`)
    const url = `/api/uploads/${safeFolder}/${filename}`
    console.log(`Upload OK: ${filename} (${buffer.length} bytes) to ${filepath}`)
    return NextResponse.json({ url, filename })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "خطأ في الرفع", details: error instanceof Error ? error.message : "unknown" }, { status: 500 })
  }
}
