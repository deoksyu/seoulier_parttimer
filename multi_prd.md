# PRD v2.2  
## 멀티 매장 근태·노무 관리 시스템 (Windsurf 개발 재개용 / 최종본)

---

## 0. 문서 목적

이 문서는 기존 단일 매장용 시스템을  
**멀티 매장 SaaS 구조로 확장**하기 위한 개발 기준 문서다.

목표:
- 동일 프로젝트에서 개발 재개
- Supabase + Vercel **무료 플랜 한계 내**에서 100개 매장 운영
- Windsurf 에이전트가 **추가 설계 없이 바로 구현 가능**

---

## 1. 제품 개요

### 1.1 제품 정의

- 소규모 매장을 위한 근태·노무 운영 시스템
- 직원: 출근/퇴근 기록만 수행
- 매장 관리자: 근무 요약/증빙 관리
- 슈퍼 관리자: 전체 매장 운영 관리

---

### 1.2 기술 스택 (고정, 변경 금지)

- Frontend: Next.js (Vercel 배포, 단일 프로젝트)
- Backend/DB/Auth: Supabase (단일 프로젝트)
- Auth:
  - 관리자/슈퍼관리자: Supabase Auth
  - 직원: PIN 기반 로그인 → Supabase Auth 세션 발급
- PDF: 클라이언트 생성 (서버 저장 금지)

---

## 2. 전체 아키텍처

### 2.1 배포 구조

- Vercel 배포: 1개
- Supabase 프로젝트: 1개
- 매장별 분리 방식:
  - 배포 분리 ❌
  - 데이터 분리 ⭕ (멀티테넌트)

---

### 2.2 URL 구조 (확정)

- 슈퍼 관리자 콘솔  
  `/sa`

- 매장 운영 앱  
  `/s/{storeSlug}`

서브도메인 사용 금지 (무료 플랜 유지 목적)

---

## 3. 사용자 역할

### 3.1 슈퍼 관리자 (Super Admin)
- 시스템 운영자
- 전체 매장 생성/비활성화
- 플랜 상태 관리

### 3.2 매장 관리자 (Store Admin)
- 점장/사장
- 직원 관리
- 근무 요약/출력

### 3.3 직원 (Staff)
- PIN 로그인
- 출근/퇴근 기록
- 개인 근무 현황 확인

---

## 4. 기능 범위 (MVP)

### 4.1 슈퍼 관리자 콘솔 (`/sa`)

#### 기능
- 매장 생성
- storeSlug 자동 생성
- 매장 관리자 초대 링크 생성
- 매장 상태 관리
  - ACTIVE / SUSPENDED
- 매장 플랜 설정
  - FREE / TRIAL / PRO
- 매장 목록 조회

#### 접근 제어
- Supabase Auth user 중 allowlist 기반 접근
- `super_admins` 테이블에 user_id 등록된 계정만 접근 허용

---

### 4.2 매장 운영 앱 (`/s/{storeSlug}`)

#### 공통
- storeSlug → store_id 서버 매핑
- 유효하지 않은 slug 접근 차단
- slug 매핑 결과는 캐시 (5~15분)

---

#### 4.2.1 직원 기능

- PIN 로그인
- 출근 기록
- 퇴근 기록
- 오늘 근무 상태
- 이번 달 근무 요약
- 개인 근무 내역 (페이징)

---

#### 4.2.2 관리자 기능

- 직원 목록 관리
- 직원 PIN 재설정
- 직원 활성/비활성
- 월별 근무 요약 (집계 테이블 기반)
- PDF 다운로드 (브라우저 생성)

---

## 5. 데이터베이스 설계

### 5.1 필수 테이블

#### stores
- id (uuid, pk)
- slug (unique)
- name
- plan (FREE/TRIAL/PRO)
- status (ACTIVE/SUSPENDED)
- created_at

---

#### super_admins
- user_id (supabase auth uid)

---

#### store_admins
- id
- store_id
- user_id (auth uid)
- role

---

#### staff
- id
- store_id
- name
- pin_hash
- active

---

중복되거나 불필요한 컬럼 혹은 데이터 사용하지 않을 것

## 6. 인증 & 보안 (절대 변경 금지)

### 6.1 직원 PIN 로그인 세션 모델

- 직원도 Supabase Auth의 세션 주체가 된다
- PIN 로그인 흐름:
  1. 클라이언트 → Edge Function 호출
  2. PIN 검증 (해시 비교)
  3. 성공 시:
     - 해당 직원 전용 Auth User로 세션 발급
     - JWT에 커스텀 클레임 포함:
       - store_id
       - staff_id
       - role=staff

---

### 6.2 JWT 클레임 규칙

- 관리자:
  - role=admin
  - store_id 포함
- 직원:
  - role=staff
  - store_id, staff_id 포함

---

### 6.3 Row Level Security (RLS)

- 모든 핵심 테이블에 store_id 기준 RLS 적용
- 직원:
  - 자신의 staff_id + store_id 데이터만 접근
- 관리자:
  - 자신의 store_id 데이터만 접근
- 서비스 롤 키는 Edge Function에서만 사용

---

### 6.4 PIN 정책

- PIN 평문 저장 금지 (해시만 저장)
- PIN 로그인은 Edge Function 단일 엔드포인트
- 실패 횟수 DB 기록
- 5회 실패 시 10분 잠금
- 점진적 지연(backoff) 적용

---

## 7. 무료 플랜 유지 전략 (필수)

### 7.1 데이터 전송 최적화

- 대시보드/요약은 `monthly_staff_summary`만 사용
- 실시간 합산 쿼리 금지
- `select *` 금지 (필요 컬럼만)

---

### 7.2 집계 테이블 업데이트 전략

- 출근/퇴근 기록은 Edge Function을 통해서만 저장
- 해당 함수에서:
  - shifts 저장
  - monthly_staff_summary 동시 업데이트
- “쓰기 시 집계” 방식 고정

---

### 7.3 PDF 처리

- 서버 저장 금지
- 브라우저(jsPDF 등)에서 생성 후 다운로드
- PRO 이상에서만 저장 기능 고려(미구현)

---

### 7.4 실시간 기능

- Supabase Realtime 사용 금지
- 수동 새로고침 기반 UI

---

## 8. 개발 우선순위

### Phase 1 (필수)
- 슈퍼 관리자 콘솔
- 매장 생성 + slug 발급
- `/s/{storeSlug}` 라우팅
- RLS 정책 적용
- 직원 PIN 로그인 세션 모델 구현

---

### Phase 2
- 출근/퇴근 기록
- 집계 테이블 업데이트
- 관리자 요약 대시보드

---

### Phase 3
- PDF 다운로드
- 관리자 UX 개선

---

## 9. 명시적 제외 사항

- 매장별 별도 배포 ❌
- 매장별 Supabase 프로젝트 ❌
- 급여 계산 ❌
- 자동 결제 ❌
- 실시간 알림 ❌

---

## 10. 완료 기준 (Definition of Done)

- 슈퍼 콘솔에서 매장 생성 → 링크 발급 가능
- 매장 간 데이터 완전 분리 검증
- 직원 PIN 로그인 → 세션/RLS 정상 작동
- 10개 이상 매장 동시 사용 가능
- Supabase/Vercel 무료 플랜 유지

---

## 11. Windsurf 에이전트 지시문

- 이 PRD를 최우선 기준으로 삼을 것
- 기존 코드 최대한 재사용
- 무료 플랜 유지가 모든 판단의 우선순위
- 불필요한 추상화/과설계 금지

---
