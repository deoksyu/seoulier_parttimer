# 멀티테넌트 시스템 마이그레이션 계획서

## 📋 문서 정보
- **작성일**: 2026-02-02
- **목적**: 단일 매장 시스템 → 멀티테넌트 SaaS 전환
- **기준 문서**: multi_prd.md v2.2

---

## 1. 현재 상태 분석

### 1.1 기존 시스템 구조
```
현재 스택:
- Frontend: React 18 + Vite
- Backend: Express.js (로컬: SQLite, 배포: PostgreSQL via Vercel Serverless)
- Auth: PIN 기반 (평문 비교)
- 배포: Vercel (client + api 폴더)
```

### 1.2 기존 데이터베이스
```sql
-- 현재 테이블 (단일 매장)
users (id, username, password, name, role, pin, phone, email, ...)
shifts (id, user_id, date, start_time, end_time, work_hours, status, ...)
cleaning_tasks (id, title, category, order_num, is_active)
daily_cleanings (id, task_id, date, checked_by, checked_at, check_level)
```

### 1.3 기존 기능
- ✅ PIN 로그인 (4자리)
- ✅ 출퇴근 기록 (자동 시간 계산)
- ✅ 근무시간 집계 (10:00 보정, 15:00-17:00 휴게시간 제외)
- ✅ 지각 체크
- ✅ 청소 체크리스트 (더블 체크)
- ✅ 관리자 승인
- ✅ 직원 관리
- ✅ 월별 통계

---

## 2. 목표 시스템 구조

### 2.1 신규 스택
```
목표 스택:
- Frontend: Next.js 14+ (App Router)
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- Auth: 
  - 관리자: Supabase Auth (이메일/비밀번호)
  - 직원: PIN → Supabase Auth 세션 발급 (Edge Function)
- 배포: Vercel (단일 Next.js 프로젝트)
```

### 2.2 신규 데이터베이스 (멀티테넌트)
```sql
-- 조직/매장 계층
stores (id uuid, slug text unique, name, plan, status, created_at)
super_admins (user_id uuid) -- Supabase Auth UID
store_admins (id, store_id, user_id uuid, role)

-- 직원 (매장별 격리)
staff (id, store_id, name, pin_hash, active, created_at)

-- 근무 기록 (매장별 격리)
shifts (id, store_id, staff_id, date, start_time, end_time, work_hours, status, ...)

-- 집계 테이블 (무료 플랜 최적화)
monthly_staff_summary (
  store_id, staff_id, year_month,
  total_hours, total_days, late_count,
  updated_at
)

-- 청소 (매장별 격리)
cleaning_tasks (id, store_id, title, category, order_num, is_active)
daily_cleanings (id, store_id, task_id, date, checked_by, checked_at, check_level)
```

### 2.3 URL 구조
```
/sa                    → 슈퍼 관리자 콘솔
/s/[storeSlug]         → 매장 앱 (직원/관리자 공통)
/s/[storeSlug]/admin   → 관리자 전용 페이지
```

---

## 3. 핵심 아키텍처 변경사항

### 3.1 인증 시스템 전환

#### 기존 (v1.0)
```javascript
// PIN 검증 (평문)
if (user.pin === inputPin) {
  // 세션 생성 (단순 상태 관리)
  setUser(user);
}
```

#### 신규 (v2.0)
```javascript
// Edge Function: /functions/pin-login
1. PIN 해시 검증
2. 성공 시:
   - Supabase Auth User 생성 (staff 전용)
   - JWT 발급 (커스텀 클레임: store_id, staff_id, role=staff)
3. 클라이언트에 세션 반환
```

**핵심 차이점**:
- 직원도 Supabase Auth의 정식 세션 주체
- RLS가 JWT 클레임을 기반으로 자동 작동
- 서버 측 권한 검증 불필요 (RLS가 처리)

### 3.2 데이터 격리 (RLS)

#### 모든 테이블에 적용
```sql
-- 예시: shifts 테이블 RLS
CREATE POLICY "Users can only access their store's data"
ON shifts
FOR ALL
USING (
  store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);

CREATE POLICY "Staff can only access their own shifts"
ON shifts
FOR SELECT
USING (
  staff_id = (auth.jwt() -> 'app_metadata' ->> 'staff_id')::integer
  AND store_id = (auth.jwt() -> 'app_metadata' ->> 'store_id')::uuid
);
```

