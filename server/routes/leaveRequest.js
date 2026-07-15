import service from "../services/leaveRequest.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, createSchema, rejectSchema } from "../validators/leaveRequest.schema.js";
import { permission } from "../middleware/permission.js";

/** 휴가 신청/승인 (/api/leaveRequest) */
export default async function leaveRequestRoutes(app) {
  app.post("/list", { preHandler: permission("leave.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/create", { preHandler: permission("leave.edit") }, async (req) => service.create(validate(createSchema, req.body)));
  app.post("/approve", { preHandler: permission("leave.approve") }, async (req) => { const { id } = validate(idSchema, req.body); return service.approve(id, req.user?.id); });
  app.post("/reject", { preHandler: permission("leave.approve") }, async (req) => service.reject(validate(rejectSchema, req.body), req.user?.id));
  app.post("/cancel", { preHandler: permission("leave.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.cancel(id); });
  app.post("/delete", { preHandler: permission("leave.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
