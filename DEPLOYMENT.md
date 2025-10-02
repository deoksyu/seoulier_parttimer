# 🚀 배포 가이드

## 📋 배포 전 체크리스트

### ✅ 완료된 사항
- [x] 파일 기반 SQLite 데이터베이스 (데이터 영구 저장)
- [x] CREATE TABLE IF NOT EXISTS (재시작 시 데이터 유지)
- [x] 환경 변수 지원 (DATABASE_PATH)

### ⚠️ 배포 전 필요한 작업
- [ ] CORS 설정 (특정 도메인만 허용)
- [ ] 환경 변수 설정
- [ ] 프론트엔드 API URL 변경

---

## 🌐 Vercel + Render 배포 방법

### 1단계: GitHub 저장소 생성

```bash
# 현재 프로젝트가 이미 Git 저장소입니다
git remote add origin https://github.com/your-username/parttimer.git
git push -u origin main
```

### 2단계: Render 배포 (백엔드)

#### 2.1 Render 계정 생성
1. https://render.com 접속
2. GitHub 계정으로 로그인

#### 2.2 Web Service 생성
1. **New** → **Web Service** 클릭
2. GitHub 저장소 연결
3. 설정:
   - **Name**: `parttimer-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

#### 2.3 환경 변수 설정
Environment 탭에서 추가:
```
DATABASE_PATH=/opt/render/project/src/database.db
PORT=5001
```

#### 2.4 Persistent Disk 추가 (중요!)
1. **Disks** 탭 클릭
2. **Add Disk** 클릭
3. 설정:
   - **Name**: `database`
   - **Mount Path**: `/opt/render/project/src`
   - **Size**: 1 GB (무료)

#### 2.5 배포 URL 확인
배포 완료 후 URL 복사 (예: `https://parttimer-api.onrender.com`)

### 3단계: Vercel 배포 (프론트엔드)

#### 3.1 API URL 변경
`client/src/App.jsx` 파일 수정:
```javascript
const API_URL = 'https://parttimer-api.onrender.com/api';
```

#### 3.2 Vercel 계정 생성
1. https://vercel.com 접속
2. GitHub 계정으로 로그인

#### 3.3 프로젝트 Import
1. **Add New** → **Project** 클릭
2. GitHub 저장소 선택
3. 설정:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

#### 3.4 배포 완료
배포 완료 후 URL 확인 (예: `https://parttimer.vercel.app`)

---

## 🔒 보안 강화 (선택 사항)

### CORS 설정 변경

`server/server.js` 수정:
```javascript
// Before
app.use(cors());

// After
app.use(cors({
  origin: 'https://parttimer.vercel.app', // Vercel URL로 변경
  credentials: true
}));
```

---

## 📊 배포 후 확인 사항

### 1. 백엔드 API 테스트
```bash
curl -X POST https://parttimer-api.onrender.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

예상 응답:
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

### 2. 프론트엔드 접속
1. Vercel URL 접속
2. admin/admin 로그인 테스트
3. 출퇴근 기록 테스트

### 3. 데이터 영구성 확인
1. 출퇴근 기록 생성
2. Render에서 서비스 재시작
3. 데이터가 유지되는지 확인

---

## ⚠️ 주의사항

### Render 무료 티어 제한
- **자동 슬립**: 15분 동안 요청이 없으면 서버가 슬립 모드로 전환
- **첫 요청 느림**: 슬립 모드에서 깨어나는데 30초~1분 소요
- **월 750시간**: 무료 티어는 월 750시간 제한 (충분함)

### 데이터베이스 백업
Render에서 데이터베이스 파일 다운로드:
```bash
# Render Shell에서 실행
cat /opt/render/project/src/database.db > backup.db
```

---

## 🔧 트러블슈팅

### 문제 1: CORS 에러
**증상**: 프론트엔드에서 API 호출 시 CORS 에러

**해결**:
```javascript
// server/server.js
app.use(cors({
  origin: ['http://localhost:5173', 'https://parttimer.vercel.app'],
  credentials: true
}));
```

### 문제 2: 데이터베이스 초기화
**증상**: 서버 재시작 시 데이터 손실

**해결**: Persistent Disk가 올바르게 마운트되었는지 확인
```bash
# Render Shell에서 확인
ls -la /opt/render/project/src/database.db
```

### 문제 3: 서버 슬립
**증상**: 첫 요청이 매우 느림

**해결**: 
- UptimeRobot 등으로 5분마다 핑 보내기
- 또는 유료 플랜 사용

---

## 💰 비용

| 서비스 | 플랜 | 비용 |
|--------|------|------|
| Vercel | Hobby | 무료 |
| Render | Free | 무료 |
| **총 비용** | | **$0/월** |

---

## 📈 업그레이드 경로

### 단계 1: 현재 (무료)
- Vercel (프론트엔드)
- Render Free (백엔드)
- SQLite (데이터베이스)

### 단계 2: 성능 개선 ($7/월)
- Vercel (프론트엔드) - 무료
- Render Starter ($7/월) - 슬립 모드 없음
- SQLite (데이터베이스)

### 단계 3: 확장 ($25/월)
- Vercel (프론트엔드) - 무료
- Render Standard ($25/월)
- Supabase PostgreSQL (무료 또는 $25/월)

---

## ✅ 배포 완료 후

배포가 완료되면:
1. ✅ 원격으로 데이터 전송 가능
2. ✅ 데이터 영구 저장
3. ✅ 여러 사용자 동시 접속 가능
4. ✅ 언제 어디서나 접속 가능

**배포 URL을 README.md에 추가하세요!**
