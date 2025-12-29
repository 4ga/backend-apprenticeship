import crypto from "node:crypto";
import { getDb } from "./db";

type Role = "user" | "admin";
export const AUDIT_ACTIONS = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAIL",
  "AUTH_REFRESH",
  "AUTH_LOGOUT",
  "AUTH_LOGOUT_ALL",
  "ADMIN_LIST_USERS",
  "ADMIN_VIEW_USER_TODOS",
  "ADMIN_SET_USER_ROLE",
  "ADMIN_DELETE_USER",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLog = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: Role;
  action: AuditAction;
  targetUserId: string | null;
  targetTodoId: string | null;
  ip: string | null;
  userAgent: string | null;
  meta: unknown;
};

function rowToAudit(row: any): AuditLog {
  const actorRole: Role = row.actorRole === "admin" ? "admin" : "user";
  const action: AuditAction = (AUDIT_ACTIONS as readonly string[]).includes(
    String(row.action)
  )
    ? (row.action as AuditAction)
    : "AUTH_LOGIN_FAIL";

  let meta: unknown = null;
  try {
    meta = row.metaJson ? JSON.parse(row.metaJson) : null;
  } catch {
    meta = null;
  }

  return {
    id: row.id,
    createdAt: row.createdAt,
    actorUserId: row.actorUserId ?? null,
    actorEmail: row.actorEmail ?? null,
    actorRole,
    action,
    targetUserId: row.targetUserId ?? null,
    targetTodoId: row.targetTodoId ?? null,
    ip: row.ip ?? null,
    userAgent: row.userAgent ?? null,
    meta,
  };
}

export async function writeAuditLog(input: {
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: "user" | "admin";
  action: AuditAction;
  targetUserId?: string | null;
  targetTodoId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: unknown;
}): Promise<void> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const metaJson = JSON.stringify(input.meta ?? null);

  await db.run(
    `INSERT INTO audit_logs (
    id, createdAt,
    actorUserId, actorEmail, actorRole,
    action, targetUserId, targetTodoId,
    ip, userAgent,
    metaJson
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    id,
    createdAt,
    input.actorUserId,
    input.actorEmail,
    input.actorRole,
    input.action,
    input.targetUserId ?? null,
    input.targetTodoId ?? null,
    input.ip ?? null,
    input.userAgent ?? null,
    metaJson
  );
}

export async function listAuditLogs(opts: {
  action?: AuditAction;
  actorUserId?: string;
  targetUserId?: string;
  limit: number;
  offset: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const db = await getDb();

  const whereParts: string[] = [];
  const params: any[] = [];

  if (opts.action) {
    whereParts.push("action = ?");
    params.push(opts.action);
  }

  if (opts.actorUserId) {
    whereParts.push("actorUserId = ?");
    params.push(opts.actorUserId.trim());
  }

  if (opts.targetUserId) {
    whereParts.push("targetUserId = ?");
    params.push(opts.targetUserId.trim());
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const totalRow = await db.get<{ total: number }>(
    `SELECT COUNT(*) as total FROM audit_logs ${where};`,
    ...params
  );

  const rows = await db.all<any[]>(
    `SELECT
      id, createdAt, actorUserId, actorEmail, actorRole,
      action, targetUserId, targetTodoId, ip, userAgent, metaJson
     FROM audit_logs
     ${where}
     ORDER BY createdAt DESC
     LIMIT ? OFFSET ?;
     `,
    ...params,
    opts.limit,
    opts.offset
  );
  return {
    logs: rows.map(rowToAudit),
    total: totalRow?.total ?? 0,
  };
}
