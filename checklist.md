# 개발 체크리스트 (Development Checklist)

## 📋 문서 정보
- **프로젝트명**: 아르바이트 출퇴근 관리 시스템
- **버전**: 1.0.0 (1시간 MVP)
- **작성일**: 2025-10-02
- **문서 타입**: 초고속 개발 체크리스트
- **목표 시간**: 1시간 이내

---

## ⚡ 1시간 MVP 개발 전략

### 핵심 원칙
- **최소 기능만 구현**: 출퇴근 기록 + 간단한 조회
- **UI 최소화**: 기능 우선, 디자인은 나중에
- **단일 파일 구조**: 복잡한 아키텍처 배제
- **로컬 개발만**: 배포는 추후 진행

---

## 🎯 1시간 타임라인

| 시간 | Phase | 작업 내용 |
|------|-------|----------|
| 0-10분 | Phase 1 | 프로젝트 초기 설정 |
| 10-25분 | Phase 2 | 백엔드 핵심 기능 |
| 25-45분 | Phase 3 | 프론트엔드 핵심 기능 |
| 45-55분 | Phase 4 | 통합 및 테스트 |
| 55-60분 | Phase 5 | 최종 확인 및 정리 |

---

## Phase 1: 프로젝트 초기 설정 (10분)

### 1.1 백엔드 설정 (5분)
- [ ] 프로젝트 폴더 생성
  ```bash
  mkdir parttimer && cd parttimer
  mkdir server client
  ```
- [ ] 백엔드 초기화
  ```bash
  cd server
  npm init -y
  npm install express sqlite3 cors
  ```
- [ ] `server.js` 파일 생성 (단일 파일 구조)

### 1.2 프론트엔드 설정 (5분)
- [ ] React 프로젝트 생성
  ```bash
  cd ../client
  npm create vite@latest . -- --template react
  npm install axios
  ```
- [ ] 불필요한 파일 삭제 (App.css, index.css 내용 간소화)

---

## Phase 2: 백엔드 핵심 기능 (15분)

### 2.1 데이터베이스 + API 통합 구현 (15분)
- [ ] `server/server.js` 작성 - 모든 기능을 한 파일에 구현
  - [ ] SQLite 데이터베이스 초기화
  - [ ] Users 테이블 생성 (id, username, password, name, role)
  - [ ] Shifts 테이블 생성 (id, user_id, date, start_time, end_time, status)
  - [ ] 테스트 사용자 2명 삽입 (admin, staff01)
  
- [ ] API 엔드포인트 구현 (간단한 인증만)
  - [ ] `POST /api/login` - 로그인 (비밀번호 평문 비교)
  - [ ] `POST /api/clock-in` - 출근 기록
  - [ ] `POST /api/clock-out` - 퇴근 기록
  - [ ] `GET /api/shifts` - 근무 내역 조회
  - [ ] `PUT /api/shifts/:id/approve` - 승인 (관리자만)

- [ ] 서버 실행 확인
  ```bash
  node server.js
  ```

---

## Phase 3: 프론트엔드 핵심 기능 (20분)

### 3.1 App.jsx 수정 (20분)
- [ ] `src/App.jsx` - 모든 UI를 한 파일에 구현
  - [ ] 로그인 화면
    - [ ] 아이디/비밀번호 입력
    - [ ] 로그인 버튼
  
  - [ ] 알바생 화면 (role === 'staff')
    - [ ] 출근하기 버튼
    - [ ] 퇴근하기 버튼
    - [ ] 내 근무 내역 테이블
  
  - [ ] 관리자 화면 (role === 'admin')
    - [ ] 전체 근무 내역 테이블
    - [ ] 승인 버튼 (각 행마다)

- [ ] API 호출 함수 작성 (axios 사용)
  - [ ] login()
  - [ ] clockIn()
  - [ ] clockOut()
  - [ ] getShifts()
  - [ ] approveShift()

- [ ] 간단한 상태 관리 (useState)
  - [ ] user (로그인 사용자)
  - [ ] shifts (근무 내역)

---

## Phase 4: 통합 및 테스트 (10분)

### 4.1 기능 테스트 (10분)
- [ ] 백엔드 서버 실행 (포트 5000)
- [ ] 프론트엔드 서버 실행 (포트 3000)
- [ ] 로그인 테스트
  - [ ] admin / admin 로그인
  - [ ] staff01 / staff 로그인
