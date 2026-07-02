/**
 * 페이지네이션 파라미터 정규화 유틸.
 *
 * 모든 *PageList 서비스 함수가 동일한 page/limit 파싱 규칙을 쓰도록 통일.
 * - page: 1 미만 또는 NaN 이면 1
 * - limit: 1 미만 또는 NaN 이면 defaultLimit, maxLimit 초과 시 maxLimit 으로 캡
 *
 * @param {object} data 요청 본문
 * @param {object} [opts]
 * @param {number} [opts.defaultLimit=20]
 * @param {number} [opts.maxLimit=100]
 * @returns {{page:number, limit:number, skip:number}}
 */
export function parsePage(data, opts = {}) {
  const defaultLimit = opts.defaultLimit ?? 20;
  const maxLimit = opts.maxLimit ?? 100;

  const page = Math.max(1, Number(data?.page) || 1);
  const limit = Math.max(
    1,
    Math.min(Number(data?.limit) || defaultLimit, maxLimit),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * findMany 결과와 count 를 페이지네이션 응답 형태로 감싼다.
 * @param {{rows:any[], total:number, page:number, limit:number}} args
 * @returns {{rows:any[], total:number, page:number, limit:number, totalPages:number}}
 */
export function buildPageResult({ rows, total, page, limit }) {
  return {
    rows,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}
