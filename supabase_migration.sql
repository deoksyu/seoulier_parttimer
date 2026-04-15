-- ============================================================================
-- Worklog v2.0 마이그레이션 스크립트
-- 기존 Supabase 프로젝트에 새 테이블 추가
-- 기존 테이블(users, shifts 등)은 유지
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. 새 테이블 추가 (멀티테넌트용)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 stores (매장) - 신규
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'TRIAL', 'PRO')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);

-- ----------------------------------------------------------------------------
-- 2.2 super_admins (슈퍼 관리자) - 신규
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2.3 store_admins (매장 관리자) - 신규
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_admins_store_id ON store_admins(store_id);
CREATE INDEX IF NOT EXISTS idx_store_admins_user_id ON store_admins(user_id);

-- ----------------------------------------------------------------------------
-- 2.4 staff (직원) - 신규 (기존 users와 별도)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT DEFAULT '직원',
  workplace TEXT,
  hire_date DATE,
  hourly_wage DECIMAL(10, 2),
  regular_start_time TIME,
  health_certificate_expiry DATE,
  memo TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  pin_failed_count INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_store_id ON staff(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id ON staff(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(store_id, active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_pin_hash ON staff(store_id, pin_hash) WHERE active = true;

-- ----------------------------------------------------------------------------
-- 2.5 기존 shifts 테이블에 store_id 추가 (선택적)
-- ----------------------------------------------------------------------------
-- 기존 shifts 테이블이 있다면 store_id 컬럼 추가
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shifts') THEN
    -- store_id 컬럼이 없으면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'shifts' AND column_name = 'store_id') THEN
      ALTER TABLE shifts ADD COLUMN store_id UUID REFERENCES stores(id);
      CREATE INDEX idx_shifts_store_id ON shifts(store_id);
    END IF;
  ELSE
    -- shifts 테이블이 없으면 새로 생성
    CREATE TABLE shifts (
      id SERIAL PRIMARY KEY,
      store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME,
      work_hours DECIMAL(5, 2),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      is_modified BOOLEAN NOT NULL DEFAULT false,
      is_late BOOLEAN NOT NULL DEFAULT false,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      late_exempt BOOLEAN NOT NULL DEFAULT false,
      late_note TEXT,
      approved_by INTEGER REFERENCES staff(id),
      approved_at TIMESTAMPTZ,
      memo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX idx_shifts_store_id ON shifts(store_id);
    CREATE INDEX idx_shifts_staff_id ON shifts(staff_id);
    CREATE INDEX idx_shifts_date ON shifts(date);
    CREATE INDEX idx_shifts_status ON shifts(status);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2.6 monthly_staff_summary (월별 집계) - 신규
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_staff_summary (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  total_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  approved_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  approved_days INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, staff_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_store_id ON monthly_staff_summary(store_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_staff_id ON monthly_staff_summary(staff_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_year_month ON monthly_staff_summary(year_month);


-- ============================================================================
-- 3. RLS 정책 적용
-- ============================================================================

-- RLS 활성화
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_staff_summary ENABLE ROW LEVEL SECURITY;

-- 슈퍼 관리자 정책
DROP POLICY IF EXISTS "Super admins have full access to stores" ON stores;
CREATE POLICY "Super admins have full access to stores"
ON stores FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage super_admins" ON super_admins;
CREATE POLICY "Super admins can manage super_admins"
ON super_admins FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
);

-- 매장 관리자 정책
DROP POLICY IF EXISTS "Store admins can access their store" ON stores;
CREATE POLICY "Store admins can access their store"
ON stores FOR SELECT TO authenticated
USING (
  id IN (SELECT store_id FROM store_admins WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Store admins can manage store_admins" ON store_admins;
CREATE POLICY "Store admins can manage store_admins"
ON store_admins FOR ALL TO authenticated
USING (
  store_id IN (SELECT store_id FROM store_admins WHERE user_id = auth.uid())
);

-- 직원 정책
DROP POLICY IF EXISTS "Staff can view their store's staff list" ON staff;
CREATE POLICY "Staff can view their store's staff list"
ON staff FOR SELECT TO authenticated
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

DROP POLICY IF EXISTS "Admins can manage their store's staff" ON staff;
CREATE POLICY "Admins can manage their store's staff"
ON staff FOR ALL TO authenticated
USING (
  store_id IN (SELECT store_id FROM store_admins WHERE user_id = auth.uid())
);

-- 집계 테이블 정책
DROP POLICY IF EXISTS "Staff can view their own summary" ON monthly_staff_summary;
CREATE POLICY "Staff can view their own summary"
ON monthly_staff_summary FOR SELECT TO authenticated
USING (
  staff_id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')::integer
  AND store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

DROP POLICY IF EXISTS "Admins can view their store's summary" ON monthly_staff_summary;
CREATE POLICY "Admins can view their store's summary"
ON monthly_staff_summary FOR SELECT TO authenticated
USING (
  store_id IN (SELECT store_id FROM store_admins WHERE user_id = auth.uid())
);

-- 서비스 롤은 모든 테이블 접근 가능 (Edge Functions용)
DROP POLICY IF EXISTS "Service role can manage all" ON monthly_staff_summary;
CREATE POLICY "Service role can manage all"
ON monthly_staff_summary FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- 4. 트리거 (updated_at 자동 업데이트)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 없으면 생성
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stores_updated_at') THEN
    CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_staff_updated_at') THEN
    CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 완료
-- ============================================================================

SELECT 'Migration completed successfully! New tables added.' as message;
