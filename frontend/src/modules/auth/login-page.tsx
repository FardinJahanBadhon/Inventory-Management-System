import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/common/error-alert";
import { useAppDispatch } from "@/hooks/redux-hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import { ROUTES } from "@/routes/paths";
import { useLoginMutation } from "./auth-api";
import { setAuthenticatedUser } from "./auth-slice";
import { setStoredAccessToken } from "./auth-storage";
import { validateLoginForm, type LoginFormErrors } from "./auth-validation";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const errors = validateLoginForm({ username, password });
    setFieldErrors(errors);
    if (errors.username || errors.password) return;

    try {
      // The login response's `user` is the same server-authoritative
      // SafeUserProfile shape GET /api/auth/me returns — there is no
      // client-constructed identity/location here, so a redundant
      // follow-up /me call right after login would only add latency.
      const result = await login({ username, password }).unwrap();
      setStoredAccessToken(result.accessToken);
      dispatch(setAuthenticatedUser(result.user));
      // ADMINISTRATION and the four operational categories land on
      // different dashboards (see app/router.tsx) — sending everyone to
      // the Admin one would bounce operational users straight to
      // /unauthorized after a successful login.
      navigate(
        result.user.location.category === "ADMINISTRATION" ? ROUTES.dashboard : ROUTES.operationsDashboard,
        { replace: true },
      );
    } catch {
      // `error` from useLoginMutation already reflects the failure below.
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Inventory Management System</CardTitle>
          <CardDescription>Sign in with your assigned username and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && <ErrorAlert message={getApiErrorMessage(error)} />}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? "username-error" : undefined}
                disabled={isLoading}
              />
              {fieldErrors.username && (
                <p id="username-error" className="text-destructive text-sm">
                  {fieldErrors.username}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                disabled={isLoading}
              />
              {fieldErrors.password && (
                <p id="password-error" className="text-destructive text-sm">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
