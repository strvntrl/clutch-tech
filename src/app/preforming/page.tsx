import PreformingDashboard from "./PreformingDashboard";
import UserBar from "@/components/UserBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "Preforming Dashboard | Clutch Tech",
};

export default async function PreformingPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px 0" }}>
          <UserBar fullName={user.fullName} role={user.role} />
        </div>
      )}
      <PreformingDashboard />
    </>
  );
}