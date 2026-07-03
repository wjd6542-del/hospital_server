import service from "../services/supportTarget.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, deskSchema, saveSchema, reorderSchema } from "../validators/supportTarget.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** CS 응대 대상 (/api/supportTarget) — 유형(desk)별 트리 */
export default async function supportTargetRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/tree", async (req) => service.tree(validate(deskSchema, req.body)));
  app.post("/options", async (req) => service.options(validate(deskSchema, req.body)));
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", async (req) => { ensureAuth(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/reorder", async (req) => { ensureAuth(req.user); return service.reorder(validate(reorderSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
