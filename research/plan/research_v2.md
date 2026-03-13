# Hybrid Spatial Reconstruction of PV Locations v2
## 질문 반영형 연구계획서

작성 목적:

- 기존 `v1`의 구조를 유지하되, 사용자가 제기한 4개 질문에 직접 답한다.
- 수식은 가능한 한 LaTeX 블록 대신 plain-text 형태로 정리한다.
- 공간효과 선택 근거는 논문 출처를 남긴다.

---

## 0. 사용자 질문에 대한 직접 답변

### 0.1 왜 soft mask와 hard mask를 구분하는가?

핵심 답:

- **hard mask는 "여기는 절대 안 된다"를 표현하는 규칙**이다.
- **soft mask는 "가능은 하지만 상대적으로 덜/더 적합하다"를 표현하는 prior**다.

이 둘을 분리하는 이유는 AHP suitability가 본질적으로 **순위화(ranking)** 에 강하고, 법적/물리적 불가능 지역을 완전히 0으로 만드는 규칙과는 역할이 다르기 때문이다.

실무적으로는 이렇게 구분한다.

1. **hard mask**
   - 수면
   - 법정보호구역
   - 명백한 개발불가 지역
   - 과도한 경사
   - 즉, "확률 0"이어야 하는 곳

2. **soft mask**
   - 같은 설치 가능 지역 내부에서 AHP가 제시하는 상대 선호도
   - 즉, "확률 0은 아니지만 더 적합/덜 적합"을 표현

왜 AHP 하나로 다 처리하지 않느냐:

1. AHP는 보통 여러 요인을 가중합해서 suitability score를 만든다.
2. 하지만 연구 목표는 "최적입지"가 아니라 "실제 설치 분포 복원"이다.
3. 따라서 AHP가 낮게 준 지역이라도 실제 설치가 존재할 수 있다.
4. 반대로 수면이나 보호구역처럼 **절대 설치되면 안 되는 곳**은 데이터 모델이 아무리 선호해도 막아야 한다.

즉, `hard mask = feasibility constraint`, `soft mask = prior preference` 로 나누는 것이 더 안전하다.

AHP 기반 재생에너지 입지 연구에서도 restricted area와 weighted suitability를 분리하는 방식이 반복적으로 사용된다. Al Garni and Awasthi (2017)는 보호구역과 인프라 접근성을 함께 고려했고, Gacu et al. (2023)는 restricted criteria를 suitability overlay와 분리해 최종 지도를 생성했다.  
출처: [1], [2]

### 0.2 최근접거리(nearest distance)를 공변량으로 두는 것이 맞는가?

핵심 답:

- **1차 변수로는 맞다.**
- 하지만 **최근접거리 하나만 쓰는 것은 부족하다.**

이유는 다음과 같다.

1. PV 입지 AHP/GIS 문헌은 도로, 송전선, 변전소, 도시지역과의 **거리(proximity)** 를 핵심 요인으로 반복 사용한다.
2. 이 proximity는 GIS 구현에서 보통 **최근접거리 raster** 로 계산된다.
3. 다만 실제 설치 패턴은 "가장 가까운 1개 시설까지 거리"만으로 설명되지 않는다.

따라서 본 연구에서는 최근접거리를 아래처럼 쓰는 것이 적절하다.

1. **기본값**
   - nearest road distance
   - nearest transmission line distance
   - nearest substation distance
   - nearest urban distance

2. **보완값**
   - 1km / 3km 반경 내 road density
   - 1km 반경 내 developable land ratio
   - 2km 반경 내 urban ratio

즉, `nearest distance = 1차 접근성 변수`, `buffer/density = 2차 주변 맥락 변수` 로 같이 써야 한다.

Al Garni and Awasthi (2017), Colak et al. (2020) 모두 도로, 송전선, 변전소, 주거지 등의 proximity/거리 변수를 주요 기준으로 사용했다.  
출처: [1], [3]

### 0.3 공변량은 예시가 아니라 AHP에서 가져온다는 점을 명시해야 하지 않는가?

핵심 답:

- **맞다. v2에서는 그렇게 명시한다.**

본 연구의 공변량 선정 원칙은 아래처럼 정리한다.

