# Supabase 설정 가이드

## 1. Supabase 프로젝트 생성

### 1.1 계정 생성 및 로그인
1. https://supabase.com 접속
2. GitHub 계정으로 로그인
3. "New Project" 클릭

### 1.2 프로젝트 설정
```
Name: worklog
Database Password: (강력한 비밀번호 생성 - 저장 필수!)
Region: Northeast Asia (Seoul)
```

### 1.3 프로젝트 생성 대기 (약 2분)

---

## 2. 데이터베이스 스키마 적용

### 2.1 SQL Editor 접속
1. 좌측 메뉴 → SQL Editor
2. "New query" 클릭

### 2.2 스키마 실행
`supabase_schema.sql` 파일의 내용을 복사하여 붙여넣기 후 "Run" 클릭

### 2.3 확인
- Table Editor에서 테이블 생성 확인
- stores, staff, shifts 등 8개 테이블 확인

---

## 3. 환경 변수 수집

### 3.1 Project Settings → API
다음 정보 복사:

```bash
# Project URL
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co

# anon public (공개 키)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# service_role (서버 전용, 절대 노출 금지)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## 4. 슈퍼 관리자 계정 생성

### 4.1 Authentication → Users
1. "Add user" → "Create new user" 클릭
2. 이메일/비밀번호 입력
3. "Create user" 클릭
4. 생성된 user의 UUID 복사

### 4.2 SQL Editor에서 슈퍼 관리자 등록
```sql
INSERT INTO super_admins (user_id)
VALUES ('복사한-uuid');
```

---

## 5. RLS 정책 확인

### 5.1 Table Editor → 각 테이블 → Policies 탭
- 모든 테이블에 RLS 정책이 적용되었는지 확인
- stores, staff, shifts 등

---

## 6. Edge Functions 설정 (나중에)

### 6.1 Supabase CLI 설치
```bash
npm install -g supabase
```

### 6.2 로그인
```bash
supabase login
```

### 6.3 프로젝트 연결
```bash
supabase link --project-ref <project-ref>
```

---

완료
