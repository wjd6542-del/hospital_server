import service from "../services/insuranceClaim.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, setStatusSchema } from "../validators/insuranceClaim.schema.js";
import { permission } from "../middleware/permission.js";

/** 보험청구 (/api/insuranceClaim) */
export default async function insuranceClaimRoutes(app) {
  app.post("/list", { preHandler: permission("insurance.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/summary", { preHandler: permission("insurance.view") }, async () => service.summary());
  app.post("/save", { preHandler: permission("insurance.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/setStatus", { preHandler: permission("insurance.edit") }, async (req) => service.setStatus(validate(setStatusSchema, req.body)));
  app.post("/delete", { preHandler: permission("insurance.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
