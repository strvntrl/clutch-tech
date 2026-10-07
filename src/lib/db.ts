import { Pool, type QueryResultRow } from "pg";

/**
 * Helper koneksi database, setara dengan database.php + db_select()
 * di versi PHP lama.
 *
 * - Memakai DATABASE_URL dari environment variable (Supabase pooler).
 * - Pool di-simpan di `globalThis` supaya saat `next dev` hot-reload,
 *   tidak membuat koneksi baru berulang-ulang (connection leak).
 * - Zona waktu di-set ke Asia/Jakarta per koneksi, sama seperti
 *   `$pdo->exec("SET TIME ZONE 'Asia/Jakarta'")` di database.php lama.
 */

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL belum di-set. Cek file .env.local (lokal) atau " +
        "Environment Variables di Vercel (production)."
    );
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });

  pool.on("connect", (client) => {
    client.query("SET TIME ZONE 'Asia/Jakarta'").catch((err) => {
      console.error("Gagal set timezone koneksi:", err);
    });
  });

  pool.on("error", (err) => {
    console.error("Unexpected error pada idle client pg pool:", err);
  });

  return pool;
}

const pool = globalThis._pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalThis._pgPool = pool;
}

/**
 * Setara db_select() di PHP: SELECT yang mengembalikan banyak baris.
 *
 * Contoh:
 *   const rows = await dbSelect<{ machine_id: number; machine_code: string }>(
 *     `SELECT machine_id, machine_code FROM machine WHERE stage_id = $1`,
 *     [stageId]
 *   );
 */
export async function dbSelect<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

/**
 * Setara db_execute() di PHP: INSERT/UPDATE/DELETE.
 * Mengembalikan jumlah baris yang terdampak (rowCount).
 */
export async function dbExecute(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const result = await pool.query(sql, params);
  return result.rowCount ?? 0;
}

export default pool;
