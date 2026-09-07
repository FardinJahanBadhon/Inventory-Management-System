import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AuthInitializer } from "@/modules/auth/auth-initializer";

export function App() {
  return (
    <AuthInitializer>
      <RouterProvider router={router} />
    </AuthInitializer>
  );
}
