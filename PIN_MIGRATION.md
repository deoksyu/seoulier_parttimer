# PIN 로그인 시스템 마이그레이션 가이드

## 개요
기존 아이디/비밀번호 로그인 시스템을 **PIN 4자리 숫자** 로그인 시스템으로 변경합니다.

## 데이터베이스 변경사항

### 1. Supabase SQL Editor에서 실행

Supabase 대시보드 > SQL Editor로 이동하여 다음 SQL을 실행하세요:

```sql
-- 1. users 테이블에 pin 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT;

-- 2. 기존 사용자들에게 PIN 할당
UPDATE users SET pin = '0000' WHERE username = 'admin';
UPDATE users SET pin = '1234' WHERE username = 'st01';
UPDATE users SET pin = '2345' WHERE username = 'st02';
UPDATE users SET pin = '3456' WHERE username = 'st03';
UPDATE users SET pin = '4567' WHERE username = 'st04';
UPDATE users SET pin = '5678' WHERE username = 'st05';
UPDATE users SET pin = '6789' WHERE username = 'st06';
UPDATE users SET pin = '7890' WHERE username = 'st07';
UPDATE users SET pin = '8901' WHERE username = 'st08';

-- 3. PIN 컬럼을 NOT NULL로 변경 (모든 사용자에게 PIN이 할당된 후)
ALTER TABLE users ALTER COLUMN pin SET NOT NULL;

-- 4. PIN 유니크 제약조건 추가 (중복 방지)
ALTER TABLE users ADD CONSTRAINT unique_pin UNIQUE (pin);

-- 5. 확인
SELECT username, name, role, pin FROM users ORDER BY id;
```

### 2. 새로운 테이블 구조

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  -- 레거시, 더 이상 사용 안 함
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin TEXT UNIQUE NOT NULL  -- 새로 추가된 필드
);
```

## PIN 번호 할당

| 이름 | 역할 | PIN |
|------|------|-----|
| 관리자 | admin | 0000 |
| 이수진 | staff | 1234 |
| 배경현 | staff | 2345 |
| 채윤아 | staff | 3456 |
| 황성윤 | staff | 4567 |
| 임수민 | staff | 5678 |
| 김태오 | staff | 6789 |
| 웅 | staff | 7890 |
| 김채원 | staff | 8901 |

## 새 사용자 추가 방법

```sql
INSERT INTO users (username, password, name, role, pin) VALUES
  ('st09', 'legacy', '새직원', 'staff', '9012');
```

**참고**: `password` 필드는 레거시이므로 임의의 값을 넣어도 됩니다. 로그인 시 사용되지 않습니다.

## 보안 고려사항

### ⚠️ 주의사항
- PIN 4자리는 보안이 약할 수 있습니다 (10,000가지 조합)
- 내부 직원용 시스템이므로 적합하지만, 외부 노출 시 위험합니다

### ✅ 권장사항
1. **정기적인 PIN 변경**
   ```sql
   UPDATE users SET pin = '새PIN' WHERE username = 'st01';
   ```

2. **PIN 변경 기능 추가** (향후 개선)
   - 사용자가 직접 PIN을 변경할 수 있는 기능

3. **로그인 시도 제한** (향후 개선)
   - 5회 실패 시 일시적 잠금

4. **감사 로그** (향후 개선)
   - 로그인 시도 기록

## 롤백 방법

PIN 시스템을 다시 아이디/비밀번호로 되돌리려면:

```sql
-- PIN 제약조건 제거
ALTER TABLE users DROP CONSTRAINT IF EXISTS unique_pin;

-- PIN 컬럼 삭제
ALTER TABLE users DROP COLUMN IF EXISTS pin;
```

그리고 코드를 이전 버전으로 되돌리세요.

## 테스트 방법

1. **로컬 테스트**
   ```bash
   cd /Users/a./Desktop/vscode/seoulier_parttimer
   npm run dev
   ```

2. **PIN으로 로그인 테스트**
   - 관리자: 0000
   - 이수진: 1234
   - 배경현: 2345

3. **잘못된 PIN 테스트**
   - 9999 입력 → "PIN 번호가 잘못되었습니다" 메시지 확인

4. **출퇴근 기능 테스트**
   - 로그인 후 출근/퇴근 버튼 정상 작동 확인

## 배포 순서

1. **데이터베이스 마이그레이션 먼저 실행**
   - Supabase에서 위의 SQL 실행

2. **코드 배포**
   ```bash
   git add .
   git commit -m "feat: PIN 로그인 시스템으로 변경"
   git push origin main
   ```

3. **Vercel 자동 배포 대기** (약 1-2분)

4. **배포된 사이트에서 테스트**

## 문제 해결

### "column pin does not exist" 에러
→ 데이터베이스 마이그레이션이 실행되지 않았습니다. 위의 SQL을 실행하세요.

### "PIN 번호가 잘못되었습니다" 메시지
→ PIN이 올바르게 할당되었는지 확인:
```sql
SELECT username, name, pin FROM users;
```

### 로그인 후 기능이 작동하지 않음
→ 브라우저 캐시를 삭제하고 다시 시도하세요.

## 완료 체크리스트

- [ ] Supabase에서 SQL 마이그레이션 실행
- [ ] 모든 사용자에게 PIN 할당 확인
- [ ] 로컬에서 테스트
- [ ] Git push 및 Vercel 배포
- [ ] 배포된 사이트에서 테스트
- [ ] 모든 직원에게 새 PIN 번호 공유
