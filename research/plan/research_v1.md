# Hybrid Spatial Reconstruction of PV Locations
## AHP-Calibrated Conditional Allocation Framework for Missing PV Coordinates

---

## 1. 연구 개요

본 연구의 목적은 **행정구역별 총 PV 설치 수는 알려져 있지만 모든 설비의 정확한 좌표는 공개되지 않은 상황에서**, 일부 관측된 실제 PV 점자료와 공간 공변량을 이용하여 **누락된 PV 위치를 현실적으로 복원(reconstruct)** 하는 것이다.

즉, 본 연구는 단순한 최적입지 선정이 아니라 다음 네 요소를 결합하는 **공간 재구성 문제**다.

- **공식 총량 제약(count constraint)**
- **관측된 실제 PV 좌표**
- **AHP 기반 적합도(prior suitability)**
- **데이터 기반 공간 모델링**

최종 산출물은 다음 두 가지 중 하나 또는 둘 다를 목표로 한다.

- **전국 단위 synthetic PV point distribution**
- **grid-level reconstructed PV map**

### 1.1 연구 질문

본 연구는 아래 세 가지 질문에 답하는 구조로 설계한다.

1. **RQ1.** 관측된 PV 점자료와 공간 공변량을 이용하면, AHP-only baseline보다 더 현실적인 누락 PV 위치 복원이 가능한가?
2. **RQ2.** 시군구 내부 설치 패턴을 설명하는 핵심 요인은 무엇인가?
3. **RQ3.** 공간효과를 추가하면 단순 공변량 모형 대비 공간 군집성과 환경 맥락의 재현성이 개선되는가?

### 1.2 성공 기준

최종 연구가 성공했다고 판단하기 위한 최소 기준은 다음과 같다.

1. 복원 결과가 **모든 시군구에서 공식 총량 \(N_r\)** 을 정확히 만족한다.
2. hold-out 실험에서 메인 모델이 `AHP-only`, `uniform-feasible` 대비 **위치 복원 지표를 유의하게 개선**한다.
3. 복원 결과의 공간 패턴과 환경 분포가 실제 관측 점자료와 **과도하게 괴리되지 않는다**.
4. 500m 기본 격자 기준 결과가 250m, 1km 민감도 분석에서도 **방향성이 유지**된다.

---

## 2. 문제 정의

현재 이용 가능한 정보는 다음과 같다.

1. **행정구역(시군구)별 PV 총량 데이터**
   - 각 지역 \( r \) 에 대해 공식 PV 개수 \( N_r \) 가 주어진다.

2. **일부 실제 PV 점자료**
   - 실제 좌표가 확인된 PV 점들의 집합이다.
   - 이를 시군구 단위로 집계하면 \( n_r^{obs} \) 가 된다.

3. **공간 공변량 GIS 레이어**
   - 일사량, 경사도, 고도, 토지피복, 도로, 송전선, 변전소, 도시거리 등이다.

따라서 각 지역 \( r \) 에서 누락된 PV 개수는 다음과 같다.

\[
U_r = N_r - n_r^{obs}
\]

plain-text: `U_r = 공식 총량 - 이미 관측된 PV 수`

연구의 핵심은 이 \( U_r \) 개의 누락 PV를 **시군구 내부 격자들 중 어디에 얼마나 배분할 것인가**를 추정하는 것이다.

### 2.1 핵심 가정

모형을 성립시키기 위해 아래 가정을 명시한다.

1. 공식 총량 데이터와 관측 점자료는 **동일하거나 충분히 근접한 기준 시점**을 가진다.
2. 관측 점자료는 전체 PV의 **편향된 부분집합일 수 있지만 완전히 임의가 아닌 informative sample** 이다.
3. 공식 총량의 기본 단위는 우선 **설비 수(count)** 로 간주한다.
4. 한 격자에는 0개 이상의 PV가 들어갈 수 있으며, 복수 설비가 같은 격자에 존재할 수 있다.

### 2.2 사전 점검이 필요한 예외 상황

다음 조건이 확인되면 분석 경로를 분기한다.

1. 공식 데이터 단위가 설비 수가 아니라 **설비용량(kW/MW)** 인 경우
   - count reconstruction 대신 **capacity-weighted allocation** 을 별도 설계한다.
2. 관측 점자료의 점 1개가 개별 설비가 아니라 **단지/사업장 단위** 인 경우
   - point-to-count 해석을 수정하고, 격자 count 대신 facility cluster 해석을 적용한다.
3. 기준 시점 차이가 1년 이상인 경우
   - 동일 연도로 재정렬하거나 해당 지역을 분석 제외 후보로 분류한다.

### 2.3 본 연구의 범위와 제외 범위

본 연구는 아래 범위에 집중한다.

- 시군구 내부 공간 배분
- 전국 단위 격자 intensity 추정
- synthetic point 또는 grid count 복원

반대로 아래는 1차 범위에서 제외한다.

- 개별 설비의 실제 허가 시점 추정
- 패널 용량, 사업자, 운영사 단위 속성 복원
- 경제성 분석이나 최적입지 정책 시뮬레이션

---

## 3. 기존 outline 대비 현재 설계의 방향

기존 outline은 크게 다음 구조를 가졌다.

