import HotpressPmcForm from "./HotpressPmcForm";
import NavBar from "@/components/NavBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "PMC Hotpress | Clutch Tech",
};

export default async function HotpressPmcPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && <NavBar fullName={user.fullName} role={user.role} />}
      <HotpressPmcForm />
    </>
  );
}