- [ ] 알바생 기능 테스트
  - [ ] 출근 버튼 클릭
  - [ ] 퇴근 버튼 클릭
  - [ ] 내 근무 내역 확인
- [ ] 관리자 기능 테스트
  - [ ] 전체 근무 내역 확인
  - [ ] 승인 버튼 클릭

---

## Phase 5: 최종 확인 및 정리 (5분)

### 5.1 최종 확인 (5분)
- [ ] 모든 기능 정상 작동 확인
- [ ] 콘솔 에러 없는지 확인
- [ ] Git 커밋
  ```bash
  git add .
  git commit -m "feat: 1시간 MVP 완성"
  git push
  ```
- [ ] README.md 작성
  - [ ] 실행 방법
  - [ ] 테스트 계정

---

## 🎉 1시간 MVP 완성!

### 구현된 기능
- ✅ 로그인 (admin, staff01)
- ✅ 출근/퇴근 기록
- ✅ 근무 내역 조회
- ✅ 관리자 승인

### 다음 단계 (추후 개선)
- [ ] JWT 인증 추가
- [ ] 비밀번호 암호화 (bcrypt)
- [ ] UI 디자인 개선
- [ ] 반려 기능 추가
- [ ] 통계 기능 추가
- [ ] 배포 (Vercel + Render)

---

## 📝 참고 사항

### 테스트 계정
- **관리자**: admin / admin
- **알바생**: staff01 / staff

### 실행 명령어
```bash
# 백엔드 실행
cd server
node server.js

# 프론트엔드 실행 (새 터미널)
cd client
npm run dev
```

### 주요 파일
- `server/server.js` - 백엔드 전체 로직
- `client/src/App.jsx` - 프론트엔드 전체 UI

---

## 🔧 추후 개선 사항

### Phase 3: 백엔드 인증 시스템 구현 (추후)

#### 3.1 JWT 유틸리티 구현
- [ ] `src/utils/jwt.js` 작성
- [ ] JWT 토큰 생성 함수
- [ ] JWT 토큰 검증 함수
- [ ] JWT 토큰 디코딩 함수

#### 3.2 비밀번호 암호화 구현
- [ ] `src/utils/bcrypt.js` 작성
- [ ] 비밀번호 해싱 함수 (bcrypt)
- [ ] 비밀번호 비교 함수

#### 3.3 인증 미들웨어 구현
- [ ] `src/middleware/auth.js` 작성
- [ ] JWT 검증 미들웨어
- [ ] 역할 기반 권한 체크 미들웨어
  - [ ] `requireAuth` - 로그인 필수
  - [ ] `requireAdmin` - 관리자 권한 필수
  - [ ] `requireStaff` - 알바생 권한 필수

#### 3.4 인증 서비스 구현
- [ ] `src/services/authService.js` 작성
- [ ] 로그인 로직 구현
- [ ] 사용자 조회 로직 구현
- [ ] 토큰 갱신 로직 구현 (선택)

#### 3.5 인증 컨트롤러 구현
- [ ] `src/controllers/authController.js` 작성
- [ ] POST `/api/auth/login` - 로그인
- [ ] POST `/api/auth/logout` - 로그아웃
- [ ] GET `/api/auth/me` - 현재 사용자 정보

#### 3.6 인증 라우트 설정
- [ ] `src/routes/auth.routes.js` 작성
- [ ] 라우트 연결
- [ ] 입력 검증 추가 (express-validator)

#### 3.7 인증 테스트
- [ ] Postman/Thunder Client로 로그인 테스트
- [ ] 잘못된 비밀번호 테스트
- [ ] 존재하지 않는 사용자 테스트
- [ ] JWT 토큰 검증 테스트

---

### Phase 4: 백엔드 출퇴근 기능 구현 (2일)

#### 4.1 Shift 모델 구현
- [ ] `src/models/Shift.js` 작성
- [ ] 출근 기록 생성 함수
- [ ] 퇴근 시간 업데이트 함수
- [ ] 근무 시간 계산 함수
- [ ] 근무 기록 조회 함수

