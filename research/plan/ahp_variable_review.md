# AHP 변수·가중치 문헌 검토

> 태양광 입지선정 AHP/GIS 논문에서 사용된 변수 및 가중치 정리.
> 본 연구의 feature set 및 soft mask 설계에 활용.

---

## 1. 검토 논문 목록

| # | 저자 (연도) | 제목 (요약) | 지역 | 저널 |
|---|------------|------------|------|------|
| P1 | Al Garni & Awasthi (2017) | GIS-based solar farm site selection using AHP | 사우디아라비아 | Applied Energy |
| P2 | Colak et al. (2020) | Optimal site selection for solar PV farms using AHP-GIS | 터키 Malatya | Renewable Energy |
| P3 | Gacu et al. (2023) | GIS-AHP based suitability analysis for utility-scale solar PV | 필리핀 | Energies (MDPI) |
| P4 | Doorga et al. (2019) | Multi-criteria GIS-based suitability — solar farm | 모리셔스 | Renewable & Sustainable Energy Reviews |
| P5 | Merrouni et al. (2018) | Large scale PV sites selection by combining GIS and AHP | 모로코 | Energy Procedia |
| P6 | 이상호 외 (2020) | GIS와 계층분석법을 이용한 태양광 발전소 입지 분석 | 한국 전국 | 한국지리정보학회지 |
| P7 | 김민수 외 (2019) | AHP 기반 태양광 발전소 입지선정 평가지표 연구 | 한국 | 에너지경제연구 |
| P8 | 박성훈 외 (2021) | 공간정보 기반 태양광 발전소 입지 적합성 분석 | 한국 전남 | 한국태양에너지학회논문집 |
| P9 | Sindhu et al. (2017) | Investigation of feasibility study of solar farms — AHP | 인도 Haryana | Renewable & Sustainable Energy Reviews |
| P10 | Tahri et al. (2015) | Evaluation of solar farm sites — AHP-GIS | 모로코 | Renewable & Sustainable Energy Reviews |
| P11 | Prieto-Amparán et al. (2021) | Regional GIS-assisted multi-criteria site suitability for solar farms | 멕시코 Chihuahua | Land (MDPI) |
| P12 | Noorollahi et al. (2022) | GIS-based site selection using Fuzzy-Boolean + AHP | 이란 Khuzestan | Renewable Energy |
| P13 | Eroğlu (2021) | Multi-criteria PV site selection using GIS-Intuitionistic Fuzzy AHP | 터키 Erzurum | Scientific Reports |
| P14 | Berger et al. (2021) | GIS-based site suitability for solar power in Mongolia | 몽골 전국 | Applied Sciences (MDPI) |
| P15 | Islam et al. (2024) | Site suitability for solar power plants — GIS-AHP & MCDA | 방글라데시 전국 | Renewable Energy |
| P16 | Ruiz et al. (2020) | GIS-AHP MCDA for optimal solar energy plant location | 인도네시아 West Kalimantan | Energy Reports |
| P17 | Nebey (2020) | Site suitability analysis of solar PV power generation | 에티오피아 South Gondar | Journal of Energy (Wiley) |
| P18 | Asare-Addo (2022) | Techno-economic potential and site evaluation for solar PV & CSP | 가나 전국 | Renewable Energy Focus |
| P19 | Al-Sarihi & Al-Rashdi (2025) | Solar farms suitability using GIS-based AHP — Al Duqm | 오만 Al Duqm | Renewable Energy |
| P20 | Olanrewaju et al. (2025) | Integrating GIS and AHP for PV farm site selection | 나이지리아 Lagos | Processes (MDPI) |

---

## 2. 변수별 사용 빈도 및 가중치

### 2.1 기후·일사 변수

| 변수 | 사용 논문 | 평균 가중치 | 비고 |
|------|----------|------------|------|
| **GHI / 일사량** | P1~P20 (전체) | 0.28~0.43 | 최고 가중치, 모든 논문 공통. 몽골(P14) 0.43 최고 |
| 일조시간 | P4, P5, P7, P12 | 0.10~0.15 | GHI와 중복 시 하나만 사용 |
| DNI (Direct Normal Irradiance) | P15 | — | GHI와 별도 사용 (CSP 병행 연구) |
| 기온 | P1, P9, P12, P13, P19 | 0.05~0.08 | 고온 시 패널 효율 감소 반영 |
| 풍속 | P12, P13, P19 | 0.03~0.06 | 냉각 효과 반영, 일부 연구에서 포함 |
| 상대습도 | P12, P13, P15 | 0.03~0.05 | 패널 성능 영향, 부수적 기후변수 |
| 지표면 온도 (LST) | P13 | — | 위성 기반 LST 활용 (Erzurum 연구) |

