import permissionService from "../services/permission.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/permission.schema.js";
import { permission } from "../middleware/permission.js";
import { setActiveSchema } from "../validators/setActive.schema.js";

/**
 * 권한(Permission) 라우트 (/api/permission/*)
 * 권한 코드 마스터 CRUD + 그룹별 조회
 */
export default async function permissionRoutes(app) {
  /** 권한 전체 리스트 @route POST /api/permission/allList */
  app.post(
    "/allList",
    { preHandler: permission("permission.menu.view") },
    async (req) => {
      return permissionService.getAllList(req.body);
    },
  );

  /** 권한 리스트 @route POST /api/permission/list */
  app.post(
    "/list",
    { preHandler: permission("permission.menu.view") },
    async (req) => {
      return permissionService.getList(req.body);
    },
  );

  /** 권한을 group 키 기준으로 묶어서 조회 @route POST /api/permission/keyGroup */
  app.post(
    "/keyGroup",
    { preHandler: permission("permission.menu.view") },
    async (req) => {
      return permissionService.getKeyGroup(req.body);
    },
  );

  /** 권한 단건 조회 @route GET /api/permission/:id */
  app.get(
    "/:id",
    { preHandler: permission("permission.menu.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return permissionService.getById(params.id);
    },
  );

  /** 권한 단건 삭제 @route POST /api/permission/delete */
  app.post(
    "/delete",
    { preHandler: permission("permission.menu.update") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return permissionService.deleteById(params.id);
    },
  );

  /** 권한 생성/수정 @route POST /api/permission/save */
  app.post(
    "/save",
    { preHandler: permission("permission.menu.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return permissionService.save(body);
    },
  );

  /** 권한 일괄 저장 @route POST /api/permission/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("permission.menu.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return permissionService.batchSave(body);
    },
  );

  /** 권한 일괄 삭제 @route POST /api/permission/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("permission.menu.update") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return permissionService.batchDelete(body);
    },
  );

  /** permission 활성/비활성 토글 @route POST /api/permission/setActive */
  app.post(
    "/setActive",
    { preHandler: permission("permission.menu.update") },
    async (req) => {
      const body = validate(setActiveSchema, req.body);
      return permissionService.setActive(body, req.user);
    },
  );
}
