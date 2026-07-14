import service from "../services/faqCategory.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/faqCategory.schema.js";
import { permission } from "../middleware/permission.js";

/** FAQ 분류 (/api/faqCategory) */
export default async function faqCategoryRoutes(app) {
  app.post("/list", { preHandler: permission("faq.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("faq.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("faq.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