#### 4.2 Shift 서비스 구현
- [ ] `src/services/shiftService.js` 작성
- [ ] 출근 처리 로직
  - [ ] 중복 체크 (오늘 이미 출근했는지)
  - [ ] 출근 시간 기록
- [ ] 퇴근 처리 로직
  - [ ] 출근 기록 존재 확인
  - [ ] 퇴근 시간 기록
  - [ ] 총 근무시간 계산
- [ ] 수동 입력 로직
- [ ] 내 근무 내역 조회 로직

#### 4.3 Shift 컨트롤러 구현
- [ ] `src/controllers/shiftController.js` 작성
- [ ] POST `/api/shifts/clock-in` - 출근
- [ ] PUT `/api/shifts/clock-out/:id` - 퇴근
- [ ] GET `/api/shifts/my-shifts` - 내 근무 내역
- [ ] POST `/api/shifts/manual` - 수동 입력
- [ ] PUT `/api/shifts/:id` - 근무 기록 수정

#### 4.4 Shift 라우트 설정
- [ ] `src/routes/shift.routes.js` 작성
- [ ] 라우트 연결
- [ ] 인증 미들웨어 적용
- [ ] 입력 검증 추가

#### 4.5 출퇴근 기능 테스트
- [ ] 출근 API 테스트
- [ ] 퇴근 API 테스트
- [ ] 중복 출근 방지 테스트
- [ ] 근무 시간 계산 검증
- [ ] 내 근무 내역 조회 테스트

---

### Phase 5: 백엔드 관리자 기능 구현 (2일)

#### 5.1 Admin 서비스 구현
- [ ] `src/services/adminService.js` 작성
- [ ] 전체 근무 기록 조회 로직
  - [ ] 필터링 (사용자별, 날짜별, 상태별)
  - [ ] 페이지네이션 (선택)
- [ ] 승인 처리 로직
- [ ] 반려 처리 로직
- [ ] 통계 계산 로직
  - [ ] 월별 근무 시간 합계
  - [ ] 승인률 계산

#### 5.2 Admin 컨트롤러 구현
- [ ] `src/controllers/adminController.js` 작성
- [ ] GET `/api/admin/shifts` - 전체 근무 기록
- [ ] PUT `/api/admin/shifts/:id/approve` - 승인
- [ ] PUT `/api/admin/shifts/:id/reject` - 반려
- [ ] GET `/api/admin/statistics` - 통계
- [ ] GET `/api/admin/users` - 사용자 목록

#### 5.3 Admin 라우트 설정
- [ ] `src/routes/admin.routes.js` 작성
- [ ] 라우트 연결
- [ ] 관리자 권한 미들웨어 적용
- [ ] 입력 검증 추가

#### 5.4 관리자 기능 테스트
- [ ] 전체 근무 기록 조회 테스트
- [ ] 필터링 테스트
- [ ] 승인 처리 테스트
- [ ] 반려 처리 테스트
- [ ] 통계 조회 테스트
- [ ] 권한 체크 테스트 (알바생이 접근 시 403)

---

### Phase 6: 백엔드 미들웨어 및 보안 (1일)

#### 6.1 에러 핸들링 미들웨어
- [ ] `src/middleware/errorHandler.js` 작성
- [ ] 글로벌 에러 핸들러
- [ ] 404 Not Found 핸들러
- [ ] 에러 로깅

#### 6.2 입력 검증 미들웨어
- [ ] `src/validators/authValidator.js` 작성
- [ ] `src/validators/shiftValidator.js` 작성
- [ ] express-validator 스키마 정의

#### 6.3 보안 미들웨어 설정
- [ ] CORS 설정 (`cors`)
- [ ] 보안 헤더 설정 (`helmet`)
- [ ] Rate Limiting 설정 (`express-rate-limit`)
- [ ] 요청 로깅 설정 (`morgan`)

#### 6.4 로거 구현
- [ ] `src/middleware/logger.js` 작성
- [ ] 요청/응답 로깅
- [ ] 에러 로깅
- [ ] 파일 로깅 (선택)

---

### Phase 7: 프론트엔드 기본 설정 (1일)

