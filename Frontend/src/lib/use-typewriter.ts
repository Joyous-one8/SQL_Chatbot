import { useEffect, useRef, useState } from "react";

/**
 * Progressive-reveal hook. Today it drives a client-side timer over a
 * completed string; tomorrow, when the backend streams tokens, swap the
 * timer for an incremental append to `revealed` fed by the stream — the
 * consuming component API stays identical.
 */
export function useTypewriter(
  fullText: string | null | undefined,
  opts: { charsPerTick?: number; intervalMs?: number; enabled?: boolean } = {},
) {
  const { charsPerTick = 3, intervalMs = 16, enabled = true } = opts;
  const [revealed, setRevealed] = useState("");
  const indexRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) window.clearInterval(rafRef.current);
    indexRef.current = 0;
    setRevealed("");
    if (!fullText || !enabled) {
      setRevealed(fullText ?? "");
      return;
    }

    const id = window.setInterval(() => {
      indexRef.current = Math.min(indexRef.current + charsPerTick, fullText.length);
      setRevealed(fullText.slice(0, indexRef.current));
      if (indexRef.current >= fullText.length) {
        window.clearInterval(id);
      }
    }, intervalMs);
    rafRef.current = id;

    return () => window.clearInterval(id);
  }, [fullText, charsPerTick, intervalMs, enabled]);

  const done = !fullText || revealed.length >= (fullText?.length ?? 0);
  return { text: revealed, done };
}
