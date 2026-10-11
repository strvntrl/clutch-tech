import DrillingDashboard from "./DrillingDashboard";
import UserBar from "@/components/UserBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "Drilling Dashboard | Clutch Tech",
};

export default async function DrillingPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px 0" }}>
          <UserBar fullName={user.fullName} role={user.role} />
        </div>
      )}
      <DrillingDashboard />
    </>
  );
}