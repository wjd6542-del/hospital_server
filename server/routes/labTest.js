import service from "../services/labTest.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/labTest.schema.js";
import { permission } from "../middleware/permission.js";

/** 검사 마스터 (/api/labTest) */
export default async function labTestRoutes(app) {
  app.post("/list", { preHandler: permission("lab.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("lab.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("lab.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
