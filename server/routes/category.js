import service from "../services/category.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/category.schema.js";
import { permission } from "../middleware/permission.js";

/** 공통 코드 (/api/category) — 직급·직종·고용형태·면허종류·부서유형 */
export default async function categoryRoutes(app) {
  app.post("/list", { preHandler: permission("permission.menu.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("permission.menu.update") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("permission.menu.update") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
