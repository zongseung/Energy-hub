-- Energy Hub Materialized Views
-- 실행: docker exec energy-hub-db psql -U energy_user -d energy_hub -f /sql/create_views.sql

-- ══════════════════════════════════════════════════════════════
-- 시군구별 PV + RPS 집계 뷰
-- ══════════════════════════════════════════════════════════════
DROP MATERIALIZED VIEW IF EXISTS mv_sigungu_summary;

CREATE MATERIALIZED VIEW mv_sigungu_summary AS
SELECT
    ab.sig_cd,
    ab.sig_kor_nm,
    COUNT(pf.id)                                          AS pv_count,
    COUNT(pf.id) FILTER (WHERE pf.status = '정상가동')     AS pv_active,
    COALESCE(SUM(pf.capacity_kw), 0)                      AS total_capacity_kw,
    rps.cnt                                               AS rps_facility_cnt,
    rps.inst_capa                                         AS rps_inst_capa,
    rps.gelec_qty                                         AS rps_gelec_qty
FROM admin_boundary ab
LEFT JOIN pv_facility pf
    ON pf.has_coord = true AND ST_Within(pf.geom, ab.geom)
LEFT JOIN rps_utilization rps
    ON ab.sig_cd = rps.gugun_code
GROUP BY ab.sig_cd, ab.sig_kor_nm, rps.cnt, rps.inst_capa, rps.gelec_qty;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sigungu ON mv_sigungu_summary(sig_cd);

-- 리프레시 (초기 1회)
REFRESH MATERIALIZED VIEW mv_sigungu_summary;
