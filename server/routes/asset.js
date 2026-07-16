import service from "../services/asset.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/asset.schema.js";
import { permission } from "../middleware/permission.js";

/** 자산 대장 (/api/asset) */
export default async function assetRoutes(app) {
  app.post("/list", { preHandler: permission("asset.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/summary", { preHandler: permission("asset.view") }, async () => service.summary());
  app.post("/save", { preHandler: permission("asset.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("asset.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
