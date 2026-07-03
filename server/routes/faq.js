import service from "../services/faq.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/faq.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** 자주 하는 질문 (/api/faq) */
export default async function faqRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/categories", async () => service.categories());
  app.post("/popular", async (req) => service.popular(req.body || {}));
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", async (req) => { ensureAuth(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
