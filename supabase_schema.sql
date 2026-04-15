-- ============================================================================
-- Worklog - 멀티테넌트 근태 관리 시스템
-- Supabase 데이터베이스 스키마
-- 작성일: 2026-02-02
-- 기준: multi_prd.md v2.2
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

-- UUID 생성을 위한 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. CORE TABLES (멀티테넌트 기반)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 stores (매장)
-- ----------------------------------------------------------------------------
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'TRIAL', 'PRO')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_status ON stores(status);

-- 코멘트
COMMENT ON TABLE stores IS '매장 정보 (멀티테넌트 기본 단위)';
COMMENT ON COLUMN stores.slug IS '매장 고유 URL 식별자 (예: seoul-station)';
COMMENT ON COLUMN stores.plan IS '요금제: FREE(무료), TRIAL(체험), PRO(프로)';
COMMENT ON COLUMN stores.status IS '상태: ACTIVE(활성), SUSPENDED(정지)';

-- ----------------------------------------------------------------------------
-- 2.2 super_admins (슈퍼 관리자)
-- ----------------------------------------------------------------------------
CREATE TABLE super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE super_admins IS '슈퍼 관리자 allowlist (Supabase Auth UID)';

-- ----------------------------------------------------------------------------
-- 2.3 store_admins (매장 관리자)
-- ----------------------------------------------------------------------------
CREATE TABLE store_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);

-- 인덱스
CREATE INDEX idx_store_admins_store_id ON store_admins(store_id);
CREATE INDEX idx_store_admins_user_id ON store_admins(user_id);

COMMENT ON TABLE store_admins IS '매장 관리자 (Supabase Auth 기반)';
COMMENT ON COLUMN store_admins.role IS '역할: admin(관리자), manager(매니저)';

