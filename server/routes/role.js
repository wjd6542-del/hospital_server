import roleService from "../services/role.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
  permissionSaveSchema,
} from "../validators/role.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 역할(Role) 라우트 (/api/role/*)
 * 역할 CRUD + 역할-권한 매핑(RolePermission) 동기화
 */
export default async function roleRoutes(app) {
  /** 역할 전체 리스트 @route POST /api/role/allList */
  app.post(
    "/allList",
    { preHandler: permission("permission.user.view") },
    async (req) => {
      return roleService.getAllList(req.body);
    },
  );

  /** 역할 리스트 @route POST /api/role/list */
  app.post(
    "/list",
    { preHandler: permission("permission.user.view") },
    async (req) => {
      return roleService.getList(req.body);
    },
  );

  /** 역할 단건 조회 @route POST /api/role/:id */
  app.post(
    "/:id",
    { preHandler: permission("permission.user.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return roleService.getById(params.id);
    },
  );

  /** 역할 단건 삭제 @route POST /api/role/delete */
  app.post(
    "/delete",
    { preHandler: permission("permission.user.update") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return roleService.deleteById(params.id);
    },
  );

  /** 역할 생성/수정 @route POST /api/role/save */
  app.post(
    "/save",
    { preHandler: permission("permission.user.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return roleService.save(body);
    },
  );

  /** 역할 일괄 저장 @route POST /api/role/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("permission.user.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return roleService.batchSave(body);
    },
  );

  /** 역할 일괄 삭제 @route POST /api/role/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("permission.user.update") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return roleService.batchDelete(body);
    },
  );

  /** 역할-권한 매핑 동기화 @route POST /api/role/permissionSave */
  app.post(
    "/permissionSave",
    { preHandler: permission("permission.user.update") },
    async (req) => {
      const body = validate(permissionSaveSchema, req.body);
      return roleService.permissionSave(body);
    },
  );

  /** role 활성/비활성 토글 @route POST /api/role/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("permission.user.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return roleService.setActive(body, req.user);
    },
  );
}
