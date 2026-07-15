import service from "../services/leaveGrant.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/leaveGrant.schema.js";
import { permission } from "../middleware/permission.js";

/** 연차 부여 (/api/leaveGrant) — 부여/사용/잔여 + 법정 제안값 */
export default async function leaveGrantRoutes(app) {
  app.post("/list", { preHandler: permission("leave.view") }, async (req) => service.list(validate(listSchema, req.body)));
  app.post("/save", { preHandler: permission("leave.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("leave.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
