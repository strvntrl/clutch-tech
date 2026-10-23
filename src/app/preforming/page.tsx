import PreformingDashboard from "./PreformingDashboard";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "Preforming Dashboard | Clutch Tech",
};

export default async function PreformingPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PreformingDashboard />
    </>
  );
}