# 근무시간 책정 시스템 분석 및 현황

## 📊 현재 시스템 개요

### 1. 데이터베이스 스키마 (Shifts 테이블)

```sql
CREATE TABLE shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,        -- 출근 시간 (HH:mm:ss)
  end_time TEXT,                    -- 퇴근 시간 (HH:mm:ss)
  work_hours REAL,                  -- 계산된 근무시간 (소수점)
  status TEXT DEFAULT 'pending',    -- 승인 상태
  is_modified INTEGER DEFAULT 0,    -- 수정 여부
  is_late INTEGER DEFAULT 0,        -- 지각 여부
  late_minutes INTEGER DEFAULT 0,   -- 지각 시간 (분)
  late_exempt INTEGER DEFAULT 0,    -- 지각 면제 여부
  late_note TEXT,                   -- 지각 사유
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

---

## ⚙️ 근무시간 계산 로직

### 📍 위치: 3곳에서 구현됨
1. **`/api/index.js`** (Line 70-129) - 프로덕션 API (PostgreSQL)
2. **`/server/server.js`** (Line 303-335) - 로컬 서버 (SQLite)
3. **`/client/src/App.jsx`** (Line 508-535) - 프론트엔드 (편집 시)

### 핵심 계산 알고리즘

```javascript
function calculateWorkHours(startTime, endTime) {
  // 1. 시간 파싱 (HH:mm:ss 또는 HH:mm 형식)
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  let diffMinutes = endMinutes - startMinutes;
  
  // 2. 야간 근무 처리 (자정 넘어가는 경우)
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;  // 24시간 추가
  }
  
  // 3. 휴게시간 자동 차감 (15:00~17:00)
  const breakStart = 15 * 60;  // 900분 (15:00)
  const breakEnd = 17 * 60;    // 1020분 (17:00)
  
  // 근무 시간이 휴게시간과 겹치는 경우만 차감
  if (startMinutes < breakEnd && endMinutes > breakStart) {
    const overlapStart = Math.max(startMinutes, breakStart);
    const overlapEnd = Math.min(endMinutes, breakEnd);
    const overlapMinutes = overlapEnd - overlapStart;
    diffMinutes -= overlapMinutes;
  }
  
  // 4. 30분 단위 반올림
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const roundedMinutes = minutes >= 30 ? 0.5 : 0;
  
  return hours + roundedMinutes;
}
```

### 주요 특징

#### ✅ 자동 처리 항목
- **야간 근무**: 자정을 넘어가는 근무 자동 계산
- **휴게시간**: 15:00~17:00 사이 겹치는 시간 자동 차감
- **반올림**: 30분 미만 버림, 30분 이상 0.5시간으로 계산

#### ⚠️ 특수 케이스
- 16:00~17:00 시간대 출근: 휴게시간 체크 제외
- 17:00 이후 출근: 저녁 근무로 간주, 17:00 기준 지각 계산

---

## 🕐 지각 관리 시스템

### 지각 계산 로직 (출근 시)

```javascript
// 1. 사용자의 정규 출근 시간 조회
const user = await query('SELECT regular_start_time FROM users WHERE id = $1', [userId]);

// 2. 시간대별 지각 판정
if (actualHour === 16) {
  // 16:00~17:00 시간대: 지각 없음
  isLate = 0;
} else if (actualHour >= 17) {
  // 17:00 이후: 17:00 기준으로 지각 계산
  if (actualMinutes > 17 * 60) {
    isLate = 1;
    lateMinutes = actualMinutes - (17 * 60);
  }
} else {
  // 일반 시간대: regular_start_time 기준
  if (actualMinutes > regularMinutes) {
    isLate = 1;
    lateMinutes = actualMinutes - regularMinutes;
  }
}
```

### 지각 데이터 구조
- **is_late**: 지각 여부 (0/1)
- **late_minutes**: 지각 시간 (분)
- **late_exempt**: 지각 면제 여부 (0/1)
- **late_note**: 지각 사유 메모

---

## 🔄 API 엔드포인트

### 1. 출근 (Clock In)
**POST** `/api/clock-in`
```json
{
  "userId": 1
}
```
**처리 내용:**
- 현재 시간(KST) 기록
- 지각 여부 자동 판정
- shifts 테이블에 INSERT

### 2. 퇴근 (Clock Out)
**POST** `/api/clock-out`
```json
{
  "userId": 1
}
```
**처리 내용:**
- 현재 시간(KST) 기록
- 근무시간 자동 계산 (calculateWorkHours 호출)
- shifts 테이블 UPDATE

### 3. 근무 기록 수정
**PUT** `/api/shifts/:id`
```json
{
  "start_time": "09:00",
  "end_time": "18:00",
  "work_hours": 7.0,
  "late_exempt": 0,
  "late_note": "교통 체증"
}
```
**처리 내용:**
- 시작/종료 시간 변경 시 근무시간 재계산
- 지각 상태 재계산
- is_modified = 1 설정

### 4. 근무 기록 조회
**GET** `/api/shifts?userId=1&month=2025-11`
- 특정 사용자의 월별 근무 기록 조회
- 관리자는 전체 직원 조회 가능

---

## 🎨 프론트엔드 구현

### 근무 기록 편집 UI
**위치:** `/client/src/App.jsx` (Line 1876-1920)

```jsx
// 실시간 근무시간 계산
<input
  type="text"
  value={editingShift.start_time}
  onChange={(e) => {
    const newStartTime = e.target.value;
    const newWorkHours = calculateEditWorkHours(newStartTime, editingShift.end_time);
    setEditingShift({
      ...editingShift,
      start_time: newStartTime,
      work_hours: newWorkHours
    });
  }}
