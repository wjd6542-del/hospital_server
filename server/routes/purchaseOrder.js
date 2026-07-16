import service from "../services/purchaseOrder.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, setStatusSchema } from "../validators/purchaseOrder.schema.js";
import { permission } from "../middleware/permission.js";

/** 발주 (/api/purchaseOrder) */
export default async function purchaseOrderRoutes(app) {
  app.post("/list", { preHandler: permission("purchase.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("purchase.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/setStatus", { preHandler: permission("purchase.edit") }, async (req) => service.setStatus(validate(setStatusSchema, req.body)));
  app.post("/delete", { preHandler: permission("purchase.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
