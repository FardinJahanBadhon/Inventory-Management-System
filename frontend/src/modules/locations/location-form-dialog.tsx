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
import { LOCATION_CATEGORIES, type LocationCategory } from "@/types/location-category";
import { useCreateLocationMutation, useUpdateLocationMutation } from "./location-api";
import { validateLocationForm, type LocationFormErrors } from "./location-validation";
import type { Location } from "./location-types";

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: Location;
}

// One dialog handles both create and edit — `location` present means edit.
// The Administration Office (category === ADMINISTRATION on an existing
// row) has its category/active-status locked in the UI because the
// backend rejects changing either (see PROJECT_RULES.md); a pure rename
// stays available.
export function LocationFormDialog({ open, onOpenChange, location }: LocationFormDialogProps) {
  const isEditMode = Boolean(location);
  const isAdministrationOffice = location?.category === "ADMINISTRATION";

  // Initial values only — this component is remounted (via a `key` at the
  // call site, see locations-page.tsx) every time it opens, so there is no
  // stale state to reset with an effect.
  const [name, setName] = useState(location?.name ?? "");
  const [category, setCategory] = useState<LocationCategory | "">(location?.category ?? "");
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [fieldErrors, setFieldErrors] = useState<LocationFormErrors>({});

  const [createLocation, { isLoading: isCreating, error: createError }] = useCreateLocationMutation();
  const [updateLocation, { isLoading: isUpdating, error: updateError }] = useUpdateLocationMutation();
  const isSubmitting = isCreating || isUpdating;
  const error = createError ?? updateError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateLocationForm({ name, category });
    setFieldErrors(errors);
    if (errors.name || errors.category) return;

    try {
      if (isEditMode && location) {
        await updateLocation({
          id: location.id,
          input: { name, category: category as LocationCategory, isActive },
        }).unwrap();
      } else {
        await createLocation({ name, category: category as LocationCategory, isActive }).unwrap();
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
          <DialogTitle>{isEditMode ? "Edit location" : "New location"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update this location's details."
              : "Locations are never deleted — deactivate one instead if it's no longer used."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <ErrorAlert message={getApiErrorMessage(error)} />}

          <div className="space-y-2">
            <Label htmlFor="location-name">Name</Label>
            <Input
              id="location-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={isSubmitting}
            />
            {fieldErrors.name && <p className="text-destructive text-sm">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as LocationCategory)}
              disabled={isSubmitting || isAdministrationOffice}
            >
              <SelectTrigger id="location-category" aria-invalid={Boolean(fieldErrors.category)}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {LOCATION_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.category && <p className="text-destructive text-sm">{fieldErrors.category}</p>}
            {isAdministrationOffice && (
              <p className="text-muted-foreground text-sm">
                The Administration Office's category cannot be changed.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="location-isActive"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={isSubmitting || isAdministrationOffice}
              className="border-input size-4 rounded"
            />
            <Label htmlFor="location-isActive">Active</Label>
          </div>
          {isAdministrationOffice && (
            <p className="text-muted-foreground -mt-2 text-sm">
              The Administration Office cannot be deactivated.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEditMode ? "Save changes" : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
