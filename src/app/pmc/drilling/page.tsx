import DrillingPmcForm from "./DrillingPmcForm";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "PMC Drilling | Clutch Tech",
};

export default async function DrillingPmcPage() {
  const user = await getCurrentUser();

  return (
    <DrillingPmcForm
      user={user ? { fullName: user.fullName, role: user.role } : null}
    />
  );
}