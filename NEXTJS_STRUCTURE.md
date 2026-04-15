# Next.js 프로젝트 구조 설계

## 📋 문서 정보
- **작성일**: 2026-02-02
- **Next.js 버전**: 14+ (App Router)
- **목적**: 멀티테넌트 시스템 프론트엔드 구조

---

## 1. 프로젝트 루트 구조

```
worklog/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # 루트 레이아웃
│   ├── page.tsx                 # 홈페이지 (리다이렉트)
│   ├── sa/                      # 슈퍼 관리자 콘솔
│   └── s/                       # 매장 앱
├── components/                   # 재사용 컴포넌트
├── lib/                         # 유틸리티 & 설정
├── types/                       # TypeScript 타입
├── public/                      # 정적 파일
├── supabase/                    # Supabase 관련
│   ├── functions/               # Edge Functions (로컬 개발)
│   └── migrations/              # DB 마이그레이션
├── .env.local                   # 환경 변수
├── next.config.js               # Next.js 설정
├── package.json
└── tsconfig.json
```

---

## 2. App Router 구조 (상세)

### 2.1 전체 라우팅 맵

```
app/
├── layout.tsx                    # 루트 레이아웃 (전역 스타일, 폰트)
├── page.tsx                      # / → 리다이렉트 또는 랜딩
├── globals.css                   # 전역 CSS
│
├── sa/                           # 슈퍼 관리자 콘솔
│   ├── layout.tsx               # SA 레이아웃 (인증 체크)
│   ├── page.tsx                 # /sa → 대시보드
│   ├── stores/                  # 매장 관리
│   │   ├── page.tsx            # /sa/stores → 매장 목록
│   │   ├── new/                # /sa/stores/new → 매장 생성
│   │   │   └── page.tsx
│   │   └── [storeId]/          # /sa/stores/[id] → 매장 상세
│   │       └── page.tsx
│   └── settings/                # 설정
│       └── page.tsx
│
└── s/                            # 매장 앱
    └── [storeSlug]/              # 동적 라우팅
        ├── layout.tsx           # 매장 레이아웃 (slug → store_id 매핑)
        ├── page.tsx             # /s/[slug] → 직원/관리자 메인
        ├── login/               # /s/[slug]/login → PIN 로그인
        │   └── page.tsx
        ├── admin/               # 관리자 전용
        │   ├── layout.tsx      # 관리자 인증 체크
        │   ├── page.tsx        # /s/[slug]/admin → 대시보드
        │   ├── staff/          # /s/[slug]/admin/staff → 직원 관리
        │   │   └── page.tsx
        │   └── reports/        # /s/[slug]/admin/reports → 리포트
        │       └── page.tsx
        └── cleaning/            # 청소 체크리스트
            └── page.tsx
```

---

## 3. 컴포넌트 구조

### 3.1 디렉토리 구조

```
components/
├── common/                       # 공통 컴포넌트
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   ├── Loading.tsx
│   └── ErrorBoundary.tsx
│
├── layout/                       # 레이아웃 컴포넌트
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
│
├── sa/                           # 슈퍼 관리자 전용
│   ├── StoreList.tsx
│   ├── StoreForm.tsx
│   └── StoreCard.tsx
│
├── store/                        # 매장 앱 공통
│   ├── ClockInButton.tsx        # 출근 버튼
│   ├── ClockOutButton.tsx       # 퇴근 버튼
│   ├── ShiftList.tsx            # 근무 내역
│   ├── ShiftCard.tsx
│   └── PinPad.tsx               # PIN 입력 패드
│
├── admin/                        # 관리자 전용
│   ├── StaffList.tsx
│   ├── StaffForm.tsx
│   ├── ShiftApproval.tsx
│   └── MonthlyReport.tsx
│
└── cleaning/                     # 청소 체크리스트
    ├── TaskList.tsx
    ├── TaskItem.tsx
    └── WeeklyView.tsx
```

### 3.2 기존 코드 재사용 전략

#### 기존 App.jsx (3,473줄) → 분리 계획

```javascript
// 기존: client/src/App.jsx (모든 기능이 하나의 파일)

// 신규: 기능별 분리
app/s/[storeSlug]/page.tsx          // 직원 메인 (출퇴근 버튼)
app/s/[storeSlug]/admin/page.tsx    // 관리자 대시보드
components/store/ClockInButton.tsx  // 출근 버튼 로직
components/store/ShiftList.tsx      // 근무 내역 테이블
components/cleaning/TaskList.tsx    // 청소 체크리스트
```

