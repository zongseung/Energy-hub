# 외부 데이터 유출(리버스 엔지니어링/스크래핑) 하드닝 — PRD v0.1

작성일: 2026-06-13 · 트랙: security · 관련: [`SMB_CSV_NGINX_보안계획서`](../SMB_CSV_NGINX_보안계획서_2026-03-04.md)

## Context
"외부에서 리버스 엔지니어링으로 데이터를 빼낼 수 있는가" 점검 결과, **리버스 엔지니어링이 불필요할 정도로 열려 있음**을 확인했다. 현재 스택(FastAPI + Martin + Nginx)은 **인증/인가가 전혀 없고**, OpenAPI 문서가 공개이며, Martin이 `public`(+`tiger`) 스키마를 통째로 벡터타일로 자동 발행한다. 네트워크에 도달 가능한 누구나 전 데이터셋을 수집할 수 있다.

> 전제: 데이터센터의 weather/demand "다운로드"는 **의도된 기능**이다. 문제는 그 대상·범위가 **미신뢰 네트워크에 무인증으로** 열려 있다는 점이다. 대응 강도는 아래 **결정 사항**(인터넷 노출 여부 / 공개데이터 여부)에 따른다.

---

## 발견 (검증 완료)

| # | 심각도 | 위치 | 내용 | 근거(실측) |
|---|--------|------|------|-----------|
| F1 | **HIGH** | `backend/app/main.py` (인증 미들웨어 부재) · `nginx.conf` | 모든 API + 다운로드/export 엔드포인트가 **무인증**. CORS(`allow_origins` 제한)는 브라우저 교차출처만 막고 직접 호출엔 무력 | `Origin` 없이 `curl /api/v1/demand/export?...` → **200** |
| F2 | **HIGH** | `src/martin/martin.yaml` `auto_publish` | 스키마 통째 자동 발행 → `ev_charger_latest`(충전소명·사업자·주소·출력), `pv_facility`, 인프라, **`tiger.*` 샘플 테이블**까지 타일 단위 수집 가능 | `/tiles/catalog`에 노출, `/tiles/ev_charger_latest/...` → **200** |
| F3 | MED | `main.py` `docs_url/redoc_url`, `nginx.conf` `/docs /redoc /openapi.json` | API 계약(39경로) **완전 공개** → 공격자가 번들 분석 없이 전 엔드포인트·파라미터 획득 | `/openapi.json` → 200, 33KB |
| F4 | MED | `src/martin/martin.yaml:5` (git 추적됨) | **평문 DB 비밀번호** 소스 관리에 포함 | `energy_user:****` (평문, 이후 로테이션·env분리로 무효화) |
| F5 | LOW(설계상) | `demand.py`/`data.py` 다운로드 | 대용량/전기간 추출 허용(rate limit만) | export `hours=8784`, 연도 ZIP 등 |

(앞선 인젝션 리뷰에서 SQL/XSS/경로탈출 확정 취약점은 없음 — 이 문서는 **노출/인가** 클래스 한정.)

---

## 결정 사항 (대응 강도 결정 — 사용자 확인 필요)
1. **노출 범위**: 8088이 (a) 인터넷 직접 노출 / (b) 사내 LAN·VPN 전용 / (c) 향후 공개 예정 — 어느 쪽인가?
2. **데이터 개방성**: weather/demand/인프라 데이터가 (a) 공개(open-data) 의도 / (b) 내부·승인자 전용인가?

→ (b/b)면 **네트워크 게이팅 중심**(Phase 1)으로 충분. (a/공개)면 **인증·쿼터·서명URL**(Phase 2)까지.

---

## 대응 계획

### Phase 1 — 즉시(고효과, UX 영향 적음)
1. **네트워크 게이팅(최대 레버)**: `nginx.conf`에 신뢰 CIDR `allow/deny` 또는 VPN/인증 프록시 뒤로. 외부 직접 도달 차단.
2. **문서 비공개(F3)**: 운영에서 `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)` 또는 nginx에서 `/docs|/redoc|/openapi.json`을 내부 CIDR로만 `allow`.
3. **Martin 발행 최소화(F2)**: `auto_publish`(스키마 통째)를 **명시적 테이블 allowlist**로 교체 — UI가 실제 쓰는 레이어(pv_facility / substation / power_line / power_plant / landcover / road / ev_charger_latest / admin_boundary)만. `tiger.*`·미사용 테이블 제거. 가능하면 `/tiles/`도 내부/인증 뒤로.
4. **시크릿 분리(F4)**: martin DB 접속을 `connection_string` 평문 대신 **환경변수**(`DATABASE_URL`)로 주입, `martin.yaml`에서 비밀번호 제거 후 **비밀번호 로테이션**. (이미 `src/.env`는 미추적)

### Phase 2 — 미신뢰 도달이 남거나 공개앱일 때
5. **다운로드 인가**: `/api/v1/data/*` + `/demand/export` (+필요시 `/tiles/`)에 **API 토큰/키 헤더** 또는 인증. (SMB 보안계획서의 mTLS+allowlist 모델 재사용)
6. **쿼터·범위 상한(F5)**: export 최대 행수/기간 캡 + per-IP 일일 쿼터(현 rate limit 보강).
7. **서명 URL(선택)**: 다운로드 URL에 만료 HMAC(`secure_link`) — 유출 시 시간제한. (SMB 보안계획서 §7 재사용)

---

## 적용 파일
- `src/nginx/nginx.conf` — allow/deny CIDR, `/docs|/redoc|/openapi.json` 게이팅, (Phase2) 다운로드/타일 인증 location
- `src/backend/app/main.py` — 운영 시 docs/openapi 비활성, (Phase2) 인증 의존성
- `src/martin/martin.yaml` — `auto_publish` → 명시 allowlist, DB비번 env화
- (운영) DB 비밀번호 로테이션, `martin.yaml` 시크릿 제거 커밋

## 검증
- [ ] 비신뢰 IP에서 `/api/v1/...`, `/tiles/...`, `/docs` 접근 시 차단(403/거부)
- [ ] `/tiles/catalog`에 UI 사용 레이어만 노출(`tiger.*` 등 제거)
- [ ] `martin.yaml`에 평문 비밀번호 없음 + 로테이션 완료
- [ ] (Phase2) 토큰 없는 export/다운로드 호출 401

## 비고
- F5(대용량 추출)·rate limit 류는 앞선 자동 보안리뷰에선 제외 항목이나, "외부 수집" 위협모델에선 Phase 2의 쿼터로 함께 다룬다.
- 본 문서는 점검 결과에 따른 권고안이며, 실제 적용은 위 **결정 사항** 확정 후 진행.
