import { NextRequest, NextResponse } from "next/server";
import { normalizeDate } from "@/lib/shift";
import { errorResponse, requireUser } from "@/lib/pmc/common";
import { loadIot } from "@/lib/pmc/drilling";

/** GET /api/pmc/drilling/iot?date=&shift=  -> { iot: { "DR-01": 123, ... } } (ringan, untuk polling) */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const sp = new URL(request.url).searchParams;
    const iot = await loadIot(normalizeDate(sp.get("date")), sp.get("shift") ?? "Shift-1");
    return NextResponse.json({ iot });
  } catch (err) {
    return errorResponse(err);
  }
}