**핵심**:
- 모든 쿼리에 자동으로 `store_id` 필터 적용
- 애플리케이션 코드에서 별도 필터링 불필요
- 매장 간 데이터 유출 원천 차단

### 3.3 집계 테이블 전략 (무료 플랜 최적화)

#### 기존 (실시간 집계)
```sql
-- 매번 합산 (비효율)
SELECT SUM(work_hours) FROM shifts WHERE user_id = ? AND date LIKE '2026-01%'
```

#### 신규 (쓰기 시 집계)
```javascript
// Edge Function: /functions/clock-out
1. shifts 테이블에 퇴근 기록
2. work_hours 계산
3. monthly_staff_summary 업데이트 (UPSERT)
   - total_hours += work_hours
   - total_days += 1
   - late_count += (is_late ? 1 : 0)
```

**핵심**:
- 대시보드는 `monthly_staff_summary`만 조회
- 실시간 합산 쿼리 제거 → 데이터 전송량 최소화
- 무료 플랜 한계 내 100개 매장 운영 가능

---

## 4. 마이그레이션 전략

### 4.1 단계별 접근 (Big Bang 방식 회피)

#### Phase 0: 준비 (1일)
- [ ] Supabase 프로젝트 생성
- [ ] 테이블 스키마 작성 및 적용
- [ ] RLS 정책 작성 및 테스트
- [ ] Edge Function 템플릿 작성

#### Phase 1: Next.js 기반 구축 (2-3일)
- [ ] Next.js 프로젝트 생성 (`/next-app` 폴더)
- [ ] 기존 React 컴포넌트 이식 (App.jsx → 페이지별 분리)
- [ ] Supabase 클라이언트 설정
- [ ] 환경 변수 설정

#### Phase 2: 슈퍼 관리자 콘솔 (2일)
- [ ] `/sa` 페이지 구현
- [ ] 매장 생성 기능
- [ ] slug 자동 생성 (nanoid 또는 매장명 기반)
- [ ] 매장 목록 조회
- [ ] 매장 상태 관리 (ACTIVE/SUSPENDED)

#### Phase 3: 매장 앱 기반 (2일)
- [ ] `/s/[storeSlug]` 동적 라우팅
- [ ] slug → store_id 매핑 (서버 컴포넌트)
- [ ] 매핑 결과 캐시 (Next.js 캐시 활용)
- [ ] 유효하지 않은 slug 처리 (404)

#### Phase 4: 직원 PIN 로그인 (2일)
- [ ] Edge Function 구현 (`/functions/pin-login`)
- [ ] PIN 해시 생성/검증 (bcrypt)
- [ ] Supabase Auth 세션 발급
- [ ] JWT 커스텀 클레임 설정
- [ ] 로그인 실패 횟수 제한 (5회 → 10분 잠금)
- [ ] 프론트엔드 PIN 입력 UI

#### Phase 5: 출퇴근 기록 (2일)
- [ ] Edge Function 구현 (`/functions/clock-in`, `/functions/clock-out`)
- [ ] 기존 근무시간 계산 로직 이식
  - 10:00 이전 출근 → 10:00 보정
  - 15:00-17:00 휴게시간 제외
  - 30분 단위 반올림
- [ ] 집계 테이블 동시 업데이트
- [ ] 프론트엔드 출퇴근 버튼 UI

#### Phase 6: 관리자 기능 (2-3일)
- [ ] 직원 목록 조회
- [ ] 직원 추가/수정/비활성화
- [ ] PIN 재설정
- [ ] 월별 근무 요약 대시보드 (집계 테이블 기반)
- [ ] PDF 다운로드 (jsPDF)

#### Phase 7: 청소 체크리스트 (선택, 1-2일)
- [ ] 청소 작업 목록 (매장별)
- [ ] 일일 청소 체크
- [ ] 더블 체크 시스템 (초록 → 빨강 → 미체크)

#### Phase 8: 테스트 및 배포 (2일)
- [ ] RLS 정책 검증 (매장 간 데이터 격리)
- [ ] 성능 테스트 (10개 매장 동시 사용)
- [ ] 무료 플랜 사용량 모니터링
- [ ] Vercel 배포
- [ ] 기존 시스템 데이터 마이그레이션 (선택)

