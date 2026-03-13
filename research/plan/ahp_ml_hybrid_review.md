# ML 기반·Hybrid 태양광 PV 입지선정 문헌 검토

> ML 단독 / GIS+ML / AHP+ML Hybrid 접근법 논문 정리.
> 본 연구의 Conditional Multinomial Allocation Model 설계 및 feature set 구성에 활용.

---

## 1. 검토 논문 목록

| # | 저자 (연도) | 제목 (요약) | 지역 | 저널 | 모델 유형 |
|---|------------|------------|------|------|----------|
| M1 | Xia et al. (2023) | Interpretable ML로 대규모 PV 입지 선택 공간 모델링 | 중국 전국 | Energy Conversion & Management | RF, XGBoost, MLP + SHAP |
| M2 | Yildiz & Arslan (2022) | Explainable AI 기반 태양광·풍력 전지구 적합성 매핑 | 전지구 (55k+ 사이트) | ISPRS IJGI | RF, SVM, MLP + SHAP |
| M3 | Alshamrani et al. (2025) | GIS + ML 기반 태양광 입지선정 (파키스탄) | 파키스탄 Cholistan 사막 | Processes (MDPI) | RF, XGBoost, MLP + SHAP |
| M4 | Liu et al. (2024) | 결합 가중치 기반 PV 입지 적합성 평가 | 중국 베이징-톈진-허베이 | Land (MDPI) | **AHP + XGBoost** Hybrid |
| M5 | Song et al. (2023) | PSO-XGBoost + GIS로 중국 전역 PV 잠재량 평가 | 중국 전국 | Applied Energy | PSO-XGBoost + GIS |
| M6 | Wang et al. (2025) | ML 기반 지역·시계열 PV/풍력 사이트 확률 모델 | 중국 전국 | Applied Energy | RF, XGBoost, MLP (시계열) |
| M7 | Ozbek & Yildiz (2021) | MaxEnt 모델로 재생에너지 입지 선정 | 터키 동지중해 | Environmental Science & Pollution Research | **MaxEnt** |
| M8 | Kim et al. (2023) | CNN으로 패널 탐지 + XGBoost로 사회경제 드라이버 분석 | 미국 콜로라도 | EPJ Data Science | **Faster R-CNN + XGBoost** |
| M9 | Raza et al. (2025) | GIS-AI Hybrid로 CSP 최적입지 + 기후변화 시나리오 | 이란 Bushehr | Advances in Space Research | **RF + CNN + Fuzzy MCDA** |
| M10 | Li et al. (2025) | Fuzzy 종합 평가 + ML 앙상블 PV 적합성 매핑 | 중국 전국 | Remote Sensing (MDPI) | Fuzzy CE + ML Ensemble |
| M11 | Patel & Yadav (2025) | ANN+AHP+GIS Hybrid + PCA + Monte Carlo 불확실성 정량화 | 인도 남부 | Sustainable Energy Technologies & Assessments | **ANN + AHP + GIS** |
| M12 | Liang et al. (2025) | DL 앙상블 + GIS로 옥상 태양광 잠재량 고정밀 매핑 | 네덜란드 암스테르담 | J. Geovisualization & Spatial Analysis | **DL Ensemble** (UNet, DeepLabv3 등 5모델) |
| M13 | Cengiz et al. (2024) | Fuzzy MCDM + GIS + ML 풍력·태양광 입지선정 | 다지역 | Euro-Mediterranean J. for Environmental Integration | Fuzzy MCDM + ML |
| M14 | Biresselioglu et al. (2021) | 지역 GIS 다기준 태양광 입지 평가 (AHP baseline) | 터키 다지역 | Land (MDPI) | GIS-AHP (MCDA baseline) |
| M15 | Manfreda et al. (2024) | 미국 남동부 태양광 입지 적합성 모델링 | 미국 조지아주 | Energies (MDPI) | GIS-MCDA (AHP 적용) |

---

## 2. 논문별 상세 정보

### M1 — Xia et al. (2023), Energy Conversion & Management (중국)

**모델:** Random Forest, XGBoost, MLP + **SHAP explainability**
**타깃:** Binary — PV 설치 여부 (1 km² 격자)

