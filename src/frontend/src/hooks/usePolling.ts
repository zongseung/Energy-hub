import { useEffect, useRef, useState } from "react";

export function usePolling<T>(url: string, intervalMs: number = 300_000) {
  const [data, setData] = useState<T | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (mounted) {
          setData(json);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (err: unknown) {
        if (mounted && (err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      }
    };

    const startPolling = () => {
      poll();
      timerRef.current = setInterval(poll, intervalMs);
    };

    const stopPolling = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      controller.abort();
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, intervalMs]);

  return { data, lastUpdated, error };
}
