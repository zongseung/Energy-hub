# Hybrid Spatial Reconstruction of PV Locations — v3
## 변수·GIS 규격 구체화

> v2 모델 구조(Conditional Multinomial Allocation) 유지.
> v3에서는 **GIS 좌표계 규격**, **변수별 데이터 소스**, **처리 파이프라인**을 구체화한다.

---

## 1. GIS 좌표계 표준

### 1.1 기준 CRS

| 용도 | CRS | 단위 | 이유 |
|------|-----|------|------|
| 격자 생성 / 거리 계산 | **EPSG:5179** (GRS80 / Korea 2000) | meter | 한국 국가 표준, 왜곡 최소 |
| 원본 저장 / PostGIS | EPSG:4326 (WGS84) | degree | energy-hub-db 기존 CRS |
| 최종 산출물 | EPSG:4326 | degree | 시각화 호환 |

처리 규칙:
- 거리 계산·격자 생성은 **EPSG:5179에서 수행**
- 산출물 저장 전 EPSG:4326으로 역변환

### 1.2 격자 생성 기준

- 해상도: 500m × 500m (기본), 250m / 1km (민감도)
- 범위: 한국 육지 행정경계 bbox 기준 (`admin_boundary` 전체 envelope)
- 총 격자 수 예상: 약 400,000셀 (500m 기준)
- 해안 및 도서지역: 시군구 내부 교차 격자만 포함 (`ST_Intersects`)

### 1.3 레이어 해상도 통일 규칙

| 레이어 유형 | 처리 방식 |
|------------|-----------|
| Raster (GHI, DEM 등) | 격자 centroid로 bilinear 보간 추출 |
| Vector polygon (LULC, 보호구역) | 격자와 overlay → 면적 가중 dominant class |
| Vector line (도로, 송전선) | 격자 centroid → nearest euclidean distance |
| Vector point (변전소) | 격자 centroid → nearest euclidean distance |

---

## 2. 변수 데이터 소스

### 2.1 현재 보유 (energy-hub-db에서 즉시 추출 가능)

| 변수 | 테이블 | 처리 방법 | 산출 컬럼 |
|------|--------|-----------|-----------|
| 관측 PV 좌표 | `pv_facility` (has_coord=true) | 격자 spatial join → count | `y_g_obs` |
| 시군구 경계 | `admin_boundary` | grid에 region_id 부여 | `region_id` |
| 변전소 거리 | `substation` | centroid → nearest point | `dist_substation` |
| 송전선 거리 | `power_line` | centroid → nearest line | `dist_transmission` |
| LULC 클래스 | `landcover` (EGIS lv2_2025y) | 격자별 dominant l2_code | `lulc_class` |
| 개발가능지 비율 | `landcover` | 격자 내 개발가능 면적 비율 | `developable_ratio` |
| 수면 여부 | `landcover` | l2_code 수계 클래스 → hard mask | `mask_water` |

### 2.2 추가 수집 필요 (우선순위 순)

| 변수 | 출처 | 포맷 | 해상도 | 난이도 |
|------|------|------|--------|--------|
| **도로 네트워크** | OSM Korea (`geofabrik.de`) | .osm.pbf → shapefile | Vector | ⭐ 매우 쉬움 (무료 다운로드) |
| **보호구역** | 환경부 환경공간정보서비스 (`egis.me.go.kr`) | Shapefile | Vector | ⭐ 쉬움 (무료) |
| **DEM (고도·경사·향)** | 국토지리정보원 수치표고모델 또는 SRTM 30m | GeoTIFF | 30m | ⭐⭐ 보통 |
| **GHI (일사량)** | KIER 태양자원지도 또는 ERA5 reanalysis | GeoTIFF / NetCDF | ~1km | ⭐⭐ 보통 |
| **시군구별 PV 총량 N_r** | KEA 신재생에너지 보급통계 또는 data.go.kr | CSV/Excel | 시군구 | ⭐⭐ 보통 |

### 2.3 변수별 처리 메모

**도로 (dist_road)**
- OSM에서 `highway` 태그 필터: primary / secondary / tertiary
- 고속도로(motorway)는 접근성보다 barrier에 가까우므로 분리 검토

