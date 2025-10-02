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
-- Users 테이블
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL
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

-- 초기 사용자 데이터 삽입
INSERT INTO users (username, password, name, role) VALUES
  ('admin', 'admin', '관리자', 'admin'),
  ('st01', 'st01', '이수진', 'staff'),
  ('st02', 'st02', '배경현', 'staff'),
  ('st03', 'st03', '채윤아', 'staff'),
  ('st04', 'st04', '황성윤', 'staff'),
  ('st05', 'st05', '임수민', 'staff'),
  ('st06', 'st06', '김태오', 'staff'),
  ('st07', 'st07', '웅', 'staff'),
  ('st08', 'st08', '김채원', 'staff');
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
