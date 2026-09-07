import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

// Shared Previous/Next pager for every paginated admin list — all four use
// the same `{ items, meta: { page, pageSize, total, totalPages } }` shape
// (backend/src/shared/types/api.ts's PaginatedData<T>).
export function PaginationControls({ page, totalPages, total, onPageChange }: PaginationControlsProps) {
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-muted-foreground text-sm">
        Page {page} of {totalPages} · {total} total
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