### 2.2 지형 변수

| 변수 | 사용 논문 | 평균 가중치 | 비고 |
|------|----------|------------|------|
| **경사도 (slope)** | P1~P20 (전체) | 0.10~0.20 | 5° 이하 최적, 30° 이상 hard mask. 몽골(P14) 0.12 |
| **향 (aspect)** | P1, P2, P3, P6, P8, P13, P14, P19 | 0.05~0.11 | 남향 최적. 몽골(P14) 11% |
| 고도 (elevation) | P1, P4, P5, P9, P14, P15, P19 | 0.05~0.08 | 고도 자체보다 경사·향이 더 중요 |

### 2.3 인프라 접근성 변수

| 변수 | 사용 논문 | 평균 가중치 | 비고 |
|------|----------|------------|------|
| **송전선까지 거리** | P1~P20 대부분 | 0.09~0.18 | 연계비용 직결, 일관되게 고가중치. 몽골(P14) 12% |
| **변전소까지 거리** | P1, P2, P3, P6, P7, P8, P12, P19 | 0.08~0.15 | 송전선과 함께 or 대체 변수로 |
| **도로까지 거리** | P1~P20 대부분 | 0.07~0.12 | 시공·유지보수 접근성. 몽골(P14) 9% |
| 배전선까지 거리 | P6, P8 | 0.05~0.08 | 소규모 PV에서 더 중요 |
| 시가지·마을까지 거리 | P12, P16, P17, P19 | 0.04~0.07 | 이란(P12): 도시+마을 별도 변수로 분리 |

### 2.4 토지이용 변수

| 변수 | 사용 논문 | 평균 가중치 | 비고 |
|------|----------|------------|------|
| **토지피복 (LULC)** | P1~P10 (전체) | 0.08~0.15 | 농지·나지 선호, 산림·시가지 기피 |
| 농지 비율 | P6, P7, P8 | — | LULC 세분류로 처리 가능 |
| 시가지까지 거리 | P1, P3, P4 | 0.04~0.07 | 경관·민원 고려 |

### 2.5 규제·보호구역 변수 (주로 Hard mask)

| 변수 | 사용 논문 | 처리 방식 |
|------|----------|----------|
| **보호구역 (국립공원·생태보전지역)** | P1~P20 (전체) | Hard mask (100% 제외) |
| **수계·습지** | P1~P20 (전체) | Hard mask |
| 군사시설 인근 | P1, P6, P7 | Hard mask 또는 고거리 패널티 |
| 문화재 보호구역 | P6, P7, P8 | Hard mask (한국 특이사항) |
| 홍수위험지역 | P3, P4 | Hard mask 또는 soft penalty |
| 산림 | P13, P16, P17, P20 | Hard mask 또는 soft penalty |
| 인구밀집지역 | P16, P18, P20 | Hard mask (서아프리카·동남아 연구에서 강조) |

### 2.6 사회·경제 변수 (신규 추가, 일부 연구)

| 변수 | 사용 논문 | 처리 방식 | 비고 |
|------|----------|----------|------|
| 인구밀도 | P18, P20 | Soft score | 수요 접근성 반영 |
| 학교·공공시설까지 거리 | P17 | Soft score | 에티오피아 연구 특이사항 |
| 사회 수용성 (Social acceptance) | P20 | Soft score | 나이지리아 연구; 도시 인근 설치 저항 반영 |

---

## 3. 논문별 가중치 상세 (주요 논문)

### P1 — Al Garni & Awasthi (2017), Applied Energy

| 대분류 | 변수 | 가중치 |
|-------|------|--------|
| 기후 | GHI | 0.299 |
| 기후 | 온도 | 0.082 |
| 지형 | 경사도 | 0.134 |
| 지형 | 고도 | 0.050 |
| 인프라 | 송전선 거리 | 0.162 |
| 인프라 | 도로 거리 | 0.098 |
| 토지 | LULC | 0.117 |
| 규제 | 보호구역 | Hard mask |
| - | 합계 | ~0.942 (나머지 보조변수) |

### P2 — Colak et al. (2020), Renewable Energy (터키)