- 격자 단위 suitability 또는 logistic probability surface 생성
- 지역별 weighting 적용
- Monte Carlo 방식으로 PV 점 배치

그러나 기존 구조는 다음 한계가 있었다.

1. **binary presence 기반 학습과 multinomial allocation 수식이 혼재**되어 있었다.
2. **지역 총량 제약이 사후 보정에 가까웠다.**
3. **AHP prior가 구조적으로 활용되지 않았다.**
4. **공간 군집성이 모델 내부 구조로 직접 들어가지 않았다.**

따라서 본 연구에서는 전체 흐름을 아래처럼 재설계한다.

1. 격자 단위 설명변수와 AHP prior를 구축한다.
2. 관측된 PV 점의 격자 count \(y_g^{obs}\) 를 학습 타깃으로 사용한다.
3. 시군구 내부 상대 강도 \(\lambda_g\) 를 추정한다.
4. 이를 확률화하여 누락 PV \(U_r\) 를 배분한다.

즉, 문제 정의와 학습 구조를 **조건부 allocation 모델**로 일치시킨다.

---

## 4. 연구의 핵심 아이디어

본 연구의 중심 아이디어는 다음과 같다.

> **시군구별 공식 총량 \(N_r\) 을 고정한 상태에서, 각 지역 내부 격자의 상대적 설치 강도 \(\lambda_g\) 를 추정한 뒤, 이를 확률화하여 누락된 PV를 배분한다.**

즉 최종적으로 필요한 것은 각 격자 \( g \) 의 상대 강도:

\[
\lambda_g
\]

이며, 이를 시군구 내부 확률로 바꾸면:

\[
p_{rg} = \frac{\lambda_g}{\sum_{h \in G_r} \lambda_h}
\]

가 된다.

이 확률 \( p_{rg} \) 는 "시군구 \( r \) 안에서 추가 PV가 격자 \( g \) 로 갈 비율"을 의미한다.

plain-text로 쓰면 아래와 같다.

- `lambda_g`: 격자 `g`의 상대 설치 강도
- `p_rg = lambda_g / (region r 내부 모든 lambda의 합)`
- 즉, 시군구 내부에서 추가 PV를 어디에 배분할지 정하는 지역 내 확률이다.

### 4.1 전체 파이프라인

문서 전체는 아래 흐름으로 읽으면 연결이 가장 잘 보인다.

```text
[공식 시군구 총량 N_r]
        +
[관측된 실제 PV 점자료]
        +
[GIS / AHP 입력 레이어]
        |
        v
[전국 grid 생성 및 region_id 부여]
        |
        +--> [관측 점을 grid에 집계] -> y_g^obs, n_r^obs
        |
        +--> [AHP suitability 계산] -> S_g^AHP -> class c(g)
        |                                 |
        |                                 +-> soft mask m_{c(g)}
        |                                 +-> hard mask M_g^{hard}
        |
        +--> [거리형/버퍼형 공변량 계산] -> x_g
        |
        v
[score_g = beta'x_g + rho*log(m_{c(g)}) + w_g]
        |
        v
[lambda_g = M_g^{hard} * exp(score_g)]
        |
        v
[시군구 내부 정규화]
        |
        v
[p_rg = lambda_g / sum(lambda_h in region r)]
        |
        +--> [관측점 기반 학습 / 검증]
        |
        +--> [U_r = N_r - n_r^obs 계산]
                |
                v
        [m_rg = U_r * p_rg]
                |
                v
        [Z_hat_g = y_g^obs + m_rg]
                |
                +--> reconstructed PV grid
                +--> synthetic PV points
                +--> validation / sensitivity analysis
```

즉, 본 연구는 크게 5단계로 요약된다.

1. `총량 + 관측점 + GIS/AHP 레이어`를 준비한다.
2. 이를 모두 `grid` 단위로 정렬한다.
3. 각 grid의 상대 강도 `lambda_g`를 추정한다.
4. 시군구 내부 확률 `p_rg`로 바꾼다.
5. 누락량 `U_r`를 확률에 따라 배분해 최종 복원값 `Z_hat_g`를 만든다.

---

## 5. 입력 데이터와 분석 단위

### 5.1 공식 총량 데이터

현재 프로젝트 문맥에서 우선 검토할 공식 총량 후보는 다음과 같다.

- `data.go.kr` 기반 시군구별 PV CSV
- RPS 또는 공공 통계 기반 시군구 집계 자료

필수 컬럼은 최소한 아래를 만족해야 한다.

- `region_id`
- `region_name`
- `reference_date`
- `pv_total_count` 또는 이에 준하는 총량 변수

### 5.2 관측 PV 점자료

관측 점자료는 아래 성격의 데이터를 포함할 수 있다.

- 공개 좌표가 있는 PV 발전소 포인트
- OSM 기반 발전소 레이어
- 내부 수집 point inventory

필수 품질 점검 항목은 다음과 같다.

- 좌표계 통일 여부
- 중복 점 존재 여부
- 점 1개의 의미가 개별 설비인지 단지인지
- 기준 시점과 공식 총량의 정합성

### 5.3 공간 공변량 레이어

필수 레이어 후보는 아래와 같다.

