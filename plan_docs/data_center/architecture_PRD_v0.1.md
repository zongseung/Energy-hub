# 마이크로 데이터센터 확장 — 연결 아키텍처 기획서 (v0.1)

> 작성 스킬: `senior-fullstack`
> 작성일: 2026-06-13 · 트랙: `data_center` · 짝 문서: [`UIUX_design_PRD_v0.1.md`](./UIUX_design_PRD_v0.1.md)
> 목적: 게이트 허브 + 마이크로 데이터센터를 **스파게티 없이** 기존 코드베이스에 연결하는 방법 검토.
> rev 메모(2026-06-13): **SMB 단기예보(기상청)** 데이터셋 포함 결정 — DB 적재 없이 **파일 패스스루**(`source:"file"`, 릴리스 스왑 CSV). [`SMB_CSV_NGINX_보안계획서`](../SMB_CSV_NGINX_보안계획서_2026-03-04.md) 와 정합(외부/내부 모두 SMB 직접 read 금지, 로컬 `current` 릴리스만 서빙).

---

## 1. 설계 원칙 (Clean, not spaghetti)

| 원칙 | 적용 |
|------|------|
| P1. 라우트 = 경계 | 화면 단위로 독립 라우트 + lazy import. 한 컴포넌트가 라우팅·데이터·뷰를 다 들고 있던 `MapView.tsx` 패턴 재발 금지 |
| P2. 레이어 단방향 | `View(컴포넌트) → store(zustand) → api(클라이언트) → backend → DB`. 컴포넌트가 fetch 를 직접 호출하지 않고 api 모듈/스토어 경유 |
| P3. 도메인 격리 | 데이터센터는 `features/datacenter/` 로 묶고, 기존 map/twin 과 import 교차 금지 |
| P4. 서버가 진실 | 다운로드 가능한 데이터셋·컬럼·필터는 **백엔드 레지스트리(화이트리스트)** 가 단일 출처. 프론트는 그것을 그릴 뿐 |
| P5. 보안 우선 | 사용자 입력은 절대 SQL 에 문자열 결합 금지 → 화이트리스트 + 파라미터 바인딩 |
| P6. 추가만, 파괴 없음 | 기존 라우트/엔드포인트 비파괴. `/` → `/map` 이동만 변경 |

---

## 2. 시스템 흐름

```
[Browser]
  React Router ──/──▶ GateHubPage      ─┐
              ──/map─▶ MainPage(기존)    │  fetch /api/v1/...
              ──/data▶ DataCenterPage   ─┘
        │
        ▼ (다운로드는 <a href> 네이티브 네비게이션, JS 메모리 미적재)
[nginx :8088] ──/api/v1/─▶ [backend :8000 FastAPI]
                                 │ asyncpg (stream / COPY)
                                 ▼
                         [energy-hub-db :5437 PostGIS]
                           로컬 테이블 + FDW 외래 테이블
```

- **조회/메타**(catalog, preview): 기존 `apiFetch<T>` (JSON) + Redis 캐시.
- **다운로드**(export): JSON 파싱 안 함. 브라우저가 `Content-Disposition: attachment` 스트림을 직접 받아 디스크로 — 대용량도 프론트 메모리 0.

---

## 3. 프론트엔드 — 라우팅 & 코드 분할

`src/frontend/src/App.tsx` 변경(기존 lazy 패턴 그대로 확장):

```tsx
const GateHubPage   = lazy(() => import("./routes/GateHubPage"));   // 신규
const MainPage      = lazy(() => import("./routes/MainPage"));      // 기존
const DataCenterPage= lazy(() => import("./routes/DataCenterPage"));// 신규
const JejuTwinPage  = lazy(() => import("./routes/JejuTwinPage"));  // 기존

<Routes>
  <Route path="/"          element={<GateHubPage />} />
  <Route path="/map"       element={<MainPage />} />
  <Route path="/data"      element={<DataCenterPage />} />
  <Route path="/twin/jeju" element={<JejuTwinPage />} />
  <Route path="*"          element={<Navigate to="/" replace />} />
</Routes>
```

