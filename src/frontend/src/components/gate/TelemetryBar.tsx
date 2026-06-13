import { useEffect, useState } from "react";
import { useUiStore } from "../../stores/uiStore";

/**
 * 게이트 상단 텔레메트리 바.
 * 마케팅 헤더가 아니라 관제 콘솔 상단 라인 — 워드마크 + 실시간 UTC 시계 + 빌드 태그 + 테마 토글.
 */
export function TelemetryBar() {
  const [kst, setKst] = useState(() => fmtKst(new Date()));
  const { theme, toggleTheme } = useUiStore();

  useEffect(() => {
    const id = setInterval(() => setKst(fmtKst(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="shrink-0 h-9 flex items-center justify-between px-4 border-b border-hb-border bg-hb-bg/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 font-mono text-2xs tracking-[0.2em] uppercase">
        <span className="text-text-primary font-semibold">ENERGY·HUB</span>
        <span className="text-hb-border-light">/</span>
        <span className="text-text-secondary">CONTROL</span>
        <span className="text-accent-cyan animate-pulse">▌</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-2xs tracking-wider text-text-muted">
        <span className="hidden sm:inline">BUILD 0.1</span>
        <span className="hidden sm:inline text-hb-border-light">·</span>
        <span className="num text-text-secondary">{kst} KST</span>
        <span className="w-px h-4 bg-hb-border" />
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "라이트 모드" : "다크 모드"}
          aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          className="flex items-center px-1.5 py-1 rounded text-text-muted hover:text-text-primary transition-colors"
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

// 브라우저 타임존과 무관하게 KST(UTC+9) 고정 — UTC 기준에 9시간을 더해 표기.
function fmtKst(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(
    k.getUTCMinutes()
  )}:${p(k.getUTCSeconds())}`;
}
