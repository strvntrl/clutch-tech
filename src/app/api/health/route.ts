import { NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";

/**
 * GET /api/health
 *
 * Endpoint sederhana untuk cek apakah koneksi ke Supabase berhasil
 * dan tabel master (process_stage) bisa dibaca.
 *
 * Buka di browser: http://localhost:3000/api/health
 */
export async function GET() {
  try {
    const rows = await dbSelect<{
      stage_id: number;
      stage_code: string;
      stage_name: string;
    }>(
      `SELECT stage_id, stage_code, stage_name
       FROM process_stage
       ORDER BY sequence_order`
    );

    return NextResponse.json({
      status: true,
      message: "Koneksi database berhasil",
      stages: rows,
    });
  } catch (error) {
    console.error("DB health check error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Koneksi database gagal",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
