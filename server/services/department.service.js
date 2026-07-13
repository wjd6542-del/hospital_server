import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { parsePage, buildPageResult } from "../utils/pagination.js";

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

/** parent_id 가 자기 자신이거나 자기 후손이면 던진다 (조상 체인을 거슬러 올라가며 검사) */
async function assertNoCycle(id, parentId) {
  if (!parentId) return;
  if (parentId === id) {
    throw new AppError("자기 자신을 상위 부서로 지정할 수 없습니다.", 400, "INVALID_PARENT");
  }
  if (!id) return;
  let cur = await prisma.department.findUnique({
    where: { id: parentId },
    select: { parent_id: true },
  });
  while (cur?.parent_id) {
    if (cur.parent_id === id) {
      throw new AppError("하위 부서를 상위 부서로 지정할 수 없습니다.", 400, "CYCLE");
    }
    cur = await prisma.department.findUnique({
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
    await assertNoCycle(id, fields.parent_id ?? null);

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

  /** 드래그로 계층·순서 변경 */
  async reorder({ id, parent_id, before_id }) {
    const self = await prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!self) throw new AppError("부서를 찾을 수 없습니다.", 404, "NOT_FOUND");

    const pid = parent_id ?? null;
    await assertNoCycle(id, pid);

    await prisma.department.update({ where: { id }, data: { parent_id: pid } });

    const sibs = await prisma.department.findMany({
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

    await prisma.$transaction(
      orderIds.map((sid, i) => prisma.department.update({ where: { id: sid }, data: { sort: i } })),
    );
    return { ok: true };
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
