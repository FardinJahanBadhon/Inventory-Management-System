// The full Product row is already safe to return as-is (no sensitive
// field to strip), but this type keeps the API contract explicit — same
// rationale as LocationResponse in the Locations module.
export interface ProductResponse {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