1. 변수 후보는 임의 예시가 아니라 **PV 입지선정 AHP 문헌에서 반복 출현한 변수군**에서 가져온다.
2. 그다음 실제 데이터 가용성, 해상도, 결측률, 중복성, 해석 가능성을 보고 축소한다.
3. 마지막으로 관측 PV 점자료를 이용해 **현실 데이터에 맞게 가중치와 효과 크기를 재보정**한다.

즉 흐름은 다음과 같다.

`AHP 문헌 -> 후보 변수군 선정 -> 지역 데이터로 구현 가능 여부 점검 -> 관측 점자료로 현실 보정`

따라서 AHP는 단순 참고가 아니라,

- 변수 pool의 출처
- 방향성에 대한 prior
- hard/soft constraint의 출발점

으로 사용한다.

### 0.4 공간효과는 어떻게 두는 것이 가장 좋은가?

핵심 답:

- **현재 연구 목적과 데이터 구조를 기준으로는 "단계적 접근"이 가장 적절하다.**

추천 순서는 다음과 같다.

1. **1단계: 공간효과 없음**
   - 순수 공변량 + AHP prior만으로 baseline 구축

2. **2단계: feature-based 공간효과**
   - 인접 셀 평균
   - kernel-smoothed observed density
   - 지역 주변 개발가능지/도로밀도 요약값
   - 장점: 빠르고 해석이 쉽다

3. **3단계: BYM2/CAR**
   - 격자 인접 그래프 기반 random effect
   - 장점: areal/grid 데이터에 정합적이다
   - 추천 상황: 격자 단위 count reconstruction을 본격 추정할 때

4. **4단계: LGCP/SPDE**
   - exact point pattern 자체를 모델링하고 싶을 때
   - 장점: 군집성 표현이 강함
   - 단점: 계산비용이 크고 구현 난도가 높다

논문 근거는 다음과 같다.

1. **Besag, York and Mollié (1991)**  
   - 인접 구조를 가진 areal data에서 공간 random effect를 두는 고전적 출발점이다.  
   출처: [4]

2. **Riebler et al. (2016)**  
   - BYM2는 기존 BYM의 해석성과 prior 설정 문제를 개선한 parameterization이다.  
   출처: [5]

3. **Lindgren, Rue and Lindström (2011)**  
   - Gaussian field를 GMRF/SPDE로 연결해 계산 가능성을 크게 높였다.  
   출처: [6]

4. **Møller, Syversveen and Waagepetersen (1998)**  
   - LGCP는 clustered point pattern을 분석하기 위한 대표적 점과정 모형이다.  
   출처: [7]

현재 연구의 출력 단위가 **격자(grid)** 이고, 전국 단위 계산까지 고려해야 하므로, 본 계획서는 `feature-based spatial effect -> BYM2 확장`을 주경로로 채택한다.

---

## 1. 연구의 정체성 재정의

본 연구는 "최적입지 선정"이 아니라 아래 문제를 다룬다.

- 시군구별 공식 PV 총량은 알고 있다.
- 일부 실제 PV 좌표는 알고 있다.
- 모든 좌표는 알 수 없다.
- 따라서 누락된 PV를 시군구 내부 어디에 배분할지 추정해야 한다.

즉 본 연구는 다음 네 요소를 결합하는 **hybrid reconstruction problem** 이다.

1. 공식 총량 제약
2. 관측 점자료
3. AHP 기반 prior
4. 데이터 기반 공간모형

---

## 2. 연구 질문

### RQ1

AHP 기반 prior와 현실 관측 점자료를 결합하면, AHP-only보다 더 현실적인 PV 복원이 가능한가?

### RQ2

시군구 내부 PV 배분을 설명하는 핵심 공변량은 무엇인가?

### RQ3

공간효과를 추가하면 단순 공변량 모형보다 군집성과 맥락 재현성이 개선되는가?

---

## 3. 데이터 구조와 기본 가정

분석에 필요한 입력은 아래 세 가지다.

1. **공식 총량 데이터**
   - region_id
   - reference_date
   - pv_total_count

2. **관측 PV 점자료**
   - point_id
   - lon / lat
   - source
   - reference_date

3. **공간 레이어**
   - 행정경계
   - GHI
   - slope / elevation / aspect
   - LULC
   - road
   - transmission line
   - substation
   - urban area
   - water / protected area

