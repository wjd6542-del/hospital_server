import settingsService from "../services/settings.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  saveSchema,
  batchSaveSchema,
  batchDeleteSchema,
} from "../validators/settings.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 시스템 설정(Settings) 라우트 (/api/settings/*)
 * key/value 형태의 동적 설정 및 공통코드(Category) 제공
 */
export default async function settingsRoutes(app) {
  /** 설정 전체 리스트 @route POST /api/settings/allList */
  app.post(
    "/allList",
    { preHandler: permission("setting.view") },
    async (req) => {
      return settingsService.getAllList(req.body);
    },
  );

  /** 설정 리스트 @route POST /api/settings/list */
  app.post(
    "/list",
    { preHandler: permission("setting.view") },
    async (req) => {
      return settingsService.getList(req.body);
    },
  );

  /** key 기준 그룹핑 @route POST /api/settings/keyGroup */
  app.post(
    "/keyGroup",
    { preHandler: permission("setting.view") },
    async (req) => {
      return settingsService.getKeyGroup(req.body);
    },
  );

  /** 등급/종류 리스트 @route POST /api/settings/getGradeList */
  app.post(
    "/getGradeList",
    { preHandler: permission("setting.view") },
    async () => {
      const keys = ["climb_type", "environment_type", "rock_type"];

      const results = await Promise.all(
        keys.map((key) =>
          settingsService.getViewList({ key }).then((data) => [key, data]),
        ),
      );

      return Object.fromEntries(results);
    },
  );

  /** 설정 단건 조회 @route GET /api/settings/:id */
  app.get(
    "/:id",
    { preHandler: permission("setting.view") },
    async (req) => {
      const params = validate(idParamSchema, req.params);
      return settingsService.getById(params.id);
    },
  );

  /** 설정 단건 삭제 @route POST /api/settings/delete */
  app.post(
    "/delete",
    { preHandler: permission("setting.update") },
    async (req) => {
      const params = validate(idParamSchema, req.body);
      return settingsService.deleteById(params.id);
    },
  );

  /** 설정 생성/수정 @route POST /api/settings/save */
  app.post(
    "/save",
    { preHandler: permission("setting.update") },
    async (req) => {
      const body = validate(saveSchema, req.body);
      return settingsService.save(body);
    },
  );

  /** 설정 일괄 저장 @route POST /api/settings/batchSave */
  app.post(
    "/batchSave",
    { preHandler: permission("setting.update") },
    async (req) => {
      const body = validate(batchSaveSchema, req.body);
      return settingsService.batchSave(body);
    },
  );

  /** 설정 일괄 삭제 @route POST /api/settings/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("setting.update") },
    async (req) => {
      const body = validate(batchDeleteSchema, req.body);
      return settingsService.batchDelete(body);
    },
  );
}