#### 재사용 가능한 UI 코드
- 출퇴근 버튼 UI
- 근무 내역 테이블
- 청소 체크리스트 (더블 체크 로직)
- 다크모드 토글
- 월별 필터
- 통계 카드

---

## 4. 라이브러리 & 설정

### 4.1 lib/ 구조

```
lib/
├── supabase/
│   ├── client.ts                # Supabase 클라이언트 (브라우저)
│   ├── server.ts                # Supabase 클라이언트 (서버)
│   └── middleware.ts            # 인증 미들웨어
│
├── utils/
│   ├── date.ts                  # 날짜 유틸 (getTodayKST 등)
│   ├── time.ts                  # 시간 계산 (calculateWorkHours)
│   └── format.ts                # 포맷팅
│
├── hooks/
│   ├── useAuth.ts               # 인증 훅
│   ├── useStore.ts              # 매장 정보 훅
│   └── useShifts.ts             # 근무 기록 훅
│
└── constants/
    ├── routes.ts                # 라우트 상수
    └── config.ts                # 설정 상수
```

### 4.2 주요 파일 예시

#### lib/supabase/client.ts
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### lib/supabase/server.ts
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

#### lib/utils/time.ts (기존 로직 이식)
```typescript
/**
 * 근무시간 계산 (기존 calculateWorkHours 이식)
 * - 10:00 이전 출근 → 10:00으로 보정
 * - 15:00-17:00 휴게시간 제외
 * - 30분 단위 반올림
 */
export function calculateWorkHours(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // 10:00 이전 출근 → 10:00으로 보정
  const workStartThreshold = 10 * 60;
  if (startMinutes < workStartThreshold) {
    startMinutes = workStartThreshold;
  }

  if (endMinutes < workStartThreshold) {
    return 0;
  }

  let diffMinutes = endMinutes - startMinutes;

  // 휴게시간 15:00-17:00 제외
  const breakStart = 15 * 60;
  const breakEnd = 17 * 60;

  if (startMinutes < breakEnd && endMinutes > breakStart) {
    const overlapStart = Math.max(startMinutes, breakStart);
    const overlapEnd = Math.min(endMinutes, breakEnd);
    const overlapMinutes = overlapEnd - overlapStart;
    diffMinutes -= overlapMinutes;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const roundedMinutes = minutes >= 30 ? 0.5 : 0;
  
  return hours + roundedMinutes;
}

/**
 * KST 오늘 날짜 (YYYY-MM-DD)
 */
export function getTodayKST(): string {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * KST 현재 시간 (HH:mm:ss)
 */
export function getCurrentTimeKST(): string {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const hours = String(kstDate.getHours()).padStart(2, '0');
  const minutes = String(kstDate.getMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
```

---

## 5. TypeScript 타입 정의

### 5.1 types/ 구조

```
types/
├── database.types.ts            # Supabase 자동 생성 타입
├── store.ts                     # 매장 관련 타입
├── staff.ts                     # 직원 관련 타입
├── shift.ts                     # 근무 기록 타입
└── auth.ts                      # 인증 관련 타입
```

### 5.2 주요 타입 예시

#### types/store.ts
```typescript
export type Store = {
  id: string;
  slug: string;
  name: string;
  plan: 'FREE' | 'TRIAL' | 'PRO';
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
  updated_at: string;
};

export type StoreWithStats = Store & {
  staff_count: number;
  active_staff_count: number;
  today_clock_ins: number;
};
```

#### types/staff.ts
```typescript
export type Staff = {
  id: number;
  store_id: string;
  auth_user_id: string | null;
  name: string;
  pin_hash: string;
  phone: string | null;
  email: string | null;
  position: string;
  workplace: string | null;
  hire_date: string | null;
  hourly_wage: number | null;
  regular_start_time: string | null;
  health_certificate_expiry: string | null;
  memo: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};
```

#### types/shift.ts
```typescript
export type Shift = {
  id: number;
  store_id: string;
  staff_id: number;
  date: string;
  start_time: string;
  end_time: string | null;
  work_hours: number | null;
  status: 'pending' | 'approved' | 'rejected';
  is_modified: boolean;
  is_late: boolean;
  late_minutes: number;
  late_exempt: boolean;
  late_note: string | null;
  approved_by: number | null;
  approved_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftWithStaff = Shift & {
  staff: {
    name: string;
    position: string;
  };
};
```

