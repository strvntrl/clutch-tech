import HotpressPmcForm from "./HotpressPmcForm";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "PMC Hotpress | Clutch Tech",
};

export default async function HotpressPmcPage() {
  const user = await getCurrentUser();

  return (
    <HotpressPmcForm
      user={user ? { fullName: user.fullName, role: user.role } : null}
    />
  );
}