import service from "../services/facilityRequest.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, setStatusSchema } from "../validators/facilityRequest.schema.js";
import { permission } from "../middleware/permission.js";

/** 시설 유지보수 요청 (/api/facilityRequest) */
export default async function facilityRequestRoutes(app) {
  app.post("/list", { preHandler: permission("facility.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/summary", { preHandler: permission("facility.view") }, async () => service.summary());
  app.post("/save", { preHandler: permission("facility.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/setStatus", { preHandler: permission("facility.edit") }, async (req) => service.setStatus(validate(setStatusSchema, req.body)));
  app.post("/delete", { preHandler: permission("facility.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