#### 7.1 라우팅 설정
- [ ] `src/App.jsx` 라우터 설정
- [ ] 라우트 정의
  ```javascript
  /                      → LoginPage
  /staff/dashboard       → StaffDashboard (Protected)
  /staff/shifts          → StaffShiftList (Protected)
  /admin/dashboard       → AdminDashboard (Protected)
  /admin/shifts          → AdminShiftManagement (Protected)
  /admin/statistics      → AdminStatistics (Protected)
  ```
- [ ] Protected Route 컴포넌트 구현
- [ ] 404 페이지 구현

#### 7.2 API 서비스 설정
- [ ] `src/services/api.js` - Axios 인스턴스 생성
- [ ] Request Interceptor (JWT 토큰 자동 추가)
- [ ] Response Interceptor (에러 처리)
- [ ] `src/services/authService.js` - 인증 API
- [ ] `src/services/shiftService.js` - 출퇴근 API
- [ ] `src/services/adminService.js` - 관리자 API

#### 7.3 Context 설정
- [ ] `src/context/AuthContext.jsx` 작성
- [ ] 로그인 상태 관리
- [ ] 사용자 정보 관리
- [ ] 로그인/로그아웃 함수
- [ ] localStorage 토큰 관리

#### 7.4 커스텀 훅 구현
- [ ] `src/hooks/useAuth.js` - 인증 훅
- [ ] `src/hooks/useShifts.js` - 출퇴근 데이터 훅
- [ ] `src/hooks/useApi.js` - API 호출 훅

#### 7.5 유틸리티 함수
- [ ] `src/utils/dateFormatter.js` - 날짜 포맷팅
- [ ] `src/utils/timeCalculator.js` - 시간 계산
- [ ] `src/utils/validators.js` - 입력 검증

#### 7.6 상수 정의
- [ ] `src/constants/index.js`
- [ ] API 엔드포인트
- [ ] 상태 코드
- [ ] 에러 메시지

---

### Phase 8: 프론트엔드 공통 컴포넌트 (1일)

#### 8.1 레이아웃 컴포넌트
- [ ] `src/components/layout/Header.jsx`
- [ ] `src/components/layout/Sidebar.jsx` (선택)
- [ ] `src/components/layout/Footer.jsx`
- [ ] `src/components/layout/Layout.jsx` - 전체 레이아웃

#### 8.2 공통 컴포넌트
- [ ] `src/components/common/Button.jsx`
- [ ] `src/components/common/Input.jsx`
- [ ] `src/components/common/Modal.jsx`
- [ ] `src/components/common/Loading.jsx`
- [ ] `src/components/common/ErrorMessage.jsx`
- [ ] `src/components/common/SuccessMessage.jsx`
- [ ] `src/components/common/Card.jsx`

#### 8.3 Tailwind CSS 스타일링
- [ ] 색상 팔레트 정의
- [ ] 공통 스타일 클래스 정의
- [ ] 반응형 브레이크포인트 설정

---

### Phase 9: 프론트엔드 인증 페이지 (1일)

#### 9.1 로그인 페이지
- [ ] `src/pages/LoginPage.jsx` 작성
- [ ] 로그인 폼 UI
  - [ ] 아이디 입력
  - [ ] 비밀번호 입력
  - [ ] 로그인 버튼
- [ ] 폼 검증 (react-hook-form)
- [ ] 로그인 API 호출
- [ ] 에러 처리
- [ ] 성공 시 리다이렉트

#### 9.2 로그인 기능 테스트
- [ ] 정상 로그인 테스트
- [ ] 잘못된 비밀번호 테스트
- [ ] 존재하지 않는 사용자 테스트
- [ ] 토큰 저장 확인
- [ ] 리다이렉트 확인

---

### Phase 10: 프론트엔드 알바생 기능 (2일)

#### 10.1 알바생 대시보드
- [ ] `src/pages/StaffDashboard.jsx` 작성
- [ ] 현재 날짜/시간 표시
- [ ] 출근하기 버튼
- [ ] 퇴근하기 버튼
- [ ] 오늘 근무 상태 표시
- [ ] 메모 입력 칸

#### 10.2 출퇴근 컴포넌트
- [ ] `src/components/staff/ClockInButton.jsx`
- [ ] `src/components/staff/ClockOutButton.jsx`
- [ ] 버튼 상태 관리 (출근 전/출근 후)
- [ ] API 호출
- [ ] 성공/에러 메시지 표시

