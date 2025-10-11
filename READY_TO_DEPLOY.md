# ✅ 배포 준비 완료!

## 🎯 완료된 작업

### 1. 서버 설정 (server/server.js)
- ✅ **환경 변수 지원**
  - `PORT`: 서버 포트 (기본값: 5001)
  - `DATABASE_PATH`: 데이터베이스 파일 경로
  - `FRONTEND_URL`: 프론트엔드 URL (CORS 설정)
  - `NODE_ENV`: 환경 (development/production)

- ✅ **CORS 설정**
  - 동적 origin 허용
  - localhost 개발 환경 지원
  - 프로덕션 환경 FRONTEND_URL 사용

- ✅ **로깅 개선**
  - 서버 시작 시 환경 정보 출력
  - 데이터베이스 경로 표시
  - CORS 허용 origin 표시

### 2. 클라이언트 설정 (client/src/App.jsx)
- ✅ **API URL 환경 변수**
  - `VITE_API_URL`: API 엔드포인트 URL
  - 개발/프로덕션 자동 전환

### 3. 배포 설정 파일
- ✅ **vercel.json**
  - API 프록시 설정 (Render 백엔드로 연결)
  - 빌드 설정

- ✅ **환경 변수 예제**
  - `server/.env.example`
  - `client/.env.example`

### 4. 문서
- ✅ **DEPLOY_CHECKLIST.md**: 단계별 배포 가이드
- ✅ **DEPLOYMENT.md**: 상세 배포 문서
- ✅ **.gitignore**: 민감한 파일 제외

---

## 🚀 배포 순서

### 1단계: Render (백엔드)
1. Render.com 계정 생성
2. Web Service 생성
3. 환경 변수 설정:
   ```
   PORT=5001
   NODE_ENV=production
   DATABASE_PATH=/opt/render/project/src/database.db
   FRONTEND_URL=https://your-app.vercel.app
   ```
4. Persistent Disk 추가 (중요!)
5. 배포 URL 복사

### 2단계: Vercel (프론트엔드)
1. `vercel.json`에서 백엔드 URL 업데이트
2. Vercel.com 계정 생성
3. 프로젝트 Import
4. 배포 완료

---

## 🧪 로컬 테스트

### 서버 테스트
```bash
cd server
node server.js

# 다른 터미널에서
curl http://localhost:5001/api/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"9999"}'
```

### 클라이언트 테스트
```bash
cd client
npm run dev

# 브라우저에서 http://localhost:5173 접속
```

---

## ⚠️ 배포 전 확인사항

- [ ] Git 저장소에 코드 푸시 완료
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] 로컬에서 정상 작동 확인
- [ ] 데이터베이스 백업 완료

---

## 📝 배포 후 수정할 파일

### vercel.json
```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RENDER-URL.onrender.com/api/:path*"
    }
  ]
}
```

**YOUR-RENDER-URL**을 실제 Render 배포 URL로 변경하세요!

---

## 🎉 배포 완료 후

1. **테스트**
   - 관리자 로그인 (PIN: 9999)
   - 출퇴근 기록
   - 청소 체크리스트
   - 근무 승인

2. **모니터링**
   - Render 로그 확인
   - Vercel 로그 확인
   - 브라우저 Console 에러 확인

3. **백업**
   - 정기적으로 데이터베이스 백업
   - Render Shell에서 다운로드

---

## 💡 팁

### Render 슬립 모드 방지
UptimeRobot (무료)으로 5분마다 핑:
- URL: `https://your-api.onrender.com/api/health`
- Interval: 5 minutes

### 비용
- Vercel: 무료
- Render: 무료 (슬립 모드 있음)
- **총 비용: $0/월**

### 업그레이드
슬립 모드가 불편하면:
- Render Starter: $7/월 (슬립 모드 없음)

---

## 📞 문제 발생 시

1. **CORS 에러**: `FRONTEND_URL` 환경 변수 확인
2. **데이터 손실**: Persistent Disk 마운트 확인
3. **빌드 실패**: 로컬에서 빌드 테스트

자세한 내용은 `DEPLOY_CHECKLIST.md` 참조!

---

## ✨ 준비 완료!

모든 코드가 배포 준비되었습니다. `DEPLOY_CHECKLIST.md`를 따라 배포를 진행하세요!