/>
```

### 지각 표시
- ⚠️ 빨간색: 지각 (late_exempt = 0)
- 회색 취소선: 지각 면제 (late_exempt = 1)
- 지각 시간(분) 표시

---

## 🔍 코드 위치 정리

### Backend (API)
| 파일 | 라인 | 기능 |
|------|------|------|
| `/api/index.js` | 70-129 | calculateWorkHours 함수 |
| `/api/index.js` | 173-278 | Clock In 엔드포인트 + 지각 계산 |
| `/api/index.js` | 281-337 | Clock Out 엔드포인트 |
| `/api/index.js` | 418-485 | 근무 기록 수정 엔드포인트 |

### Backend (Local Server)
| 파일 | 라인 | 기능 |
|------|------|------|
| `/server/server.js` | 70-96 | Shifts 테이블 생성 + 컬럼 추가 |
| `/server/server.js` | 303-335 | calculateWorkHours 함수 |

### Frontend
| 파일 | 라인 | 기능 |
|------|------|------|
| `/client/src/App.jsx` | 508-535 | calculateEditWorkHours 함수 |
| `/client/src/App.jsx` | 1876-1920 | 근무 기록 편집 UI |

---

## ⚡ 성능 최적화

### 데이터베이스 인덱스
```sql
CREATE INDEX idx_shifts_user_date ON shifts(user_id, date);
CREATE INDEX idx_shifts_date ON shifts(date);
```

### Connection Pool (PostgreSQL)
```javascript
const pool = new Pool({
  max: 3,                      // 최대 연결 수
  idleTimeoutMillis: 30000,    // 유휴 연결 타임아웃
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true
});
```

---

## 🌏 시간대 처리 (KST)

### 한국 시간 변환 함수
```javascript
// 날짜 (YYYY-MM-DD)
const getTodayKST = () => {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${year}-${month}-${day}`;
};

// 시간 (HH:mm:ss)
const getCurrentTimeKST = () => {
  const now = new Date();
  const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${hours}:${minutes}:${seconds}`;
};
```

---

## 🎯 추가 기능 구현 시 고려사항

### 1. 코드 일관성 유지
- **3곳 모두 수정 필요**: API, Server, Client
- 동일한 로직 적용 보장

### 2. 데이터베이스 마이그레이션
- 새 컬럼 추가 시 `ALTER TABLE` 사용
- 기존 데이터 호환성 유지

### 3. 휴게시간 정책
- 현재: 15:00~17:00 고정
- 변경 시: breakStart, breakEnd 상수 수정

### 4. 반올림 정책
- 현재: 30분 기준 (0-29분 버림, 30-59분 0.5시간)
- 변경 시: roundedMinutes 계산 로직 수정

### 5. 지각 정책
- 16:00~17:00 시간대 특수 처리
- 17:00 이후 저녁 근무 기준
- 정규 출근 시간 기반 계산

---

## ✅ 현재 시스템 상태

### 장점
- ✅ 자동 계산으로 인적 오류 최소화
- ✅ 휴게시간 자동 차감
- ✅ 야간 근무 지원
- ✅ 지각 자동 판정
- ✅ 수정 이력 추적 (is_modified)
- ✅ 지각 면제 기능

### 개선 가능 영역
- 🔄 코드 중복 (3곳에 동일 로직)
- 🔄 휴게시간 정책 하드코딩
- 🔄 반올림 정책 하드코딩
- 🔄 시간대별 지각 정책 복잡도

---

## 📝 추가 사항 구현 준비 완료

현재 코드 구조를 완전히 파악했으며, 다음 작업이 가능합니다:

1. **새로운 필드 추가** (예: 야간수당, 주휴수당 등)
2. **계산 로직 수정** (예: 휴게시간 정책 변경)
3. **지각 정책 변경** (예: 새로운 시간대 규칙)
4. **추가 엔드포인트** (예: 통계, 리포트 등)

**추가하고 싶은 기능을 알려주시면 기존 코드와 충돌 없이 구현하겠습니다!** 🚀