#### 10.3 내 근무 내역 페이지
- [ ] `src/pages/StaffShiftList.jsx` 작성
- [ ] `src/components/staff/ShiftList.jsx` 컴포넌트
- [ ] 근무 기록 테이블
  - [ ] 날짜
  - [ ] 출근 시간
  - [ ] 퇴근 시간
  - [ ] 총 근무시간
  - [ ] 상태 (승인/대기/반려)
- [ ] 상태별 아이콘/색상 표시
- [ ] 반려 사유 표시
- [ ] 월별 필터링

#### 10.4 알바생 기능 테스트
- [ ] 출근 버튼 클릭 테스트
- [ ] 퇴근 버튼 클릭 테스트
- [ ] 근무 내역 조회 테스트
- [ ] 상태 표시 확인
- [ ] 반응형 디자인 확인

---

### Phase 11: 프론트엔드 관리자 기능 (2일)

#### 11.1 관리자 대시보드
- [ ] `src/pages/AdminDashboard.jsx` 작성
- [ ] 승인 대기 건수 표시
- [ ] 오늘 출근 현황
- [ ] 빠른 통계 표시

#### 11.2 근무 기록 관리 페이지
- [ ] `src/pages/AdminShiftManagement.jsx` 작성
- [ ] `src/components/admin/ShiftApproval.jsx` 컴포넌트
- [ ] 근무 기록 리스트
  - [ ] 알바생 이름
  - [ ] 날짜
  - [ ] 출퇴근 시간
  - [ ] 총 근무시간
  - [ ] 상태
  - [ ] 승인/반려 버튼
- [ ] 필터링 기능
  - [ ] 알바생별 필터
  - [ ] 날짜별 필터
  - [ ] 상태별 필터
- [ ] 승인 처리 기능
- [ ] 반려 처리 기능 (사유 입력 모달)

#### 11.3 통계 페이지
- [ ] `src/pages/AdminStatistics.jsx` 작성
- [ ] `src/components/admin/Statistics.jsx` 컴포넌트
- [ ] 월별 통계 테이블
  - [ ] 알바생별 총 근무시간
  - [ ] 승인률
- [ ] 차트 표시 (선택)

#### 11.4 관리자 기능 테스트
- [ ] 근무 기록 조회 테스트
- [ ] 필터링 테스트
- [ ] 승인 처리 테스트
- [ ] 반려 처리 테스트
- [ ] 통계 조회 테스트
- [ ] 권한 체크 (알바생 접근 차단)

---

### Phase 12: UI/UX 개선 (1일)

#### 12.1 디자인 개선
- [ ] 색상 테마 일관성 확인
- [ ] 타이포그래피 개선
- [ ] 간격 및 여백 조정
- [ ] 아이콘 추가 (react-icons)

#### 12.2 반응형 디자인
- [ ] 모바일 레이아웃 확인
- [ ] 태블릿 레이아웃 확인
- [ ] 데스크톱 레이아웃 확인
- [ ] 미디어 쿼리 최적화

#### 12.3 사용자 경험 개선
- [ ] 로딩 인디케이터 추가
- [ ] 에러 메시지 개선
- [ ] 성공 메시지 토스트 추가
- [ ] 확인 다이얼로그 추가
- [ ] 키보드 네비게이션 지원

#### 12.4 접근성 개선
- [ ] ARIA 레이블 추가
- [ ] 키보드 접근성 확인
- [ ] 색상 대비 확인
- [ ] 스크린 리더 테스트

---

### Phase 13: 통합 테스트 (1일)

#### 13.1 기능 테스트
- [ ] 전체 사용자 플로우 테스트
  - [ ] 로그인 → 출근 → 퇴근 → 내역 확인
  - [ ] 관리자 로그인 → 승인/반려 → 통계 확인
- [ ] 엣지 케이스 테스트
  - [ ] 중복 출근 시도
  - [ ] 출근 없이 퇴근 시도
  - [ ] 권한 없는 접근 시도

#### 13.2 크로스 브라우저 테스트
- [ ] Chrome 테스트
- [ ] Firefox 테스트
- [ ] Safari 테스트
- [ ] Edge 테스트

#### 13.3 성능 테스트
- [ ] Lighthouse 점수 확인
- [ ] 페이지 로딩 속도 측정
- [ ] API 응답 시간 측정
- [ ] 번들 크기 확인

