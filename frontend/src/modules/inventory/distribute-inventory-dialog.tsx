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
import { ErrorAlert } from "@/components/common/error-alert";
import { getApiErrorMessage } from "@/lib/api-error";
import { useDistributeInventoryMutation } from "./inventory-api";
import { validateQuantityAgainstAvailable } from "./inventory-validation";
import type { InventoryRecord } from "./inventory-types";

interface DistributeInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: InventoryRecord;
}

// Distribution always targets `record.id` and always draws from the
// caller's own location — there is no source-location field anywhere in
// this form, and none is sent. The backend re-derives and re-checks
// ownership independently regardless of what this dialog shows.
export function DistributeInventoryDialog({ open, onOpenChange, record }: DistributeInventoryDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  const [distributeInventory, { isLoading, error }] = useDistributeInventoryMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const validationError = validateQuantityAgainstAvailable(quantity, record.quantity);
    setFieldError(validationError);
    if (validationError) return;

    try {
      await distributeInventory({ id: record.id, input: { quantity: Number(quantity) } }).unwrap();
      onOpenChange(false);
    } catch {
      // `error` below already reflects the failure (e.g. a 400 if a
      // concurrent request already reduced the available quantity).
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Distribute inventory</DialogTitle>
          <DialogDescription>
            {record.product.name} at {record.location.name} — {record.quantity} {record.product.unit}{" "}
            available.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <ErrorAlert message={getApiErrorMessage(error)} />}

          <div className="space-y-2">
            <Label htmlFor="distribute-quantity">Quantity to distribute</Label>
            <Input
              id="distribute-quantity"
              type="number"
              min={1}
              max={record.quantity}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={Boolean(fieldError)}
              disabled={isLoading}
            />
            {fieldError && <p className="text-destructive text-sm">{fieldError}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Distributing…" : "Distribute"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
