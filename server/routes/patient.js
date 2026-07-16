import service from "../services/patient.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/patient.schema.js";
import { permission } from "../middleware/permission.js";

/** 환자 등록 (/api/patient) */
export default async function patientRoutes(app) {
  app.post("/list", { preHandler: permission("patient.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/get", { preHandler: permission("patient.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", { preHandler: permission("patient.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("patient.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
