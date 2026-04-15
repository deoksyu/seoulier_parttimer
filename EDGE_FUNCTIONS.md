# Edge Functions 명세서

## 📋 문서 정보
- **작성일**: 2026-02-02
- **목적**: Supabase Edge Functions 구현 가이드
- **언어**: TypeScript (Deno)

---

## 1. 개요

### 1.1 Edge Functions 역할
- **PIN 로그인**: 직원 PIN 검증 → Supabase Auth 세션 발급
- **출퇴근 기록**: 출근/퇴근 시 shifts + monthly_staff_summary 동시 업데이트
- **데이터 격리**: 서비스 롤 키로 RLS 우회하여 집계 테이블 업데이트

### 1.2 보안 원칙
- 모든 Edge Function은 인증 필수
- PIN 검증은 해시 비교만
- 집계 테이블 업데이트는 Edge Function에서만

---

## 2. Edge Function 목록

### 2.1 pin-login
**경로**: `/functions/pin-login/index.ts`

#### 요청
```typescript
POST /functions/v1/pin-login
Content-Type: application/json

{
  "storeSlug": "seoul-station",
  "pin": "1234"
}
```

#### 응답 (성공)
```typescript
{
  "success": true,
  "session": {
    "access_token": "eyJhbGc...",
    "refresh_token": "...",
    "user": {
      "id": "uuid",
      "app_metadata": {
        "store_id": "uuid",
        "staff_id": 123,
        "role": "staff"
      }
    }
  },
  "staff": {
    "id": 123,
    "name": "홍길동",
    "position": "직원"
  }
}
```

#### 응답 (실패)
```typescript
{
  "success": false,
  "error": "INVALID_PIN" | "ACCOUNT_LOCKED" | "STORE_NOT_FOUND" | "STAFF_INACTIVE"
}
```

#### 로직
1. storeSlug → store_id 조회
2. store 상태 확인 (ACTIVE만 허용)
3. PIN 해시 검증
4. 실패 시:
   - pin_failed_count 증가
   - 5회 실패 시 pin_locked_until = NOW() + 10분
5. 성공 시:
   - pin_failed_count = 0, pin_locked_until = NULL
   - staff용 Auth User 생성 또는 재사용
   - JWT 커스텀 클레임 설정:
     ```typescript
     app_metadata: {
       store_id: "uuid",
       staff_id: 123,
       role: "staff"
     }
     ```
   - 세션 발급