- GHI 또는 solar irradiance
- DEM 기반 slope, aspect, elevation
- LULC / developable land
- 도로
- 송전선
- 변전소
- 도시지역 또는 built-up area
- 수면 / 보호구역
- 행정경계

현재 프로젝트 자산과의 연결 가능 후보는 다음과 같다.

- 행정경계 GeoJSON
- OSM 기반 발전소 / 변전소 / 송전선 GeoJSON
- 후처리된 PV 관련 Parquet

### 5.4 공간 단위: 격자(grid)

본 연구에서는 점자료 자체가 아니라 **격자(grid)** 를 공통 분석 단위로 사용한다.

격자를 사용하는 이유는 다음과 같다.

- 행정구역 총량 \(N_r\) 을 내부적으로 분해해야 한다.
- 여러 GIS 레이어를 일관된 단위로 결합해야 한다.
- AHP suitability, 공변량, 실제 점자료, 최종 allocation 결과를 동일 support에서 비교해야 한다.

### 5.5 격자 크기

기본안은 다음과 같다.

- **기본안: 500m x 500m**
- 민감도 분석: 250m, 1km

500m를 기본안으로 두는 이유는 다음과 같다.

1. 행정구역 내부 공간 차이를 반영할 만큼 충분히 세밀하다.
2. 전국 단위 계산 시 메모리와 학습 부담을 감당할 수 있다.
3. 도로, 변전소, 도시거리와 같은 거리 기반 공변량의 차이를 유지할 수 있다.

### 5.6 각 격자가 가져야 하는 필수 정보

각 격자 \( g \) 는 최소한 다음 정보를 포함해야 한다.

- `grid_id`
- `region_id`
- centroid 좌표
- 관측된 PV count \( y_g^{obs} \)
- 공변량 벡터 \( x_g \)
- AHP suitability score \( S_g^{AHP} \)
- AHP class \( c(g) \)
- hard feasibility mask \( M_g^{hard} \)

### 5.7 전처리 산출물

실행 관점에서 전처리 단계의 주요 산출물은 아래처럼 고정한다.

- `district_totals.parquet`
- `pv_points_observed.gpkg`
- `analysis_grid_500m.parquet`
- `ahp_prior_500m.parquet`
- `feature_matrix_500m.parquet`
- `reconstructed_pv_grid_500m.parquet`
- `synthetic_pv_points_500m.gpkg`

---

## 6. AHP의 활용 방식

본 연구에서 AHP는 **최종 예측모형의 주모델**이 아니라 **prior layer** 로 활용된다.

### 6.1 변수 선정의 근거

국내 PV 입지선정 AHP 논문을 조사하여 반복적으로 사용된 변수를 후보군으로 선정한다.

대표 변수는 다음과 같다.

- GHI
- slope
- aspect
- elevation
- land use / land cover
- distance to road
- distance to power line / substation
- distance to urban area
- protected areas / water bodies

즉 AHP는 먼저 **변수 선정의 근거**가 된다.

### 6.2 AHP suitability map 생성

선행연구 기반 가중치를 이용하여 격자별 AHP 적합도 점수

\[
S_g^{AHP}
\]

를 계산한다.

plain-text: `S_g^AHP = AHP 방식으로 계산한 격자 g의 적합도 점수`

### 6.3 AHP 등급화

적합도 점수를 5개 등급으로 나눈다.

\[
c(g)\in\{1,2,3,4,5\}
\]

plain-text: `c(g)`는 격자 `g`가 속한 AHP 등급이다.

1차 기본안은 **eligible grid만 대상으로 한 national quantile 5등급**이다.

- 1: 매우 낮음
- 2: 낮음
- 3: 보통
- 4: 높음
- 5: 매우 높음

민감도 분석에서 `Jenks natural breaks` 를 보조안으로 비교한다.

### 6.4 실제 PV와의 비교를 통한 calibration

관측된 실제 PV 점들이 AHP 각 등급에 얼마나 많이 들어가는지 계산한다.

등급 \(k\) 에 대해 다음 enrichment ratio를 계산한다.

\[
R_k =
\frac{n_k / n^{obs}}
{a_k / a^{elig}}
\]

여기서

- \(n_k\): AHP 등급 \(k\) 안에 들어간 observed PV 수
- \(n^{obs}\): 전체 observed PV 수
- \(a_k\): AHP 등급 \(k\)의 eligible area
- \(a^{elig}\): 전체 eligible area

plain-text: `R_k = (등급 k 안의 실제 PV 비중) / (등급 k의 설치가능 면적 비중)`

### 6.5 zero-cell 불안정성 보정

관측 점이 적은 등급에서 \(R_k\) 가 과도하게 흔들리는 것을 막기 위해 Laplace smoothing을 적용한다.

\[
R_k^{sm}
=
\frac{(n_k+\alpha) / (n+K\alpha)}
{(a_k+\alpha) / (a+K\alpha)}
\]

plain-text: `R_k^sm`은 표본이 적은 등급에서 값이 너무 튀지 않도록 보정한 enrichment ratio다.

기본값은 \(\alpha = 1\) 로 둔다.

또한 극단적 값이 메인 모델을 지배하지 않도록 아래 범위에서 clipping 한다.

