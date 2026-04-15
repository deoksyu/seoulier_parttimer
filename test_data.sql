-- ============================================================================
-- 테스트 데이터 생성 스크립트
-- supabase_schema.sql 실행 후 사용
-- ============================================================================

-- 1. 테스트 매장 생성
INSERT INTO stores (slug, name, plan, status) VALUES
  ('test-store', '테스트 매장', 'FREE', 'ACTIVE'),
  ('seoul-station', '서울역점', 'PRO', 'ACTIVE'),
  ('gangnam', '강남점', 'TRIAL', 'ACTIVE');

-- 2. 슈퍼 관리자는 Supabase Dashboard에서 수동 추가
-- (Authentication → Users에서 사용자 생성 후 UUID 복사)
-- 그 다음 아래 쿼리 실행:
-- INSERT INTO super_admins (user_id) VALUES ('복사한-uuid');

-- 3. 테스트 직원 생성 (PIN: 1234, 해시값)
-- bcrypt 해시: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy (1234)
INSERT INTO staff (store_id, name, pin_hash, position, active) VALUES
  ((SELECT id FROM stores WHERE slug = 'test-store'), '홍길동', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '직원', true),
  ((SELECT id FROM stores WHERE slug = 'test-store'), '김철수', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '매니저', true),
  ((SELECT id FROM stores WHERE slug = 'seoul-station'), '이영희', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '직원', true);

-- 완료
SELECT 'Test data created successfully!' as message;
