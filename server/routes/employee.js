import service from "../services/employee.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, resignSchema } from "../validators/employee.schema.js";
import { permission } from "../middleware/permission.js";

/** 직원 (/api/employee) — 마스터. 퇴사는 resign, 삭제는 오등록 취소용. */
export default async function employeeRoutes(app) {
  app.post("/list", { preHandler: permission("hr.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/options", { preHandler: permission("hr.view") }, async () => service.options());
  app.post("/get", { preHandler: permission("hr.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", { preHandler: permission("hr.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/resign", { preHandler: permission("hr.edit") }, async (req) => service.resign(validate(resignSchema, req.body)));
  app.post("/delete", { preHandler: permission("hr.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
