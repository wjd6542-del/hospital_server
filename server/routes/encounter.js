import service from "../services/encounter.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/encounter.schema.js";
import { permission } from "../middleware/permission.js";

/** 외래 진료 (/api/encounter) — 진단 중첩, 예약 연동 */
export default async function encounterRoutes(app) {
  app.post("/list", { preHandler: permission("emr.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/get", { preHandler: permission("emr.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", { preHandler: permission("emr.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("emr.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
