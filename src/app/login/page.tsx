import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Login | Clutch Tech" };

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}