import { Link } from "react-router-dom";
import { useUiStore } from "../../stores/uiStore";

interface GlobalBarProps {
  title: string;
  /** 상대 도메인 바로가기 (예: 데이터센터 화면에서 지도로) */
  switchTo: { to: string; label: string };
  accent?: "cyan" | "green";
}

const ACCENT_TEXT: Record<NonNullable<GlobalBarProps["accent"]>, string> = {
  cyan: "text-accent-cyan",
  green: "text-accent-green",
};

/**
 * 게이트를 제외한 화면의 공통 상단바.
 * 좌: ← 게이트 / 중앙: 도메인 타이틀 / 우: 상대 도메인 전환 + 테마 토글.
 * (기존 MainPage 의 TopBar 는 그대로 두고, 신규 화면에서 이 바를 사용)
 */
export function GlobalBar({ title, switchTo, accent = "cyan" }: GlobalBarProps) {
  const { theme, toggleTheme } = useUiStore();

  return (
    <header className="shrink-0 h-10 flex items-center justify-between px-3 bg-hb-surface border-b border-hb-border">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          to="/"
          className="flex items-center gap-1.5 font-mono text-2xs tracking-wider text-text-muted hover:text-text-primary transition-colors"
        >
          <span>←</span>
          <span className="uppercase">GATE</span>
        </Link>
        <span className="w-px h-5 bg-hb-border" />
        <span className={`font-mono text-sm font-semibold uppercase tracking-[0.12em] ${ACCENT_TEXT[accent]} truncate`}>
          {title}
        </span>
      </div>

      <div className="flex items-center gap-3 text-2xs">
        <Link
          to={switchTo.to}
          className="flex items-center gap-1.5 px-2 py-1 rounded font-mono uppercase tracking-wider bg-hb-border/40 text-text-muted hover:text-text-primary transition-colors"
        >
          {switchTo.label}
          <span>→</span>
        </Link>
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "라이트 모드" : "다크 모드"}
          className="flex items-center px-2 py-1 rounded bg-hb-border/40 text-text-muted hover:text-text-primary transition-colors"
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
