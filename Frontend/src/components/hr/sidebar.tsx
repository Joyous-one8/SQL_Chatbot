import { Database, PanelLeftClose, PanelLeftOpen, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onToggle: () => void;
  onNewConversation: () => void;
  onPickExample: (q: string) => void;
  sessionId: string;
  disabled?: boolean;
}

export const EXAMPLE_QUESTIONS = [
  "Which employees are older than 40?",
  "Who works in Marketing?",
  "Which employees have a birthday next week?",
  "Show me the 10 most recent hires",
  "Average tenure by department",
];

export function Sidebar({
  open,
  onToggle,
  onNewConversation,
  onPickExample,
  sessionId,
  disabled,
}: Props) {
  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        open ? "w-72" : "w-14",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        <div className={cn("flex items-center gap-2 overflow-hidden", !open && "justify-center")}>
          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Database className="h-3.5 w-3.5" />
          </div>
          {open && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">Atlas HR</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                Employee Data · chat
              </div>
            </div>
          )}
        </div>
        {open && (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {!open && (
        <button
          onClick={onToggle}
          aria-label="Expand sidebar"
          className="mx-auto mt-2 rounded p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      <div className="p-3">
        <button
          onClick={onNewConversation}
          disabled={disabled}
          className={cn(
            "group flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:opacity-50",
            !open && "justify-center px-0",
          )}
        >
          <Plus className="h-4 w-4 flex-none" />
          {open && <span>New conversation</span>}
        </button>
      </div>

      {open && (
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Example questions
          </div>
          <ul className="space-y-1">
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <button
                  onClick={() => onPickExample(q)}
                  disabled={disabled}
                  className="block w-full rounded-md px-3 py-2 text-left text-[13px] leading-snug text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open && (
        <div className="border-t border-sidebar-border p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Session
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-sidebar-foreground/70">
            {sessionId}
          </div>
        </div>
      )}
    </aside>
  );
}