-- ----------------------------------------------------------------------------
-- 2.4 staff (직원)
-- ----------------------------------------------------------------------------
CREATE TABLE staff (
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

-- 인덱스
CREATE INDEX idx_staff_store_id ON staff(store_id);
CREATE INDEX idx_staff_auth_user_id ON staff(auth_user_id);
CREATE INDEX idx_staff_active ON staff(store_id, active);
CREATE UNIQUE INDEX idx_staff_pin_hash ON staff(store_id, pin_hash) WHERE active = true;

COMMENT ON TABLE staff IS '직원 정보 (매장별 격리)';
COMMENT ON COLUMN staff.auth_user_id IS 'PIN 로그인 시 생성되는 Supabase Auth User ID';
COMMENT ON COLUMN staff.pin_hash IS 'PIN 해시 (bcrypt)';
COMMENT ON COLUMN staff.pin_failed_count IS 'PIN 로그인 실패 횟수';
COMMENT ON COLUMN staff.pin_locked_until IS 'PIN 잠금 해제 시간 (5회 실패 시 10분)';

-- ============================================================================
-- 3. WORK RECORDS (근무 기록)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 shifts (출퇴근 기록)
-- ----------------------------------------------------------------------------
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

-- 인덱스
CREATE INDEX idx_shifts_store_id ON shifts(store_id);
CREATE INDEX idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_shifts_status ON shifts(status);
CREATE INDEX idx_shifts_store_date ON shifts(store_id, date);
CREATE INDEX idx_shifts_staff_date ON shifts(staff_id, date);

COMMENT ON TABLE shifts IS '출퇴근 기록 (매장별 격리)';
COMMENT ON COLUMN shifts.work_hours IS '근무시간 (10:00 보정, 15:00-17:00 휴게시간 제외)';
COMMENT ON COLUMN shifts.is_late IS '지각 여부';
COMMENT ON COLUMN shifts.late_exempt IS '지각 면제 여부';

-- ----------------------------------------------------------------------------
-- 3.2 monthly_staff_summary (월별 집계 - 무료 플랜 최적화)
-- ----------------------------------------------------------------------------
CREATE TABLE monthly_staff_summary (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- 'YYYY-MM' 형식
  total_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_days INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  approved_hours DECIMAL(10, 2) NOT NULL DEFAULT 0,
  approved_days INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(store_id, staff_id, year_month)
);

-- 인덱스
CREATE INDEX idx_monthly_summary_store_id ON monthly_staff_summary(store_id);
CREATE INDEX idx_monthly_summary_staff_id ON monthly_staff_summary(staff_id);
CREATE INDEX idx_monthly_summary_year_month ON monthly_staff_summary(year_month);

COMMENT ON TABLE monthly_staff_summary IS '월별 근무 집계 (대시보드 최적화용)';
COMMENT ON COLUMN monthly_staff_summary.year_month IS '년월 (예: 2026-02)';

-- ============================================================================
-- 4. CLEANING TASKS (청소 체크리스트)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 cleaning_tasks (청소 작업 목록)
-- ----------------------------------------------------------------------------
CREATE TABLE cleaning_tasks (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  order_num INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_cleaning_tasks_store_id ON cleaning_tasks(store_id);
CREATE INDEX idx_cleaning_tasks_active ON cleaning_tasks(store_id, is_active);
CREATE INDEX idx_cleaning_tasks_order ON cleaning_tasks(store_id, order_num);

COMMENT ON TABLE cleaning_tasks IS '청소 작업 목록 (매장별)';

-- ----------------------------------------------------------------------------
-- 4.2 daily_cleanings (일일 청소 체크)
-- ----------------------------------------------------------------------------
CREATE TABLE daily_cleanings (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  checked_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_level INTEGER NOT NULL DEFAULT 1 CHECK (check_level IN (1, 2)),
  UNIQUE(store_id, task_id, date)
);

-- 인덱스
CREATE INDEX idx_daily_cleanings_store_id ON daily_cleanings(store_id);
CREATE INDEX idx_daily_cleanings_date ON daily_cleanings(date);
CREATE INDEX idx_daily_cleanings_store_date ON daily_cleanings(store_id, date);

COMMENT ON TABLE daily_cleanings IS '일일 청소 체크 기록';
COMMENT ON COLUMN daily_cleanings.check_level IS '체크 레벨: 1(초록), 2(빨강)';

-- ----------------------------------------------------------------------------
-- 4.3 weekly_cleanings (주간 청소)
-- ----------------------------------------------------------------------------
CREATE TABLE weekly_cleanings (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  week_start DATE NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_weekly_cleanings_store_id ON weekly_cleanings(store_id);
CREATE INDEX idx_weekly_cleanings_week ON weekly_cleanings(store_id, week_start);

-- ----------------------------------------------------------------------------
-- 4.4 monthly_cleanings (월간 청소)
-- ----------------------------------------------------------------------------
CREATE TABLE monthly_cleanings (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  month TEXT NOT NULL, -- 'YYYY-MM'
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monthly_cleanings_store_id ON monthly_cleanings(store_id);
CREATE INDEX idx_monthly_cleanings_month ON monthly_cleanings(store_id, month);

-- ============================================================================
-- 5. AUDIT & LOGS (감사 로그)
-- ============================================================================

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_store_id ON audit_logs(store_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

COMMENT ON TABLE audit_logs IS '감사 로그 (모든 중요 작업 기록)';

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) 정책
-- ============================================================================

-- RLS 활성화
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_staff_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_cleanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_cleanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_cleanings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6.1 슈퍼 관리자 정책
-- ----------------------------------------------------------------------------

-- 슈퍼 관리자는 모든 데이터 접근 가능
CREATE POLICY "Super admins have full access"
ON stores FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Super admins can manage super_admins"
ON super_admins FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 6.2 매장 관리자 정책
-- ----------------------------------------------------------------------------

-- 매장 관리자는 자신의 매장 데이터만 접근
CREATE POLICY "Store admins can access their store"
ON stores FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Store admins can manage store_admins"
ON store_admins FOR ALL
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 6.3 직원 정책
-- ----------------------------------------------------------------------------

-- 직원은 자신의 매장 데이터만 접근
CREATE POLICY "Staff can access their store's staff list"
ON staff FOR SELECT
TO authenticated
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- 직원은 자신의 정보만 수정 가능
CREATE POLICY "Staff can update their own info"
ON staff FOR UPDATE
TO authenticated
USING (
  id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')::integer
);

-- 관리자는 자신의 매장 직원 관리 가능
CREATE POLICY "Admins can manage their store's staff"
ON staff FOR ALL
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 6.4 출퇴근 기록 정책
-- ----------------------------------------------------------------------------

-- 직원은 자신의 출퇴근 기록만 조회
CREATE POLICY "Staff can view their own shifts"
ON shifts FOR SELECT
TO authenticated
USING (
  staff_id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')::integer
  AND store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- 직원은 자신의 출퇴근 기록 생성 가능 (Edge Function에서 처리)
CREATE POLICY "Staff can create their own shifts"
ON shifts FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')::integer
  AND store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- 관리자는 자신의 매장 모든 출퇴근 기록 관리
CREATE POLICY "Admins can manage their store's shifts"
ON shifts FOR ALL
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 6.5 집계 테이블 정책
-- ----------------------------------------------------------------------------

-- 직원은 자신의 집계 데이터만 조회
CREATE POLICY "Staff can view their own summary"
ON monthly_staff_summary FOR SELECT
TO authenticated
USING (
  staff_id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')::integer
  AND store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- 관리자는 자신의 매장 모든 집계 데이터 조회
CREATE POLICY "Admins can view their store's summary"
ON monthly_staff_summary FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

-- Edge Function에서만 집계 데이터 수정 가능 (서비스 롤 키 사용)
CREATE POLICY "Service role can manage summary"
ON monthly_staff_summary FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6.6 청소 체크리스트 정책
-- ----------------------------------------------------------------------------

-- 직원은 자신의 매장 청소 작업 조회
CREATE POLICY "Staff can view their store's cleaning tasks"
ON cleaning_tasks FOR SELECT
TO authenticated
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- 관리자는 자신의 매장 청소 작업 관리
CREATE POLICY "Admins can manage their store's cleaning tasks"
ON cleaning_tasks FOR ALL
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

-- 직원은 자신의 매장 일일 청소 체크 가능
CREATE POLICY "Staff can check their store's daily cleanings"
ON daily_cleanings FOR ALL
TO authenticated
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- 주간/월간 청소도 동일
CREATE POLICY "Staff can manage their store's weekly cleanings"
ON weekly_cleanings FOR ALL
TO authenticated
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

CREATE POLICY "Staff can manage their store's monthly cleanings"
ON monthly_cleanings FOR ALL
TO authenticated
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

-- ----------------------------------------------------------------------------
-- 6.7 감사 로그 정책
-- ----------------------------------------------------------------------------

-- 슈퍼 관리자만 모든 로그 조회
CREATE POLICY "Super admins can view all logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = auth.uid()
  )
);

-- 관리자는 자신의 매장 로그만 조회
CREATE POLICY "Admins can view their store's logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  store_id IN (
    SELECT store_id FROM store_admins
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 7.1 updated_at 자동 업데이트
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cleaning_tasks_updated_at BEFORE UPDATE ON cleaning_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. INITIAL DATA (초기 데이터)
-- ============================================================================

-- 슈퍼 관리자는 Supabase Dashboard에서 수동으로 추가
-- (auth.users 테이블에 사용자 생성 후 super_admins 테이블에 user_id 추가)

-- ============================================================================
-- 완료
-- ============================================================================

-- 스키마 버전 정보
COMMENT ON SCHEMA public IS 'Worklog v2.0 - 멀티테넌트 근태 관리 시스템';
