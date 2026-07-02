import { AsyncLocalStorage } from "node:async_hooks";

/**
 * 요청 단위 감사 컨텍스트 저장소 (user_id/ip/user_agent/page/method)
 * auditHook.js 에서 runAuditContext 로 바인딩, prismaAuditMiddleware 에서 getAuditContext 로 조회
 */
export const auditContext = new AsyncLocalStorage();

/**
 * 주어진 컨텍스트로 콜백을 실행 (이 콜백 내부 await 체인에서 getAuditContext 가 해당 값을 반환)
 * @param {Object} data 감사 컨텍스트
 * @param {Function} callback
 */
export function runAuditContext(data, callback) {
  return auditContext.run(data, callback);
}

/** 현재 실행 컨텍스트의 감사 정보 반환 (컨텍스트 밖이면 undefined) */
export function getAuditContext() {
  return auditContext.getStore();
}
