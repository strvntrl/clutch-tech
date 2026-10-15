import HotpressPmcForm from "./HotpressPmcForm";
import UserBar from "@/components/UserBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "PMC Hotpress | Clutch Tech",
};

export default async function HotpressPmcPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && (
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px 0" }}>
          <UserBar fullName={user.fullName} role={user.role} />
        </div>
      )}
      <HotpressPmcForm />
    </>
  );
}