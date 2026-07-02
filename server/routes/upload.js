import fs from "fs";
import path from "path";
import { pipeline } from "node:stream/promises";

/** 파일/이미지 업로드 (/api/upload) — 다중 파일, uploads/board 에 저장 */
export default async function uploadRoutes(app) {
  app.post("/", async (req) => {
    const dir = path.join(process.cwd(), "uploads", "board");
    fs.mkdirSync(dir, { recursive: true });
    const saved = [];
    for await (const part of req.parts()) {
      if (!part.file) continue;
      const ext = path.extname(part.filename || "") || "";
      const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const dest = path.join(dir, name);
      await pipeline(part.file, fs.createWriteStream(dest));
      const size = fs.statSync(dest).size;
      const mime = part.mimetype || "";
      saved.push({
        path: `/uploads/board/${name}`,
        filename: part.filename || name,
        mime_type: mime,
        size,
        is_image: /^image\//.test(mime),
      });
    }
    return saved;
  });
}
