-- Energy Hub DDL — 로컬 테이블 + 확장 설치
-- 실행: docker exec energy-hub-db psql -U energy_user -d energy_hub -f /sql/schema/energy_hub_ddl.sql

-- ══════════════════════════════════════════════════════════════
-- 1. 확장 설치
-- ══════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- ══════════════════════════════════════════════════════════════
-- 2. pv_facility — data.go.kr PV 허가 데이터 (114,840건)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pv_facility (
    id              SERIAL PRIMARY KEY,
    name            TEXT,
    addr_road       TEXT,
    addr_jibun      TEXT,
    geom            GEOMETRY(POINT, 4326),
    has_coord       BOOLEAN GENERATED ALWAYS AS (geom IS NOT NULL) STORED,
    install_type    TEXT,
    status          TEXT NOT NULL,
    capacity_kw     NUMERIC(15, 2),
    voltage         TEXT,
    frequency       TEXT,
    install_year    SMALLINT,
    usage_detail    TEXT,
    permit_date     DATE,
    permit_org      TEXT,
    install_area_m2 NUMERIC(15, 2),
    data_date       DATE,
    source_file     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pv_geom ON pv_facility USING GIST(geom) WHERE geom IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pv_status ON pv_facility(status);
CREATE INDEX IF NOT EXISTS idx_pv_has_coord ON pv_facility(has_coord);
CREATE INDEX IF NOT EXISTS idx_pv_name_trgm ON pv_facility USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pv_addr_trgm ON pv_facility USING GIN(addr_road gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pv_capacity ON pv_facility(capacity_kw);
CREATE INDEX IF NOT EXISTS idx_pv_year ON pv_facility(install_year);

-- ══════════════════════════════════════════════════════════════
-- 3. substation — OSM 변전소 (1,185건)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS substation (
    id       SERIAL PRIMARY KEY,
    name     TEXT,
    name_en  TEXT,
    geom     GEOMETRY(POINT, 4326) NOT NULL,
    voltage  TEXT,
    sub_type TEXT,
    frequency TEXT,
    operator TEXT,
    osm_id   BIGINT,
    sido     TEXT
);

CREATE INDEX IF NOT EXISTS idx_sub_geom ON substation USING GIST(geom);

-- ══════════════════════════════════════════════════════════════
-- 4. power_line — OSM 송배전선 (4,685건)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS power_line (
    id         SERIAL PRIMARY KEY,
    name       TEXT,
    geom       GEOMETRY(LINESTRING, 4326) NOT NULL,
    power_type TEXT,
    voltage    TEXT,
    sido       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pl_geom ON power_line USING GIST(geom);

-- ══════════════════════════════════════════════════════════════
-- 4-1. power_plant — OSM 발전소/발전기 (12,235건)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS power_plant (
    id            SERIAL PRIMARY KEY,
    name          TEXT,
    name_en       TEXT,
    geom          GEOMETRY(POINT, 4326) NOT NULL,
    power_type    TEXT,
    plant_source  TEXT,
    plant_output  TEXT,
    plant_method  TEXT,
    operator      TEXT,
    osm_id        BIGINT,
    sido          TEXT
);

CREATE INDEX IF NOT EXISTS idx_pp_geom ON power_plant USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_pp_source ON power_plant(plant_source);
CREATE INDEX IF NOT EXISTS idx_pp_sido ON power_plant(sido);

-- ══════════════════════════════════════════════════════════════
-- 4-2. wind_plant_location — 풍력 발전소 위치 (FDW 테이블 좌표 보완)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wind_plant_location (
    id            SERIAL PRIMARY KEY,
    plant_name    TEXT NOT NULL UNIQUE,
    label         TEXT NOT NULL,
    source_table  TEXT NOT NULL,
    geom          GEOMETRY(POINT, 4326) NOT NULL,
    operator      TEXT,
    capacity_mw   NUMERIC(10, 2),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wpl_geom ON wind_plant_location USING GIST(geom);

-- ══════════════════════════════════════════════════════════════
-- 5. rps_utilization — RE:Cloud RPS 이용률 (228행)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS rps_utilization (
    id              SERIAL PRIMARY KEY,
    sido_code       VARCHAR(5) NOT NULL,
    sido_name       VARCHAR(20) NOT NULL,
    gugun_code      VARCHAR(10) NOT NULL,
    gugun_name      VARCHAR(20) NOT NULL,
    cnt             INTEGER,
    inst_capa       DOUBLE PRECISION,
    gelec_qty       DOUBLE PRECISION,
    cnt_ratio       DOUBLE PRECISION,
    capa_ratio      DOUBLE PRECISION,
    gelec_diff      DOUBLE PRECISION,
    collected_at    DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rps_gugun_date ON rps_utilization(gugun_code, collected_at);

-- ══════════════════════════════════════════════════════════════
-- 6. admin_boundary — 시군구 행정경계 (250개)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_boundary (
    id              SERIAL PRIMARY KEY,
    sig_cd          VARCHAR(10) NOT NULL UNIQUE,
    sig_kor_nm      VARCHAR(50) NOT NULL,
    sig_eng_nm      VARCHAR(100),
    base_year       VARCHAR(4),
    geom            GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ab_geom ON admin_boundary USING GIST(geom);

-- ══════════════════════════════════════════════════════════════
-- 7. weather_station — 관측소 위치 (19개)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS weather_station (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL UNIQUE,
    address         VARCHAR(200),
    geom            GEOMETRY(POINT, 4326) NOT NULL,
    station_type    VARCHAR(20) DEFAULT 'heat_demand'
);

CREATE INDEX IF NOT EXISTS idx_ws_geom ON weather_station USING GIST(geom);

-- ══════════════════════════════════════════════════════════════
-- 8. landcover — EGIS 중분류 토지피복지도 lv2_2024y
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS landcover (
    id          BIGSERIAL PRIMARY KEY,
    gid         BIGINT,
    l2_code     VARCHAR(10),
    l2_name     TEXT,
    img_name    TEXT,
    img_date    TEXT,
    inx_num     TEXT,
    sido        TEXT,
    geom        GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lc_geom ON landcover USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_lc_l2code ON landcover(l2_code);
CREATE INDEX IF NOT EXISTS idx_lc_sido ON landcover(sido);
