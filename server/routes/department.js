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
import { permission } from "../middleware/permission.js";

/** 부서 (/api/department) — 계층 트리 */
export default async function departmentRoutes(app) {
  app.post("/list", { preHandler: permission("department.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/tree", { preHandler: permission("department.view") }, async () => service.tree());
  app.post("/options", { preHandler: permission("department.view") }, async () => service.options());
  app.post("/get", { preHandler: permission("department.view") }, async (req) => { const { id } = validate(idSchema, req.body); return service.get(id); });

  // 트리 인라인 추가는 name/parent_id 만 오고, 상세 패널 저장은 전체 필드가 온다.
  // code 유무로 갈라 알맞은 스키마로 검증한다.
  app.post("/save", { preHandler: permission("department.edit") }, async (req) => {
    const body = req.body || {};
    const schema = body.code === undefined ? quickSaveSchema : saveSchema;
    return service.save(validate(schema, body));
  });

  app.post("/reorder", { preHandler: permission("department.edit") }, async (req) => service.reorder(validate(reorderSchema, req.body)));
  app.post("/delete", { preHandler: permission("department.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
