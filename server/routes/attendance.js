import service from "../services/attendance.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idSchema,
  listSchema,
  saveSchema,
  bulkGenerateSchema,
  summarySchema,
} from "../validators/attendance.schema.js";
import { permission } from "../middleware/permission.js";

/** 출퇴근 (/api/attendance) — save 가 근무표와 대조해 서버에서 판정한다 */
export default async function attendanceRoutes(app) {
  app.post("/list", { preHandler: permission("attendance.view") }, async (req) => service.list(validate(listSchema, req.body)));
  app.post("/save", { preHandler: permission("attendance.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/bulkGenerate", { preHandler: permission("attendance.edit") }, async (req) => service.bulkGenerate(validate(bulkGenerateSchema, req.body)));
  app.post("/summary", { preHandler: permission("attendance.view") }, async (req) => service.summary(validate(summarySchema, req.body)));
  app.post("/delete", { preHandler: permission("attendance.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