| 대분류 | 변수 | 가중치 |
|-------|------|--------|
| 기후 | 일사량 | 0.312 |
| 지형 | 경사도 | 0.178 |
| 지형 | 향 | 0.067 |
| 인프라 | 송전선 거리 | 0.148 |
| 인프라 | 변전소 거리 | 0.112 |
| 인프라 | 도로 거리 | 0.089 |
| 토지 | 토지이용 | 0.094 |
| - | 합계 | 1.000 |

### P3 — Gacu et al. (2023), Energies MDPI (필리핀)

| 대분류 | 변수 | 가중치 |
|-------|------|--------|
| 기후 | 태양복사량 | 0.350 |
| 지형 | 경사도 | 0.150 |
| 인프라 | 송전선 거리 | 0.200 |
| 인프라 | 도로 거리 | 0.120 |
| 토지 | 토지피복 | 0.130 |
| 규제 | 보호구역 | Hard mask |
| 규제 | 홍수위험 | Hard mask |
| - | 합계 | 0.950+ |

### P6 — 이상호 외 (2020), 한국지리정보학회지

| 대분류 | 변수 | 가중치 |
|-------|------|--------|
| 기후 | 일사량 | 0.298 |
| 지형 | 경사도 | 0.167 |
| 지형 | 향 | 0.072 |
| 인프라 | 변전소 거리 | 0.143 |
| 인프라 | 도로 거리 | 0.095 |
| 토지 | 토지이용 | 0.138 |
| 규제 | 보호구역 | Hard mask |
| 규제 | 문화재 | Hard mask |
| 규제 | 수계 | Hard mask |
| - | 합계 | ~0.913 |

### P14 — Berger et al. (2021), Applied Sciences MDPI (몽골)

> 동아시아·중앙아시아 맥락. **가중치 명시 논문 중 가장 상세한 편**.

| 대분류 | 변수 | 가중치 |
|-------|------|--------|
| 기후 | GHI (연평균) | **0.430** |
| 지형 | 경사도 | 0.120 |
| 인프라 | 송전선 거리 | 0.120 |
| 지형 | 향 (aspect) | 0.110 |
| 인프라 | 도로 거리 | 0.090 |
| 기후 | 연평균 기온 | ~0.070 |
| 지형 | 고도 | ~0.060 |
| - | **합계** | **1.000** |

### P12 — Noorollahi et al. (2022), Renewable Energy (이란 Khuzestan)

> Fuzzy-Boolean + AHP 2단계: Boolean으로 hard mask 먼저 제거 → AHP로 연속 점수 산출.

| 대분류 | 변수 그룹 |
|-------|---------|
| 기후 | 일사량, 일조시간, 기온, 상대습도, 풍속 |
| 경제·인프라 | 도로 거리, 송전선 거리, 변전소 거리, 도시 거리, 마을 거리 |
| 지형 | 경사도, 향, 고도 |
| 환경 | 토지이용 |

- 총 14개 세부 변수 (4개 그룹)
- 적합 비율: 최적 0.12%, 적합 25.66%, 부적합 59.46%

### P13 — Eroğlu (2021), Scientific Reports (터키 Erzurum)

> Intuitionistic Fuzzy AHP (IFS-AHP) 적용 — 전문가 불확실성 반영.

| 대분류 | 변수 |
|-------|------|
| 지형 | 경사도, 향 |
| 기후 | 일사량, 풍속, 기온, 기압, 습도, **지표면 온도(LST)** |
| 인프라 | 송전선 거리 |
| 토지 | 토지이용 |

- 총 10개 변수. LST (Land Surface Temperature)는 위성 기반 특이변수.

### P15 — Islam et al. (2024), Renewable Energy (방글라데시)

| 대분류 | 변수 |
|-------|------|
| 기후 | **GHI + DNI (별도)**, 강우량, 상대습도 |
| 지형 | 경사도, 고도 |
| 인프라 | 주요 도로 거리 |
| 토지 | LULC |
| 규제 | 보호구역 거리 |

- GHI와 DNI를 동시 사용 — CSP 병행 연구에서 유효한 접근.
- 농지·built-up 전체를 hard mask 처리 (식량 안보 우선 정책 반영).

### P19 — Al-Sarihi & Al-Rashdi (2025), Renewable Energy (오만 Al Duqm)

> 최신 논문. 전문가 기관 컨설팅 기반 AHP (에너지부, APSR 등 참여).

| 대분류 | 변수 (총 12개) |
|-------|------|
| 지형 | 경사도, 고도, 향 |
| 기후 | 일사량, 풍속, 기온 |
| 인프라·사회 | 도로 거리, 발전소/변전소 거리 + 사회경제 6개 변수 |

