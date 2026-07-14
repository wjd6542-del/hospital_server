import service from "../services/shiftType.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/shiftType.schema.js";
import { permission } from "../middleware/permission.js";

function ensureAuth(user) {
  if (!user?.id) {
    const e = new Error("로그인이 필요합니다."); e.statusCode = 401; e.code = "UNAUTH"; e.isOperational = true; throw e;
  }
}

/**
 * 근무유형 (/api/shiftType) — 데이/이브닝/나이트/비번/연차/병가
 * /list 는 근무표 화면의 팔레트 공급원이라 인증만 요구한다. 권한을 걸면
 * 근태 담당자가 근무표를 못 짠다. (category/list 와 같은 이유)
 * 쓰기는 환경설정 권한을 유지한다.
 */
export default async function shiftTypeRoutes(app) {
  app.post("/list", async (req) => { ensureAuth(req.user); return service.list(validate(listSchema, req.body || {})); });
  app.post("/save", { preHandler: permission("permission.menu.update") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/delete", { preHandler: permission("permission.menu.update") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
