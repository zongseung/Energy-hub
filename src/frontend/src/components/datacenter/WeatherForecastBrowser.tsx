import { useEffect, useState } from "react";
import {
  fetchCities,
  fetchDistricts,
  fetchTowns,
  fetchVariables,
  fetchFiles,
  fetchYears,
  previewFile,
  downloadUrl,
  downloadYearUrl,
  type WeatherFile,
} from "../../api/weatherApi";

/**
 * 기상청 단기예보 NAS 브라우저.
 * 시도 → 구군 → 동읍면 → 변수 (검색 가능) → 연도 → 월별 CSV / 연도 ZIP.
 * /api/v1/data/weather/* (실데이터, NAS read-only). 상태는 컴포넌트 로컬.
 */
export function WeatherForecastBrowser() {
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [towns, setTowns] = useState<string[]>([]);
  const [variables, setVariables] = useState<string[]>([]);
  const [files, setFiles] = useState<WeatherFile[]>([]);
  const [years, setYears] = useState<string[]>([]);

  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const [variable, setVariable] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  const [preview, setPreview] = useState<{ filename: string; lines: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function safe(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void safe(async () => setCities((await fetchCities()).cities.map((c) => c.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetBelow(level: "city" | "district" | "town" | "variable") {
    if (level === "city") {
      setDistrict(null);
      setDistricts([]);
    }
    if (level === "city" || level === "district") {
      setTown(null);
      setTowns([]);
    }
    if (level === "city" || level === "district" || level === "town") {
      setVariable(null);
      setVariables([]);
    }
    setFiles([]);
    setYears([]);
    setYear(null);
    setPreview(null);
  }

  function onCity(name: string) {
    setCity(name);
    resetBelow("city");
    void safe(async () => setDistricts((await fetchDistricts(name)).districts.map((d) => d.name)));
  }
  function onDistrict(name: string) {
    setDistrict(name);
    resetBelow("district");
    void safe(async () => setTowns((await fetchTowns(city!, name)).towns.map((t) => t.name)));
  }
  function onTown(name: string) {
    setTown(name);
    resetBelow("town");
    void safe(async () => setVariables((await fetchVariables(city!, district!, name)).variables.map((v) => v.name)));
  }
  function onVariable(name: string) {
    setVariable(name);
    setFiles([]);
    setYears([]);
    setYear(null);
    setPreview(null);
    void safe(async () => {
      const [f, y] = await Promise.all([
        fetchFiles(city!, district!, town!, name),
        fetchYears(city!, district!, town!, name),
      ]);
      setFiles(f.files);
      setYears(y.years);
      setYear(y.years.length ? y.years[y.years.length - 1] : null);
    });
  }
  function onPreview(filename: string) {
    void safe(async () => {
      const p = await previewFile(city!, district!, town!, variable!, filename);
      setPreview({ filename, lines: p.lines });
    });
  }

  const shownFiles = year ? files.filter((f) => f.year === year) : files;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 캐스케이드 + 연도 */}
      <div className="hb-panel p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="hb-label">기상청 단기예보 — 지역 선택</span>
          {busy && <span className="font-mono text-2xs text-text-muted animate-pulse">LOADING…</span>}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <SearchableSelect label="시도" items={cities} value={city} onSelect={onCity} />
          <SearchableSelect label="구군" items={districts} value={district} onSelect={onDistrict} disabled={!city} />
          <SearchableSelect label="동읍면" items={towns} value={town} onSelect={onTown} disabled={!district} />
          <SearchableSelect label="변수" items={variables} value={variable} onSelect={onVariable} disabled={!town} />
        </div>

        {years.length > 0 && (
          <div className="mt-3">
            <span className="hb-label block mb-1">연도</span>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setYear(y);
                    setPreview(null);
                  }}
                  className={`shrink-0 px-2.5 py-1 font-mono text-xs border transition-colors ${
                    y === year
                      ? "border-accent-cyan text-accent-cyan bg-accent-cyan/10"
                      : "border-hb-border text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="mt-2 font-mono text-2xs text-accent-red">ERROR · {error}</div>}
      </div>

      {/* 파일목록 + 미리보기 */}
      <div className="flex-1 flex gap-3 overflow-hidden">
        <div className="hb-card flex-1 flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-hb-border">
            <span className="hb-label">파일 {variable ? `· ${variable}` : ""}</span>
            {variable && year && shownFiles.length > 0 && (
              <a
                href={downloadYearUrl(city!, district!, town!, variable, year)}
                download
                className="flex items-center gap-1 px-2 py-0.5 font-mono text-2xs uppercase tracking-wider border border-accent-cyan/60 text-accent-cyan hover:bg-accent-cyan/10"
              >
                {year} 전체 ZIP ↓
              </a>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {!variable ? (
              <Center>
                변수까지 선택하세요 <span className="animate-pulse">▌</span>
              </Center>
            ) : shownFiles.length === 0 ? (
              <Center>파일 없음</Center>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-hb-panel">
                  <tr>
                    <th className="text-left hb-label px-3 py-1.5 border-b border-hb-border">기간</th>
                    <th className="text-right hb-label px-3 py-1.5 border-b border-hb-border">MB</th>
                    <th className="text-right hb-label px-3 py-1.5 border-b border-hb-border">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {shownFiles.map((f) => (
                    <tr key={f.filename} className="border-b border-hb-border/40 hover:bg-hb-border/20">
                      <td className="num px-3 py-1 text-text-secondary whitespace-nowrap">
                        {f.start_date}–{f.end_date}
                      </td>
                      <td className="num px-3 py-1 text-right text-text-primary">{f.size_mb}</td>
                      <td className="px-3 py-1 text-right whitespace-nowrap">
                        <button
                          onClick={() => onPreview(f.filename)}
                          className="font-mono text-2xs text-text-muted hover:text-accent-cyan mr-2"
                        >
                          미리보기
                        </button>
                        <a
                          href={downloadUrl(city!, district!, town!, variable, f.filename)}
                          download
                          className="font-mono text-2xs text-accent-cyan hover:underline"
                        >
                          CSV ↓
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 미리보기 패널 */}
        {preview && (
          <div className="hb-card w-80 shrink-0 flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-hb-border">
              <span className="hb-label truncate">미리보기</span>
              <button onClick={() => setPreview(null)} className="text-text-muted hover:text-text-primary text-xs">
                ✕
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-3 font-mono text-2xs text-text-secondary leading-relaxed whitespace-pre">
              {preview.lines.join("\n")}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex items-center justify-center font-mono text-xs text-text-muted py-16">{children}</div>;
}

/** 검색 가능한 셀렉트 — 입력 필터 + 스크롤 목록. */
function SearchableSelect({
  label,
  items,
  value,
  onSelect,
  disabled,
}: {
  label: string;
  items: string[];
  value: string | null;
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? items.filter((i) => i.toLowerCase().includes(q.toLowerCase())) : items;

  return (
    <div className="relative">
      <span className="hb-label block mb-1">{label}</span>
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between bg-hb-bg border border-hb-border px-2 py-1.5 text-xs font-mono text-left disabled:opacity-40 disabled:cursor-not-allowed focus:border-accent-cyan focus:outline-none"
      >
        <span className={value ? "text-text-primary truncate" : "text-text-muted"}>{value ?? "선택"}</span>
        <span className="text-text-muted ml-1">▾</span>
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-hb-surface border border-hb-border-light shadow-2xl max-h-64 flex flex-col">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색…"
              className="bg-hb-bg border-b border-hb-border px-2 py-1.5 text-xs font-mono text-text-primary focus:outline-none"
            />
            <ul className="overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-2 py-2 text-2xs font-mono text-text-muted">결과 없음</li>
              )}
              {filtered.map((i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      onSelect(i);
                      setOpen(false);
                      setQ("");
                    }}
                    className={`w-full text-left px-2 py-1.5 text-xs font-mono hover:bg-accent-cyan/10 ${
                      i === value ? "text-accent-cyan" : "text-text-secondary"
                    }`}
                  >
                    {i}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
