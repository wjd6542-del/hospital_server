import service from "../services/supportDesk.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, saveSchema } from "../validators/supportDesk.schema.js";

function ensureAdmin(user) {
  if (!user?.is_super) {
    const e = new Error("관리자만 가능합니다."); e.statusCode = 403; e.code = "FORBIDDEN"; e.isOperational = true; throw e;
  }
}

/** CS 응대 유형 (/api/supportDesk) */
export default async function supportDeskRoutes(app) {
  app.post("/list", async () => service.list());
  app.post("/listAll", async () => service.listAll());
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/getByCode", async (req) => service.getByCode(req.body?.code));
  app.post("/save", async (req) => { ensureAdmin(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAdmin(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
