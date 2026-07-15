import service from "../services/shiftSchedule.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  gridSchema,
  saveCellSchema,
  saveBulkSchema,
  copyMonthSchema,
  deleteCellSchema,
} from "../validators/shiftSchedule.schema.js";
import { permission } from "../middleware/permission.js";

/** 근무표 (/api/shiftSchedule) — 직원 × 날짜 그리드 */
export default async function shiftScheduleRoutes(app) {
  app.post("/grid", { preHandler: permission("attendance.view") }, async (req) => service.grid(validate(gridSchema, req.body)));
  app.post("/saveCell", { preHandler: permission("attendance.edit") }, async (req) => service.saveCell(validate(saveCellSchema, req.body)));
  app.post("/saveBulk", { preHandler: permission("attendance.edit") }, async (req) => service.saveBulk(validate(saveBulkSchema, req.body)));
  app.post("/copyMonth", { preHandler: permission("attendance.edit") }, async (req) => service.copyMonth(validate(copyMonthSchema, req.body)));
  app.post("/deleteCell", { preHandler: permission("attendance.edit") }, async (req) => service.removeCell(validate(deleteCellSchema, req.body)));
}
