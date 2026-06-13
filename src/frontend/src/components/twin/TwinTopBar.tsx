import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUiStore } from "../../stores/uiStore";

export function TwinTopBar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useUiStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const ts = now.toISOString().slice(0, 19).replace("T", " ");

  return (
    <div className="h-10 shrink-0 flex items-center gap-3 px-3 bg-hb-surface border-b border-hb-border">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors font-mono text-[11px] uppercase tracking-wider"
        aria-label="메인으로 돌아가기"
      >
        <span>←</span>
        <span>BACK</span>
      </button>

      <div className="h-4 w-px bg-hb-border" />

      <div className="flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
        </span>
        <span className="font-mono text-[11px] font-bold tracking-widest text-text-primary">
          JEJU DIGITAL TWIN
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-accent-green">
          LIVE
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3 font-mono text-[10px] tabular-nums text-text-muted">
        <span>{ts} UTC</span>
        <button
          onClick={toggleTheme}
          className="px-2 py-0.5 rounded border border-hb-border hover:border-accent-cyan/50 transition-colors uppercase"
          aria-label="테마 토글"
        >
          {theme === "dark" ? "DARK" : "LIGHT"}
        </button>
      </div>
    </div>
  );
}
