import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

const MAX_TREE_DEPTH = 100;

/** 부서 코드 자동 생성 — DEPT-0001 형태. 트리 인라인 추가에서 code 없이 만들 때 사용. */
async function nextCode() {
  const last = await prisma.department.findFirst({
    where: { code: { startsWith: "DEPT-" } },
    orderBy: { id: "desc" },
    select: { code: true },
  });
  const n = last ? (parseInt(last.code.replace("DEPT-", ""), 10) || 0) + 1 : 1;
  return `DEPT-${String(n).padStart(4, "0")}`;
}

/**
 * parent_id 가 자기 자신이거나 자기 후손이면 던진다 (조상 체인을 거슬러 올라가며 검사)
 * @param {import("@prisma/client").PrismaClient | Prisma.TransactionClient} db - 트랜잭션 안에서 호출할 때는 tx 를 넘긴다
 * visited Set + depth 상한(100) — DB에 이미 순환이 있는 상태로 이 함수가 불려도 무한 루프에 빠지지 않는다.
 */
async function assertNoCycle(db, id, parentId) {
  if (!parentId) return;
  if (parentId === id) {
    throw new AppError("자기 자신을 상위 부서로 지정할 수 없습니다.", 400, "INVALID_PARENT");
  }
  if (!id) return;

  const visited = new Set();
  let depth = 0;
  let cur = await db.department.findUnique({
    where: { id: parentId },
    select: { parent_id: true },
  });
  while (cur?.parent_id) {
    if (cur.parent_id === id) {
      throw new AppError("하위 부서를 상위 부서로 지정할 수 없습니다.", 400, "CYCLE");
    }
    if (visited.has(cur.parent_id) || depth >= MAX_TREE_DEPTH) {
      throw new AppError(
        "부서 계층에 순환이 있습니다. 관리자에게 문의하세요.",
        500,
        "TREE_CORRUPTED",
      );
    }
    visited.add(cur.parent_id);
    depth++;
    cur = await db.department.findUnique({
      where: { id: cur.parent_id },
      select: { parent_id: true },
    });
  }
}

export default {
  async list({ q, is_active, page, limit } = {}) {
    const where = {};
    if (typeof is_active === "boolean") where.is_active = is_active;
    if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }];
    const { page: p, limit: l, skip } = parsePage({ page, limit });
    const [rows, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy: [{ sort: "asc" }, { id: "asc" }],
        skip,
        take: l,
        include: { type: true, head_employee: { select: { id: true, name: true, emp_no: true } } },
      }),
      prisma.department.count({ where }),
    ]);
    return buildPageResult({ rows, total, page: p, limit: l });
  },

  /** 계층 트리 (EntityTree 용) */
  async tree() {
    const rows = await prisma.department.findMany({
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, parent_id: true, is_active: true },
    });
    const byId = new Map();
    rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
    const roots = [];
    for (const node of byId.values()) {
      if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).children.push(node);
      else roots.push(node);
    }
    return roots;
  },

  /** 셀렉트박스용 — 계층 순서대로 평탄화하고 depth 를 붙인다 */
  async options() {
    const rows = await prisma.department.findMany({
      where: { is_active: true },
      orderBy: [{ sort: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, parent_id: true },
    });
    const kids = new Map();
    rows.forEach((r) => {
      const k = r.parent_id ?? 0;
      if (!kids.has(k)) kids.set(k, []);
      kids.get(k).push(r);
    });
    const out = [];
    const walk = (parentId, depth) => {
      for (const r of kids.get(parentId) ?? []) {
        out.push({ id: r.id, name: r.name, code: r.code, depth });
        walk(r.id, depth + 1);
      }
    };
    walk(0, 0);
    return out;
  },

  async get(id) {
    const d = await prisma.department.findUnique({
      where: { id },
      include: { type: true, head_employee: { select: { id: true, name: true, emp_no: true } } },
    });
    if (!d) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");
    return d;
  },

  async save(data) {
    const { id, ...fields } = data;
    await assertNoCycle(prisma, id, fields.parent_id ?? null);

    if (fields.code) {
      const dup = await prisma.department.findFirst({
        where: { code: fields.code, ...(id ? { id: { not: id } } : {}) },
      });
      if (dup) throw new AppError("이미 존재하는 부서 코드입니다.", 400, "DUPLICATE");
    }

    if (id) {
      const ex = await prisma.department.findUnique({ where: { id } });
      if (!ex) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");
      return prisma.department.update({ where: { id }, data: fields });
    }
    return prisma.department.create({
      data: { ...fields, code: fields.code || (await nextCode()) },
    });
  },

  /**
   * 드래그로 계층·순서 변경.
   * 순환 검사 + parent_id 갱신 + sort 재번호를 하나의 트랜잭션으로 묶어 원자적으로 처리한다.
   * Serializable 격리 수준을 써서, 두 부서를 동시에 서로의 하위로 옮기는 요청(A→parent=B, B→parent=A)이
   * 동시에 들어와도 한쪽이 직렬화 충돌로 실패하고 DB에 순환이 남지 않게 한다.
   */
  async reorder({ id, parent_id, before_id }) {
    const pid = parent_id ?? null;

    return prisma.$transaction(
      async (tx) => {
        const self = await tx.department.findUnique({ where: { id }, select: { id: true } });
        if (!self) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");

        await assertNoCycle(tx, id, pid);

        await tx.department.update({ where: { id }, data: { parent_id: pid } });

        const sibs = await tx.department.findMany({
          where: { parent_id: pid, id: { not: id } },
          orderBy: [{ sort: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        const orderIds = [];
        let inserted = false;
        for (const s of sibs) {
          if (before_id && s.id === before_id) {
            orderIds.push(id);
            inserted = true;
          }
          orderIds.push(s.id);
        }
        if (!inserted) orderIds.push(id);

        for (let i = 0; i < orderIds.length; i++) {
          await tx.department.update({ where: { id: orderIds[i] }, data: { sort: i } });
        }

        return { ok: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async remove(id) {
    const ex = await prisma.department.findUnique({ where: { id } });
    if (!ex) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const kids = await prisma.department.count({ where: { parent_id: id } });
    if (kids > 0) {
      throw new AppError("하위 부서가 있어 삭제할 수 없습니다.", 400, "HAS_CHILDREN");
    }
    const emps = await prisma.employee.count({ where: { department_id: id } });
    if (emps > 0) {
      throw new AppError(
        `소속 직원이 ${emps}명 있어 삭제할 수 없습니다. 비활성 처리하세요.`,
        400,
        "IN_USE",
      );
    }

    await prisma.department.delete({ where: { id } });
    return { ok: true };
  },
};
