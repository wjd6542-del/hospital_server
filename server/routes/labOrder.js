import service from "../services/labOrder.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, resultSchema } from "../validators/labOrder.schema.js";
import { permission } from "../middleware/permission.js";

/** 검사 오더/결과 (/api/labOrder) — 항목 중첩, 결과 입력 시 이상치 자동판정 */
export default async function labOrderRoutes(app) {
  app.post("/list", { preHandler: permission("lab.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/get", { preHandler: permission("lab.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", { preHandler: permission("lab.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/result", { preHandler: permission("lab.result") }, async (req) => service.result(validate(resultSchema, req.body)));
  app.post("/cancel", { preHandler: permission("lab.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.cancel(id); });
  app.post("/delete", { preHandler: permission("lab.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
