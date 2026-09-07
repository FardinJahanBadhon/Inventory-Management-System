export interface LoginFormValues {
  username: string;
  password: string;
}

export interface LoginFormErrors {
  username?: string;
  password?: string;
}

// Usability-only validation — reject empty fields before hitting the
// network. Username format, password complexity, and every other business
// rule remain backend-authoritative (see PROJECT_RULES.md) and are
// deliberately not duplicated here.
export function validateLoginForm({ username, password }: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {};

  if (!username.trim()) {
    errors.username = "Username is required";
  }
  if (!password) {
    errors.password = "Password is required";
  }

  return errors;
}
