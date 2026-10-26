export type UserRole = "operator" | "foreman" | "supervisor" | "ast_manager";

export const ROLE_LABEL: Record<UserRole, string> = {
  operator: "Operator",
  foreman: "Foreman",
  supervisor: "Supervisor",
  ast_manager: "Ast. Manager",
};

export function normalizeRole(raw: unknown): UserRole {
  const key = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, ""); // buang titik, spasi, underscore, strip

  if (key === "asmen" || key.endsWith("manager")) return "ast_manager";
  if (key === "supervisor" || key === "spv") return "supervisor";
  if (key === "foreman") return "foreman";
  return "operator";
}

/** Nama role untuk ditampilkan di UI. */
export function roleLabel(raw: unknown): string {
  return ROLE_LABEL[normalizeRole(raw)];
}