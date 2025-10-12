# Supabase 설정 가이드

## 1단계: Supabase 프로젝트 생성

1. https://supabase.com 접속
2. GitHub 계정으로 가입/로그인
3. "New Project" 클릭
4. 프로젝트 정보 입력:
   - Name: `seoulier-parttimer`
   - Database Password: (강력한 비밀번호 생성 - 저장해두세요!)
   - Region: Northeast Asia (Seoul)
5. "Create new project" 클릭 (약 2분 소요)

## 2단계: 데이터베이스 테이블 생성

1. 프로젝트 대시보드 > SQL Editor 클릭
2. 다음 SQL 실행:

```sql
-- Users 테이블 (PIN 로그인 시스템)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  hire_date TEXT,
  hourly_wage INTEGER DEFAULT 10000,
  memo TEXT
);

-- Shifts 테이블
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  work_hours REAL,
  status TEXT DEFAULT 'pending',
  is_modified INTEGER DEFAULT 0
);

-- Cleaning Tasks 테이블
CREATE TABLE cleaning_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  order_num INTEGER,
  is_active INTEGER DEFAULT 1
);

-- Daily Cleanings 테이블
CREATE TABLE daily_cleanings (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES cleaning_tasks(id),
  date TEXT NOT NULL,
  checked_by INTEGER REFERENCES users(id),
  checked_at TEXT,
  check_level INTEGER DEFAULT 1
);

-- Weekly Cleanings 테이블
CREATE TABLE weekly_cleanings (
  id SERIAL PRIMARY KEY,
  task_name TEXT NOT NULL,
  week_start TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  checked_by INTEGER REFERENCES users(id),
  checked_at TEXT
);

-- Monthly Cleanings 테이블
CREATE TABLE monthly_cleanings (
  id SERIAL PRIMARY KEY,
  task_name TEXT NOT NULL,
  month TEXT NOT NULL,
  checked INTEGER DEFAULT 0,
  checked_by INTEGER REFERENCES users(id),
  checked_at TEXT
);

-- 성능 최적화를 위한 인덱스 생성
CREATE INDEX idx_users_pin ON users(pin);
CREATE INDEX idx_shifts_user_date ON shifts(user_id, date);
CREATE INDEX idx_shifts_date ON shifts(date);
CREATE INDEX idx_daily_cleanings_date ON daily_cleanings(date);
CREATE INDEX idx_daily_cleanings_task_date ON daily_cleanings(task_id, date);
CREATE INDEX idx_weekly_cleanings_week ON weekly_cleanings(week_start);
CREATE INDEX idx_monthly_cleanings_month ON monthly_cleanings(month);
CREATE INDEX idx_cleaning_tasks_active ON cleaning_tasks(is_active);

-- 직급(position) 컬럼 추가 (기존 테이블에 추가하는 경우)
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT DEFAULT '직원';

-- 근무지(workplace) 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS workplace TEXT DEFAULT '서울역 홀';

-- 초기 사용자 데이터 삽입 (PIN 포함)
INSERT INTO users (username, password, name, role, pin, hourly_wage) VALUES
  ('admin', 'admin', '관리자', 'admin', '9999', 10000),
  ('cleaning', 'cleaning', '청소담당', 'cleaning', '0000', 10000),
  ('st01', 'st01', '이수진', 'staff', '0003', 10000),
  ('st02', 'st02', '배경현', 'staff', '0004', 10000),
  ('st03', 'st03', '채윤아', 'staff', '0005', 10000),
  ('st04', 'st04', '황성윤', 'staff', '0006', 10000),
  ('st05', 'st05', '임수민', 'staff', '0007', 10000),
  ('st06', 'st06', '김태오', 'staff', '0008', 10000),
  ('st08', 'st08', '김채원', 'staff', '0009', 10000),
  ('st09', 'st09', '김태현', 'staff', '1001', 10000),
  ('st10', 'st10', '김용재', 'staff', '1002', 10000),
  ('st11', 'st11', '고도희', 'staff', '1003', 10000),
  ('st12', 'st12', '드니', 'staff', '1004', 10000),
  ('st13', 'st13', '심승욱', 'staff', '1005', 10000),
  ('st14', 'st14', '권희재', 'staff', '1006', 10000),
  ('st15', 'st15', '최민규', 'staff', '1007', 10000),
  ('st16', 'st16', '박주형', 'staff', '1008', 10000),
  ('st17', 'st17', '강다슬', 'staff', '0001', 10000),
  ('st18', 'st18', '하새별', 'staff', '0002', 10000);

-- 초기 청소 태스크 데이터
INSERT INTO cleaning_tasks (title, category, order_num, is_active) VALUES
  ('홀/룸 바닥 쓸기/닦기', '홀', 1, 1),
  ('카트(3개)클리닝', '홀', 2, 1),
  ('국통 부속품 세척', '티카', 3, 1),
  ('아이스스쿱 세척', '티카', 4, 1),
  ('대걸레', '행주/대걸레', 5, 1),
  ('음식물 쓰레기 배출', '티카', 5, 1),
  ('적색린넨', '행주/대걸레', 6, 1),
  ('유리폐기물 배출', '티카', 6, 1),
  ('백색린넨', '행주/대걸레', 7, 1),
  ('행주', '행주/대걸레', 8, 1),
  ('커피머신 부속품 세척', '티카', 9, 1),
  ('정수기 부속품 세척', '티카', 10, 1);
```

## 3단계: 연결 정보 확인

1. 프로젝트 대시보드 > Settings > Database
2. Connection string 복사 (URI 형식)
3. 또는 개별 정보 확인:
   - Host
   - Database name
   - Port
   - User
   - Password

## 4단계: Vercel 환경 변수 설정

Vercel 프로젝트 > Settings > Environment Variables에 추가:

```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres
```

## 완료!

이제 데이터가 영구적으로 저장됩니다.
