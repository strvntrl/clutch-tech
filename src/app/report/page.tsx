import ReportView from "./ReportView";
import NavBar from "@/components/NavBar";
import { getCurrentUser } from "@/lib/get-current-user";

export const metadata = {
  title: "Laporan Produksi | Clutch Tech",
};

export default async function ReportPage() {
  const user = await getCurrentUser();

  return (
    <>
      {user && <NavBar fullName={user.fullName} role={user.role} />}
      <ReportView />
    </>
  );
}