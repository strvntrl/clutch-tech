import DrillingPmcForm from "./DrillingPmcForm";
import NavBar from "@/components/NavBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "PMC Drilling | Clutch Tech",
};

export default async function DrillingPmcPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && <NavBar fullName={user.fullName} role={user.role} />}
      <DrillingPmcForm />
    </>
  );
}