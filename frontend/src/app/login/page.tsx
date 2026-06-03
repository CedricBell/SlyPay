import { Suspense } from "react";
import { LoginForm, LoginFormFallback } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