- `MainPage` 는 내용 변경 없이 경로만 `/` → `/map`. 내부 컴포넌트(`TopBar`/`MainLayout`/`StatusBar`)는 그대로.
- 각 페이지는 별도 청크 → 게이트 진입이 지도/deck.gl 번들을 끌어오지 않음(초기 로드 경량).

---

## 4. 프론트엔드 — 폴더 구조 (feature 기반)

기존 컨벤션(`components/<feature>/`, `routes/`, `api/`, `stores/`)을 따르되 데이터센터는 한 폴더로 격리:

```
src/frontend/src/
  routes/
    GateHubPage.tsx          [신규] 얇은 조립 (페이지 = 레이아웃만)
    DataCenterPage.tsx       [신규] 얇은 조립
    MainPage.tsx             [기존] 변경 없음
  components/
    gate/
      GatePanel.tsx          [신규] 좌/우 공통 패널 (props 주도)
      GateSeam.tsx           [신규] 중앙 스캔라인 (CSS-only)
    datacenter/
      DatasetList.tsx        [신규] 카탈로그 목록
      FilterPanel.tsx        [신규] 카탈로그 스펙 기반 동적 폼
      PreviewTable.tsx       [신규] 미리보기 50행
      ExportBar.tsx          [신규] 행수 + CSV/GeoJSON 버튼
    layout/
      GlobalBar.tsx          [신규] TopBar 일반화(게이트/데이터센터 공통 상단바)
  stores/
    datacenterStore.ts       [신규] 선택 데이터셋 + 필터 상태
  api/
    dataApi.ts               [신규] catalog/preview/export 클라이언트
    client.ts                [기존] apiFetch + (신규)buildExportUrl 추가
```

**규칙**: `routes/*Page.tsx` 는 레이아웃 조립만(로직 없음). 데이터 패칭은 컴포넌트 내부 effect 가 아니라 **store action** 또는 작은 커스텀 훅(`useCatalog`, `usePreview`)으로. → MapView 식 비대화 차단.

---

## 5. 프론트엔드 — 상태관리 (`datacenterStore.ts`)

기존 zustand 컨벤션(`mapStore`/`uiStore`) 준수. 데이터센터 전용 슬라이스 분리:

```ts
interface DataCenterState {
  catalog: DatasetMeta[] | null;
  selectedId: string | null;
  filters: Record<string, unknown>;   // 카탈로그 스펙에 맞춰 동적
  preview: { columns: string[]; rows: unknown[][]; estRows: number } | null;
  loading: { catalog: boolean; preview: boolean };
  error: string | null;

  loadCatalog(): Promise<void>;
  select(id: string): void;            // 선택 시 필터 기본값 리셋 + preview 재요청
  setFilter(key: string, value: unknown): void;
  refreshPreview(): Promise<void>;     // 디바운스(250ms)
}
```

- 다운로드 자체는 **상태에 두지 않는다**(브라우저 네이티브). store 는 "어떤 데이터셋 + 어떤 필터" 까지만 보유 → `ExportBar` 가 그 상태로 URL 만 만든다.
- 필터 변경 → preview 디바운스 재요청. export URL 은 항상 현재 store 필터에서 파생(미리보기와 결과 일치 보장, 디자인 문서 §6.3).

---

## 6. API 레이어 (프론트)

### 6.1 `client.ts` — 다운로드 URL 빌더 추가 (조회와 분리)

```ts
// 기존 apiFetch<T> 는 JSON 조회 전용 — 그대로 둠.
// 다운로드는 파싱하지 않고 URL 만 생성해 브라우저에 위임.
export function buildExportUrl(path: string, params?: Record<string, string|number|boolean>): string {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  return url.toString();
}
```

### 6.2 `dataApi.ts`

