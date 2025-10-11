# 🚀 배포 체크리스트

## ✅ 배포 전 준비 완료 사항

### 1. 코드 준비
- [x] 환경 변수 지원 (PORT, DATABASE_PATH, FRONTEND_URL)
- [x] CORS 설정 (동적 origin 허용)
- [x] API URL 환경 변수 지원
- [x] SQLite 파일 기반 데이터베이스
- [x] 에러 처리 및 로깅

### 2. 환경 변수 파일
- [x] `server/.env.example` 생성
- [x] `client/.env.example` 생성

### 3. 배포 설정 파일
- [x] `vercel.json` 업데이트 (API 프록시 설정)

---

## 📝 배포 단계

### Step 1: Render 배포 (백엔드)

1. **Render 계정 생성**
   - https://render.com 접속
   - GitHub 계정으로 로그인

2. **Web Service 생성**
   - New → Web Service
   - GitHub 저장소 연결
   - 설정:
     ```
     Name: seoulier-parttimer-api
     Root Directory: server
     Environment: Node
     Build Command: npm install
     Start Command: node server.js
     Instance Type: Free
     ```

3. **환경 변수 설정**
   Environment 탭에서 추가:
   ```
   PORT=5001
   NODE_ENV=production
   DATABASE_PATH=/opt/render/project/src/database.db
   FRONTEND_URL=https://your-app.vercel.app
   ```

4. **Persistent Disk 추가** ⚠️ 중요!
   - Disks 탭 클릭
   - Add Disk
   - 설정:
     ```
     Name: database
     Mount Path: /opt/render/project/src
     Size: 1 GB
     ```

5. **배포 URL 복사**
   - 예: `https://seoulier-parttimer-api.onrender.com`

### Step 2: Vercel 배포 (프론트엔드)

1. **vercel.json 수정**
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://seoulier-parttimer-api.onrender.com/api/:path*"
       }
     ]
   }
   ```

2. **Vercel 계정 생성**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

3. **프로젝트 Import**
   - Add New → Project
   - GitHub 저장소 선택
   - 설정:
     ```
     Framework Preset: Vite
     Root Directory: client
     Build Command: npm run build
     Output Directory: dist
     ```

4. **환경 변수 설정** (선택 사항)
   ```
   VITE_API_URL=/api
   ```

5. **배포 완료**
   - URL 확인: `https://seoulier-parttimer.vercel.app`

---

## 🧪 배포 후 테스트

### 1. 백엔드 API 테스트
```bash
# Health check
curl https://seoulier-parttimer-api.onrender.com/api/health

# Login test
curl -X POST https://seoulier-parttimer-api.onrender.com/api/login-pin \
  -H "Content-Type: application/json" \
  -d '{"pin":"9999"}'
```

### 2. 프론트엔드 테스트
1. Vercel URL 접속
2. PIN 9999로 관리자 로그인
3. 출퇴근 기록 테스트
4. 청소 체크리스트 테스트

### 3. CORS 테스트
- 브라우저 개발자 도구 → Console
- CORS 에러가 없는지 확인

---

## ⚠️ 주의사항

### Render 무료 티어
- **자동 슬립**: 15분 동안 요청이 없으면 슬립 모드
- **첫 요청 느림**: 슬립에서 깨어나는데 30초~1분 소요
- **해결책**: UptimeRobot으로 5분마다 핑 보내기

### 데이터베이스 백업
정기적으로 Render Shell에서 백업:
```bash
cat /opt/render/project/src/database.db > backup.db
```

### 환경 변수 보안
- `.env` 파일은 절대 Git에 커밋하지 않기
- `.gitignore`에 `.env` 추가 확인

---

## 🔧 트러블슈팅

### 문제 1: CORS 에러
**증상**: `Access-Control-Allow-Origin` 에러

**해결**:
1. Render 환경 변수에 `FRONTEND_URL` 확인
2. 서버 재시작
3. 브라우저 캐시 삭제

### 문제 2: 데이터베이스 초기화
**증상**: 서버 재시작 시 데이터 손실

**해결**:
1. Persistent Disk가 올바르게 마운트되었는지 확인
2. Render Shell에서 확인:
   ```bash
   ls -la /opt/render/project/src/database.db
   ```

### 문제 3: 빌드 실패
**증상**: Vercel 또는 Render 빌드 실패

**해결**:
1. `package.json`의 dependencies 확인
2. Node 버전 확인 (권장: 18.x)
3. 로컬에서 빌드 테스트:
   ```bash
   cd client && npm run build
   cd ../server && npm install
   ```

---

## 📊 배포 완료 확인

- [ ] Render 백엔드 배포 완료
- [ ] Vercel 프론트엔드 배포 완료
- [ ] 환경 변수 설정 완료
- [ ] Persistent Disk 마운트 완료
- [ ] API 연결 테스트 완료
- [ ] 로그인 테스트 완료
- [ ] 출퇴근 기록 테스트 완료
- [ ] 청소 체크리스트 테스트 완료
- [ ] CORS 에러 없음
- [ ] 데이터 영구성 확인

---

## 🎉 배포 완료!

배포가 완료되면:
- ✅ 원격으로 데이터 전송 가능
- ✅ 데이터 영구 저장
- ✅ 여러 사용자 동시 접속 가능
- ✅ 언제 어디서나 접속 가능

**배포 URL을 팀원들과 공유하세요!**
