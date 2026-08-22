import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import fs from "fs"

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params

  if (!segments || segments.length < 2) {
    return new NextResponse("Not found", { status: 404 })
  }

  const [folder, ...filenameParts] = segments
  const filename = filenameParts.join("/")

  const allowedFolders = ["products", "orders", "avatars", "logos", "withdrawals"]
  if (!allowedFolders.includes(folder)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const safeFolder = path.normalize(folder).replace(/^(\.\.[/\\])+/, "")
  const safeFilename = path.normalize(filename).replace(/^(\.\.[/\\])+/, "")

  // Try new uploads directory first, then fallback to public/uploads
  const possiblePaths = [
    path.join(process.cwd(), "uploads", safeFolder, safeFilename),
    path.join(process.cwd(), "public", "uploads", safeFolder, safeFilename),
  ]

  for (const filepath of possiblePaths) {
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filepath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif",
      }
      const contentType = mimeTypes[ext] || "application/octet-stream"
      const buffer = await readFile(filepath)
      return new NextResponse(buffer, {
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
      })
    }
  }

  return new NextResponse("Not found", { status: 404 })
}
