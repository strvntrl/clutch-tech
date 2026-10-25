import DrillingDashboard from "./DrillingDashboard";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "Drilling Dashboard | Clutch Tech",
};

export default async function DrillingPage() {
  const user = await getCurrentUser();

  return (
    <DrillingDashboard
      user={user ? { fullName: user.fullName, role: user.role } : null}
    />
  );
}