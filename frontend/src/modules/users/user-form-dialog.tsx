import { useState, type FormEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorAlert } from "@/components/common/error-alert";
import { getApiErrorMessage } from "@/lib/api-error";
import { useGetLocationsQuery } from "@/modules/locations/location-api";
import { useCreateUserMutation, useUpdateUserMutation } from "./user-api";
import { validateUserForm, type UserFormErrors } from "./user-validation";
import type { User } from "./user-types";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
}

// One dialog for create and edit. Location is a picker, not free text —
// the admin assigns a location, and the backend alone derives the user's
// effective category from it (see PROJECT_RULES.md); there is no
// role/category field anywhere in this form.
export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEditMode = Boolean(user);

  // Initial values only — this component is remounted (via a `key` at the
  // call site, see users-page.tsx) every time it opens, so there is no
  // stale state to reset with an effect.
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [locationId, setLocationId] = useState(user?.locationId ?? "");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const [fieldErrors, setFieldErrors] = useState<UserFormErrors>({});

  // pageSize: 100 (the API's max) rather than a dedicated "list all"
  // endpoint — there is no such endpoint, and the source requirements
  // don't call for one just for this picker.
  const { data: locationsData, isLoading: isLoadingLocations } = useGetLocationsQuery({ pageSize: 100 });
  const [createUser, { isLoading: isCreating, error: createError }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating, error: updateError }] = useUpdateUserMutation();
  const isSubmitting = isCreating || isUpdating;
  const error = createError ?? updateError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateUserForm({ name, username, password, locationId }, !isEditMode);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (isEditMode && user) {
        await updateUser({
          id: user.id,
          input: {
            name,
            username,
            locationId,
            isActive,
            ...(password ? { password } : {}),
          },
        }).unwrap();
      } else {
        await createUser({ name, username, password, locationId, isActive }).unwrap();
      }
      onOpenChange(false);
    } catch {
      // `error` above already reflects the failure.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit user" : "New user"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update this user's details. Leave password blank to keep it unchanged."
              : "The assigned location determines this user's permissions — there is no separate role field."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <ErrorAlert message={getApiErrorMessage(error)} />}

          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={isSubmitting}
            />
            {fieldErrors.name && <p className="text-destructive text-sm">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-username">Username</Label>
            <Input
              id="user-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={Boolean(fieldErrors.username)}
              disabled={isSubmitting}
              autoComplete="off"
            />
            {fieldErrors.username && <p className="text-destructive text-sm">{fieldErrors.username}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">{isEditMode ? "New password (optional)" : "Password"}</Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            {fieldErrors.password && <p className="text-destructive text-sm">{fieldErrors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-location">Location</Label>
            <Select value={locationId} onValueChange={setLocationId} disabled={isSubmitting || isLoadingLocations}>
              <SelectTrigger id="user-location" aria-invalid={Boolean(fieldErrors.locationId)}>
                <SelectValue placeholder={isLoadingLocations ? "Loading locations…" : "Select a location"} />
              </SelectTrigger>
              <SelectContent>
                {locationsData?.items.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} ({location.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.locationId && <p className="text-destructive text-sm">{fieldErrors.locationId}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="user-isActive"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSubmitting}
              className="border-input size-4 rounded"
            />
            <Label htmlFor="user-isActive">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEditMode ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