| 변수 그룹 | 변수 (총 21개) |
|----------|----------------|
| 자연·기후 | 일사량(GHI), 기온, 강우량, 풍속 |
| 지형 | 경사도, 고도, 향 |
| 토지 | LULC, **NDVI** |
| 인프라 | 송전망까지 거리, 도로까지 거리 |
| 사회·경제 | GDP, 인구밀도, 전력 수요 |
| 정책 | 생태 레드라인 |

**SHAP 상위 변수:** NDVI, 송전망 거리 (1·2위), GHI (3위)
**성능:** RF 최고; XGBoost ≈ RF

---

### M2 — Yildiz & Arslan (2022), ISPRS IJGI (전지구)

**모델:** RF, SVM, MLP + SHAP
**타깃:** Binary — 실제 태양광 발전소 위치 여부
**데이터:** 전지구 55,000+ 사이트

| 변수 |
|------|
| 일사량(GHI), 경사도, LULC |
| 송전망 거리, 도로 거리, 기온, 고도 |

**성능:** RF AUC = **0.95**, Acc = 90% (최고)
> 전지구 규모 연구 → 변수 일반화 가능성 확인.

---

### M3 — Alshamrani et al. (2025), Processes MDPI (파키스탄)

**모델:** RF, XGBoost, MLP + SHAP
**타깃:** Binary suitability

| 변수 (14개) |
|-------------|
| 일사량, 경사도, **향(aspect)**, LULC |
| 송전망 거리, 도로 거리, 토양 유형 |
| 기온, 상대습도 |

**SHAP 상위 변수:** 향(aspect), 일사량, 송전망 거리
**성능:** RF AUC = **0.92** (최고)

---

### M4 — Liu et al. (2024), Land MDPI (중국 베이징-톈진-허베이)

**모델:** **AHP + XGBoost Hybrid** → PDSI(종합 적합성 지수) 산출
**타깃:** 연속형 PDSI score

| 변수 그룹 | 변수 |
|----------|------|
| 생태 | NDVI, 생태 민감도 |
| 경제 | 지가, 송전망 거리, 도로 거리 |
| 지형·기후 | 경사도, 향, GHI, LULC |

**결과:** 21.59% 면적이 적합 판정
> AHP로 초기 가중치 설정 → XGBoost로 비선형 보정하는 구조 — **본 연구와 가장 유사한 hybrid 설계**.

---

### M5 — Song et al. (2023), Applied Energy (중국 전국)

**모델:** **PSO-optimized XGBoost** + GIS
**타깃:** 연속형 GHI / PV potential (kWh/m²)

| 변수 |
|------|
| 일조시간, 기온, 상대습도, 고도 |
| 위도/경도, 운량, 에어로졸 광학 두께(AOD) |

**성능:** PSO-XGBoost > 일반 XGBoost (RMSE 기준)
> 하이퍼파라미터 최적화(PSO) 효과 입증. SHAP 해석성 포함.

---

### M6 — Wang et al. (2025), Applied Energy (중국 전국)

**모델:** RF, XGBoost, MLP (지역별 + **시계열 모델**)
**타깃:** 1 km² 격자 설치 확률

| 변수 |
|------|
| 도로까지 거리 (~5 km 임계), **변전소까지 거리 (~30 km 임계)** |
| GHI, 경사도, LULC |
| GDP, 인구, **시간대(연도)** |

**SHAP 상위 변수:** 도로 거리, 변전소 거리 (1·2위)
> 시계열 모델: 시기별 입지 선호 변화 포착. **시간 특성 변수 도입 사례**.

---

### M7 — Ozbek & Yildiz (2021), Env. Science & Pollution Research (터키)

**모델:** **MaxEnt** (생물종 분포 모델을 에너지 입지에 전용)
**타깃:** 서식지 적합도 확률 (0~1)

| 변수 |
|------|
| GHI, 기온, 고도, 경사도, 향 |
| LULC, 강수량, 취락 거리 |

**성능:** 태양광 AUC = **0.87**
> MaxEnt: 실제 설치 위치만 있고 '비설치 확인' 데이터가 없을 때 유효 (presence-only).

---

### M8 — Kim et al. (2023), EPJ Data Science (미국 콜로라도)

**모델:** Stage 1 — **Faster R-CNN** (위성이미지에서 패널 탐지), Stage 2 — **XGBoost** (사회경제 드라이버, 43개 변수)

| Stage 1 변수 | Stage 2 변수 (43개) |
|---|---|
| 위성 이미지 | 정당 투표 성향, 우박 위험도, 주택 가격 |
| 건물 지붕 | 임차 비율, 허가 소요 기간 |

