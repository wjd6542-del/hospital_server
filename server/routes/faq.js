import service from "../services/faq.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/faq.schema.js";
import { permission } from "../middleware/permission.js";

/** 자주 하는 질문 (/api/faq) */
export default async function faqRoutes(app) {
  app.post("/list", { preHandler: permission("faq.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/categories", { preHandler: permission("faq.view") }, async () => service.categories());
  app.post("/popular", { preHandler: permission("faq.view") }, async (req) => service.popular(req.body || {}));
  app.post("/get", { preHandler: permission("faq.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", { preHandler: permission("faq.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("faq.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
