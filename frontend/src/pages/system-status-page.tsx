import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useGetHealthQuery } from "@/api/health-api";

// Verification-only page for Phase 2 (Project Initialization). It proves the
// full chain works end to end: React renders → Redux Provider is active →
// RTK Query issues a request → Express responds → Shadcn UI components
// render the result. This page is replaced by the real dashboard in later
// phases once authentication and roles exist.
export function SystemStatusPage() {
  const { data, error, isLoading, refetch, isFetching } = useGetHealthQuery();

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Backend Connection</CardTitle>
        <CardDescription>
          Verifies the frontend can reach the Express API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Checking backend health…</p>}

        {error && (
          <p className="text-sm text-destructive">
            Could not reach the backend. Is it running on the configured API URL?
          </p>
        )}

        {data && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Service</dt>
            <dd>{data.service}</dd>
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{data.environment}</dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd className={data.database === "connected" ? "" : "text-destructive"}>
              {data.database}
            </dd>
            <dt className="text-muted-foreground">Server time</dt>
            <dd>{new Date(data.timestamp).toLocaleString()}</dd>
          </dl>
        )}

        <Button onClick={() => refetch()} disabled={isFetching} size="sm">
          {isFetching ? "Checking…" : "Re-check"}
        </Button>
      </CardContent>
    </Card>
  );
}