**성능:** R-CNN mAP=81~95%, XGBoost R²=**0.70**
> 탐지(R-CNN) + 설명(XGBoost) 2단계 구조 참고 가능.

---

### M9 — Raza et al. (2025), Advances in Space Research (이란)

**모델:** **RF + CNN + Fuzzy MCDA** 3단계 Hybrid
**타깃:** Binary suitability (고적합 면적 5.37%)

| 변수 |
|------|
| DNI, 기온, 상대습도, 경사도 |
| LULC, 도로 거리, 송전망 거리, 풍속 |
| **RCP 기후변화 시나리오 (2050, 2100)** |

**성능:** RF+CNN hybrid가 MCDA 단독 대비 **+12.7% 정확도**
> 기후변화 시나리오 통합 사례 — 미래 적합성 평가에 유효.

---

### M10 — Li et al. (2025), Remote Sensing MDPI (중국 전국)

**모델:** **Fuzzy 종합 평가 + ML 앙상블**
**타깃:** 연속형 적합성 점수 (경제·기후·지리 통합)

| 변수 (11개) |
|-------------|
| GHI, 지가, 전력 수요, 경사도, 향 |
| LULC, 송전망 거리, 기온, 고도 |
| 생태 민감도, 정책 구역 |

> 지가·전력 수요 포함 경제 변수 통합 사례.

---

### M11 — Patel & Yadav (2025), Sustainable Energy Technologies & Assessments (인도)

**모델:** **ANN + AHP + GIS** + PCA (차원 축소) + Monte Carlo (불확실성)
**타깃:** 순위형 입지 적합성 점수

| 변수 |
|------|
| GHI, LULC, 경사도, 향 |
| 송전망 거리, 기온, 습도, 풍속 |
| 경제 요인 (지가 등) |

**성능:** 단독 모델 대비 **+22% 정확도**, 95% CI 제공
> **Monte Carlo로 불확실성 정량화** — 본 연구의 확률적 배분과 연결 가능.

---

### M12 — Liang et al. (2025), J. Geovisualization & Spatial Analysis (네덜란드)

**모델:** **DL Ensemble** — UNet-ResNet50, DeepLabv3-ResNet50, Mask2Former-SwinTransformer, SAM-LoRA, PSPNet (가중 다수결)
**타깃:** 옥상 태양광 패널 Binary 분할

| 변수 |
|------|
| 위성/항공 이미지, 건물 외형 |
| LiDAR DSM (표면 모델), 그림자 마스크, 지붕 방향 |

> 옥상 PV 특화 — 대규모 지상 PV와 직접 비교 어려우나 DL 앙상블 구조 참고.

---

### M13 — Cengiz et al. (2024), Euro-Mediterranean J. (다지역)

**모델:** Fuzzy MCDM + GIS + ML
**타깃:** Binary suitability

| 변수 |
|------|
| 풍속, 일사량, 경사도, LULC |
| 도로 거리, 취락 거리, 송전망 거리 |

> Fuzzy MCDM + ML 결합 방법론 비교 논문.

---

## 3. 입력 변수 사용 빈도 종합 (M1~M15)

| 변수 | 사용 빈도 | 비고 |
|------|----------|------|
| **GHI / 일사량** | 15/15 | 모든 논문 공통 |
| **경사도 (slope)** | 14/15 | Hard mask: >3~5° |
| **LULC** | 14/15 | 농지·산림·도시 제외 |
| **송전망 거리** | 13/15 | SHAP 상위 1~2위 반복 등장 |
| **도로 거리** | 13/15 | 임계: ~5 km |
| **향 (aspect)** | 11/15 | SHAP에서 예상보다 높은 중요도 |
| **기온** | 11/15 | 연평균 |
| **고도 (elevation)** | 10/15 | — |
| **변전소·취락 거리** | 9/15 | — |
| **NDVI** | 6/15 | M1, M4, M10 등 — 생태 상태 반영 |
| **지가·경제 변수** | 5/15 | 최근(2024~25) 논문에서 증가 추세 |
| **인구밀도** | 5/15 | 수요측 변수 |
| **기후변화 시나리오** | 1/15 | M9만 포함 (RCP) |

---

## 4. 모델 성능 벤치마크