\[
m_k = \min(\max(R_k^{sm}, 0.25), 4.0)
\]

plain-text: `m_k`는 너무 작거나 너무 큰 값을 잘라낸 최종 soft-mask weight다.

### 6.6 soft mask로 활용

AHP를 최종식에 직접 중복 투입하지 않고 calibration된 soft mask로 사용한다.

\[
m_{c(g)} = m_k
\]

plain-text: 격자 `g`가 등급 `k`에 속하면, 그 격자의 soft mask 값은 `m_k`를 사용한다.

즉 AHP는 최종적으로 **이론적 prior를 실제 점자료로 보정한 soft mask** 역할을 한다.

### 6.7 hard mask

설치 불가능한 격자는 hard mask로 제외한다.

\[
M_g^{hard} \in \{0,1\}
\]

plain-text: `M_g^{hard} = 0`이면 설치 불가, `1`이면 설치 가능이다.

예시는 다음과 같다.

- 수면
- 보호구역
- 과도한 경사
- 명백한 설치 불가 토지

### 6.8 AHP prior 구축 시 판단 규칙

문서 수준이 아니라 실제 구현 수준에서 아래 기준을 사용한다.

1. hard mask는 가능한 한 **보수적** 으로 적용한다.
2. soft mask는 관측 자료로 보정하되, 메인 모델을 압도하지 않도록 clip 한다.
3. 공변량과 AHP가 동일 변수를 공유하더라도 AHP는 **prior weight** 로만 취급한다.

---

## 7. 데이터 기반 공변량 \(x_g\)

본 연구에서 \(x_g\) 는 격자 \(g\) 의 설명변수 벡터이다.

핵심은 **설명 가능한 현실 변수**를 만드는 것이다.

### 7.1 기본 물리/환경 변수

\[
(GHI, slope, aspect, elevation, LULC)
\]

plain-text: 기본 공변량은 `GHI, slope, aspect, elevation, land cover` 다.

### 7.2 거리형 공변량

격자 centroid 기준 최근접 거리:

\[
d_g^{road}, d_g^{powerline}, d_g^{substation}, d_g^{urban}, d_g^{water}
\]

plain-text: 각 격자에 대해 도로, 송전선, 변전소, 도시지역, 수면까지의 최근접거리를 계산한다.

실제 모델에서는 다음 변환을 기본으로 사용한다.

\[
\log(1+d_g)
\]

plain-text: 거리 변수는 보통 `log(1 + distance)` 형태로 변환해 긴 꼬리를 완화한다.

### 7.3 버퍼/반경 요약형 공변량

격자 주변 반경 안의 공간구조를 요약한다.

예시는 다음과 같다.

- road density within 1km
- developable land ratio within 1km
- urban ratio within 2km
- protected area ratio within 1km

### 7.4 다중 스케일 공변량

동일 변수를 여러 거리대에서 계산한다.

- road density within 500m / 1km / 3km
- urban ratio within 500m / 2km / 5km

### 7.5 방향/벡터형 공변량

필요시 방향성을 반영할 수 있다.

- nearest substation까지의 \(\Delta x, \Delta y\)
- bearing to nearest road / substation

### 7.6 상호작용/변환형 공변량

현실적인 설치 조건을 반영하기 위해 일부 파생항을 고려한다.

\[
GHI \times developable\ ratio
\]

plain-text: 일사량이 높고 개발가능 면적도 큰 곳을 더 높게 평가하는 상호작용항이다.

\[
slope \times LULC
\]

plain-text: 경사 효과가 토지피복 유형에 따라 달라질 수 있음을 반영한다.

\[
\log(1+dist\_substation)
\]

plain-text: 변전소 거리 변수의 비선형 효과를 반영한 변환형 변수다.

### 7.7 1차 고정 feature set

초기 실험에서는 feature explosion을 막기 위해 아래 세 묶음으로 고정한다.

1. **기본형**
   - GHI, slope, elevation, LULC, road distance, substation distance, urban distance
2. **확장형**
   - 기본형 + road density, developable ratio, protected ratio
3. **공간확장형**
   - 확장형 + neighborhood summary 또는 kernel density feature

### 7.8 전처리 규칙

모든 공변량은 아래 규칙을 따른다.

1. 연속형 변수는 winsorizing 후 z-score 표준화
2. 거리형 변수는 `log1p` 변환
3. 범주형 LULC는 one-hot 또는 ordered grouping
4. 결측은 "물리적으로 불가능"과 "데이터 미존재"를 구분하여 처리
5. hold-out 실험 시 hold-out 점을 이용한 누설이 없도록 공간 feature를 재계산

---

## 8. 공간효과 \(w_g\)

\(w_g\) 는 \(x_g\) 로 설명되지 않는 잔여 공간 군집성(spatial dependence)을 나타낸다.

즉 "왜 주변 격자끼리 비슷한가"를 보정하는 항이다.

### 가능한 방식

#### (1) \(w_g = 0\)
- 공간효과를 넣지 않는 baseline

#### (2) spatial-feature 대체형
- 인접 셀 평균값
- kernel-smoothed observed PV density
- 주변 셀 개발가능지 비율
- 주변 road density

