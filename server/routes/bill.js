import service from "../services/bill.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, paySchema, suggestSchema } from "../validators/bill.schema.js";
import { permission } from "../middleware/permission.js";

/** 수납/정산 (/api/bill) — 항목 중첩, 수납 시 진료수입 자동기록, 보험청구 생성 */
export default async function billRoutes(app) {
  app.post("/list", { preHandler: permission("billing.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/get", { preHandler: permission("billing.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/suggest", { preHandler: permission("billing.edit") }, async (req) => service.suggest(validate(suggestSchema, req.body)));
  app.post("/save", { preHandler: permission("billing.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/pay", { preHandler: permission("billing.pay") }, async (req) => service.pay(validate(paySchema, req.body)));
  app.post("/createClaim", { preHandler: permission("billing.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.createClaim(id); });
  app.post("/cancel", { preHandler: permission("billing.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.cancel(id); });
  app.post("/delete", { preHandler: permission("billing.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
