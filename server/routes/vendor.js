import service from "../services/vendor.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/vendor.schema.js";
import { permission } from "../middleware/permission.js";

/** 거래처 (/api/vendor) */
export default async function vendorRoutes(app) {
  app.post("/list", { preHandler: permission("purchase.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("purchase.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("purchase.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
