import { NextRequest, NextResponse } from "next/server";
import { dbSelect } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/session";
import { normalizeRole } from "@/lib/roles";

interface UserRow {
  user_id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: false, error: "Body request tidak valid" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { status: false, error: "Username dan password wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const rows = await dbSelect<UserRow>(
      `SELECT user_id, username, password_hash, full_name, role, is_active
       FROM app_user WHERE username = $1 LIMIT 1`,
      [username]
    );

    // Pesan sama untuk "user tidak ada" dan "password salah" (cegah user enumeration)
    const genericError = "Username atau password salah";

    if (rows.length === 0) {
      return NextResponse.json({ status: false, error: genericError }, { status: 401 });
    }
    const user = rows[0];

    if (!user.is_active) {
      return NextResponse.json({ status: false, error: "Akun ini sudah dinonaktifkan" }, { status: 403 });
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ status: false, error: genericError }, { status: 401 });
    }

    const role = normalizeRole(user.role);

    const token = await signSessionToken({
      userId: user.user_id,
      username: user.username,
      fullName: user.full_name,
      role,
    });

    const res = NextResponse.json({
      status: true,
      user: { username: user.username, fullName: user.full_name, role },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ status: false, error: "Terjadi kesalahan server" }, { status: 500 });
  }
}