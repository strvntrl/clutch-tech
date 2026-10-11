export const MACHINE_COLORS = ["#1976d2", "#2e7d32", "#f57c00", "#7b1fa2", "#00838f", "#c2185b"];
export const TARGET_COLOR = "#d32f2f";

export function colorFor(machines: string[], mc: string): string {
  const idx = machines.indexOf(mc);
  return MACHINE_COLORS[(idx < 0 ? 0 : idx) % MACHINE_COLORS.length];
} 