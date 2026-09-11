import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableRowsSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <TableRow key={row}>
          {Array.from({ length: columns }).map((_, col) => (
            <TableCell key={col} className="py-3">
              <Skeleton className={cn("h-4", col === 0 ? "w-2/3" : "w-full")} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function TableSkeleton({
  columns = 4,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, col) => (
              <TableHead key={col}>
                <Skeleton className="h-3.5 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRowsSkeleton rows={rows} columns={columns} />
        </TableBody>
      </Table>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-5 h-48 w-full" />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="size-9 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="col-span-12 lg:col-span-7">
          <div className="rounded-lg border bg-card p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-64 w-full" />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-5">
          <div className="rounded-lg border bg-card p-4">
            <Skeleton className="h-5 w-32" />
            <div className="mt-6 flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
