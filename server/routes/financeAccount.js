import service from "../services/financeAccount.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/financeAccount.schema.js";
import { permission } from "../middleware/permission.js";

/** 계정과목 (/api/financeAccount) */
export default async function financeAccountRoutes(app) {
  app.post("/list", { preHandler: permission("finance.view") }, async (req) => service.list(validate(listSchema, req.body)));
  app.post("/save", { preHandler: permission("finance.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("finance.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
