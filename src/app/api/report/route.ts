import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/pmc/common";
import { getReport, parseParams } from "@/lib/report/query";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const params = parseParams(new URL(request.url).searchParams);
    return NextResponse.json(await getReport(params));
  } catch (err) {
    return errorResponse(err);
  }
}