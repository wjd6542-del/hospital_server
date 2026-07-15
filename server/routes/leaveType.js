import service from "../services/leaveType.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/leaveType.schema.js";
import { permission } from "../middleware/permission.js";

/** 휴가유형 마스터 (/api/leaveType) */
export default async function leaveTypeRoutes(app) {
  app.post("/list", { preHandler: permission("leave.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("leave.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("leave.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
