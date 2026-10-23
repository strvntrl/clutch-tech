import HotpressDashboard from "./HotpressDashboard";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "Hotpress Dashboard | Clutch Tech",
};

export default async function HotpressPage() {
  const user = await getCurrentUser();

  return (
    <>
      <HotpressDashboard />
    </>
  );
}