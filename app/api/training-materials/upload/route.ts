import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: session.id }, select: { isAdmin: true } });
    if (!user?.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const mimeType = req.headers.get("content-type") ?? "";
    const isImage = mimeType.startsWith("image/");
    const isVideo = mimeType.startsWith("video/");
    if (!isImage && !isVideo) return NextResponse.json({ error: "Only images and videos allowed" }, { status: 400 });

    const ext = mimeType === "video/mp4" ? "mp4"
      : mimeType === "video/quicktime" ? "mov"
      : mimeType === "image/jpeg" ? "jpg"
      : mimeType === "image/png" ? "png"
      : mimeType === "image/gif" ? "gif"
      : mimeType === "image/webp" ? "webp"
      : mimeType.split("/")[1] ?? "bin";

    const fileId = `tm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fileName = `${fileId}.${ext}`;
    const dir = path.join(process.cwd(), "public", "training-files");
    await mkdir(dir, { recursive: true });
    const dest = path.join(dir, fileName);

    if (!req.body) return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    const ws = createWriteStream(dest);
    const reader = req.body.getReader();
    await new Promise<void>((resolve, reject) => {
      ws.on("error", reject);
      ws.on("finish", resolve);
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) { ws.end(); return; }
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

    return NextResponse.json({ url: `/training-files/${fileName}`, mimeType });
  } catch (err) {
    console.error("[TM upload] error:", err);
    return NextResponse.json({ error: (err as Error).message ?? "Internal error" }, { status: 500 });
  }
}
