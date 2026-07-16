import service from "../services/admission.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, dischargeSchema } from "../validators/admission.schema.js";
import { permission } from "../middleware/permission.js";

/** 병동 입원 관리 (/api/admission) */
export default async function admissionRoutes(app) {
  app.post("/list", { preHandler: permission("ward.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/summary", { preHandler: permission("ward.view") }, async () => service.summary());
  app.post("/save", { preHandler: permission("ward.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/discharge", { preHandler: permission("ward.edit") }, async (req) => service.discharge(validate(dischargeSchema, req.body)));
  app.post("/delete", { preHandler: permission("ward.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