#### 13.4 보안 테스트
- [ ] JWT 토큰 만료 테스트
- [ ] 권한 체크 테스트
- [ ] SQL Injection 방지 확인
- [ ] XSS 방지 확인

---

### Phase 14: 배포 준비 (1일)

#### 14.1 프로덕션 빌드
- [ ] 프론트엔드 빌드
  ```bash
  npm run build
  ```
- [ ] 빌드 에러 확인 및 수정
- [ ] 번들 크기 최적화
- [ ] 환경 변수 프로덕션 설정

#### 14.2 데이터베이스 준비
- [ ] 프로덕션 데이터베이스 파일 생성
- [ ] 마이그레이션 실행
- [ ] 초기 관리자 계정 생성
- [ ] 백업 스크립트 작성

#### 14.3 환경 변수 설정
- [ ] Vercel 환경 변수 설정
  - [ ] `VITE_API_BASE_URL`
- [ ] Render 환경 변수 설정
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET` (강력한 시크릿 키)
  - [ ] `DATABASE_PATH`
  - [ ] `CORS_ORIGIN`

#### 14.4 배포 문서 작성
- [ ] README.md 작성
  - [ ] 프로젝트 소개
  - [ ] 설치 방법
  - [ ] 실행 방법
  - [ ] 환경 변수 설명
- [ ] DEPLOYMENT.md 작성 (배포 가이드)

---

### Phase 15: Vercel 배포 (프론트엔드) (30분)

#### 15.1 Vercel 프로젝트 생성
- [ ] Vercel 계정 생성/로그인
- [ ] GitHub 저장소 연결
- [ ] 프로젝트 import

#### 15.2 빌드 설정
- [ ] Framework Preset: Vite 선택
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Install Command: `npm install`

#### 15.3 환경 변수 설정
- [ ] `VITE_API_BASE_URL` 설정 (Render URL)

#### 15.4 배포 및 확인
- [ ] 배포 실행
- [ ] 배포 로그 확인
- [ ] 배포된 사이트 접속 확인
- [ ] 기능 동작 확인

---

### Phase 16: Render 배포 (백엔드) (30분)

#### 16.1 Render 프로젝트 생성
- [ ] Render 계정 생성/로그인
- [ ] New Web Service 생성
- [ ] GitHub 저장소 연결

#### 16.2 서비스 설정
- [ ] Name: 서비스 이름 입력
- [ ] Environment: Node
- [ ] Build Command: `npm install`
- [ ] Start Command: `node server.js`
- [ ] Instance Type: Free

#### 16.3 환경 변수 설정
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` (강력한 랜덤 문자열)
- [ ] `DATABASE_PATH=./database/production.db`
- [ ] `CORS_ORIGIN` (Vercel URL)

#### 16.4 Persistent Disk 설정
- [ ] Disk 추가 (데이터베이스 파일 저장용)
- [ ] Mount Path: `/opt/render/project/src/database`

#### 16.5 배포 및 확인
- [ ] 배포 실행
- [ ] 배포 로그 확인
- [ ] API 엔드포인트 접속 확인
- [ ] 데이터베이스 연결 확인

---

### Phase 17: 배포 후 테스트 (1일)

#### 17.1 프로덕션 환경 테스트
- [ ] 로그인 기능 테스트
- [ ] 출퇴근 기록 테스트
- [ ] 관리자 승인/반려 테스트
- [ ] 통계 조회 테스트

#### 17.2 성능 확인
- [ ] 페이지 로딩 속도 측정
- [ ] API 응답 시간 측정
- [ ] Lighthouse 점수 확인

#### 17.3 에러 모니터링
- [ ] 배포 로그 확인
- [ ] 에러 발생 여부 확인
- [ ] 에러 수정 및 재배포

#### 17.4 사용자 테스트
- [ ] 실제 사용자에게 테스트 요청
- [ ] 피드백 수집
- [ ] 개선 사항 정리

---

### Phase 18: 문서화 및 마무리 (1일)

#### 18.1 사용자 가이드 작성
- [ ] USER_GUIDE.md 작성
- [ ] 알바생용 가이드
- [ ] 관리자용 가이드
- [ ] 스크린샷 추가

