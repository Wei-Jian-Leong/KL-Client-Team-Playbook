import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { mkdir, unlink } from "fs/promises";
import { createWriteStream } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
    if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { id } = await params;
    const article = await prisma.knowledgeArticle.findUnique({ where: { id }, select: { files: true } });
    if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

    const mimeType = req.headers.get("content-type") ?? "";
    const isImage = mimeType.startsWith("image/");
    const isVideo = mimeType.startsWith("video/");
    if (!isImage && !isVideo) return NextResponse.json({ error: "Only images and videos allowed" }, { status: 400 });

    const originalName = decodeURIComponent(req.headers.get("x-filename") ?? "upload");

    const ext = mimeType === "video/mp4" ? "mp4"
      : mimeType === "video/quicktime" ? "mov"
      : mimeType === "image/jpeg" ? "jpg"
      : mimeType === "image/png" ? "png"
      : mimeType === "image/gif" ? "gif"
      : mimeType === "image/webp" ? "webp"
      : mimeType.split("/")[1] ?? "bin";

    const fileId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${fileId}.${ext}`;
    const dir = path.join(process.cwd(), "public", "knowledge-files");
    await mkdir(dir, { recursive: true });
    const dest = path.join(dir, fileName);

    // Stream body directly to disk — no buffering in memory
    if (!req.body) return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    const ws = createWriteStream(dest);
    const reader = req.body.getReader();
    await new Promise<void>((resolve, reject) => {
      ws.on("error", reject);
      ws.on("finish", resolve); // resolve only after file is fully flushed to disk
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { ws.end(); return; }
            // handle backpressure: wait for drain if write buffer is full
            if (!ws.write(value)) {
              await new Promise<void>(r => ws.once("drain", r));
            }
          }
        } catch (err) {
          ws.destroy(err as Error);
          reject(err);
        }
      };
      pump();
    });

    // Convert .mov to .mp4 for browser compatibility
    let finalExt = ext;
    if (ext === "mov") {
      const mp4Dest = path.join(dir, `${fileId}.mp4`);
      try {
        await execAsync(`avconvert -p PresetHEVCHighestQuality -s "${dest}" -o "${mp4Dest}"`);
        await unlink(dest);
        finalExt = "mp4";
      } catch {
        // conversion failed — keep original .mov
      }
    }

    let files: { id: string; name: string; mimeType: string }[] = [];
    try { files = JSON.parse(article.files ?? "[]"); } catch { /* ignore */ }
    files.push({ id: fileId, name: originalName, mimeType: finalExt === "mp4" ? "video/mp4" : mimeType });

    await prisma.knowledgeArticle.update({ where: { id }, data: { files: JSON.stringify(files) } });

    return NextResponse.json({ success: true, file: { id: fileId, name: originalName, mimeType: finalExt === "mp4" ? "video/mp4" : mimeType } });
  } catch (err) {
    console.error("[KB upload] error:", err);
    return NextResponse.json({ error: (err as Error).message ?? "Internal error" }, { status: 500 });
  }
}
