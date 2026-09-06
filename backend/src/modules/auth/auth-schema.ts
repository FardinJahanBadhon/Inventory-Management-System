import { z } from "zod";

// Deliberately no complexity rules here (min length beyond "non-empty",
// character classes, etc.) — this validates a LOGIN attempt, not a new
// password. Whatever password an admin actually set at user-creation time
// must be accepted; complexity belongs to user creation (Phase 7).
export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
