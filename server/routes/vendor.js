import service from "../services/vendor.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/vendor.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** 업체 (/api/vendor) */
export default async function vendorRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/tree", async () => service.tree());
  app.post("/options", async () => service.options());
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });
  app.post("/save", async (req) => { ensureAuth(req.user); return service.save(validate(saveSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
