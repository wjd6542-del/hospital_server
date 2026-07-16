import service from "../services/financeTxn.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, summarySchema, dashboardSchema, compareSchema } from "../validators/financeTxn.schema.js";
import { permission } from "../middleware/permission.js";

/** 수입·지출 거래 (/api/financeTxn) */
export default async function financeTxnRoutes(app) {
  app.post("/list", { preHandler: permission("finance.view") }, async (req) => service.list(validate(listSchema, req.body)));
  app.post("/save", { preHandler: permission("finance.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/summary", { preHandler: permission("finance.view") }, async (req) => service.summary(validate(summarySchema, req.body)));
  app.post("/dashboard", { preHandler: permission("finance.view") }, async (req) => service.dashboard(validate(dashboardSchema, req.body)));
  app.post("/compare", { preHandler: permission("finance.view") }, async (req) => service.compare(validate(compareSchema, req.body)));
  app.post("/delete", { preHandler: permission("finance.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
