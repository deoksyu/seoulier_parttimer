# 🧪 배포 전 최종 테스트

## ✅ 로컬 환경 테스트

### 1. 서버 API 테스트

#### Health Check
```bash
curl http://localhost:5001/api/health
```
예상 결과:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-10-11T08:34:52.757Z",
  "database": "./database.db"
}
```

#### PIN 로그인
```bash
curl -X POST http://localhost:5001/api/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"9999"}'
```
예상 결과:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "name": "관리자",
    "role": "admin"
  }
}
```

#### 청소 태스크 조회
```bash
curl "http://localhost:5001/api/cleaning-tasks?date=2025-10-11"
```
예상 결과:
```json
{
  "success": true,
  "tasks": [...]
}
```

#### 404 에러 핸들링
```bash
curl http://localhost:5001/api/nonexistent
```
예상 결과:
```json
{
  "success": false,
  "message": "Endpoint not found"
}
```

### 2. 프론트엔드 테스트

브라우저에서 http://localhost:5173 접속 후:

- [ ] PIN 9999로 관리자 로그인
- [ ] 출퇴근 기록 생성
- [ ] 청소 체크리스트 확인
- [ ] 일일 청소 체크/언체크
- [ ] 주간 청소 체크/언체크
- [ ] 월간 청소 체크/언체크
- [ ] 관리자 대시보드 - 근무 탭
- [ ] 관리자 대시보드 - 청소 탭
- [ ] 관리자 대시보드 - 인사 탭
- [ ] 로그아웃

### 3. CORS 테스트

다른 origin에서 API 호출 시도:
```bash
curl -H "Origin: http://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -X OPTIONS http://localhost:5001/api/login-pin
```

개발 환경에서는 모든 origin 허용되어야 함.

---

## 📋 배포 전 체크리스트

### 코드 준비
- [x] 환경 변수 지원 추가
- [x] CORS 동적 설정
- [x] Health check 엔드포인트
- [x] 에러 핸들링 미들웨어
- [x] 404 핸들러
- [x] 로깅 개선

### 파일 확인
- [x] `.gitignore`에 `.env`, `database.db` 포함
- [x] `server/.env.example` 생성
- [x] `client/.env.example` 생성
- [x] `vercel.json` 설정
- [x] `package.json` 스크립트 확인

### 문서
- [x] `DEPLOY_CHECKLIST.md`
- [x] `READY_TO_DEPLOY.md`
- [x] `PRE_DEPLOY_TEST.md` (현재 파일)

### 로컬 테스트
- [ ] 모든 API 엔드포인트 테스트
- [ ] 프론트엔드 기능 테스트
- [ ] 에러 핸들링 테스트
- [ ] CORS 테스트

---

## 🚀 배포 준비 완료 확인

모든 테스트가 통과하면:

1. **Git 커밋**
   ```bash
   git add .
   git commit -m "feat: 배포 준비 완료 - 환경 변수, CORS, 에러 핸들링 추가"
   git push origin main
   ```

2. **배포 진행**
   - `DEPLOY_CHECKLIST.md` 참조
   - Render 먼저, Vercel 나중에

3. **배포 후 테스트**
   - Health check
   - 로그인
   - 모든 기능 테스트

---

## ⚠️ 주의사항

### 배포 전 반드시 확인
1. ✅ `.env` 파일이 Git에 커밋되지 않았는지
2. ✅ `database.db` 파일이 Git에 커밋되지 않았는지
3. ✅ 로컬에서 모든 기능이 정상 작동하는지

### 배포 후 반드시 수정
1. ⚠️ `vercel.json`의 Render URL 업데이트
2. ⚠️ Render 환경 변수에 `FRONTEND_URL` 설정
3. ⚠️ Persistent Disk 마운트 확인

---

## 🎯 다음 단계

1. 이 파일의 모든 테스트 실행
2. 테스트 통과 확인
3. Git 커밋 및 푸시
4. `DEPLOY_CHECKLIST.md` 따라 배포
5. 배포 후 프로덕션 환경 테스트

**준비되었습니다! 배포를 시작하세요! 🚀**
