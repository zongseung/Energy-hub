-- Energy Hub 전체 검증 쿼리
-- 실행: docker exec energy-hub-db psql -U energy_user -d energy_hub -f /sql/verify_all.sql

\echo '══════════════════════════════════════════════════'
\echo '  로컬 테이블 검증'
\echo '══════════════════════════════════════════════════'

SELECT 'pv_facility' AS table_name,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE has_coord) AS with_coord
FROM pv_facility;

SELECT 'substation' AS table_name, COUNT(*) AS total FROM substation;
SELECT 'power_line' AS table_name, COUNT(*) AS total FROM power_line;
SELECT 'rps_utilization' AS table_name, COUNT(*) AS total FROM rps_utilization;
SELECT 'admin_boundary' AS table_name, COUNT(*) AS total FROM admin_boundary;
SELECT 'weather_station' AS table_name, COUNT(*) AS total FROM weather_station;

\echo ''
\echo '══════════════════════════════════════════════════'
\echo '  FDW 외래 테이블 검증 (sdb: demand-postgres)'
\echo '══════════════════════════════════════════════════'

SELECT 'demand_5min' AS table_name, COUNT(*) AS total FROM demand_5min;
SELECT 'demand_weather_1h' AS table_name, COUNT(*) AS total FROM demand_weather_1h;
SELECT 'heat_demand' AS table_name, COUNT(*) AS total FROM heat_demand;
SELECT 'heat_demand_location' AS table_name, COUNT(*) AS total FROM heat_demand_location;

\echo ''
\echo '══════════════════════════════════════════════════'
\echo '  FDW 외래 테이블 검증 (sdc: pv-data-postgres)'
\echo '══════════════════════════════════════════════════'

SELECT 'nambu_generation' AS table_name, COUNT(*) AS total FROM nambu_generation;
SELECT 'nambu_plants' AS table_name, COUNT(*) AS total FROM nambu_plants;
SELECT 'namdong_generation' AS table_name, COUNT(*) AS total FROM namdong_generation;
SELECT 'namdong_plants' AS table_name, COUNT(*) AS total FROM namdong_plants;
SELECT 'wind_hangyoung' AS table_name, COUNT(*) AS total FROM wind_hangyoung;
SELECT 'wind_namdong' AS table_name, COUNT(*) AS total FROM wind_namdong;
SELECT 'wind_seobu' AS table_name, COUNT(*) AS total FROM wind_seobu;

\echo ''
\echo '══════════════════════════════════════════════════'
\echo '  Materialized View 검증'
\echo '══════════════════════════════════════════════════'

SELECT 'mv_sigungu_summary' AS view_name, COUNT(*) AS total FROM mv_sigungu_summary;

\echo ''
\echo '══════════════════════════════════════════════════'
\echo '  크로스 DB 조인 테스트'
\echo '══════════════════════════════════════════════════'

-- 가장 가까운 관측소의 PV 발전소
SELECT pf.name AS pv_name,
       ws.name AS station_name,
       ROUND(ST_Distance(pf.geom::geography, ws.geom::geography)::numeric) AS dist_m
FROM pv_facility pf
CROSS JOIN LATERAL (
    SELECT ws2.name, ws2.geom
    FROM weather_station ws2
    ORDER BY pf.geom <-> ws2.geom
    LIMIT 1
) ws
WHERE pf.id = 1 AND pf.geom IS NOT NULL;

-- demand_5min 최신 1행 (FDW push-down 확인)
SELECT * FROM demand_5min ORDER BY timestamp DESC LIMIT 1;

\echo ''
\echo '══════════════════════════════════════════════════'
\echo '  검증 완료'
\echo '══════════════════════════════════════════════════'
