import service from "../services/faqCategory.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/faqCategory.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** FAQ 분류 (/api/faqCategory) */
export default async function faqCategoryRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", async (req) => { ensureAuth(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