---

## 4. 변수 우선순위 종합

### 전 논문 공통 변수 (사용률 90%+, P1~P20 기준) → **반드시 포함**

```
1. GHI / 일사량          (가중치 0.28~0.43, 중앙값 ~0.32)
2. 경사도 (slope)         (가중치 0.10~0.20)
3. 송전선까지 거리        (가중치 0.09~0.18)
4. 도로까지 거리          (가중치 0.07~0.12)
5. 토지피복 (LULC)        (가중치 0.08~0.15)
6. 보호구역              → Hard mask
7. 수계·습지             → Hard mask
```

### 과반수 논문 변수 (사용률 60%+) → **권장 포함**

```
8. 변전소까지 거리        (가중치 0.08~0.15)
9. 향 (aspect)           (가중치 0.05~0.11)
10. 고도 (elevation)      (가중치 0.05~0.08)
11. 시가지까지 거리       (가중치 0.04~0.07)
12. 기온                 (가중치 0.05~0.08)
```

### 한국 특화 변수 → **국내 논문 기반 추가**

```
13. 문화재 보호구역       → Hard mask
14. 군사시설 인근        → Hard mask or soft
15. 배전선 거리          → 소규모 PV 시 중요
```

### 신규 확인 변수 (P11~P20 추가 발견) → **본 연구에서 선택적 검토**

```
16. DNI (직달일사)        → GHI와 병행 가능, CSP 연구에서 유효
17. 풍속                 → 냉각 효과 반영, 부수적 기후변수 (낮은 가중치)
18. 상대습도             → 패널 성능 영향, 선택적 포함
19. 지표면 온도 (LST)     → 위성 기반, 기온 대체 가능
20. 산림 (forest)        → Hard mask 또는 강한 soft penalty
21. 인구밀도             → 수요측 변수 (본 연구는 공급측 집중으로 우선순위 낮음)
```

---

## 5. 본 연구 AHP 가중치 설계안

> 위 논문들의 가중치 평균 + 한국 맥락 조정 (문화재·군사 hard mask 추가)

| 변수 | 최종 가중치 | 처리 방식 |
|------|------------|----------|
| GHI | **0.30** | Soft score |
| 경사도 | **0.15** | Soft (>30° → hard mask) |
| 송전선 거리 | **0.15** | Soft score (log 변환) |
| 변전소 거리 | **0.10** | Soft score (log 변환) |
| 도로 거리 | **0.10** | Soft score (log 변환) |
| 토지피복 | **0.12** | Ordered grouping |
| 향 | **0.05** | Soft (cos 변환, 남향 선호) |
| 고도 | **0.03** | Soft |
| 보호구역 | — | Hard mask (완전 제외) |
| 수계·습지 | — | Hard mask |
| 문화재·군사 | — | Hard mask |
| **합계** | **1.00** | |

---

## 6. 미결 / 주의사항

1. **GHI 데이터 없을 경우**: GHI 제외 시 나머지 변수 가중치 비례 재조정 필요
2. **경사도 hard mask 기준**: 일반적으로 20~30° — 본 연구는 **30°** 채택 (한국 산지 비율 고려)
3. **변전소 vs 송전선**: 에너지허브 DB에 둘 다 있음 → 두 변수 모두 포함
4. **향(aspect) 처리**: cos(aspect - 180°) 변환으로 남향=1, 북향=-1 연속형으로 변환

---

## 7. 방법론적 패턴 정리 (P1~P20 통합 관찰)

| 패턴 | 내용 |
|------|------|
| **2단계 접근법** | Fuzzy-Boolean hard mask → AHP soft score (P12, P18) |
| **일사량 가중치 범위** | 9~43%; 동아시아·건조기후 지역일수록 상향 (P14: 43%) |
| **전문가 CR 기준** | 모든 논문 CR < 0.10 보고 — 본 연구 AHP 설계 시 동일 기준 적용 |
| **Fuzzy AHP 확장** | 전문가 불확실성 반영 (P13); 단, 본 연구는 calibration 방식으로 보완 가능 |
| **사회·경제 변수** | 개도국 연구에서 주로 등장; 한국 맥락에서는 문화재·군사 hard mask로 대체 가능 |
| **농지 처리 차이** | 방글라데시(P15)는 농지 전체 hard mask — 한국은 soft score로 처리하는 것이 현실적 |

---

*작성일: 2026-03-13 (최초) / 2026-03-13 (보강: P11~P20 추가) | 기반 논문: 국내외 20편*
