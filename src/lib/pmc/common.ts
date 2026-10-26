import "server-only";
import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { getCurrentUser } from "@/lib/get-current-user";
import { normalizeRole, type UserRole } from "@/lib/roles";
import type { ShiftWindow } from "@/lib/shift";
import type { PmcLevel, PmcPermissions } from "@/types/pmc";

export const PRIVILEGED_ROLES: UserRole[] = ["supervisor", "ast_manager"];

export const LEVEL_ROLE: Record<PmcLevel, UserRole> = {
  foreman: "foreman",
  supervisor: "supervisor",
  ast_manager: "ast_manager",
};

export const EDIT_TOLERANCE_SEC = 30 * 60;

export interface AuthUser {
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

/** Ubah error apa pun jadi respons JSON yang konsisten. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, ...(err.extra ?? {}) }, { status: err.status });
  }
  console.error("PMC error:", err);
  return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
}


export async function requireUser(): Promise<AuthUser> {
  const session = await getCurrentUser();
  if (!session) throw new HttpError(401, "Belum login");

  const rows = await dbSelect<{ username: string; full_name: string; role: string; is_active: boolean }>(
    `SELECT username, full_name, role, is_active FROM app_user WHERE user_id = $1`,
    [session.userId]
  );
  if (rows.length === 0 || !rows[0].is_active) throw new HttpError(403, "Akun tidak aktif");

  return {
    userId: session.userId,
    username: rows[0].username,
    fullName: rows[0].full_name,
    role: normalizeRole(rows[0].role),
  };
}

export function computePermissions(role: UserRole, win: ShiftWindow, now: number): PmcPermissions {
  const started = now >= win.startEpoch;
  const isLive = started && now < win.endEpoch;
  const privileged = PRIVILEGED_ROLES.includes(role);

  let canEdit = false;
  let reason: string | null = null;

  if (!started) {
    reason = "Shift ini belum dimulai.";
  } else if (privileged) {
    canEdit = true;
  } else if (now < win.endEpoch + EDIT_TOLERANCE_SEC) {
    canEdit = true;
  } else {
    reason =
      "Shift ini sudah berakhir. Hanya Supervisor / Ast. Manager yang dapat mengubah data shift lampau.";
  }

  const canApprove = {} as Record<PmcLevel, boolean>;
  (Object.keys(LEVEL_ROLE) as PmcLevel[]).forEach((lv) => {
    canApprove[lv] = started && role === LEVEL_ROLE[lv];
  });

  return { started, canEdit, canEditLocked: privileged && started, canApprove, isLive, reason };
}