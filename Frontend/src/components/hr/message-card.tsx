import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Code2, Copy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatResponse } from "@/lib/hr-api";
import { useTypewriter } from "@/lib/use-typewriter";
import { DataTable } from "./data-table";

export type ChatTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; response: ChatResponse; animate: boolean };

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="fade-in-up flex justify-end">
      <div className="flex max-w-2xl items-start gap-3">
        <div className="rounded-lg rounded-tr-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-subtle">
          {text}
        </div>
        <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold text-primary">
      A
    </div>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-border bg-muted/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <Code2 className="h-3.5 w-3.5" />
        <span>View SQL</span>
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between border-b border-border/60 bg-surface px-3 py-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              generated query
            </span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto bg-surface px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foreground/90">
            <code>{sql}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

function InlineList({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <ul className="mt-3 space-y-1 rounded-md border border-border bg-surface px-4 py-3 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap gap-x-4 gap-y-0.5 text-foreground/90">
          {Object.entries(r).map(([k, v]) => (
            <span key={k}>
              <span className="text-muted-foreground">{k}:</span>{" "}
              <span className="font-medium">{v === null || v === undefined ? "—" : String(v)}</span>
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

function MetricsFooter({ seconds }: { seconds: number }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
      <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/50" />
      {seconds.toFixed(1)}s
    </div>
  );
}

export function AssistantMessage({
  response,
  animate,
}: {
  response: ChatResponse;
  animate: boolean;
}) {
  const isError = response.status === "error";
  const answerText = isError ? response.error_message ?? "Something went wrong." : response.answer ?? "";
  const { text: revealed, done } = useTypewriter(answerText, { enabled: animate });

  return (
    <div className="fade-in-up flex justify-start">
      <div className="flex w-full max-w-3xl items-start gap-3">
        <AssistantAvatar />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "rounded-lg border bg-surface px-4 py-3 shadow-subtle",
              isError
                ? "border-l-[3px] border-l-warning border-border bg-warning/5"
                : "border-border",
            )}
          >
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
              {revealed}
              {!done && (
                <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-foreground/60 align-middle" />
              )}
            </p>

            {!isError && response.generated_sql && <SqlBlock sql={response.generated_sql} />}

            {!isError && response.mode === "table" && response.data && response.data.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {response.row_count ?? response.data.length}{" "}
                    {(response.row_count ?? response.data.length) === 1 ? "result" : "results"}
                  </span>
                </div>
                <DataTable rows={response.data} />
              </div>
            )}

            {!isError &&
              response.mode === "text" &&
              response.data &&
              response.data.length > 0 &&
              response.data.length <= 15 && <InlineList rows={response.data} />}
          </div>
          <MetricsFooter seconds={response.metrics?.execution_time_seconds ?? 0} />
        </div>
      </div>
    </div>
  );
}

export function ThinkingBubble() {
  return (
    <div className="fade-in-up flex justify-start">
      <div className="flex max-w-2xl items-start gap-3">
        <AssistantAvatar />
        <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-subtle">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex gap-1">
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "180ms" }} />
              <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "360ms" }} />
            </span>
            <span>Thinking</span>
          </div>
        </div>
      </div>
    </div>
  );
}