| 모델 | 최고 성능 | 논문 |
|------|----------|------|
| **Random Forest** | AUC 0.92~0.95, Acc 89~90% | M1, M2, M3, M6 — 일관되게 최고 |
| **XGBoost** | AUC ~0.89, R²=0.70 | M3, M8 |
| **PSO-XGBoost** | RMSE 최소 | M5 |
| **MaxEnt** | AUC 0.87~0.95 | M7 |
| **SVM** | AUC 0.93, Acc 87% | M2 |
| **MLP / ANN** | AUC ~0.87 | M2, M3 |
| **RF + CNN Hybrid** | MCDA 대비 +12.7% | M9 |
| **ANN + AHP Hybrid** | 단독 대비 +22% | M11 |
| **DL Ensemble** | F1·Precision·Recall 최고 | M12 |

> **일반 순위: RF ≈ XGBoost > MLP/SVM > MCDA 단독**

---

## 5. 본 연구와의 연결점 및 설계 시사점

### 5.1 Feature 설계

| 시사점 | 근거 |
|--------|------|
| **NDVI 추가 검토** | M1, M4, M10에서 SHAP 상위 — 생태 상태·토지 품질 반영 |
| **변전소 거리 임계 ~30 km** | M6 SHAP 분석 결과 — log 변환 후 30 km 이하 강한 효과 |
| **도로 거리 임계 ~5 km** | M6 SHAP 결과 — 5 km 이하에서 설치 확률 급등 |
| **향(aspect)의 예상 외 중요도** | M3 SHAP 1위 — cos 변환 연속형 처리 권장 |

### 5.2 모델 설계

| 시사점 | 근거 |
|--------|------|
| **AHP → XGBoost/RF 보정 구조** | M4 (AHP+XGBoost): AHP prior → ML 비선형 보정 — 본 연구 soft mask + multinomial 구조와 유사 |
| **MaxEnt 병행 검토** | M7: presence-only 데이터일 때 유효 (관측 좌표 편향 시 대안) |
| **RF가 baseline으로 적합** | M1, M2, M3, M6 모두 RF 최고 — 비교모형으로 추가 권장 |
| **Monte Carlo 불확실성** | M11: 95% CI 제공 — 본 연구 U_r 배분의 불확실성 구간 산출에 적용 가능 |

### 5.3 본 연구 비교모형 확장 제안

현재 계획된 비교모형에 아래를 추가 검토:

```
기존: uniform-feasible / AHP-only / covariate-only / XGBoost·CatBoost
추가 검토:
  - Random Forest (M1~M3, M6 기준 일관 최고)
  - MaxEnt (좌표 편향 심할 때 presence-only 대안)
  - AHP+XGBoost hybrid (M4 구조: soft mask를 XGBoost offset으로 직접 삽입)
```

---

## 6. Hard Mask 기준 통합 정리 (ML 논문 기준)

| 제외 기준 | 빈도 | 표준 버퍼 |
|----------|------|----------|
| 수계·습지 | 15/15 | 100~500 m |
| 도시·시가지 | 14/15 | 500 m~2 km |
| 보호구역 | 14/15 | 완전 제외 |
| 경사도 초과 | 14/15 | >3~5° (ML 논문) / >20~30° (AHP 논문) |
| 산림·밀림 | 10/15 | 완전 제외 또는 soft |
| 군사·공항 | 6/15 | 완전 제외 |
| 생태 레드라인 (중국) | 4/15 | 중국 특이사항 |

> ML 논문의 경사도 제외 기준이 AHP 논문보다 엄격 (>3~5° vs >20~30°).
> 한국 산지 비율 고려 시 **30° 채택이 현실적** (AHP 논문 기준 유지).

---

## 7. 연구 공백 (본 연구 차별화 포인트)

| 공백 | 내용 |
|------|------|
| **시군구 총량 제약** | 기존 논문 모두 미적용 — 본 연구의 핵심 차별점 |
| **Presence-only → count reconstruction** | 기존: binary 분류 중심. 본 연구: 격자 count 복원 |
| **AHP prior calibration** | M4만 AHP+ML 결합, 나머지는 ML 단독 |
| **불확실성 정량화** | M11만 Monte Carlo CI 제공 — 본 연구도 적용 권장 |
| **시계열 드라이버** | M6만 시계열 반영 — 기준 시점 고정 시 불필요 |

---

*작성일: 2026-03-13 | 기반 논문: 15편 (ML 단독 8편 / AHP+ML Hybrid 4편 / GIS+ML 3편)*
