import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/pmc/common";
import { searchParts } from "@/lib/pmc/drilling";

/** GET /api/pmc/parts?q=CD-1  -> { parts: [{ part_number, customer, product_type }] } (dipakai form PMC mana pun) */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({ parts: await searchParts(q) });
  } catch (err) {
    return errorResponse(err);
  }
}