import service from "../services/prescription.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/prescription.schema.js";
import { permission } from "../middleware/permission.js";

/** 처방 (/api/prescription) — 약품 중첩, 조제 시 재고 차감 */
export default async function prescriptionRoutes(app) {
  app.post("/list", { preHandler: permission("prescription.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/get", { preHandler: permission("prescription.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", { preHandler: permission("prescription.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/dispense", { preHandler: permission("prescription.dispense") }, async (req) => { const { id } = validate(idSchema, req.body); return service.dispense(id); });
  app.post("/cancel", { preHandler: permission("prescription.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.cancel(id); });
  app.post("/delete", { preHandler: permission("prescription.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
