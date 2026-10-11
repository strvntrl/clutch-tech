import "server-only";
import bcrypt from "bcryptjs";

// Hash di app_user dibuat pgcrypto (crypt + gen_salt('bf') -> "$2a$...").
// bcryptjs bisa langsung memverifikasinya.
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}