```ts
import { apiFetch, buildExportUrl } from "./client";

export interface FilterSpec {
  key: string; label: string;
  type: "select" | "daterange" | "range";
  options?: { value: string; label: string }[];   // select
  min?: number; max?: number;                       // range
}
export interface DatasetMeta {
  id: string; label: string; description: string;
  source: "table" | "file";                  // ← DB 쿼리 vs 릴리스 CSV 파일
  geometry: "point" | "polygon" | "line" | null;
  rowCount: number;                            // file 소스는 파일 수/총 행 추정
  release?: string;                            // file 소스만: 릴리스 id (provenance)
  filters: FilterSpec[];
  formats: ("csv" | "geojson")[];              // file(단기예보)은 ["csv"] 고정
}
export interface PreviewResult { columns: string[]; rows: unknown[][]; estRows: number; }

export const fetchCatalog = () => apiFetch<DatasetMeta[]>("/data/catalog");
export const fetchPreview = (id: string, f: Record<string,string|number|boolean>) =>
  apiFetch<PreviewResult>(`/data/${id}/preview`, { ...f, limit: 50 });
export const exportUrl = (id: string, fmt: "csv"|"geojson", f: Record<string,string|number|boolean>) =>
  buildExportUrl(`/data/${id}/export`, { ...f, format: fmt });
```

- **다운로드 트리거**: `ExportBar` 가 `<a href={exportUrl(...)} download>` 렌더 또는 `window.location.assign(exportUrl(...))`. fetch+blob 방식은 대용량에서 메모리 폭증 → **금지**.

---

## 7. 백엔드 — Export 라우터 설계 (신규 `app/api/v1/data.py`)

기존 라우터 컨벤션(`APIRouter()`, async, `get_db` 의존성, `@redis_cached`) 그대로.

### 7.1 데이터셋 레지스트리 = 보안 경계 (단일 출처)

사용자는 **테이블/컬럼 이름을 절대 못 보냄.** dataset id 만 받고, 서버 레지스트리가 실테이블·허용컬럼·필터·지오메트리를 결정.

```python
# app/services/dataset_registry.py
@dataclass(frozen=True)
class FilterDef:
    key: str
    column: str
    kind: Literal["select", "daterange", "range"]
    # select: 허용값도 화이트리스트(또는 사전질의), range: 숫자 컬럼

@dataclass(frozen=True)
class DatasetDef:
    id: str
    label: str
    table: str                 # "public.pv_facility" — 코드에만 존재(사용자 입력 아님)
    columns: tuple[str, ...]   # 내보낼 컬럼 화이트리스트
    geom_column: str | None    # "geom" → GeoJSON 가능
    filters: tuple[FilterDef, ...]

REGISTRY: dict[str, DatasetDef] = {
    "pv_facility": DatasetDef(
        id="pv_facility", label="PV 발전소", table="public.pv_facility",
        columns=("id","name","addr_road","sido","capacity_kw","status","approval_year"),
        geom_column="geom",
        filters=(
            FilterDef("sido","sido","select"),
            FilterDef("year","approval_year","range"),
            FilterDef("capacity","capacity_kw","range"),
        ),
    ),
    # substation / landcover / ev_charger / generation / demand / stats ...
}
```

- 컬럼/테이블/지오메트리는 **코드 상수**. 요청에 없는 dataset → 404. 알 수 없는 필터 키 → 무시. → SQL 인젝션 표면 제거(P5).
- `DatasetDef` 는 `source="table"` 의 정의. **단기예보(SMB)** 는 테이블이 아니라 파일이므로 별도 정의(`FileDatasetDef`, §7.5)로 같은 레지스트리에 등록되고, catalog DTO 에서 `source` 로 구분된다.

### 7.2 엔드포인트

| 메서드 | 경로 | 응답 | 캐시 |
|--------|------|------|------|
| GET | `/api/v1/data/catalog` | `DatasetMeta[]` (레지스트리 → DTO, 행수 포함) | `@redis_cached("data:catalog", 3600)` |
| GET | `/api/v1/data/{id}/preview?…&limit=50` | `{columns, rows, estRows}` | `@redis_cached("data:preview", 300)` (필터 양자화) |
| GET | `/api/v1/data/{id}/export?format=csv\|geojson&…` | `StreamingResponse` | **no-cache** |

### 7.3 필터 → 안전한 WHERE 빌더

```python
def build_where(ds: DatasetDef, q: dict) -> tuple[str, dict]:
    clauses, params = [], {}
    for f in ds.filters:                       # 레지스트리 정의 필터만 순회
        if f.kind == "select" and (v := q.get(f.key)):
            clauses.append(f'"{f.column}" = :{f.key}'); params[f.key] = v
        elif f.kind == "range":
            if (lo := q.get(f"{f.key}_min")) not in (None, ""):
                clauses.append(f'"{f.column}" >= :{f.key}_min'); params[f"{f.key}_min"] = lo
            if (hi := q.get(f"{f.key}_max")) not in (None, ""):
                clauses.append(f'"{f.column}" <= :{f.key}_max'); params[f"{f.key}_max"] = hi
        # daterange 유사
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params
```

