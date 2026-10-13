import { NextRequest, NextResponse } from "next/server";
import { normalizeDate } from "@/lib/shift";
import { errorResponse, HttpError, requireUser } from "@/lib/pmc/common";
import { loadForm, saveRows } from "@/lib/pmc/drilling";

/** GET /api/pmc/drilling?date=YYYY-MM-DD&shift=Shift-1  -> data form + hak akses pengguna */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const sp = new URL(request.url).searchParams;
    const form = await loadForm(user, normalizeDate(sp.get("date")), sp.get("shift") ?? "Shift-1");
    return NextResponse.json(form);
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/pmc/drilling  body: { date, shift, rows: PmcSaveRow[] } */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    let body: { date?: unknown; shift?: unknown; rows?: unknown };
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Body request tidak valid");
    }
    if (typeof body.date !== "string" || typeof body.shift !== "string") {
      throw new HttpError(400, "Tanggal dan shift wajib diisi");
    }
    await saveRows(user, body.date, body.shift, body.rows);
    return NextResponse.json({ status: true });
  } catch (err) {
    return errorResponse(err);
  }
}