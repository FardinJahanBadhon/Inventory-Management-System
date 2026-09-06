import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),

  // JWT infrastructure — prepared in Phase 4, consumed starting Phase 5
  // when the login endpoint issues the first real token.
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(ms|s|m|h|d|y)$/, "JWT_EXPIRES_IN must look like a duration, e.g. 8h")
    .default("8h"),

  // Password hashing — prepared in Phase 4, consumed starting Phase 7 when
  // user creation exists. Kept separate from the identical variable read by
  // prisma/seed.ts, which runs as its own standalone process.
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().positive().default(10),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  corsOrigin: parsedEnv.data.CORS_ORIGIN,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  jwtExpiresIn: parsedEnv.data.JWT_EXPIRES_IN,
  bcryptSaltRounds: parsedEnv.data.BCRYPT_SALT_ROUNDS,
  isProduction: parsedEnv.data.NODE_ENV === "production",
};