**LULC (landcover)**
- EGIS lv2_code 기반 개발가능 여부 분류:
  - hard mask (0): 수계(5xxx), 습지(6xxx)
  - 설치 불리 (soft): 시가지(1xxx), 산림(4xxx)
  - 설치 유리 (soft): 농지(2xxx), 나지(3xxx)

**DEM → slope / aspect**
- GDAL `gdaldem slope` / `gdaldem aspect` 로 파생
- slope > 30° → hard mask 검토

**GHI**
- KIER 태양자원지도: `10-year average GHI (kWh/m²/day)` raster
- ERA5 대안: `surface_solar_radiation_downwards` → 연평균 환산
- 500m 격자 centroid에서 bilinear 보간

**N_r (시군구별 공식 총량)**
- KEA 통계: 설비용량(kW) + 설비수(개소) 모두 확인
- data.go.kr `전기사업허가` CSV에서 시군구별 집계 가능 (이미 `pv_facility`에 있음)
- 기준 시점을 반드시 맞춰야 함 → 2023 또는 2024 기준으로 고정

---

## 3. grid_master_table 컬럼 정의

v2 PRD의 `grid_master_table` 스키마를 데이터 소스와 연결한 최종판:

### 3.1 식별 / 위치

| 컬럼 | 타입 | 소스 | 비고 |
|------|------|------|------|
| `grid_id` | int | 생성 | EPSG:5179 기준 순번 |
| `region_id` | str | admin_boundary | 시군구 코드 |
| `cx` | float | 생성 | centroid lon (EPSG:4326) |
| `cy` | float | 생성 | centroid lat (EPSG:4326) |
| `grid_area_m2` | float | 생성 | 500×500=250000 (해안 셀은 작을 수 있음) |

### 3.2 타깃

| 컬럼 | 타입 | 소스 |
|------|------|------|
| `y_g_obs` | int | pv_facility → spatial join count |
| `has_obs_pv` | bool | y_g_obs > 0 |

### 3.3 Hard mask

| 컬럼 | 기준 | 소스 |
|------|------|------|
| `M_hard` | AND of below | 종합 |
| `mask_water` | LULC 수계 클래스 | landcover |
| `mask_protected` | 보호구역 내부 여부 | 환경부 |
| `mask_steep` | slope > 30° | DEM 파생 |
| `mask_restricted_lulc` | 설치 명백 불가 LULC | landcover |

### 3.4 AHP

| 컬럼 | 설명 |
|------|------|
| `ahp_score` | 선행연구 가중치 기반 suitability 점수 |
| `ahp_class` | 1~5등급 (national quantile) |
| `ahp_softmask` | calibrated R_k (Laplace smoothing + clipping 0.25~4.0) |

### 3.5 물리/환경 변수

| 컬럼 | 소스 | 변환 |
|------|------|------|
| `ghi` | KIER / ERA5 | 연평균 (kWh/m²/day) |
| `slope` | DEM | degree |
| `aspect` | DEM | degree (0~360) |
| `elevation` | DEM | meter |
| `lulc_class` | landcover | EGIS lv2_code |
| `developable_ratio` | landcover | 격자 내 농지·나지 비율 |

### 3.6 거리형 변수

| 컬럼 | 소스 | 변환 |
|------|------|------|
| `dist_road` | OSM road | meter (Euclidean) |
| `dist_transmission` | power_line | meter |
| `dist_substation` | substation | meter |
| `dist_urban` | landcover (시가지 클래스) | meter |
| `log_dist_road` | - | log1p(dist_road) |
| `log_dist_transmission` | - | log1p(dist_transmission) |
| `log_dist_substation` | - | log1p(dist_substation) |

### 3.7 버퍼 요약 변수

| 컬럼 | 설명 |
|------|------|
| `road_density_1km` | 1km 반경 내 도로 총길이 / 면적 |
| `urban_ratio_1km` | 1km 반경 내 시가지 비율 |
| `developable_ratio_1km` | 1km 반경 내 개발가능지 비율 |

### 3.8 공간효과 대체 변수

| 컬럼 | 설명 |
|------|------|
| `pv_kde_1km` | 관측 PV 점 kernel density (1km bandwidth) |
| `neighbor_pv_count` | 인접 8셀 평균 observed PV count |

### 3.9 상호작용 변수

