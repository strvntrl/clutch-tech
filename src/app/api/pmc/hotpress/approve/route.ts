import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, requireUser } from "@/lib/pmc/common";
import { setApproval } from "@/lib/pmc/hotpress";

/** POST /api/pmc/hotpress/approve  body: { date, shift, level: "foreman"|"supervisor"|"ast_manager", value: boolean } */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    let body: { date?: unknown; shift?: unknown; level?: unknown; value?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Body request tidak valid");
    }
    if (typeof body.date !== "string" || typeof body.shift !== "string") {
      throw new HttpError(400, "Tanggal dan shift wajib diisi");
    }
    const approve = await setApproval(user, body.date, body.shift, body.level, body.value);
    return NextResponse.json({ status: true, approve });
  } catch (err) {
    return errorResponse(err);
  }
}