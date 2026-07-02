import commentService from "../services/comment.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, saveSchema } from "../validators/comment.schema.js";

/** 댓글 (/api/comment) */
export default async function commentRoutes(app) {
  app.post("/add", async (req) => commentService.add(validate(saveSchema, req.body), req.user));
  app.post("/delete", async (req) => { const { id } = validate(idSchema, req.body); return commentService.remove(id, req.user); });
}
