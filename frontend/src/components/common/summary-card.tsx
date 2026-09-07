import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/common/loading-spinner";

interface SummaryCardProps {
  title: string;
  isLoading: boolean;
  value: number | string | undefined;
  description: string;
}

// Shared by the Admin and Operational dashboards. A total is read from an
// existing list endpoint's own pagination metadata (`meta.total`) with
// `pageSize: 1` — the cheapest request that still returns an accurate
// count — rather than a dedicated stats endpoint, which the backend
// doesn't have. No metric shown via this component is invented.
export function SummaryCard({ title, isLoading, value, description }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">
          {isLoading ? <LoadingSpinner size="sm" /> : (value ?? "—")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}
