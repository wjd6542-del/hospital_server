import service from "../services/stockMovement.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/stockMovement.schema.js";
import { permission } from "../middleware/permission.js";

/** 입출고 수불부 (/api/stockMovement) */
export default async function stockMovementRoutes(app) {
  app.post("/list", { preHandler: permission("inventory.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("inventory.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("inventory.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
