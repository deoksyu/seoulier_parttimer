# 데이터베이스 백업 및 보안 가이드

## 1. 자동 백업 (Supabase)

### 무료 플랜:
- **자동 백업**: 7일간 보관
- **복구 방법**: Supabase 대시보드 > Database > Backups

### 유료 플랜 ($25/월):
- **Point-in-Time Recovery**: 30일간 보관
- 언제든지 특정 시점으로 복구 가능

## 2. 수동 백업

### 백업 실행:
```bash
node backup-db.js
```

### 백업 파일 위치:
- `backups/backup_YYYY-MM-DD_HH-mm-ss.json`

### 권장 백업 주기:
- **매주 1회**: 주말에 실행
- **중요 시점**: 월말, 급여 계산 전

## 3. 데이터 복구

### 복구 명령어:
```bash
# 1. 백업 파일 확인
ls backups/

# 2. 복구 실행 (경고 메시지 확인)
node restore-db.js backup_2025-10-02_17-30-00.json

# 3. 확인 후 실제 복구
node restore-db.js backup_2025-10-02_17-30-00.json --confirm
```

## 4. 보안 대책

### A. 접근 제어
- ✅ Supabase는 기본적으로 SSL/TLS 암호화
- ✅ 환경 변수로 비밀번호 관리
- ⚠️ Connection String을 GitHub에 올리지 않기

### B. Row Level Security (RLS)
Supabase에서 RLS 활성화 (선택사항):
```sql
-- Users 테이블 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Shifts 테이블 RLS 활성화
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (예시)
CREATE POLICY "Users can view their own data"
  ON shifts FOR SELECT
  USING (auth.uid() = user_id);
```

### C. 정기 백업 자동화
cron 또는 GitHub Actions로 자동화:

**.github/workflows/backup.yml** (예시):
```yaml
name: Database Backup
on:
  schedule:
    - cron: '0 0 * * 0'  # 매주 일요일 자동 실행
  workflow_dispatch:  # 수동 실행 가능

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install pg
      - run: node backup-db.js
      - uses: actions/upload-artifact@v3
        with:
          name: database-backup
          path: backups/
```

## 5. 해킹 대비 체크리스트

### ✅ 필수:
- [x] 강력한 비밀번호 사용
- [x] 환경 변수로 비밀번호 관리
- [x] 주기적 백업 (최소 주 1회)
- [x] Supabase 2FA 활성화

### ✅ 권장:
- [ ] Row Level Security 활성화
- [ ] 백업 파일 별도 저장 (Google Drive, Dropbox)
- [ ] IP 화이트리스트 설정 (유료 플랜)
- [ ] 감사 로그 모니터링

## 6. 비상 복구 절차

### 데이터 손실 발생 시:

1. **Supabase 자동 백업 확인**
   - Dashboard > Database > Backups
   - 최근 7일 내 백업 복구

2. **수동 백업 파일 사용**
   ```bash
   node restore-db.js <최신_백업_파일> --confirm
   ```

3. **복구 후 확인**
   - 사용자 수 확인
   - 최근 근무 기록 확인
   - 통계 데이터 확인

## 7. 백업 파일 관리

### 로컬 백업:
- `backups/` 폴더에 저장
- `.gitignore`에 추가되어 GitHub에 업로드 안 됨

### 클라우드 백업 (권장):
- Google Drive
- Dropbox
- AWS S3 (유료)

### 보관 정책:
- 최근 4주: 주간 백업
- 최근 12개월: 월간 백업
- 그 이후: 연간 백업

## 8. 비용 대비 보안 수준

### 무료 ($0/월):
- ✅ Supabase 자동 백업 7일
- ✅ 수동 백업 스크립트
- ✅ 기본 SSL 암호화
- **적합**: 소규모 매장 (10명 이하)

### 유료 ($25/월):
- ✅ 30일 Point-in-Time Recovery
- ✅ 우선 지원
- ✅ 더 많은 백업 보관
- **적합**: 중규모 이상, 중요 데이터

## 결론

현재 설정으로도 충분히 안전합니다:
- ✅ Supabase 자동 백업 7일
- ✅ 수동 백업 스크립트 제공
- ✅ SSL 암호화 통신
- ✅ 환경 변수 관리

**권장 사항**: 매주 일요일 `node backup-db.js` 실행!
