import service from "../services/category.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/category.schema.js";
import { permission } from "../middleware/permission.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/**
 * 공통 코드 (/api/category) — 직급·직종·고용형태·면허종류·부서유형
 * /list 는 민감정보가 아니고 모든 도메인 화면(직원 등록 폼 등)의 드롭다운 공급원이라 인증만 요구한다.
 * 쓰기(/save, /delete)는 환경설정 권한을 유지한다.
 */
export default async function categoryRoutes(app) {
  app.post("/list", async (req) => { ensureAuth(req.user); return service.list(validate(listSchema, req.body || {})); });
  app.post("/save", { preHandler: permission("permission.menu.update") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("permission.menu.update") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