#### (3) CAR / BYM2 spatial random effect
- 격자 인접 그래프 기반 공간 랜덤효과
- areal/lattice data에 적합

#### (4) Gaussian Process
- 연속공간 랜덤장으로 표현

#### (5) LGCP 또는 point-process latent field
- 점군집성 자체를 직접 모델링하는 고급 확장

### 본 연구의 추천

초기 버전에서는 아래 순서를 고정한다.

1. baseline: \(w_g = 0\)
2. 실전형: spatial-feature 대체형
3. 확장형: CAR/BYM2

즉 처음부터 무거운 공간모형으로 가지 않고, **feature-based 공간효과 -> explicit spatial random effect** 순으로 확장한다.

---

## 9. 메인 모델: Conditional Multinomial Allocation Model

본 연구의 메인 모델은 **시군구 내부 조건부 다항 allocation 구조**이다.

여기서부터는 `score 생성 -> intensity 변환 -> 시군구 내부 확률화 -> 누락량 배분` 순서로 읽으면 된다.

### 9.1 격자 score 정의

\[
s_g = \beta^\top x_g + \rho \log m_{c(g)} + w_g
\]

plain-text: `score_g = 공변량 효과 + AHP prior 효과 + 공간효과`

여기서

- \(x_g\): 데이터 기반 공변량
- \(m_{c(g)}\): AHP soft mask
- \(w_g\): 공간효과

### 9.2 intensity 정의

\[
\lambda_g = M_g^{hard}\exp(s_g)
\]

plain-text: `lambda_g = hard mask * exp(score_g)`

즉, 설치 불가 격자는 `hard mask = 0` 이므로 자동으로 `lambda_g = 0` 이 된다.

### 9.3 시군구 내부 확률화

시군구 \(r\) 내부에서

\[
p_{rg} = \frac{\lambda_g}{\sum_{h\in G_r}\lambda_h}
\]

plain-text: `p_rg = 격자 g의 강도 / 시군구 r 내부 전체 강도 합`

로 정의한다.

이로써 각 시군구 내부 확률합은 자동으로 1이 된다.

### 9.4 학습 타깃

관측된 실제 PV 점자료를 격자에 집계하여 \(y_g^{obs}\) 를 만든다.

- \(y_g^{obs}\) 는 학습용 관측 count다.
- 메인 모델은 "어느 셀이 상대적으로 더 많은 관측 PV를 갖는가"를 학습한다.
- 공식 총량 \(N_r\) 는 학습 타깃이 아니라 **배분 제약 조건**으로 사용된다.

### 9.5 조건부 likelihood

개념적으로는 다음 조건부 multinomial likelihood를 사용한다.

\[
\ell(\beta,\rho,w)
=
\sum_r \sum_{g\in G_r}
y_g^{obs}
\left(
s_g - \log \sum_{h\in G_r}\exp(s_h)
\right)
\]

plain-text:

- 관측 PV가 많이 들어간 격자일수록 높은 score를 갖도록 학습한다.
- 단, 비교는 항상 `같은 시군구 내부`에서만 일어난다.

이 식은 관측된 PV count가 시군구 내부에서 어떤 셀에 얼마나 집중되는지를 직접 반영한다.

### 9.5.1 식의 의미를 단계별로 풀어쓰면

1. 각 grid에 대해 `score_g`를 계산한다.
2. 그 score를 `exp(score_g)`로 바꿔 양수 intensity로 만든다.
3. 그 intensity를 같은 시군구 내부에서만 정규화해 `p_rg`를 만든다.
4. 관측 count `y_g^obs`가 큰 셀일수록 더 높은 `p_rg`가 나오도록 파라미터를 학습한다.

### 9.6 학습 단위와 split 원칙

훈련과 검증은 아래 원칙을 따른다.

1. **관측 점 hold-out 실험**
   - 관측 점 중 일정 비율을 숨기고 복원력을 평가한다.
2. **공간 블록 기반 split**
   - 인접 격자 누설을 줄이기 위해 시군구 또는 권역 단위 블록 split을 병행한다.
3. **시간 불일치 시 기준연도 split**
   - 동일 연도 자료만 사용하거나 연도별 보정항을 둔다.

### 9.7 규제화와 안정성

메인 모델은 아래 안정화 장치를 둔다.

- \(\beta\) 에 L2 regularization
- \(m_k\) clipping
- 희소 시군구에 대한 최소 eligible cell 수 기준
- 관측 점이 극히 적은 지역의 경우 hierarchical pooling 또는 권역 수준 fallback

### 9.8 지역별 예외 처리 규칙

아래 경우는 명시적으로 처리한다.

1. \(U_r < 0\)
   - 공식 총량과 관측 점 count 불일치이므로 데이터 품질 이슈로 분류한다.
2. eligible cell이 너무 적은 지역
   - 격자 해상도를 상향하거나 hard mask 기준을 완화 검토한다.
3. 관측 점이 0인 지역
   - 메인 모델의 전국 파라미터와 AHP prior만으로 allocation 한다.

---

## 10. 비교모형

메인 모델의 성능을 상대평가하기 위해 다음 비교모형을 둔다.

### 10.1 Uniform-feasible baseline

