import notificationService from "../services/notification.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  idParamSchema,
  batchIdsSchema,
} from "../validators/notification.schema.js";
import { permission } from "../middleware/permission.js";

/**
 * 알림(Notification) 라우트 (/api/notification/*)
 * 사용자별 알림 조회·읽음·삭제 처리. 변경 라우트는 본인 소유 알림만 처리.
 */
export default async function notificationRoutes(app) {
  /** 알림 리스트 @route POST /api/notification/list */
  app.post(
    "/list",
    { preHandler: permission("notification.view") },
    async (req) => {
      return notificationService.getList(req.body, req.user);
    },
  );

  /** 알림 단건 읽음 처리 @route POST /api/notification/read */
  app.post(
    "/read",
    { preHandler: permission("notification.read") },
    async (req) => {
      const body = validate(idParamSchema, req.body);
      return notificationService.read(body, req.user);
    },
  );

  /** 알림 전체 읽음 처리 @route POST /api/notification/readAll */
  app.post(
    "/readAll",
    { preHandler: permission("notification.read") },
    async (req) => {
      return notificationService.readAll(req.body, req.user);
    },
  );

  /** 미읽음 알림 건수 @route POST /api/notification/count */
  app.post(
    "/count",
    { preHandler: permission("notification.view") },
    async (req) => {
      return notificationService.count(req.body, req.user);
    },
  );

  /** 알림 유형별 카운트 @route POST /api/notification/countByType */
  app.post(
    "/countByType",
    { preHandler: permission("notification.view") },
    async (req) => {
      return notificationService.countByType(req.body, req.user);
    },
  );

  /** 알림 일괄 삭제 @route POST /api/notification/batchDelete */
  app.post(
    "/batchDelete",
    { preHandler: permission("notification.delete") },
    async (req) => {
      const body = validate(batchIdsSchema, req.body);
      return notificationService.batchDelete(body, req.user);
    },
  );

  /** 알림 일괄 읽음 처리 @route POST /api/notification/batchRead */
  app.post(
    "/batchRead",
    { preHandler: permission("notification.read") },
    async (req) => {
      const body = validate(batchIdsSchema, req.body);
      return notificationService.batchRead(body, req.user);
    },
  );
}
