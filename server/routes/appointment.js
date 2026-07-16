import service from "../services/appointment.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema, setStatusSchema } from "../validators/appointment.schema.js";
import { permission } from "../middleware/permission.js";

/** 진료 예약 (/api/appointment) */
export default async function appointmentRoutes(app) {
  app.post("/list", { preHandler: permission("reservation.view") }, async (req) => service.list(validate(listSchema, req.body || {})));
  app.post("/save", { preHandler: permission("reservation.edit") }, async (req) => service.save(validate(saveSchema, req.body)));
  app.post("/setStatus", { preHandler: permission("reservation.edit") }, async (req) => service.setStatus(validate(setStatusSchema, req.body)));
  app.post("/delete", { preHandler: permission("reservation.edit") }, async (req) => { const { id } = validate(idSchema, req.body); return service.remove(id); });
}
