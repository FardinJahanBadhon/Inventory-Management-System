export interface ProductFormValues {
  code: string;
  name: string;
  unit: string;
}

export interface ProductFormErrors {
  code?: string;
  name?: string;
  unit?: string;
}

// Usability-only validation — required fields. Code uniqueness is a
// backend-authoritative check surfaced via the API's 409 response, never
// duplicated here.
export function validateProductForm({ code, name, unit }: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (!code.trim()) {
    errors.code = "Code is required";
  }
  if (!name.trim()) {
    errors.name = "Name is required";
  }
  if (!unit.trim()) {
    errors.unit = "Unit is required";
  }

  return errors;
}
