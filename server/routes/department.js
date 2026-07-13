import service from "../services/department.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idSchema,
  emptySchema,
  listSchema,
  saveSchema,
  quickSaveSchema,
  reorderSchema,
} from "../validators/department.schema.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/** 부서 (/api/department) — 계층 트리 */
export default async function departmentRoutes(app) {
  app.post("/list", async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/tree", async () => service.tree());
  app.post("/options", async () => service.options());
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });

  // 트리 인라인 추가는 name/parent_id 만 오고, 상세 패널 저장은 전체 필드가 온다.
  // code 유무로 갈라 알맞은 스키마로 검증한다.
  app.post("/save", async (req) => {
    ensureAuth(req.user);
    const body = req.body || {};
    const schema = body.code === undefined ? quickSaveSchema : saveSchema;
    return service.save(validate(schema, body));
  });

  app.post("/reorder", async (req) => { ensureAuth(req.user); return service.reorder(validate(reorderSchema, req.body)); });
  app.post("/delete", async (req) => { ensureAuth(req.user); const { id } = validate(idSchema, req.body); return service.remove(id); });
}