핵심 가정은 아래와 같다.

1. 공식 총량의 기본 단위는 우선 count다.
2. 관측 점자료는 전체의 부분집합이다.
3. 공식 총량과 점자료의 기준 시점은 충분히 가깝다.

만약 공식 데이터가 count가 아니라 capacity면 별도 분기한다.

---

## 4. 공간 단위

본 연구의 기본 분석 단위는 500m grid다.

이유는 다음과 같다.

1. 시군구 내부 분포 차이를 볼 수 있다.
2. 전국 단위 계산 부담을 감당할 수 있다.
3. 거리·버퍼형 공변량을 동시에 다루기 좋다.

민감도 분석은 250m, 1km에서 수행한다.

---

## 5. AHP 활용 원칙 v2

### 5.1 AHP의 역할

AHP는 최종 예측모형이 아니라 아래 3가지 역할을 맡는다.

1. **변수 후보군의 출처**
2. **hard/soft mask의 출발점**
3. **현실 데이터 보정 전의 prior suitability**

### 5.2 변수 후보군 선정 원칙

변수 후보는 AHP 문헌에서 반복적으로 등장한 항목만 우선 채택한다.

1차 후보군:

- GHI
- slope
- aspect
- elevation
- land cover
- distance to roads
- distance to transmission lines
- distance to substations
- distance to urban areas
- water / protected area constraints

즉 v2에서는 "예시 변수"가 아니라 "**AHP 문헌 기반 후보군**"이라고 명시한다.

### 5.3 hard mask

hard mask는 binary constraint다.

예:

- water = 0
- protected area = 0
- extreme slope = 0
- clearly undevelopable land = 0

이 값은 최종 intensity에서 반드시 0으로 적용한다.

`lambda_g = 0 if hard_mask_g = 0`

### 5.4 soft mask

soft mask는 설치 가능 지역 내부에서 상대 prior를 주는 값이다.

예:

- very high suitability = 1.5
- medium suitability = 1.0
- low suitability = 0.6

즉, 가능/불가능을 나누는 것이 아니라 feasible area 안에서 prior weight를 조정한다.

### 5.5 왜 이 구조가 필요한가

이 구조를 쓰면 다음 두 가지가 동시에 가능하다.

1. 설치 불가 지역은 강제로 차단
2. 설치 가능 지역 내부에서는 AHP prior와 실제 데이터가 경쟁적으로 반영

이게 본 연구의 목적에 더 맞다.

---

## 6. 공변량 선정 원칙 v2

### 6.1 선정 원칙

공변량 선정은 아래 순서로 한다.

1. AHP 문헌에서 반복 등장한 변수 수집
2. 현재 프로젝트에서 실제 구축 가능한 변수만 남김
3. 결측률, 해상도, 중복성 점검
4. 관측 점자료 기준으로 현실 적합도 재평가

즉, 공변량은 "마음대로 고른 변수"가 아니라 **AHP 문헌 기반 후보군의 현실 데이터 버전** 이다.

### 6.2 거리형 변수는 어떻게 둘 것인가

본 연구는 아래 구조를 기본으로 한다.

1. 최근접거리
   - dist_road
   - dist_transmission
   - dist_substation
   - dist_urban

2. 다중 스케일 요약변수
   - road_density_1km
   - developable_ratio_1km
   - urban_ratio_2km

3. 필요시 상호작용
   - GHI x developable_ratio
   - slope x land_cover

### 6.3 거리 계산 방식

기본은 Euclidean nearest distance를 쓴다.

이유:

1. GIS 기반 AHP 문헌 대부분이 이 방식으로 proximity layer를 만든다.
2. 전국 단위 계산이 가능하다.
3. 재현성이 높다.

다만 도로 접근성 해석이 매우 중요해지면 network distance를 보조 분석으로 둔다.

### 6.4 1차 고정 feature set

기본형:

- GHI
- slope
- elevation
- land_cover
- dist_road
- dist_transmission
- dist_substation
- dist_urban

확장형:

- 기본형
- road_density_1km
- developable_ratio_1km
- protected_ratio_1km

공간확장형:

- 확장형
- local neighborhood summaries

---