\[
p_{rg}^{UNI}
=
\frac{M_g^{hard}}{\sum_{h\in G_r} M_h^{hard}}
\]

plain-text: 설치 가능한 격자들에 동일 확률을 주는 가장 단순한 baseline이다.

### 10.2 AHP-only model

\[
p_{rg}^{AHP}
=
\frac{M_g^{hard} m_{c(g)}}{\sum_{h\in G_r} M_h^{hard} m_{c(h)}}
\]

plain-text: AHP soft mask만으로 시군구 내부 확률을 만든 baseline이다.

### 10.3 Covariate-only multinomial model

AHP 없이 공변량만으로 score를 학습한다.

\[
s_g^{X} = \beta^\top x_g
\]

plain-text: AHP 없이 오직 공변량만으로 score를 추정하는 비교모형이다.

즉, AHP prior의 실질 기여도를 확인하기 위한 비교모형이다.

### 10.4 XGBoost / CatBoost

데이터 기반 비선형 모델을 이용해

\[
s_g^{ML} = f_\theta(x_g)
\]

plain-text: 비선형 머신러닝 모델이 공변량으로부터 score를 직접 학습한다.

즉, 이 score를 학습하고,

\[
\lambda_g = M_g^{hard} \cdot m_{c(g)} \cdot \exp(s_g^{ML})
\]

plain-text: hard mask, AHP soft mask, ML score를 결합해 intensity를 만든다.

로 최종 intensity를 구성할 수 있다.

이 모델은 예측성능 비교에 유용하다.

---

## 11. 누락된 PV의 배분

각 시군구 \(r\) 에서 누락된 개수는

\[
U_r = N_r - n_r^{obs}
\]

이다.

plain-text: 시군구별 누락량은 `공식 총량 - 관측된 PV 수` 다.

이제 시군구 내부 확률 \(p_{rg}\) 를 이용해 누락된 PV를 배분한다.

### 11.1 결정론적 배분

\[
\hat m_{rg} = U_r p_{rg}
\]

plain-text: 시군구 `r`의 누락량 `U_r` 중에서 격자 `g`가 가져가는 기대 배분량이다.

대표 결과를 만들 때는 결정론적 배분을 기본 산출물로 둔다.

### 11.2 확률적 배분 (Monte Carlo)

\[
(m_{r1},\dots,m_{rK_r}) \sim Multinomial(U_r, p_r)
\]

plain-text: 누락된 `U_r`개를 시군구 내부 확률벡터 `p_r`에 따라 확률적으로 뽑아 배분한다는 뜻이다.

Monte Carlo 배분은 uncertainty analysis 또는 ensemble generation에 사용한다.

기본 실험 설정은 다음과 같다.

- 반복 수: 100회
- 산출값: 셀별 평균, 표준편차, 5/50/95 분위수

### 11.3 최종 복원 결과

격자 \(g\) 의 최종 PV 개수는

\[
\hat Z_g = y_g^{obs} + \hat m_{rg}
\]

이다.

plain-text: 최종 복원값은 `이미 관측된 PV 수 + 새로 배분된 누락 PV 수` 다.

### 11.4 synthetic point 생성 규칙

격자 count 결과를 point로 변환해야 할 경우 아래 규칙을 적용한다.

1. count가 1 이상인 격자에 대해 해당 개수만큼 점을 생성한다.
2. 점 위치는 격자 내부에서 hard mask를 만족하는 셀 부분집합에 한정해 무작위 추출한다.
3. 동일 격자 내 복수 점은 최소 간격 규칙을 적용해 과도한 중첩을 방지한다.

---

## 12. 연구 수행 순서

### Phase 1. 데이터 정비

작업:

1. 행정구역별 PV 총량 \(N_r\) 정리
2. 실제 PV point layer 정비
3. 좌표계, 단위, 시점 통일
4. point를 시군구와 격자에 spatial join
5. \(n_r^{obs}\), \(y_g^{obs}\) 계산

산출물:

- `district_totals.parquet`
- `pv_points_observed.gpkg`
- `observed_counts_by_region.csv`

품질 점검:

- 중복 점 비율
- \(U_r < 0\) 인 지역 목록
- 기준 시점 불일치 지역 목록

### Phase 2. 격자 구축

작업:

1. 전국 격자 생성
2. 각 격자에 `region_id` 부여
3. centroid 생성
4. GIS layer join

산출물:

- `analysis_grid_500m.parquet`

품질 점검:

- 행정구역 누락 격자 수
- 해안 및 도서지역 coverage 확인
- 격자 총수 및 지역별 셀 수 분포

### Phase 3. 거리변수 및 공변량 계산

작업:

1. road distance
2. powerline distance
3. substation distance
4. urban distance
5. water / protected area distance
6. buffer summary 변수 계산

산출물:

- `feature_matrix_500m.parquet`

품질 점검:

- 결측률
- 극단값 분포
- 변수 상관계수와 다중공선성

### Phase 4. AHP prior 구축

작업:

1. 국내 AHP 논문 조사
2. 변수와 가중치 정리
3. AHP suitability score 계산
4. 등급화 \(c(g)\)
5. 실제 PV와 비교해 \(R_k\) 계산
6. soft mask \(m_{c(g)}\) 생성
7. hard mask \(M_g^{hard}\) 생성

