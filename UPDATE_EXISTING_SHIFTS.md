# 기존 근무 기록 재계산 가이드

## 📋 변경 사항 요약

**10:00 이전 출근 시간 보정 로직 추가**
- 출근 시간이 00:00~10:00 사이면 → **10:00으로 보정**
- 퇴근 시간이 10:00 이전이면 → **근무시간 0**

---

## ⚠️ 기존 근무 기록에 대한 영향

### 자동 적용되는 경우 ✅

**새로운 계산이 자동으로 적용됩니다:**

1. **관리자가 근무 기록을 수정할 때**
   - 관리자 대시보드에서 출근/퇴근 시간을 수정하면
   - 새로운 로직으로 자동 재계산됨

2. **앞으로 새로 찍히는 출퇴근 기록**
   - 오늘부터 출퇴근 찍으면 새 로직 적용

---

## 🔄 기존 기록 재계산 방법

### 방법 1: 관리자 수동 재계산 (추천)

**관리자 대시보드에서 각 근무 기록을 열어서 저장**

1. 관리자 로그인
2. 근무 탭 → 날짜 선택
3. 각 직원의 근무 기록 **편집 버튼** 클릭
4. 아무것도 수정하지 않고 **저장** 버튼만 클릭
5. → 자동으로 새 로직으로 재계산됨

**장점:**
- 안전함 (하나씩 확인 가능)
- 코드 수정 불필요
- 특정 기간만 선택적으로 재계산 가능

---

### 방법 2: SQL 스크립트로 일괄 재계산

**데이터베이스에 직접 접근 가능한 경우**

#### PostgreSQL (프로덕션)

```sql
-- 10:00 이전 출근 기록 확인
SELECT id, user_id, date, start_time, end_time, work_hours
FROM shifts
WHERE start_time < '10:00:00'
ORDER BY date DESC;

-- 재계산이 필요한 기록 업데이트
-- 주의: 이 쿼리는 예시이며, 실제로는 애플리케이션 로직을 통해 재계산하는 것이 안전합니다
```

#### SQLite (로컬)

```sql
-- 10:00 이전 출근 기록 확인
SELECT id, user_id, date, start_time, end_time, work_hours
FROM shifts
WHERE time(start_time) < '10:00:00'
ORDER BY date DESC;
```

**⚠️ 주의:**
- SQL로 직접 계산하면 휴게시간, 반올림 로직을 수동으로 구현해야 함
- 관리자 UI를 통한 재계산이 더 안전함

---

### 방법 3: API 엔드포인트 추가 (개발 필요)

**일괄 재계산 API를 만드는 경우**

```javascript
// api/index.js에 추가
app.post('/api/recalculate-shifts', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    // 기간 내 모든 shifts 조회
    const result = await query(
      'SELECT id, start_time, end_time FROM shifts WHERE date >= $1 AND date <= $2 AND end_time IS NOT NULL',
      [startDate, endDate]
    );
    
    // 각 shift 재계산
    for (const shift of result.rows) {
      const newWorkHours = calculateWorkHours(shift.start_time, shift.end_time);
      await query(
        'UPDATE shifts SET work_hours = $1 WHERE id = $2',
        [newWorkHours, shift.id]
      );
    }
    
    res.json({
      success: true,
      message: `${result.rows.length}개 기록 재계산 완료`
    });
  } catch (error) {
    console.error('Recalculate error:', error);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});
```

**사용 방법:**
```bash
curl -X POST http://localhost:5001/api/recalculate-shifts \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-10-01","endDate":"2025-11-03"}'
```

---

## 📊 영향 받는 기록 확인

### 확인 쿼리

```sql
-- PostgreSQL
SELECT 
  date,
  name,
  start_time,
  end_time,
  work_hours,
  CASE 
    WHEN start_time < '10:00:00' THEN '재계산 필요'
    ELSE '정상'
  END as status
FROM shifts s
JOIN users u ON s.user_id = u.id
WHERE start_time < '10:00:00'
ORDER BY date DESC;
```

---

## 🎯 추천 방법

### 단계별 가이드

1. **영향 범위 확인**
   ```sql
   SELECT COUNT(*) FROM shifts WHERE start_time < '10:00:00';
   ```

2. **소수의 기록만 있다면 (< 50개)**
   - → **방법 1 (관리자 수동 재계산)** 추천
   - 안전하고 확실함

3. **많은 기록이 있다면 (> 50개)**
   - → **방법 3 (API 엔드포인트)** 구현 추천
   - 한 번에 일괄 처리 가능

---

## ✅ 재계산 후 검증

### 검증 방법

1. **샘플 확인**
   - 08:00 출근 → 18:00 퇴근
   - 예상: 6시간 (10:00~18:00, 휴게시간 2시간 차감)

2. **극단적 케이스**
   - 05:00 출근 → 09:00 퇴근
   - 예상: 0시간 (둘 다 10:00 이전)

3. **정상 케이스**
   - 11:00 출근 → 18:00 퇴근
   - 예상: 5시간 (휴게시간 2시간 차감)

---

## 💡 결론

**기존 근무 기록은 자동으로 업데이트되지 않습니다.**

하지만:
- ✅ 관리자가 수정하면 자동 재계산
- ✅ 새로운 출퇴근 기록은 자동 적용
- ✅ 필요시 일괄 재계산 API 추가 가능

**10:00 이전 출근 기록이 많지 않다면, 관리자 UI에서 하나씩 저장하는 것이 가장 안전합니다!**
