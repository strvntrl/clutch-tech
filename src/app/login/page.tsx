import { Suspense } from "react";
import { IBM_Plex_Sans } from "next/font/google";
import LoginForm from "./LoginForm";

export const metadata = { title: "Login | Clutch Tech" };

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export default function LoginPage() {
  return (
    <div className={plex.variable}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}