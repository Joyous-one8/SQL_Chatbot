import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function Composer({ value, onChange, onSubmit, disabled, loading }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  useEffect(() => {
    if (!loading) ref.current?.focus();
  }, [loading]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div
          className={cn(
            "relative flex items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-subtle transition-shadow focus-within:border-ring/60 focus-within:shadow-card",
          )}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            disabled={disabled}
            rows={1}
            placeholder="Ask about your employees…"
            className="min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60"
          />
          <button
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send question"
            className={cn(
              "flex h-8 w-8 flex-none items-center justify-center rounded-md transition-all",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  );
}
