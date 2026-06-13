const BASE = "/api/v1";

export async function apiFetch<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * 다운로드 URL 빌더 — JSON 파싱하지 않고 URL 만 생성해 브라우저 네이티브 다운로드에 위임.
 * 대용량 export 를 JS 메모리에 적재하지 않기 위한 분리(아키텍처 기획서 §6.1).
 */
export function buildExportUrl(path: string, params?: Record<string, string | number | boolean>): string {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}
