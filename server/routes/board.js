import boardService from "../services/board.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, slugSchema, saveSchema } from "../validators/board.schema.js";

function ensureAdmin(user) {
  if (!user?.is_super) {
    const e = new Error("관리자만 가능합니다."); e.statusCode = 403; e.code = "FORBIDDEN"; e.isOperational = true; throw e;
  }
}

/** 게시판 (/api/board) */
export default async function boardRoutes(app) {
  app.post("/list", async () => boardService.list());
  app.post("/listAll", async (req) => { ensureAdmin(req.user); return boardService.listAll(); });
  app.post("/get", async (req) => { const { slug } = validate(slugSchema, req.body); return boardService.getBySlug(slug); });
  app.post("/save", async (req) => { ensureAdmin(req.user); return boardService.save(validate(saveSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAdmin(req.user); const { id } = validate(idSchema, req.body); return boardService.remove(id); });
}
