import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

// Generic surface for an API, network, or application error. Feature
// modules should pass a message produced by `getApiErrorMessage()`
// (src/lib/api-error.ts) — never a raw backend stack trace.
export function ErrorAlert({ title = "Something went wrong", message, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