---

## 6. 환경 변수

### 6.1 .env.local (로컬 개발)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6.2 Vercel 환경 변수 (프로덕션)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (서버 전용)
NEXT_PUBLIC_APP_URL=https://worklog.vercel.app
```

---

## 7. 주요 페이지 구현 예시

### 7.1 슈퍼 관리자 콘솔 메인

#### app/sa/page.tsx
```typescript
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import StoreList from '@/components/sa/StoreList';

export default async function SuperAdminPage() {
  const supabase = createClient();
  
  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/sa/login');
  }

  // 슈퍼 관리자 권한 확인
  const { data: superAdmin } = await supabase
    .from('super_admins')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!superAdmin) {
    return <div>접근 권한이 없습니다.</div>;
  }

  // 매장 목록 조회
  const { data: stores } = await supabase
    .from('stores')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1>슈퍼 관리자 콘솔</h1>
      <StoreList stores={stores || []} />
    </div>
  );
}
```

### 7.2 매장 앱 레이아웃 (slug 매핑)

#### app/s/[storeSlug]/layout.tsx
```typescript
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';

// slug → store_id 매핑 (캐시)
const getStoreBySlug = cache(async (slug: string) => {
  const supabase = createClient();
  
  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .single();

  if (error || !store) {
    return null;
  }

  if (store.status !== 'ACTIVE') {
    return null;
  }

  return store;
});

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { storeSlug: string };
}) {
  const store = await getStoreBySlug(params.storeSlug);

  if (!store) {
    notFound();
  }

  return (
    <div data-store-id={store.id}>
      <header>
        <h1>{store.name}</h1>
      </header>
      {children}
    </div>
  );
}
```

### 7.3 직원 메인 페이지 (출퇴근)

#### app/s/[storeSlug]/page.tsx
```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import ClockInButton from '@/components/store/ClockInButton';
import ClockOutButton from '@/components/store/ClockOutButton';
import ShiftList from '@/components/store/ShiftList';

export default function StorePage() {
  const [user, setUser] = useState(null);
  const [todayShift, setTodayShift] = useState(null);
  const supabase = createClient();

  useEffect(() => {
    // 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  const staffId = user.app_metadata?.staff_id;
  const storeId = user.app_metadata?.store_id;

  return (
    <div>
      <h2>안녕하세요!</h2>
      
      {!todayShift?.end_time ? (
        <ClockInButton storeId={storeId} staffId={staffId} />
      ) : (
        <ClockOutButton shiftId={todayShift.id} />
      )}

      <ShiftList staffId={staffId} />
    </div>
  );
}
```

---

## 8. 스타일링

### 8.1 CSS 전략
- **Tailwind CSS** 사용 (기존 App.css 이식)
- 다크모드 지원 (`dark:` 클래스)
- 반응형 디자인 (`sm:`, `md:`, `lg:`)

### 8.2 기존 스타일 재사용
```css
/* 기존: client/src/App.css (56KB) */
/* 신규: app/globals.css + Tailwind */

/* 주요 스타일 이식 */
- 출퇴근 버튼 스타일
- 테이블 스타일
- 청소 체크리스트 스타일
- 다크모드 변수
```

---

## 9. 배포 설정

### 9.1 next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['xxx.supabase.co'],
  },
};

module.exports = nextConfig;
```

### 9.2 Vercel 배포
```bash
# 자동 배포 (Git push)
git push origin main

# 수동 배포
vercel --prod
```

---

## 10. 개발 시작 순서

### Phase 1: 프로젝트 생성
```bash
npx create-next-app@latest worklog-next --typescript --tailwind --app
cd worklog-next
npm install @supabase/ssr @supabase/supabase-js
```

### Phase 2: 기본 구조 설정
1. lib/supabase/ 설정
2. types/ 타입 정의
3. app/ 라우팅 구조 생성

### Phase 3: 슈퍼 관리자 콘솔
1. app/sa/ 페이지 구현
2. 매장 생성 기능

### Phase 4: 매장 앱
1. app/s/[storeSlug]/ 레이아웃
2. PIN 로그인
3. 출퇴근 기능

### Phase 5: 기존 UI 이식
1. components/ 컴포넌트 분리
2. 청소 체크리스트
3. 관리자 대시보드

---

완료
