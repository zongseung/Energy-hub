import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

export type GateAccent = "cyan" | "green";

export interface GatePanelProps {
  to: string;
  index: string; // "01"
  sub: string; // "DATASET EXPORT"
  domain: string; // "MICRO DATA CENTER"
  accent: GateAccent;
  metrics: { label: string; value: string }[];
  tags: string[];
  delayMs: number;
  onHover: (glowRgb: string | null) => void;
  ariaLabel: string;
  /** 패널 뒤에 약하게 깔리는 배경 (예: Live Map 미리보기) */
  backdrop?: ReactNode;
}

// 도메인별 액센트 — Tailwind 퍼지 대응을 위해 전체 클래스명을 리터럴로 둔다.
const ACCENT: Record<GateAccent, { rgb: string; text: string; panelHover: string; corner: string }> = {
  cyan: {
    rgb: "0 184 217",
    text: "text-accent-cyan",
    panelHover: "hover:border-accent-cyan/70 focus-visible:border-accent-cyan",
    corner: "text-hb-border-light group-hover:text-accent-cyan group-focus-visible:text-accent-cyan",
  },
  green: {
    rgb: "14 203 129",
    text: "text-accent-green",
    panelHover: "hover:border-accent-green/70 focus-visible:border-accent-green",
    corner: "text-hb-border-light group-hover:text-accent-green group-focus-visible:text-accent-green",
  },
};

export function GatePanel(props: GatePanelProps) {
  const { to, index, sub, domain, accent, metrics, tags, delayMs, onHover, ariaLabel, backdrop } = props;
  const a = ACCENT[accent];

  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      onMouseEnter={() => onHover(a.rgb)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(a.rgb)}
      onBlur={() => onHover(null)}
      style={{ animationDelay: `${delayMs}ms` } as CSSProperties}
      className={`group gate-reveal relative overflow-hidden flex flex-1 flex-col justify-between min-h-[320px] p-7 sm:p-10
        border border-hb-border ${a.panelHover} bg-hb-surface/40 hover:bg-hb-surface/70
        transition-colors duration-300 outline-none focus-visible:bg-hb-surface/70`}
    >
      {/* 약한 배경(예: Live Map 미리보기) — 좌측은 텍스트 가독성 위해 진하게, 우측은 지도 노출 */}
      {backdrop && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.32] grayscale-[0.2] transition-opacity duration-500 group-hover:opacity-50">
            {backdrop}
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-hb-surface/90 via-hb-surface/40 to-hb-surface/10" />
        </div>
      )}

      {/* 코너 브래킷 */}
      <span className={`gate-corner z-10 border-t border-l border-current top-3 left-3 ${a.corner}`} />
      <span className={`gate-corner z-10 border-t border-r border-current top-3 right-3 ${a.corner}`} />
      <span className={`gate-corner z-10 border-b border-l border-current bottom-3 left-3 ${a.corner}`} />
      <span className={`gate-corner z-10 border-b border-r border-current bottom-3 right-3 ${a.corner}`} />

      {/* 헤더: 인덱스 + 도메인명 */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 font-mono text-2xs tracking-[0.25em] uppercase text-text-muted">
          <span className={a.text}>{index}</span>
          <span>/ {sub}</span>
        </div>
        <h2 className="mt-3 font-mono uppercase tracking-[0.1em] text-2xl sm:text-3xl font-semibold text-text-primary">
          {domain}
        </h2>
      </div>

      {/* 메트릭 (오더북 스타일: 라벨 ···· 값) */}
      <dl className="relative z-10 flex-1 flex flex-col justify-center gap-2 py-6">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-baseline gap-2 font-mono text-xs">
            <dt className="hb-label">{m.label}</dt>
            <span className="flex-1 self-end mb-1 border-b border-dashed border-hb-border" />
            <dd className="num text-text-primary">{m.value}</dd>
          </div>
        ))}
      </dl>

      {/* 태그 */}
      <div className="relative z-10 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="px-1.5 py-0.5 text-2xs font-mono uppercase tracking-wide text-text-muted border border-hb-border bg-hb-surface/40"
          >
            {t}
          </span>
        ))}
      </div>

      {/* ENTER */}
      <div className={`relative z-10 mt-6 flex items-center gap-2 font-mono text-xs tracking-[0.2em] ${a.text}`}>
        <span>ENTER</span>
        <span className="transition-transform duration-300 group-hover:translate-x-1.5 group-focus-visible:translate-x-1.5">
          →
        </span>
      </div>
    </Link>
  );
}
