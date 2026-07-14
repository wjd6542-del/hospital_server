import service from "../services/tag.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/tag.schema.js";
import { permission } from "../middleware/permission.js";

/** 태그 (/api/tag) */
export default async function tagRoutes(app) {
  app.post("/list", { preHandler: permission("faq.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("faq.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("faq.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
