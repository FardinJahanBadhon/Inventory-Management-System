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
import { useCreateProductMutation, useUpdateProductMutation } from "./product-api";
import { validateProductForm, type ProductFormErrors } from "./product-validation";
import type { Product } from "./product-types";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
}

// One dialog for create and edit. `isActive` only appears in edit mode —
// POST /api/products doesn't accept it at all; every new product starts
// active (see PROJECT_RULES.md).
export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  const isEditMode = Boolean(product);

  // Initial values only — this component is remounted (via a `key` at the
  // call site, see products-page.tsx) every time it opens, so there is no
  // stale state to reset with an effect.
  const [code, setCode] = useState(product?.code ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [fieldErrors, setFieldErrors] = useState<ProductFormErrors>({});

  const [createProduct, { isLoading: isCreating, error: createError }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating, error: updateError }] = useUpdateProductMutation();
  const isSubmitting = isCreating || isUpdating;
  const error = createError ?? updateError;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateProductForm({ code, name, unit });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (isEditMode && product) {
        await updateProduct({ id: product.id, input: { code, name, unit, isActive } }).unwrap();
      } else {
        await createProduct({ code, name, unit }).unwrap();
      }
      onOpenChange(false);
    } catch {
      // `error` above already reflects the failure (e.g. a 409 for a
      // duplicate code).
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update this product's details."
              : "New products always start active — deactivate afterward if needed."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <ErrorAlert message={getApiErrorMessage(error)} />}

          <div className="space-y-2">
            <Label htmlFor="product-code">Code</Label>
            <Input
              id="product-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-invalid={Boolean(fieldErrors.code)}
              disabled={isSubmitting}
            />
            {fieldErrors.code && <p className="text-destructive text-sm">{fieldErrors.code}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={isSubmitting}
            />
            {fieldErrors.name && <p className="text-destructive text-sm">{fieldErrors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-unit">Unit</Label>
            <Input
              id="product-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="e.g. box, bottle, piece"
              aria-invalid={Boolean(fieldErrors.unit)}
              disabled={isSubmitting}
            />
            {fieldErrors.unit && <p className="text-destructive text-sm">{fieldErrors.unit}</p>}
          </div>

          {isEditMode && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="product-isActive"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                disabled={isSubmitting}
                className="border-input size-4 rounded"
              />
              <Label htmlFor="product-isActive">Active</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEditMode ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