- 컬럼명은 레지스트리 출처(식별자), 값은 **전부 바인드 파라미터**. 사용자 문자열이 SQL 토큰이 되는 경로 없음.

### 7.4 스트리밍 내보내기 (대용량 대응)

**CSV — PostgreSQL `COPY … TO STDOUT` (가장 빠름, 서버 포매팅)**:

```python
@router.get("/data/{dataset}/export")
async def export_dataset(dataset: str, format: str = "csv",
                         request: Request, db: AsyncSession = Depends(get_db)):
    ds = REGISTRY.get(dataset)
    if not ds: raise HTTPException(404)
    where, params = build_where(ds, dict(request.query_params))
    cols = ", ".join(f'"{c}"' for c in ds.columns)

    if format == "csv":
        sql = f'COPY (SELECT {cols} FROM {ds.table}{where}) TO STDOUT WITH (FORMAT csv, HEADER true)'
        async def gen():
            raw = await db.connection()          # asyncpg raw conn
            conn = (await raw.get_raw_connection()).driver_connection
            async for chunk in _copy_stream(conn, sql, params):
                yield chunk
        return StreamingResponse(gen(), media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{dataset}_{_stamp()}.csv"',
                     "X-Accel-Buffering": "no"})

    if format == "geojson":
        if not ds.geom_column: raise HTTPException(400, "non-spatial dataset")
        # ST_AsGeoJSON 을 행 단위로 yield → FeatureCollection 조립 스트림
        ...
```

- COPY 는 파라미터 바인딩이 제한적이므로, **값 바인딩이 필요한 WHERE 는 서버사이드 커서(`db.stream()`) + 파이썬 csv 인코딩** 경로를 기본으로 채택(안전 우선). COPY 는 무필터 풀덤프 최적화로만 선택적 사용.
- 안전한 기본 구현:

```python
result = await db.stream(text(f"SELECT {cols} FROM {ds.table}{where}"), params)
async def gen():
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(ds.columns); yield buf.getvalue(); buf.seek(0); buf.truncate()
    async for row in result:                  # 서버사이드 커서 — 전체 메모리 적재 X
        w.writerow(row); yield buf.getvalue(); buf.seek(0); buf.truncate()
```

- GeoJSON: `SELECT ST_AsGeoJSON(t.*)::text FROM … t` 행을 `{"type":"FeatureCollection","features":[` … `]}` 로 스트림 조립.
- export 는 `statement_timeout` 을 길게(예: 60s) `SET LOCAL` (조회 5s 와 별도). FDW 데이터셋(demand/generation)은 타임아웃·행수 상한 명시.

---

## 7.5 파일 소스 데이터셋 — SMB 단기예보 (file passthrough)

기상청 단기예보는 DB 에 적재하지 않는다. [`SMB_CSV_NGINX_보안계획서`](../SMB_CSV_NGINX_보안계획서_2026-03-04.md) 의 **릴리스 스왑** 산출물(로컬 `/srv/releases/current`)을 그대로 서빙한다. 원칙은 동일: **누구도 SMB(`/mnt/nas-weather-data`)를 직접 read 하지 않는다.** 백엔드는 검증 완료된 로컬 `current` 릴리스만 읽는다.

### 7.5.1 정의 & manifest

```python
@dataclass(frozen=True)
class FileDatasetDef:
    id: str                    # "weather_forecast"
    label: str                 # "기상청 단기예보"
    release_dir: str           # "/srv/releases/current" (RO 마운트)
    filename_re: str           # 허용 파일명 정규식 (보안계획서 §4.2 와 동일 규칙)
    filters: tuple[FilterDef, ...]   # 발표시각(base_time) select, 지역/격자 select

FILE_REGISTRY = {
  "weather_forecast": FileDatasetDef(
    id="weather_forecast", label="기상청 단기예보 (SMB)",
    release_dir="/srv/releases/current",
    filename_re=r"^fcst_(?P<region>[a-z]+)_(?P<base>\d{8}T\d{4}Z)\.csv$",
    filters=(FilterDef("region","region","select"),
             FilterDef("base","base","select")),
  ),
}
```

