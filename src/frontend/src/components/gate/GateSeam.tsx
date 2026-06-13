import type { CSSProperties } from "react";

/**
 * 게이트 중앙 수직 seam(스캔라인). glow(RGB 트리플릿)가 주어지면 그쪽 도메인 색으로 빛난다.
 * lg 이상에서만 표시 — 작은 화면은 패널이 세로 스택되며 seam 생략.
 */
export function GateSeam({ glow }: { glow: string | null }) {
  return (
    <div
      className="gate-seam hidden lg:block self-stretch my-10"
      style={{ "--gate-glow": glow ?? "255 255 255" } as CSSProperties}
      aria-hidden
    />
  );
}
