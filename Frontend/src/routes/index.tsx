import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar, EXAMPLE_QUESTIONS } from "@/components/hr/sidebar";
import { Composer } from "@/components/hr/composer";
import {
  AssistantMessage,
  ThinkingBubble,
  UserMessage,
  type ChatTurn,
} from "@/components/hr/message-card";
import {
  askQuestion,
  getSessionId,
  resetSession,
  rotateSessionId,
  type ChatResponse,
} from "@/lib/hr-api";
import { Database } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function Index() {
  const [sessionId, setSessionId] = useState<string>("…");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  const submit = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || pending) return;

      const userTurn: ChatTurn = { id: newId(), role: "user", text: question };
      setTurns((t) => [...t, userTurn]);
      setInput("");
      setPending(true);

      let response: ChatResponse;
      try {
        response = await askQuestion(question, sessionId);
      } catch (err) {
        response = {
          status: "error",
          answer: null,
          generated_sql: null,
          mode: null,
          row_count: null,
          data: null,
          metrics: { execution_time_seconds: 0 },
          error_message:
            err instanceof Error
              ? `Couldn't reach the assistant: ${err.message}`
              : "Couldn't reach the assistant.",
        };
      }

      setTurns((t) => [
        ...t,
        { id: newId(), role: "assistant", response, animate: true },
      ]);
      setPending(false);
    },
    [pending, sessionId],
  );

  const handleNewConversation = useCallback(async () => {
    if (sessionId && sessionId !== "…") {
      void resetSession(sessionId);
    }
    const next = rotateSessionId();
    setSessionId(next);
    setTurns([]);
    setInput("");
  }, [sessionId]);

  const handlePickExample = useCallback(
    (q: string) => {
      if (pending) return;
      void submit(q);
    },
    [pending, submit],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((o) => !o)}
        onNewConversation={handleNewConversation}
        onPickExample={handlePickExample}
        sessionId={sessionId}
        disabled={pending}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-background/80 px-6 backdrop-blur">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              HR Assistant
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Natural language over your employee database
            </p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8">
            {turns.length === 0 && !pending ? (
              <EmptyState onPick={handlePickExample} disabled={pending} />
            ) : (
              <div className="space-y-6">
                {turns.map((t) =>
                  t.role === "user" ? (
                    <UserMessage key={t.id} text={t.text} />
                  ) : (
                    <AssistantMessage
                      key={t.id}
                      response={t.response}
                      animate={t.animate}
                    />
                  ),
                )}
                {pending && <ThinkingBubble />}
              </div>
            )}
          </div>
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => void submit(input)}
          disabled={pending}
          loading={pending}
        />
      </main>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fade-in-up mx-auto max-w-2xl pt-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Database className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        Ask your people data
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Atlas translates your question into SQL, runs it against the HR database, and
        returns a plain-language answer with the underlying data.
      </p>

      <div className="mt-8 grid gap-2 text-left sm:grid-cols-2">
        {EXAMPLE_QUESTIONS.slice(0, 4).map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            disabled={disabled}
            className="group rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground/90 shadow-subtle transition-all hover:border-ring/40 hover:bg-accent/40 disabled:opacity-50"
          >
            <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-primary">
              Try
            </span>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