#### 구현 예시
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (req) => {
  try {
    const { storeSlug, pin } = await req.json();

    // Supabase 클라이언트 (서비스 롤)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. storeSlug → store_id
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, status")
      .eq("slug", storeSlug)
      .single();

    if (storeError || !store) {
      return new Response(
        JSON.stringify({ success: false, error: "STORE_NOT_FOUND" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (store.status !== "ACTIVE") {
      return new Response(
        JSON.stringify({ success: false, error: "STORE_SUSPENDED" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. PIN 해시로 staff 조회
    const { data: staffList, error: staffError } = await supabaseAdmin
      .from("staff")
      .select("*")
      .eq("store_id", store.id)
      .eq("active", true);

    if (staffError || !staffList || staffList.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_PIN" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. PIN 검증 (bcrypt)
    let matchedStaff = null;
    for (const staff of staffList) {
      if (await bcrypt.compare(pin, staff.pin_hash)) {
        matchedStaff = staff;
        break;
      }
    }

    if (!matchedStaff) {
      // 실패 처리 (모든 staff의 failed_count 증가는 비효율적이므로 생략)
      return new Response(
        JSON.stringify({ success: false, error: "INVALID_PIN" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. 잠금 확인
    if (matchedStaff.pin_locked_until) {
      const lockedUntil = new Date(matchedStaff.pin_locked_until);
      if (lockedUntil > new Date()) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "ACCOUNT_LOCKED",
            locked_until: matchedStaff.pin_locked_until
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 5. 성공 - 실패 카운트 초기화
    await supabaseAdmin
      .from("staff")
      .update({ 
        pin_failed_count: 0, 
        pin_locked_until: null 
      })
      .eq("id", matchedStaff.id);

    // 6. Auth User 생성 또는 재사용
    let authUserId = matchedStaff.auth_user_id;

    if (!authUserId) {
      // 새 Auth User 생성
      const email = `staff_${matchedStaff.id}@internal.worklog.app`;
      const password = crypto.randomUUID(); // 랜덤 비밀번호 (사용 안함)

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: {
          store_id: store.id,
          staff_id: matchedStaff.id,
          role: "staff"
        }
      });

      if (authError || !authData.user) {
        throw new Error("Failed to create auth user");
      }

      authUserId = authData.user.id;

      // staff 테이블에 auth_user_id 저장
      await supabaseAdmin
        .from("staff")
        .update({ auth_user_id: authUserId })
        .eq("id", matchedStaff.id);
    } else {
      // 기존 Auth User의 메타데이터 업데이트
      await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        app_metadata: {
          store_id: store.id,
          staff_id: matchedStaff.id,
          role: "staff"
        }
      });
    }

    // 7. 세션 발급
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: `staff_${matchedStaff.id}@internal.worklog.app`
    });

    if (sessionError || !sessionData) {
      throw new Error("Failed to generate session");
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: sessionData,
        staff: {
          id: matchedStaff.id,
          name: matchedStaff.name,
          position: matchedStaff.position
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("PIN login error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "INTERNAL_ERROR" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

---

### 2.2 clock-in (출근)
**경로**: `/functions/clock-in/index.ts`

#### 요청
```typescript
POST /functions/v1/clock-in
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "memo": "정상 출근" // 선택
}
```

#### 응답
```typescript
{
  "success": true,
  "shift": {
    "id": 123,
    "date": "2026-02-02",
    "start_time": "10:30:00",
    "is_late": false,
    "late_minutes": 0
  }
}
```

#### 로직
1. JWT에서 store_id, staff_id 추출
2. 오늘 이미 출근했는지 확인 (중복 방지)
3. 현재 시간 (KST) 가져오기
4. 지각 체크 (staff.regular_start_time 기준)
5. shifts 테이블에 INSERT
6. 감사 로그 기록

---

### 2.3 clock-out (퇴근)
**경로**: `/functions/clock-out/index.ts`

#### 요청
```typescript
POST /functions/v1/clock-out
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "memo": "업무 완료" // 선택
}
```

#### 응답
```typescript
{
  "success": true,
  "shift": {
    "id": 123,
    "date": "2026-02-02",
    "start_time": "10:30:00",
    "end_time": "19:00:00",
    "work_hours": 7.5
  }
}
```

#### 로직
1. JWT에서 store_id, staff_id 추출
2. 오늘 출근 기록 조회 (end_time IS NULL)
3. 현재 시간 (KST) 가져오기
4. **근무시간 계산** (기존 로직 재사용):
   - 10:00 이전 출근 → 10:00으로 보정
   - 15:00-17:00 휴게시간 제외
   - 30분 단위 반올림
5. shifts 테이블 UPDATE (end_time, work_hours)
6. **monthly_staff_summary 테이블 UPSERT**:
   ```sql
   INSERT INTO monthly_staff_summary (store_id, staff_id, year_month, total_hours, total_days)
   VALUES ($1, $2, $3, $4, 1)
   ON CONFLICT (store_id, staff_id, year_month)
   DO UPDATE SET
     total_hours = monthly_staff_summary.total_hours + EXCLUDED.total_hours,
     total_days = monthly_staff_summary.total_days + 1,
     updated_at = NOW();
   ```
7. 감사 로그 기록

#### 근무시간 계산 함수 (기존 로직 이식)
```typescript
function calculateWorkHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // 10:00 이전 출근 → 10:00으로 보정
  const workStartThreshold = 10 * 60; // 600분
  if (startMinutes < workStartThreshold) {
    startMinutes = workStartThreshold;
  }

  // 퇴근도 10:00 이전이면 근무시간 0
  if (endMinutes < workStartThreshold) {
    return 0;
  }

  let diffMinutes = endMinutes - startMinutes;

  // 휴게시간 15:00-17:00 (900-1020분) 제외
  const breakStart = 15 * 60; // 900
  const breakEnd = 17 * 60;   // 1020

  if (startMinutes < breakEnd && endMinutes > breakStart) {
    const overlapStart = Math.max(startMinutes, breakStart);
    const overlapEnd = Math.min(endMinutes, breakEnd);
    const overlapMinutes = overlapEnd - overlapStart;
    diffMinutes -= overlapMinutes;
  }

  // 30분 단위 반올림
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const roundedMinutes = minutes >= 30 ? 0.5 : 0;
  
  return hours + roundedMinutes;
}
```

---

### 2.4 get-store-by-slug (매장 조회)
**경로**: `/functions/get-store-by-slug/index.ts`

#### 요청
```typescript
GET /functions/v1/get-store-by-slug?slug=seoul-station
```

#### 응답
```typescript
{
  "success": true,
  "store": {
    "id": "uuid",
    "slug": "seoul-station",
    "name": "서울역점",
    "status": "ACTIVE"
  }
}
```

#### 로직
- 단순 조회 (캐시는 Next.js에서 처리)
- 공개 API (인증 불필요)

---

## 3. 배포 방법

### 3.1 Supabase CLI 설치
```bash
npm install -g supabase
```

### 3.2 프로젝트 연결
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 3.3 Edge Function 생성
```bash
supabase functions new pin-login
supabase functions new clock-in
supabase functions new clock-out
```

### 3.4 배포
```bash
supabase functions deploy pin-login
supabase functions deploy clock-in
supabase functions deploy clock-out
```

### 3.5 환경 변수 설정
```bash
supabase secrets set SUPABASE_URL=https://xxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

## 4. 테스트

### 4.1 로컬 테스트
```bash
supabase functions serve pin-login
```

### 4.2 cURL 테스트
```bash
# PIN 로그인
curl -X POST https://xxx.supabase.co/functions/v1/pin-login \
  -H "Content-Type: application/json" \
  -d '{"storeSlug": "seoul-station", "pin": "1234"}'

# 출근
curl -X POST https://xxx.supabase.co/functions/v1/clock-in \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"memo": "정상 출근"}'
```

---

## 5. 보안 체크리스트

- [ ] 모든 Edge Function에 인증 확인
- [ ] PIN 해시 비교만 (평문 저장 금지)
- [ ] 서비스 롤 키는 Edge Function에서만 사용
- [ ] JWT 커스텀 클레임 검증
- [ ] Rate limiting 적용 (Supabase 자동)
- [ ] 에러 메시지에 민감 정보 노출 금지

---

## 6. 성능 최적화

- [ ] Edge Function은 전역 배포 (Deno Deploy)
- [ ] 불필요한 DB 쿼리 최소화
- [ ] 집계 테이블 UPSERT로 한 번에 처리
- [ ] Connection pooling (Supabase 자동)

---

완료
