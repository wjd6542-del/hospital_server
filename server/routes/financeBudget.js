import service from "../services/financeBudget.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { listSchema, saveSchema } from "../validators/financeBudget.schema.js";
import { permission } from "../middleware/permission.js";

/** 연간 예산 (/api/financeBudget) */
export default async function financeBudgetRoutes(app) {
  app.post("/list", { preHandler: permission("finance.view") }, async (req) => service.list(validate(listSchema, req.body)));
  app.post("/save", { preHandler: permission("finance.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
}