- 릴리스 디렉터리의 **`manifest.json`**(보안계획서 §4.1)을 단일 출처로 사용 → 어떤 파일이 어떤 발표시각/지역인지, SHA-256, 행수를 안다. catalog 의 필터 옵션(발표시각·지역)은 manifest 에서 동적 생성.

### 7.5.2 엔드포인트 동작 (source="file")

| 경로 | 동작 |
|------|------|
| `/data/catalog` | manifest 기반으로 forecast 데이터셋을 `source:"file", formats:["csv"], release:"<id>"` 로 함께 반환 |
| `/data/weather_forecast/preview` | 선택된 파일의 **앞 50행만** 파싱해 `{columns, rows}` 반환 (전체 로드 X) |
| `/data/weather_forecast/export?region=&base=` | manifest 에서 파일 해석 → 로컬 파일을 `FileResponse`(또는 청크 스트림)로 다운로드 |

```python
@router.get("/data/weather_forecast/export")
async def export_forecast(region: str, base: str):
    ds = FILE_REGISTRY["weather_forecast"]
    entry = resolve_manifest(ds, region=region, base=base)   # ← manifest 화이트리스트 조회
    if entry is None: raise HTTPException(404)
    path = Path(ds.release_dir) / entry["filename"]
    # 경로 검증: release_dir 밖으로 못 나가게 (traversal 차단)
    if not path.resolve().is_relative_to(Path(ds.release_dir).resolve()):
        raise HTTPException(400)
    return FileResponse(path, media_type="text/csv",
        filename=f"forecast_{region}_{base}.csv",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-store"})
```

### 7.5.3 배포/마운트

- 백엔드 컨테이너에 릴리스 디렉터리를 **read-only 바인드 마운트**: `src/docker-compose.yml` 의 backend 서비스에
  `volumes: ["/srv/releases:/srv/releases:ro"]` 추가. (SMB 마운트는 백엔드에 노출하지 않음 — 배포 파이프라인만 접근)
- 릴리스 스왑(`current` symlink)은 보안계획서의 별도 배포 파이프라인이 수행. 백엔드는 요청 시점의 `current` 만 본다.
- catalog/preview 는 Redis 캐시 가능(릴리스 id 를 캐시 키에 포함 → 스왑 시 자연 무효화). export 는 no-store.

### 7.5.4 프론트 영향 (분기 최소화)

- `dataApi`/`datacenterStore`/컴포넌트는 `DatasetMeta.source` 만 보고 분기. table↔file 의 차이는 **export URL 생성 규칙**(`?region&base` vs `?sido&...`)과 **GeoJSON 버튼 비활성**(file=csv only) 뿐 → UI 골격 공유, if-분기 한 곳(`ExportBar`)에 격리.

---

## 8. 보안 체크리스트 (P5)

- [ ] dataset/format/필터 키 = 화이트리스트. 미정의 입력은 404/무시.
- [ ] 모든 값은 바인드 파라미터(`:name`). 식별자(테이블·컬럼)는 레지스트리 상수에서만.
- [ ] preview `limit` 서버 상한(예: 100) 강제. 음수/과대 방지.
- [ ] export 응답에 `Content-Disposition` + `X-Content-Type-Options: nosniff`.
- [ ] FDW 대상은 `SET LOCAL statement_timeout` + try/except + rollback (CLAUDE.md FDW 패턴 준수).
- [ ] 기존 `보안_인젝션_및_데이터추출대응_계획서` 와 정합 — 대량 추출 rate limit(nginx)·로깅 검토.
- [ ] **(file 소스)** 백엔드는 SMB(`/mnt/nas-weather-data`)를 직접 read 안 함 — 로컬 `current` 릴리스만. SMB 마운트는 backend 컨테이너에 노출 금지.
- [ ] **(file 소스)** 서빙 파일은 manifest 화이트리스트에 존재해야 함. 파일명 정규식 일치 + `release_dir` 밖 경로(`..`/symlink) traversal 차단.
- [ ] **(file 소스)** `.csv` 만 허용, GET/HEAD 만. 응답 `no-store`.