산출물:

- `ahp_prior_500m.parquet`
- `ahp_weights_review.md`

품질 점검:

- class별 면적 비중
- class별 observed PV 비중
- smoothing 전후 \(R_k\) 안정성

### Phase 5. 데이터 기반 intensity 학습

작업:

1. 공변량 \(x_g\) 구성
2. 메인 모델 학습
3. 비교모형 학습
4. hyperparameter tuning

산출물:

- `model_metrics.csv`
- `feature_importance.csv`
- `region_level_diagnostics.csv`

품질 점검:

- train/validation gap
- 지역별 과적합 여부
- feature sign 및 중요도 해석 가능성

### Phase 6. allocation 및 reconstruction

작업:

1. \(U_r = N_r - n_r^{obs}\) 계산
2. \(p_{rg}\) 계산
3. \(\hat m_{rg}=U_r p_{rg}\)
4. \(\hat Z_g=y_g^{obs}+\hat m_{rg}\)
5. synthetic point 생성

산출물:

- `reconstructed_pv_grid_500m.parquet`
- `synthetic_pv_points_500m.gpkg`

품질 점검:

- 시군구 총량 일치 여부
- 음수 또는 비정상 count 발생 여부
- 점 생성 실패 셀 목록

### Phase 7. 검증 및 해석

작업:

1. hold-out observed point 복원력 평가
2. 공간 패턴 비교
3. 환경 맥락 비교
4. 민감도 분석
5. 실패 지역 원인 분석

산출물:

- `validation_report.md`
- `sensitivity_summary.csv`
- 최종 Figure 세트

### Phase 1 ~ 7을 한 줄로 요약하면

```text
데이터 정비
-> grid 구축
-> AHP prior 구축
-> 공변량 계산
-> intensity 학습
-> 시군구 내부 allocation
-> 복원 결과 검증
```

---

## 13. 검증 전략

본 연구에서는 단순 분류성능이 아니라 **공간 재구성 품질**을 검증해야 한다.

### 13.1 검증 프로토콜

검증은 아래 두 축으로 수행한다.

1. **point masking validation**
   - 관측 점의 20%를 무작위 또는 지역별 층화 방식으로 hold-out 한다.
2. **spatial block validation**
   - 인접 셀 누설을 줄이기 위해 권역 또는 시군구 블록 단위로 split 한다.

### 13.2 위치 복원력

hold-out 점에 대해 다음 지표를 계산한다.

- hold-out point의 평균 predicted rank
- top 10% 고확률 셀 내 capture rate
- hold-out log score
- Brier-type occupancy score

### 13.3 공간 패턴 검증

복원된 결과와 실제 점자료의 다음 패턴을 비교한다.

- Moran's I
- Ripley's K
- nearest-neighbor distance
- pair correlation function이 가능하면 추가

### 13.4 환경적 맥락 검증

복원된 PV와 실제 PV의 다음 분포를 비교한다.

- slope
- LULC
- road distance
- substation distance
- urban distance

비교 지표는 아래를 권장한다.

- KS statistic
- Jensen-Shannon divergence
- category share absolute error

### 13.5 행정구역 제약 검증

복원 후 각 시군구 총량이 정확히 \(N_r\) 와 일치하는지 확인한다.

이 항목은 성능지표가 아니라 **필수 제약 충족 여부**다.

### 13.6 민감도 분석

다음 요소에 대한 민감도 분석을 수행한다.

1. 격자 크기: 250m / 500m / 1km
2. AHP class 구분 방식: quantile / Jenks
3. 공간효과 포함 여부
4. distance feature 집합 구성

### 13.7 최종 채택 기준

최종 모델은 아래 기준을 만족해야 채택한다.

1. 모든 시군구 총량 제약을 정확히 만족
2. `AHP-only` 와 `uniform-feasible` 대비 위치 복원력 개선
3. 환경 분포 왜곡이 baseline보다 작거나 비슷
4. 특정 권역에서만 잘 되고 다른 지역에서 붕괴하는 패턴이 없어야 함

---

## 14. 본 연구의 정체성

본 연구는 다음과 같이 정의할 수 있다.

> **AHP 기반 최적입지 prior를 실제 관측된 PV point inventory로 보정한 후, 시군구별 공식 총량 제약 하에서 조건부 다항 allocation model을 이용하여 누락된 PV 위치를 복원하는 hybrid spatial reconstruction framework**

즉 본 연구는 단순한 AHP 논문도 아니고, 단순한 ML 예측 논문도 아니다.

- **이론적 prior (AHP)**
- **실제 설치 패턴 (observed PV points)**
- **행정구역 총량 제약**
- **조건부 allocation modeling**

을 결합하는 연구다.

---

## 15. 현재 기준 추천 설계

현재 시점에서 1차 구현안은 아래처럼 고정하는 것이 가장 현실적이다.

### 15.1 AHP

- 변수 선정 근거로 사용
- 보수적 hard mask 생성
- calibration된 soft mask 생성
- 5등급 quantile + Laplace smoothing + clipping 적용

### 15.2 격자

- 기본: 500m
- 민감도 분석: 250m / 1km

### 15.3 메인 모델

