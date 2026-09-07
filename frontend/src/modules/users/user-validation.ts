export interface UserFormValues {
  name: string;
  username: string;
  password: string;
  locationId: string;
}

export interface UserFormErrors {
  name?: string;
  username?: string;
  password?: string;
  locationId?: string;
}

// Usability-only validation, mirroring the backend's own field-presence
// rules (see user-schema.ts) without duplicating its business logic
// (uniqueness, format regex) — those errors surface from the API response
// instead. `isCreate` controls whether password is required, since it's
// optional on update (omitting it leaves the existing one unchanged).
export function validateUserForm(
  { name, username, password, locationId }: UserFormValues,
  isCreate: boolean,
): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!name.trim()) {
    errors.name = "Name is required";
  }
  if (!username.trim()) {
    errors.username = "Username is required";
  }
  if (isCreate && !password) {
    errors.password = "Password is required";
  }
  if (!locationId) {
    errors.locationId = "Location is required";
  }

  return errors;
}