#### 18.2 API 문서 작성
- [ ] API.md 작성
- [ ] 모든 엔드포인트 문서화
- [ ] 요청/응답 예시 추가

#### 18.3 유지보수 문서 작성
- [ ] MAINTENANCE.md 작성
- [ ] 백업 방법
- [ ] 복구 방법
- [ ] 트러블슈팅 가이드

#### 18.4 프로젝트 정리
- [ ] 불필요한 코드 제거
- [ ] 주석 정리
- [ ] 코드 포맷팅 (Prettier)
- [ ] 린팅 (ESLint)
- [ ] Git 커밋 정리

---

## 🔧 추가 개선 사항 (선택)

### 단기 개선 (1-2주)
- [ ] 프로필 사진 업로드 기능
- [ ] 다크 모드 지원
- [ ] 엑셀 내보내기 기능
- [ ] 이메일 알림 기능
- [ ] 비밀번호 변경 기능
- [ ] 비밀번호 찾기 기능

### 중기 개선 (1-2개월)
- [ ] 근무표 편성 기능
- [ ] 급여 계산 자동화
- [ ] 휴가 관리 기능
- [ ] 푸시 알림 (PWA)
- [ ] 다국어 지원
- [ ] 테마 커스터마이징

### 장기 개선 (3-6개월)
- [ ] 모바일 앱 (React Native)
- [ ] 생체 인증 (지문/얼굴)
- [ ] AI 기반 근무 패턴 분석
- [ ] 다중 사업장 지원
- [ ] 실시간 알림 (WebSocket)
- [ ] 고급 통계 대시보드

---

## 📊 진행 상황 추적 (1시간 버전)

### 전체 진행률
- [ ] Phase 1: 프로젝트 초기 설정 (0/10분)
- [ ] Phase 2: 백엔드 핵심 기능 (0/15분)
- [ ] Phase 3: 프론트엔드 핵심 기능 (0/20분)
- [ ] Phase 4: 통합 및 테스트 (0/10분)
- [ ] Phase 5: 최종 확인 및 정리 (0/5분)

**총 진행률**: 0/60분 (0%)

### 예상 소요 시간
- **1시간 MVP**: 60분
- **완전한 버전**: 2-3주 (추후 개선)
- **배포**: 추후 진행
- **문서화**: 추후 진행

---

## 🎯 주요 마일스톤 (1시간 버전)

| 마일스톤 | 목표 시간 | 상태 |
|---------|----------|------|
| 프로젝트 초기 설정 완료 | 10분 | ⏳ 대기 |
| 백엔드 핵심 기능 완성 | 25분 | ⏳ 대기 |
| 프론트엔드 완성 | 45분 | ⏳ 대기 |
| 통합 테스트 완료 | 55분 | ⏳ 대기 |
| 1시간 MVP 완성 | 60분 | ⏳ 대기 |

---

## 📝 참고 사항

### 개발 시 주의사항
- 모든 API 엔드포인트에 인증 미들웨어 적용
- 입력 검증 철저히 수행
- 에러 처리 누락 없이 구현
- 보안 취약점 주의 (SQL Injection, XSS 등)
- Git 커밋 메시지 명확하게 작성
- 환경 변수 절대 커밋하지 않기 (.gitignore 확인)

### 테스트 계정
- **관리자**: admin / admin123
- **알바생 1**: staff01 / staff123
- **알바생 2**: staff02 / staff123

### 유용한 명령어
```bash
# 프론트엔드 개발 서버
cd client && npm run dev

# 백엔드 개발 서버
cd server && npm run dev

# 데이터베이스 마이그레이션
cd server && npm run migrate

# 시드 데이터 실행
cd server && npm run seed

# 프로덕션 빌드
cd client && npm run build

# 린팅
npm run lint

# 포맷팅
npm run format
```

---

## ✅ 완료 기준

각 Phase는 다음 조건을 만족할 때 완료로 간주합니다:
1. 모든 체크리스트 항목 완료
2. 기능 테스트 통과
3. 코드 리뷰 완료 (팀 프로젝트인 경우)
4. Git 커밋 및 푸시 완료
5. 문서 업데이트 완료

---

**문서 종료**

> 💡 **Tip**: 이 체크리스트를 프린트하거나 Notion/Trello에 옮겨서 진행 상황을 추적하세요!
