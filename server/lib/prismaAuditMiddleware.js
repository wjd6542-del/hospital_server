import { getAuditContext } from "./auditContext.js";

/**
 * Prisma 자동 감사 미들웨어
 *
 * 단일 액션(create/update/delete/upsert):
 *   - target_id, before_data, after_data 까지 row 단위로 기록
 *
 * 배치 액션(createMany/updateMany/deleteMany):
 *   - 기본: 영향 row 들을 사전/사후 findMany 로 스냅샷한 뒤 row 단위로 풀어 AuditLog 기록
 *   - createMany 는 args.data 배열을 그대로 풀어 after_data 기록 (auto-generated id 는 target_id null 로 둠)
 *   - 모델별 노이즈가 큰 파생 데이터(일별 통계 등)는 BATCH_SUMMARY_MODELS 로 옵트아웃 → 기존 batch 요약 메시지 유지
 *
 * AuditLog 자기 자신은 항상 제외 (재귀 방지).
 * 예외 발생 시 status=FAIL 로 단일 row 기록 후 원본 에러 재던짐.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 */

/**
 * 배치 작업이 매번 수백 row 갈아엎는 파생 데이터 모델 — row 단위 audit 가 노이즈가 됨.
 * 이 모델들은 *Many 시 기존 batch 요약 1건만 기록한다.
 */
const BATCH_SUMMARY_MODELS = new Set([
  "InboundDailyStat",
  "OutboundDailyStat",
  "ReturnDailyStat",
  "StockDailySnapshot",
]);

export function auditMiddleware(prisma) {
  prisma.$use(async (params, next) => {
    const ctx = getAuditContext();

    if (!ctx) {
      return next(params);
    }

    const { user_id, ip, user_agent, page } = ctx;

    const model = params.model;
    const action = params.action;

    if (!model) return next(params);

    // AuditLog 자기 자신 제외 (재귀 방지)
    if (model === "AuditLog") {
      return next(params);
    }

    const singleActions = ["create", "update", "delete", "upsert"];
    const manyActions = ["createMany", "updateMany", "deleteMany"];

    if (![...singleActions, ...manyActions].includes(action)) {
      return next(params);
    }

    let beforeData = null;
    let beforeRows = null; // *Many 용
    let result;
    let logAction = action.toUpperCase();

    const baseAuditFields = {
      user_id,
      page,
      target_type: model,
      ip,
      user_agent,
    };

    try {
      // ----------------------
      // BEFORE DATA
      // ----------------------
      if (action === "update" || action === "delete" || action === "upsert") {
        beforeData = await prisma[model].findUnique({
          where: params.args.where,
        });
      }

      // *Many 의 BEFORE 스냅샷 (skip 모델은 생략)
      if (
        (action === "deleteMany" || action === "updateMany") &&
        !BATCH_SUMMARY_MODELS.has(model)
      ) {
        try {
          beforeRows = await prisma[model].findMany({
            where: params.args.where ?? {},
          });
        } catch {
          beforeRows = null; // 실패 시 batch 요약 fallback
        }
      }

      // ----------------------
      // 실제 쿼리 실행
      // ----------------------
      result = await next(params);

      // ----------------------
      // UPSERT 액션 판별
      // ----------------------
      if (action === "upsert") {
        logAction = beforeData ? "UPDATE" : "CREATE";
      }

      // ----------------------
      // BATCH 액션 처리
      // ----------------------
      if (manyActions.includes(action)) {
        // skip 모델: 기존 동작(요약 1행)
        if (BATCH_SUMMARY_MODELS.has(model)) {
          await prisma.auditLog.create({
            data: {
              ...baseAuditFields,
              action: logAction,
              description: `Batch ${action} count: ${result.count}`,
              status: "SUCCESS",
            },
          });
          return result;
        }

        // row 단위 풀어서 기록
        if (action === "deleteMany") {
          const rows = beforeRows ?? [];
          if (rows.length === 0) {
            // 매칭 row 없음 — 시도 자체는 기록
            await prisma.auditLog.create({
              data: {
                ...baseAuditFields,
                action: "DELETE",
                description: `Batch deleteMany matched 0 rows`,
                status: "SUCCESS",
              },
            });
          } else {
            for (const row of rows) {
              await prisma.auditLog.create({
                data: {
                  ...baseAuditFields,
                  action: "DELETE",
                  target_id: typeof row?.id === "number" ? row.id : null,
                  before_data: row,
                  status: "SUCCESS",
                },
              });
            }
          }
          return result;
        }

        if (action === "updateMany") {
          const before = beforeRows ?? [];
          if (before.length === 0) {
            await prisma.auditLog.create({
              data: {
                ...baseAuditFields,
                action: "UPDATE",
                description: `Batch updateMany matched 0 rows`,
                status: "SUCCESS",
              },
            });
            return result;
          }

          // 사후 상태 재조회 (id 보유 row 만)
          const idsWithId = before
            .map((r) => r?.id)
            .filter((v) => typeof v === "number");
          let afterMap = new Map();
          if (idsWithId.length) {
            try {
              const afterRows = await prisma[model].findMany({
                where: { id: { in: idsWithId } },
              });
              afterMap = new Map(afterRows.map((r) => [r.id, r]));
            } catch {
              afterMap = new Map();
            }
          }

          for (const row of before) {
            const id = typeof row?.id === "number" ? row.id : null;
            await prisma.auditLog.create({
              data: {
                ...baseAuditFields,
                action: "UPDATE",
                target_id: id,
                before_data: row,
                after_data: id != null ? afterMap.get(id) ?? null : null,
                status: "SUCCESS",
              },
            });
          }
          return result;
        }

        if (action === "createMany") {
          // createMany 는 result 가 {count} 만 반환하고 생성된 id 는 알 수 없음.
          // args.data (입력) 를 그대로 row 단위 after_data 로 기록.
          const inputs = Array.isArray(params.args.data)
            ? params.args.data
            : params.args.data
              ? [params.args.data]
              : [];
          if (inputs.length === 0) {
            await prisma.auditLog.create({
              data: {
                ...baseAuditFields,
                action: "CREATE",
                description: `Batch createMany count: ${result.count}`,
                status: "SUCCESS",
              },
            });
          } else {
            for (const row of inputs) {
              await prisma.auditLog.create({
                data: {
                  ...baseAuditFields,
                  action: "CREATE",
                  target_id: null, // 자동 생성 id 미회수
                  after_data: row,
                  status: "SUCCESS",
                },
              });
            }
          }
          return result;
        }
      }

      // ----------------------
      // SINGLE 액션
      // ----------------------
      await prisma.auditLog.create({
        data: {
          ...baseAuditFields,
          action: logAction,
          target_id: result?.id ?? null,
          before_data: beforeData,
          after_data: result,
          status: "SUCCESS",
        },
      });

      return result;
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          ...baseAuditFields,
          action: logAction,
          description: err.message,
          status: "FAIL",
        },
      });

      throw err;
    }
  });
}