## 7. 공간효과 설계 v2

### 7.1 추천 경로

가장 현실적인 순서는 다음과 같다.

1. **Model A: no spatial effect**
2. **Model B: feature-based spatial effect**
3. **Model C: BYM2**

LGCP/SPDE는 확장모형으로만 둔다.

### 7.2 Model B: feature-based spatial effect

구성 후보:

- neighbor mean of observed count
- kernel-smoothed observed density
- local developable land share

장점:

- 빠르다
- 구현이 쉽다
- 변수 중요도 해석이 가능하다

주의:

- hold-out 점을 포함한 density를 만들면 data leakage가 생기므로 split마다 다시 계산해야 한다.

### 7.3 Model C: BYM2

왜 BYM2인가:

1. 본 연구의 결과 단위가 grid count다.
2. grid는 인접관계가 명확한 areal/lattice data다.
3. BYM2는 adjacency-based random effect를 안정적으로 넣기 좋다.

추천 이유:

- 격자 count reconstruction과 잘 맞는다.
- 해석 가능성이 BYM보다 좋다.
- prior 설정이 더 명확하다.

### 7.4 왜 LGCP를 메인으로 두지 않는가

LGCP는 clustered point pattern 자체를 모델링할 때 매우 강력하다. 다만 현재 연구는

- 공식 총량 제약이 시군구 단위로 주어지고
- 최종 산출물이 grid allocation이며
- 전국 단위 계산이 필요하다.

따라서 첫 메인모델로는 과하다.

즉,

- **grid reconstruction** 이 목적이면 BYM2/CAR가 더 정합적이고
- **exact point process inference** 가 목적이면 LGCP가 더 자연스럽다.

### 7.5 최종 선택

본 계획서 v2의 선택은 다음과 같다.

1. 메인 실험: feature-based spatial effect
2. 고급 검증 실험: BYM2
3. 확장 연구: LGCP/SPDE

---

## 8. 메인 모델 구조

메인 모델은 시군구 내부 conditional allocation 모델로 둔다.

plain-text 식으로 쓰면:

1. `score_g = beta'x_g + rho*log(soft_mask_g) + w_g`
2. `lambda_g = hard_mask_g * exp(score_g)`
3. `p_rg = lambda_g / sum(lambda_h for h in region r)`

여기서

- `x_g` = 데이터 기반 공변량
- `soft_mask_g` = AHP prior
- `hard_mask_g` = feasibility constraint
- `w_g` = 공간효과

관측 점자료를 grid count로 집계한 값을 `y_obs_g` 라고 하면, 시군구 내부에서 어떤 셀이 더 많은 관측 PV를 가지는지 학습한다.

누락 개수는 다음처럼 계산한다.

- `U_r = N_r - n_obs_r`

그 후 시군구 내부 확률 `p_rg` 를 이용해 배분한다.

- 결정론적 배분: `m_rg = U_r * p_rg`
- 최종 복원값: `Z_hat_g = y_obs_g + m_rg`

---

## 9. 비교모형

반드시 아래 모형과 비교한다.

### 9.1 Uniform-feasible

설치 가능 지역에 균등 배분

### 9.2 AHP-only

soft mask만으로 배분

### 9.3 Covariate-only

AHP 없이 공변량만으로 배분

### 9.4 Covariate + feature-based spatial effect

실전형 메인모델

### 9.5 Covariate + BYM2

고급 확장모형

---

## 10. 검증 전략

### 10.1 위치 복원력

관측 점의 일부를 hold-out 하고 다음을 비교한다.

- top-k capture
- mean rank
- hold-out log score

### 10.2 공간 패턴

- nearest-neighbor distance
- Moran's I
- Ripley's K

### 10.3 환경 맥락

실제 점과 복원 점의 분포 비교:

- slope
- land_cover
- dist_road
- dist_substation
- dist_urban

### 10.4 필수 제약

복원 후 모든 시군구에서 아래를 만족해야 한다.

- `sum(Z_hat_g in region r) = N_r`

이건 성능지표가 아니라 필수조건이다.

---

## 11. 수행 순서

### Phase 1. AHP 문헌 리뷰

목표:

- 반복 등장 변수 목록 추출
- hard constraint 후보와 soft suitability 후보 분리

산출물:

- `ahp_variable_review.md`

### Phase 2. 데이터 정비

목표:

- 공식 총량 정리
- 관측 PV 점자료 정리
- 기준 시점 정렬

산출물:

- `district_totals.parquet`
- `pv_points_observed.gpkg`

### Phase 3. grid와 공변량 구축

목표:

- 500m 전국 grid 생성
- 거리형 / 버퍼형 공변량 계산

산출물:

- `analysis_grid_500m.parquet`
- `feature_matrix_500m.parquet`

### Phase 4. AHP prior 구축

목표:

- hard mask 구축
- soft mask 구축
- AHP-only baseline 생성

산출물:

- `ahp_prior_500m.parquet`

### Phase 5. 모델 학습

목표:

- baseline
- feature-based spatial model
- BYM2 확장

산출물:

- `model_metrics.csv`
- `region_diagnostics.csv`

### Phase 6. reconstruction

목표:

- 누락 PV 배분
- grid 결과 생성
- synthetic point 생성

산출물:

- `reconstructed_pv_grid_500m.parquet`
- `synthetic_pv_points_500m.gpkg`

---

## 12. 현재 기준 최종 추천안

현재 기준으로 가장 합리적인 선택은 아래와 같다.

1. **hard mask / soft mask를 분리한다**
2. **공변량 후보는 AHP 문헌에서 가져온다고 명시한다**
3. **최근접거리를 기본 접근성 변수로 쓰되, 버퍼형 변수를 같이 둔다**
4. **메인 공간효과는 feature-based 방식으로 시작한다**
5. **고급 확장으로 BYM2를 둔다**
6. **LGCP/SPDE는 후속 확장으로 남긴다**

---

## 13. 참고문헌

[1] Al Garni, H. Z., & Awasthi, A. (2017). *Solar PV power plant site selection using a GIS-AHP based approach with application in Saudi Arabia*. Applied Energy, 206, 1225-1240. DOI: 10.1016/j.apenergy.2017.10.024  
Link: https://www.sciencedirect.com/science/article/pii/S030626191731437X

[2] Gacu, J. G., Garcia, J. D., Fetalvero, E. G., Catajay-Mani, M. P., & Monjardin, C. E. F. (2023). *Suitability Analysis Using GIS-Based Analytic Hierarchy Process (AHP) for Solar Power Exploration*. Energies, 16(18), 6724. DOI: 10.3390/en16186724  
Link: https://doi.org/10.3390/en16186724

[3] Colak, H. E., Memisoglu, T., & Gercek, Y. (2020). *Optimal site selection for solar photovoltaic (PV) power plants using GIS and AHP: A case study of Malatya Province, Turkey*. Renewable Energy, 149, 565-576. DOI: 10.1016/j.renene.2019.12.078  
Link: https://doi.org/10.1016/j.renene.2019.12.078

[4] Besag, J., York, J., & Mollié, A. (1991). *Bayesian image restoration, with two applications in spatial statistics*. Annals of the Institute of Statistical Mathematics, 43(1), 1-20. DOI: 10.1007/BF00116466  
Link: https://www.ism.ac.jp/editsec/aism/43/1.html

[5] Riebler, A., Sørbye, S. H., Simpson, D., & Rue, H. (2016). *An intuitive Bayesian spatial model for disease mapping that accounts for scaling*. Statistical Methods in Medical Research, 25(4), 1145-1165. DOI: 10.1177/0962280216660421  
Link: https://pubmed.ncbi.nlm.nih.gov/27566770/

[6] Lindgren, F., Rue, H., & Lindström, J. (2011). *An explicit link between Gaussian fields and Gaussian Markov random fields: the stochastic partial differential equation approach*. Journal of the Royal Statistical Society: Series B, 73(4), 423-498. DOI: 10.1111/j.1467-9868.2011.00777.x  
Link: https://academic.oup.com/jrsssb/article/73/4/423/7034732

[7] Møller, J., Syversveen, A. R., & Waagepetersen, R. P. (1998). *Log Gaussian Cox processes*. Scandinavian Journal of Statistics, 25(3), 451-482. DOI: 10.1111/1467-9469.00115  
Link: https://vbn.aau.dk/en/publications/log-gaussian-cox-processes

---
