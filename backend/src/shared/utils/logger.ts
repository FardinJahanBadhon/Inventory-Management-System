type LogLevel = "info" | "warn" | "error";

// Deliberately lightweight — no logging package was selected in Phase 1/2.
// Structured (JSON-line) output is enough at this stage to make startup,
// shutdown, and unexpected errors greppable. Never pass secrets (JWT_SECRET,
// passwords, password hashes, tokens) in `meta`.
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