- Conditional multinomial allocation model
- L2 regularization 포함
- 공간효과는 1차에서 feature-based 방식으로 시작

### 15.4 비교모형

- uniform-feasible
- AHP-only
- covariate-only
- XGBoost / CatBoost

### 15.5 공간효과

- 1차: neighborhood summary 또는 kernel density feature
- 2차: CAR/BYM2 확장

---

## 16. 현재 시점에서 가장 중요한 확인 사항

아래 여섯 가지를 먼저 확정해야 이후 단계가 흔들리지 않는다.

1. 공식 PV 총량 데이터의 단위가 정확히 무엇인지
2. point layer의 점 1개가 실제로 무엇을 의미하는지
3. 공식 총량과 point layer의 기준 시점이 같은지
4. 거리 계산에 필요한 GIS 레이어 확보 여부
5. 국내 AHP 논문의 변수/가중치 확보 가능 여부
6. 격자 크기와 raster 해상도의 호환성

### 16.1 즉시 확인해야 할 결정 규칙

실무적으로는 아래 순서로 판단한다.

1. 단위 확인
   - `count` 면 현재 설계를 유지한다.
   - `capacity` 면 count 모델과 분리한다.
2. 시점 확인
   - 동일 연도면 진행한다.
   - 차이가 크면 기준연도 재정렬 또는 제외한다.
3. 점 정의 확인
   - 점 1개가 설비 1개가 아니면 cluster-level 해석으로 전환한다.

---

## 17. 연구 일정(안)

현실적인 6주 일정은 다음과 같다.

### Week 1

- 공식 총량 데이터와 관측 점자료 정합성 검토
- 행정경계 및 인프라 레이어 확보
- 데이터 단위와 기준 시점 확정

### Week 2

- 전국 500m 격자 생성
- 공간 join 및 기본 공변량 구축
- 결측과 이상치 점검

### Week 3

- AHP prior 설계
- hard/soft mask 생성
- AHP-only, uniform baseline 구축

### Week 4

- 메인 multinomial 모델 학습
- covariate-only 및 XGBoost/CatBoost 비교모형 학습

### Week 5

- reconstruction 수행
- hold-out 검증
- 공간 패턴 및 환경 분포 평가

### Week 6

- 민감도 분석
- 실패 지역 진단
- 최종 Figure와 문서 정리

---

## 18. 최종 산출물

최종적으로 아래 산출물을 만드는 것을 목표로 한다.

1. **정제 데이터셋**
   - 시군구 총량
   - 관측 점자료
   - 분석 격자
2. **모델 산출물**
   - AHP prior
   - 메인 모델 파라미터 또는 학습 artifact
   - region-level diagnostics
3. **결과 데이터셋**
   - reconstructed grid count
   - synthetic PV point layer
   - uncertainty summary
4. **연구 문서**
   - 방법론 요약
   - 검증 보고서
   - Figure 및 표

---

## 19. 예상 리스크와 대응

### 19.1 데이터 단위 불일치

리스크:

- 공식 총량이 count가 아니라 capacity일 수 있다.

대응:

- count 모델과 capacity 모델을 분리하고, count 환산이 불가능하면 연구 질문을 조정한다.

### 19.2 관측 점자료의 표본 편향

리스크:

- 공개 좌표가 특정 규모나 특정 지역에 치우쳐 있을 수 있다.

대응:

- 지역별 hold-out
- 권역별 성능 비교
- AHP prior와 공변량의 보수적 결합

### 19.3 공간 레이어 품질 차이

리스크:

- 도로, 송전선, 보호구역의 최신성이나 위치 오차가 다를 수 있다.

대응:

- 핵심 변수만 우선 사용
- 레이어별 기준 연도 기록
- 민감도 분석에서 영향 확인

### 19.4 계산 비용 증가

리스크:

- 전국 250m 격자와 복잡한 공간효과는 계산량이 매우 크다.

대응:

- 기본은 500m
- 250m는 샘플 권역 또는 민감도 분석용으로 제한
- 공간효과는 feature-based 방식부터 시작

---

## 20. 최종 요약

본 연구는 다음 흐름으로 요약할 수 있다.

```text
Official district totals
 + Observed PV points
 + AHP prior
 + Grid-based covariates
-> estimate lambda_g
-> normalize within each region to get p_rg
-> compute missing count U_r = N_r - n_r^obs
-> allocate missing PV: m_rg = U_r * p_rg
-> final reconstruction: Z_hat_g = y_g^obs + m_rg
```

한 줄로 쓰면 아래와 같다.

- 입력: `공식 총량 + 관측 점자료 + AHP prior + grid 공변량`
- 중간 단계: `lambda_g 추정 -> p_rg 계산`
- 출력: `누락량 배분 -> 최종 복원값 Z_hat_g 생성`

즉, 본 연구의 핵심은 **시군구 총량 제약 하에서 누락된 PV 위치를 가장 현실적으로 배분하는 격자 기반 hybrid spatial allocation model** 이다.

다음 실무 단계는 아래 세 가지다.

1. 공식 총량 데이터 단위와 기준 시점을 확정한다.
2. 관측 점자료의 점 1개 의미를 확정한다.
3. 500m 격자 기준 전처리 산출물부터 고정한다.

---
