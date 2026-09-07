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
import { useGetProductsQuery } from "@/modules/products/product-api";
import { useInitializeInventoryMutation } from "./inventory-api";
import { validateInitializeInventoryForm, type InitializeInventoryFormErrors } from "./inventory-validation";

interface InitializeInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Initialization always creates a new Inventory row (never an upsert) —
// submitting the same location + product twice is expected and valid (see
// PROJECT_RULES.md), so this form deliberately does NOT close itself or
// clear the location/product choice after a successful submit, only the
// quantity. That makes repeating the same destination for several
// products (or the same product again) the natural next action rather
// than something the admin has to fight the form to do.
export function InitializeInventoryDialog({ open, onOpenChange }: InitializeInventoryDialogProps) {
  const [locationId, setLocationId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fieldErrors, setFieldErrors] = useState<InitializeInventoryFormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);

  const { data: locationsData, isLoading: isLoadingLocations } = useGetLocationsQuery({ pageSize: 100 });
  const { data: productsData, isLoading: isLoadingProducts } = useGetProductsQuery({ pageSize: 100 });
  const [initializeInventory, { isLoading: isSubmitting, error }] = useInitializeInventoryMutation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setSuccessMessage(undefined);

    const errors = validateInitializeInventoryForm({ locationId, productId, quantity });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      const result = await initializeInventory({
        locationId,
        productId,
        quantity: Number(quantity),
      }).unwrap();
      setSuccessMessage(
        `Initialized ${result.quantity} ${result.product.unit}(s) of ${result.product.name} at ${result.location.name}.`,
      );
      setQuantity("");
    } catch {
      // `error` below already reflects the failure.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Initialize inventory</DialogTitle>
          <DialogDescription>
            Creates a new inventory record. Initializing the same product and location again is
            allowed and creates a separate record — quantities are never merged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error && <ErrorAlert message={getApiErrorMessage(error)} />}
          {successMessage && (
            <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              {successMessage}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="init-location">Destination location</Label>
            <Select value={locationId} onValueChange={setLocationId} disabled={isSubmitting || isLoadingLocations}>
              <SelectTrigger id="init-location" aria-invalid={Boolean(fieldErrors.locationId)}>
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

          <div className="space-y-2">
            <Label htmlFor="init-product">Product</Label>
            <Select value={productId} onValueChange={setProductId} disabled={isSubmitting || isLoadingProducts}>
              <SelectTrigger id="init-product" aria-invalid={Boolean(fieldErrors.productId)}>
                <SelectValue placeholder={isLoadingProducts ? "Loading products…" : "Select a product"} />
              </SelectTrigger>
              <SelectContent>
                {productsData?.items.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.code} — {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.productId && <p className="text-destructive text-sm">{fieldErrors.productId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="init-quantity">Quantity</Label>
            <Input
              id="init-quantity"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={Boolean(fieldErrors.quantity)}
              disabled={isSubmitting}
            />
            {fieldErrors.quantity && <p className="text-destructive text-sm">{fieldErrors.quantity}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Done
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Initializing…" : "Initialize"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
