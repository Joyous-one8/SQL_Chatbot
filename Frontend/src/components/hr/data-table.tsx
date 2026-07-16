import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

interface Props {
  rows: Row[];
  pageSize?: number;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataTable({ rows, pageSize = 25 }: Props) {
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) set.add(k);
    return Array.from(set);
  }, [rows]);

  const [sort, setSort] = useState<{ col: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * mult;
    });
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (col: string) => {
    setSort((s) => {
      if (!s || s.col !== col) return { col, dir: "asc" };
      if (s.dir === "asc") return { col, dir: "desc" };
      return null;
    });
    setPage(0);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {columns.map((col) => {
                const active = sort?.col === col;
                const Icon = !active
                  ? ArrowUpDown
                  : sort!.dir === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={col}
                    className="border-b border-border px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    <button
                      onClick={() => toggleSort(col)}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs uppercase tracking-wide transition-colors hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {col}
                      <Icon className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="whitespace-nowrap px-3 py-2 text-foreground/90"
                  >
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Showing {current * pageSize + 1}–
            {Math.min(sorted.length, (current + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="rounded border border-border bg-surface px-2 py-1 transition-colors hover:bg-accent disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 tabular-nums">
              {current + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="rounded border border-border bg-surface px-2 py-1 transition-colors hover:bg-accent disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
