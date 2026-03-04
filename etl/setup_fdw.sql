-- Energy Hub FDW 설정
-- demand-postgres (sdb:5433) + pv-data-postgres (sdc:5436) 외래 테이블 매핑
--
-- 실행: docker exec energy-hub-db psql -U energy_user -d energy_hub -f /sql/setup_fdw.sql
-- 주의: FDW 비밀번호는 환경변수로 대체 불가 — SQL에 직접 기재

-- ══════════════════════════════════════════════════════════════
-- 1. demand-postgres (sdb) 연결
-- ══════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'demand_server') THEN
        -- Docker 내부 네트워크 (weather-pipeline_prefect-new) 경유
        EXECUTE $sql$
            CREATE SERVER demand_server
                FOREIGN DATA WRAPPER postgres_fdw
                OPTIONS (
                    host 'demand-postgres',
                    port '5432',
                    dbname 'demand'
                )
        $sql$;
        RAISE NOTICE 'demand_server 생성 완료';
    ELSE
        RAISE NOTICE 'demand_server 이미 존재';
    END IF;
END $$;

-- 사용자 매핑
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_user_mappings
        WHERE srvname = 'demand_server' AND usename = current_user
    ) THEN
        EXECUTE format(
            'CREATE USER MAPPING FOR %I SERVER demand_server OPTIONS (user ''demand'', password ''demand'')',
            current_user
        );
        RAISE NOTICE 'demand_server 사용자 매핑 완료';
    ELSE
        RAISE NOTICE 'demand_server 사용자 매핑 이미 존재';
    END IF;
END $$;

-- 외래 테이블 가져오기 (기존 테이블 있으면 스킵)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'demand_5min' AND table_type = 'FOREIGN') THEN
        IMPORT FOREIGN SCHEMA public
            LIMIT TO (demand_5min, demand_weather_1h, heat_demand, heat_demand_location)
            FROM SERVER demand_server
            INTO public;
        RAISE NOTICE 'demand 외래 테이블 4개 매핑 완료';
    ELSE
        RAISE NOTICE 'demand 외래 테이블 이미 존재';
    END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 2. pv-data-postgres (sdc) 연결
-- ══════════════════════════════════════════════════════════════
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'pv_data_server') THEN
        -- Docker 내부 네트워크 (pv-pipeline-network) 경유
        EXECUTE $sql$
            CREATE SERVER pv_data_server
                FOREIGN DATA WRAPPER postgres_fdw
                OPTIONS (
                    host 'pv-data-postgres',
                    port '5432',
                    dbname 'pv'
                )
        $sql$;
        RAISE NOTICE 'pv_data_server 생성 완료';
    ELSE
        RAISE NOTICE 'pv_data_server 이미 존재';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_user_mappings
        WHERE srvname = 'pv_data_server' AND usename = current_user
    ) THEN
        EXECUTE format(
            'CREATE USER MAPPING FOR %I SERVER pv_data_server OPTIONS (user ''pv'', password ''pv'')',
            current_user
        );
        RAISE NOTICE 'pv_data_server 사용자 매핑 완료';
    ELSE
        RAISE NOTICE 'pv_data_server 사용자 매핑 이미 존재';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nambu_generation' AND table_type = 'FOREIGN') THEN
        IMPORT FOREIGN SCHEMA public
            LIMIT TO (
                nambu_generation, nambu_plants,
                namdong_generation, namdong_plants,
                wind_hangyoung, wind_namdong, wind_seobu
            )
            FROM SERVER pv_data_server
            INTO public;
        RAISE NOTICE 'pv_data 외래 테이블 7개 매핑 완료';
    ELSE
        RAISE NOTICE 'pv_data 외래 테이블 이미 존재';
    END IF;
END $$;
