import postService from "../services/post.service.js";
import { validate } from "../plugins/validator.plugin.js";
import { idSchema, listSchema, saveSchema } from "../validators/post.schema.js";

/** 게시글 (/api/post) */
export default async function postRoutes(app) {
  app.post("/list", async (req) => postService.list(validate(listSchema, req.body)));
  app.post("/get", async (req) => { const { id } = validate(idSchema, req.body); return postService.get(id); });
  app.post("/save", async (req) => postService.save(validate(saveSchema, req.body), req.user));
  app.post("/delete", async (req) => { const { id } = validate(idSchema, req.body); return postService.remove(id, req.user); });
}
