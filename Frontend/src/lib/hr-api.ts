// HR chat API client + types. Backend contract:
//   POST /chat/query  { question, session_id } -> ChatResponse
//   POST /chat/reset  { session_id }
//
// Base URL is configurable via VITE_HR_API_URL (defaults to same origin).

export type ChatMode = "table" | "text" | null;

export interface ChatMetrics {
  execution_time_seconds: number;
}

export interface ChatResponse {
  status: "success" | "error";
  answer: string | null;
  generated_sql: string | null;
  mode: ChatMode;
  row_count: number | null;
  data: Array<Record<string, unknown>> | null;
  metrics: ChatMetrics;
  error_message: string | null;
}

const BASE_URL: string =
  (import.meta.env.VITE_HR_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const SESSION_KEY = "atlas-hr-session-id";

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr-placeholder";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = generateSessionId();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function rotateSessionId(): string {
  const id = generateSessionId();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function askQuestion(
  question: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, session_id: sessionId }),
    signal,
  });

  if (!res.ok) {
    // Still try to parse a structured error response; else surface a friendly one.
    try {
      const body = (await res.json()) as ChatResponse;
      return body;
    } catch {
      return {
        status: "error",
        answer: null,
        generated_sql: null,
        mode: null,
        row_count: null,
        data: null,
        metrics: { execution_time_seconds: 0 },
        error_message: `Request failed (${res.status})`,
      };
    }
  }

  return (await res.json()) as ChatResponse;
}

export async function resetSession(sessionId: string): Promise<void> {
  try {
    await fetch(`${BASE_URL}/chat/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
  } catch {
    // Non-fatal; the local thread will still clear.
  }
}