| 컬럼 | 수식 |
|------|------|
| `ghi_x_developable` | ghi × developable_ratio |
| `ghi_x_log_dist_substation` | ghi × log_dist_substation |

---

## 4. 처리 파이프라인

```
[energy-hub-db]
  pv_facility, substation, power_line,
  landcover, admin_boundary
        │
        ▼
[00_data_export.ipynb] ─── 학교서버 전용
  → pv_points_observed.gpkg
  → district_totals.parquet  (N_r 포함)
  → infra_layers.gpkg        (substation, power_line)
  → lulc_layer.gpkg          (landcover)
  → admin_boundary.gpkg

[외부 수집]
  OSM road → road_korea.gpkg
  환경부 보호구역 → protected_area.gpkg
  SRTM / 국토지리정보원 → dem_korea.tif
  KIER / ERA5 → ghi_korea.tif

        │
        ▼ (어디서든 실행 가능)
[01_grid_build.ipynb]
  → analysis_grid_500m.parquet (EPSG:5179 기준 생성, 4326 저장)

[02_feature_matrix.ipynb]
  → 거리 계산 (EPSG:5179)
  → raster 추출 (bilinear)
  → hard mask 생성
  → feature_matrix_500m.parquet

[03_ahp_prior.ipynb]
  → AHP score 계산
  → 등급화 + calibration
  → ahp_prior_500m.parquet

[04_model.ipynb]
  → Model A/B/C 학습
  → model_metrics.csv

[05_reconstruction.ipynb]
  → U_r 계산
  → p_rg → m_rg → Z_hat_g
  → reconstructed_pv_grid_500m.parquet
  → synthetic_pv_points_500m.gpkg

[06_validation.ipynb]
  → hold-out 검증
  → 공간패턴 검증
  → 환경분포 검증
```

---

## 5. 1차 고정 Feature Set

### Basic (지금 당장 가능)
```
y_g_obs, M_hard,
dist_transmission, log_dist_transmission,
dist_substation, log_dist_substation,
lulc_class, developable_ratio,
mask_water, mask_restricted_lulc
```

### Standard (OSM 도로 + 보호구역 추가 후)
```
Basic +
dist_road, log_dist_road,
mask_protected,
road_density_1km, developable_ratio_1km
```

### Full (GHI + DEM 추가 후)
```
Standard +
ghi, slope, aspect, elevation,
mask_steep,
ghi_x_developable, ghi_x_log_dist_substation
```

### Spatial (공간효과 추가)
```
Full +
pv_kde_1km, neighbor_pv_count
```

---

## 6. 전처리 규칙 요약

| 변수 유형 | 처리 |
|----------|------|
| 연속형 | winsorize(1%, 99%) → z-score 표준화 |
| 거리형 | log1p 변환 → z-score |
| 범주형 LULC | ordered grouping (개발가능 수준 순서) |
| Hard mask | 0/1 binary, 표준화 없음 |
| Soft mask (AHP) | clipping(0.25, 4.0) 후 log 변환 |
| KDE 변수 | hold-out 점 제외 후 재계산 (leakage 방지) |

---

## 7. 데이터 수집 우선순위 액션플랜

| 순서 | 작업 | 소요 시간 |
|------|------|-----------|
| 1 | energy-hub-db에서 `00_data_export` 실행 | 1시간 |
| 2 | OSM Korea 도로 다운로드 (geofabrik) | 30분 |
| 3 | 환경부 보호구역 다운로드 | 1시간 |
| 4 | SRTM 30m DEM 다운로드 (NASA Earthdata) | 1시간 |
| 5 | KIER 또는 ERA5 GHI 확보 | 2~4시간 |
| 6 | N_r 확정 (KEA 통계 or data.go.kr 집계) | 반나절 |

---

## 8. 미결 사항

1. **N_r 단위 확정**: count vs capacity — data.go.kr `pv_facility`의 `capacity_kw`와 설비 수 중 어떤 걸 N_r로 쓸지
2. **LULC 시점 불일치**: 설치 당시 토지 분류가 달랐을 수 있음 — v1 데이터(2024y, 2025y) 병행 사용 여부
3. **pv_facility 좌표 보유율**: has_coord=true 비율이 얼마인지 → 첫 번째로 확인해야 할 숫자

---
