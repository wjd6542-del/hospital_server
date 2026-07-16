import service from "../services/stats.service.js";
import { permission } from "../middleware/permission.js";

/** 통계 대시보드 (/api/stats) — 전 도메인 KPI 집계 */
export default async function statsRoutes(app) {
  app.post("/overview", { preHandler: permission("stats.view") }, async () => service.overview());
}
