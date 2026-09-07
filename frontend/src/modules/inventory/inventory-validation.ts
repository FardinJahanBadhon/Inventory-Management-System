export interface InitializeInventoryFormValues {
  locationId: string;
  productId: string;
  quantity: string;
}

export interface InitializeInventoryFormErrors {
  locationId?: string;
  productId?: string;
  quantity?: string;
}

// Usability-only validation. The backend independently enforces
// `quantity > 0` and integer-ness (see inventory-schema.ts) — this only
// avoids an obviously-invalid round trip.
export function validateInitializeInventoryForm({
  locationId,
  productId,
  quantity,
}: InitializeInventoryFormValues): InitializeInventoryFormErrors {
  const errors: InitializeInventoryFormErrors = {};

  if (!locationId) {
    errors.locationId = "Destination location is required";
  }
  if (!productId) {
    errors.productId = "Product is required";
  }

  const parsedQuantity = Number(quantity);
  if (!quantity.trim()) {
    errors.quantity = "Quantity is required";
  } else if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    errors.quantity = "Quantity must be a whole number greater than zero";
  }

  return errors;
}

// Shared by Distribute and Trash — both take just a quantity. Checking
// against `availableQuantity` is a usability nicety only; the backend's
// atomic conditional update (see PROJECT_RULES.md) is the actual guard
// against over-drawing a row, including under concurrent requests this
// check can't see.
export function validateQuantityAgainstAvailable(
  quantity: string,
  availableQuantity: number,
): string | undefined {
  const parsedQuantity = Number(quantity);

  if (!quantity.trim()) {
    return "Quantity is required";
  }
  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return "Quantity must be a whole number greater than zero";
  }
  if (parsedQuantity > availableQuantity) {
    return `Only ${availableQuantity} available`;
  }

  return undefined;
}