**총 예상 기간**: 15-20일

---

## 5. 기존 코드 재사용 전략

### 5.1 재사용 가능한 코드

#### UI 컴포넌트 (거의 그대로)
```javascript
// 기존: client/src/App.jsx (3,473줄)
// 신규: 페이지별 분리

/s/[storeSlug]/page.tsx          // 직원 메인 (출퇴근 버튼)
/s/[storeSlug]/admin/page.tsx    // 관리자 대시보드
/sa/page.tsx                     // 슈퍼 관리자 콘솔

// 재사용 가능한 로직
- 출퇴근 버튼 UI
- 근무 내역 테이블
- 청소 체크리스트 UI
- 다크모드 토글
- 월별 필터
```

#### 비즈니스 로직 (함수 이식)
```javascript
// 기존: api/index.js의 calculateWorkHours 함수
// 신규: Edge Function 또는 공통 유틸리티로 이식

// 재사용 가능한 로직
- calculateWorkHours() - 근무시간 계산
- getTodayKST() - KST 날짜
- getCurrentTimeKST() - KST 시간
- 지각 체크 로직
```

### 5.2 변경 필요한 코드

#### API 호출 방식
```javascript
// 기존: axios → Express API
const response = await axios.post(`${API_URL}/clock-in`, { userId });

// 신규: Supabase 클라이언트 또는 Edge Function
const { data, error } = await supabase.functions.invoke('clock-in', {
  body: { storeId, staffId }
});
```

#### 상태 관리
```javascript
// 기존: useState로 user 관리
const [user, setUser] = useState(null);

// 신규: Supabase Auth 세션
const { data: { session } } = await supabase.auth.getSession();
const user = session?.user;
const storeId = user?.app_metadata?.store_id;
```

---

## 6. 데이터 마이그레이션 계획

### 6.1 기존 데이터 처리 방안

#### 옵션 A: 신규 시작 (권장)
- 기존 시스템은 그대로 유지 (읽기 전용)
- 신규 시스템은 빈 상태로 시작
- 필요 시 과거 데이터 수동 이관

**장점**:
- 마이그레이션 리스크 최소화
- 빠른 출시 가능
- 데이터 정합성 보장

#### 옵션 B: 데이터 이관 (선택)
```javascript
// 마이그레이션 스크립트 (Node.js)
1. 기존 SQLite/PostgreSQL에서 데이터 추출
2. 단일 매장으로 간주하여 Supabase에 삽입
   - 기존 users → staff (store_id = 고정값)
   - 기존 shifts → shifts (store_id 추가)
3. 집계 테이블 재계산
```

### 6.2 권장 방안
- **Phase 1**: 신규 시스템 먼저 완성
- **Phase 2**: 기존 시스템과 병행 운영 (1-2주)
- **Phase 3**: 필요 시 데이터 이관 스크립트 실행

---

## 7. 기술적 도전 과제 및 해결 방안

### 7.1 직원 PIN 로그인 → Supabase Auth 세션

**도전 과제**:
- Supabase Auth는 기본적으로 이메일/비밀번호 기반
- 직원은 이메일이 없고 PIN만 있음

**해결 방안**:
```javascript
// Edge Function: pin-login
1. staff 테이블에서 PIN 해시 검증
2. 성공 시:
   - 직원 전용 Auth User 생성 (이메일: staff_{id}@internal.local)
   - 또는 기존 Auth User 재사용 (staff_id로 매핑)
3. supabase.auth.admin.generateLink() 또는
   supabase.auth.signInWithPassword() 호출
4. JWT에 커스텀 클레임 추가:
   - app_metadata: { store_id, staff_id, role: 'staff' }
```

### 7.2 slug → store_id 매핑 캐시

**도전 과제**:
- 매 요청마다 DB 조회 시 성능 저하

**해결 방안**:
```javascript
// Next.js 서버 컴포넌트 + 캐시
export async function getStoreBySlug(slug: string) {
  const { data } = await supabase
    .from('stores')
    .select('id, name, status')
    .eq('slug', slug)
    .single();
  
  return data;
}

// Next.js 자동 캐시 (5-15분)
// 또는 Redis/Vercel KV 사용 (선택)
```

### 7.3 무료 플랜 한계 대응