---

## 9. 캐싱

| 대상 | 전략 |
|------|------|
| catalog | Redis 1h (`@redis_cached`). 레지스트리/행수 거의 불변 |
| preview | Redis 5m, 필터값 키에 포함(기존 bbox 양자화 패턴 응용) |
| export | **캐시 금지**(`Cache-Control: no-store`). 스트리밍 |
| nginx | `/api/v1/data/export` 는 `proxy_buffering off` + 캐시 제외(아래 §10) |

---

## 10. Nginx (`src/nginx/nginx.conf`)

- `/api/v1/` 프록시는 기존 그대로. 단 **export 경로만** 버퍼링 해제 + 타임아웃 상향:

```nginx
location /api/v1/data/ {
    proxy_pass http://backend;
    proxy_buffering off;            # 스트리밍 즉시 전달
    proxy_read_timeout 120s;        # 대용량 export
    proxy_cache off;
    add_header X-Accel-Buffering no;
}
```

- API rate limit(60r/s) 유지. 대량 export 남용은 별도 limit zone 검토(보안 §8).

---

## 11. 단계별 구현 순서 (비파괴 점진)

1. **라우팅 셸**: `App.tsx` 라우트 추가 + `GateHubPage`(정적), `/` → `/map` 이동. (지도/트윈 무영향 확인)
2. **GlobalBar 공통화**: `TopBar` → `GlobalBar` 일반화, MainPage/데이터센터 공유.
3. **백엔드 catalog**: 레지스트리 + `/data/catalog` + `@redis_cached`. (2개 데이터셋부터: pv_facility, substation)
4. **데이터센터 화면**: DatasetList → FilterPanel(동적) → PreviewTable. `dataApi`/`datacenterStore` 연결.
5. **export 스트리밍**: CSV(서버커서) → GeoJSON. nginx 버퍼링 해제.
6. **데이터셋 확장**: landcover/ev_charger/generation/demand/stats 레지스트리 추가.
7. **단기예보(file 소스)**: 릴리스 RO 마운트 + manifest 로더 + `FileResponse` export + 프론트 source 분기. (배포 파이프라인은 보안계획서 별도)
8. **게이트 폴리시**: seam/모션/텔레메트리 수치 연결(catalog/stats), reduced-motion.

각 단계는 독립 PR 가능 + 기존 기능 회귀 없음.

---

## 12. 안티패턴 회피 (스파게티 방지)

| 안티패턴 | 회피 |
|----------|------|
| `MapView.tsx`식 만능 컴포넌트 | 페이지=조립, 로직=store/훅, 뷰=프레젠테이션 분리 |
| 컴포넌트에서 직접 `fetch` | 반드시 `dataApi` 경유 |
| 다운로드 데이터를 JS 메모리에 적재 | 브라우저 네이티브 다운로드(URL 위임) |
| 테이블/컬럼명을 쿼리스트링으로 받기 | 레지스트리 화이트리스트 |
| 필터 SQL 문자열 결합 | 바인드 파라미터 |
| map/twin 과 datacenter import 교차 | feature 폴더 격리 |
| export 응답 캐싱 | no-store + nginx 캐시 제외 |

---

## 13. 수용 기준
- [ ] `/`,`/map`,`/data`,`/twin/jeju` 라우트 동작 + 기존 지도/트윈 회귀 없음.
- [ ] `/data/catalog` 가 레지스트리 기반 메타를 반환(테이블명 노출 없음).
- [ ] 정의되지 않은 dataset/필터 요청이 안전 처리(404/무시)됨.
- [ ] 50만 행급 CSV export 가 백엔드/프론트 메모리 급증 없이 스트리밍됨.
- [ ] 비공간 데이터셋 GeoJSON 요청이 400 으로 차단됨.
- [ ] 컴포넌트→store→api 단방향이 지켜지고, 컴포넌트 직접 fetch 가 없음.
- [ ] 단기예보가 catalog 에 `source:"file"` 로 노출되고, manifest 외 파일/traversal 요청이 차단됨.
- [ ] 단기예보 다운로드가 SMB 가 아닌 로컬 `current` 릴리스에서만 서빙됨(SMB 장애 시에도 동작).
