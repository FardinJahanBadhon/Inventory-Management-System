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
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import { useTrashInventoryMutation } from "./inventory-api";
import { validateQuantityAgainstAvailable } from "./inventory-validation";
import type { InventoryRecord } from "./inventory-types";

interface TrashInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: InventoryRecord;
}

// Two steps, reusing the same ConfirmActionDialog the Admin UI uses for
// activate/deactivate: enter a quantity, then explicitly confirm — trash
// permanently reduces available stock (PROJECT_RULES.md: the row is never
// deleted, only decremented, but that decrement itself has no undo in the
// UI). Distribution (distribute-inventory-dialog.tsx) has no equivalent
// second step; it's the routine, frequent action, not the one meant to
// give the operator pause.
export function TrashInventoryDialog({ open, onOpenChange, record }: TrashInventoryDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [trashInventory, { isLoading, error }] = useTrashInventoryMutation();

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateQuantityAgainstAvailable(quantity, record.quantity);
    setFieldError(validationError);
    if (validationError) return;

    setConfirmOpen(true);
  }

  async function handleConfirm() {
    try {
      await trashInventory({ id: record.id, input: { quantity: Number(quantity) } }).unwrap();
      setConfirmOpen(false);
      onOpenChange(false);
    } catch {
      // Drop back to the quantity step so the backend's own error (e.g. a
      // concurrent request already reduced availability) is visible next
      // to the field it concerns, not buried inside the confirm dialog.
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trash inventory</DialogTitle>
            <DialogDescription>
              {record.product.name} at {record.location.name} — {record.quantity} {record.product.unit}{" "}
              available. Use this for stock that's expired, damaged, or otherwise unusable.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleContinue} noValidate className="space-y-4">
            {error && <ErrorAlert message={getApiErrorMessage(error)} />}

            <div className="space-y-2">
              <Label htmlFor="trash-quantity">Quantity to trash</Label>
              <Input
                id="trash-quantity"
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
              <Button type="submit" variant="destructive" disabled={isLoading}>
                Continue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Trash this inventory?"
        description={`This will remove ${quantity} ${record.product.unit} of ${record.product.name} from ${record.location.name}. This cannot be undone.`}
        confirmLabel="Trash"
        destructive
        isLoading={isLoading}
        onConfirm={handleConfirm}
      />
    </>
  );
}