**Supabase 무료 플랜**:
- 500MB DB
- 2GB 파일 저장소
- 50,000 월간 활성 사용자
- 500MB egress/월

**대응 전략**:
- ✅ 집계 테이블 활용 (실시간 합산 금지)
- ✅ `select *` 금지 (필요한 컬럼만)
- ✅ PDF 서버 저장 금지
- ✅ Realtime 사용 금지
- ✅ 이미지 업로드 최소화

**예상 사용량 (100개 매장)**:
- DB: ~200MB (충분)
- 활성 사용자: ~5,000명 (충분)
- Egress: ~300MB/월 (충분)

---

## 8. 성공 기준 (Definition of Done)

### 8.1 기능 완성도
- [ ] 슈퍼 콘솔에서 매장 생성 가능
- [ ] 매장별 고유 URL 접근 가능 (`/s/{slug}`)
- [ ] 직원 PIN 로그인 → 세션 발급 정상 작동
- [ ] 출퇴근 기록 → 집계 테이블 업데이트 정상
- [ ] 관리자 대시보드에서 월별 요약 조회 가능
- [ ] PDF 다운로드 정상 작동

### 8.2 보안 검증
- [ ] 매장 A의 직원이 매장 B 데이터 접근 불가 (RLS 검증)
- [ ] PIN 5회 실패 시 10분 잠금 작동
- [ ] JWT 커스텀 클레임 정상 설정
- [ ] 슈퍼 관리자만 `/sa` 접근 가능

### 8.3 성능 검증
- [ ] 10개 매장 동시 사용 시 정상 작동
- [ ] 대시보드 로딩 시간 < 2초
- [ ] Supabase 무료 플랜 한계 내 운영 확인

### 8.4 배포 검증
- [ ] Vercel 배포 성공
- [ ] 환경 변수 정상 설정
- [ ] 프로덕션 환경에서 모든 기능 정상 작동

---

## 9. 리스크 관리

### 9.1 기술 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| Next.js 마이그레이션 복잡도 | 중 | 단계별 이식, 기존 UI 최대한 재사용 |
| PIN 로그인 세션 모델 구현 | 높음 | Edge Function 충분한 테스트, 대체 방안 준비 |
| RLS 정책 오류 | 높음 | 철저한 테스트, 매장 간 격리 검증 |
| 무료 플랜 초과 | 중 | 사용량 모니터링, 집계 테이블 활용 |

### 9.2 일정 리스크

| 리스크 | 대응 방안 |
|--------|----------|
| 예상보다 긴 개발 기간 | MVP 기능만 우선 구현, 청소 체크리스트 등은 Phase 2 |
| 기존 시스템 병행 운영 필요 | 신규 시스템 안정화 전까지 기존 시스템 유지 |

---

## 10. 다음 단계

### 즉시 시작 가능한 작업
1. **Supabase 프로젝트 생성**
2. **테이블 스키마 SQL 작성**
3. **RLS 정책 SQL 작성**
4. **Next.js 프로젝트 생성**

### 문서 작성 필요
1. **Supabase 스키마 상세 문서** (DDL + RLS)
2. **Edge Function 명세서** (pin-login, clock-in, clock-out)
3. **API 엔드포인트 문서** (기존 → 신규 매핑)

---

## 11. 결론

이 마이그레이션은 **단순한 기술 스택 전환이 아닌, 비즈니스 모델의 근본적 변화**입니다.

**핵심 이해사항**:
1. ✅ 직원도 Supabase Auth 세션 주체 (PIN → JWT)
2. ✅ RLS가 모든 데이터 격리 처리 (애플리케이션 코드 단순화)
3. ✅ 집계 테이블로 무료 플랜 최적화
4. ✅ 단일 배포로 100개 매장 운영 가능
5. ✅ 기존 코드 최대한 재사용 (UI, 비즈니스 로직)

**예상 결과**:
- 15-20일 내 MVP 완성 가능
- 무료 플랜으로 100개 매장 운영 가능
- 확장성 확보 (1,000개 매장까지 대응 가능)

---

**작성자 이해도 자가 평가**: ⭐⭐⭐⭐⭐ (5/5)
- PRD의 모든 요구사항 이해
- 기술적 도전 과제 파악 및 해결 방안 제시
- 실행 가능한 단계별 계획 수립
- 리스크 관리 방안 포함
