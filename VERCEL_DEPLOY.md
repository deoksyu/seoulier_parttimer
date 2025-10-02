# Vercel 배포 가이드

## 사전 준비

1. **Vercel 계정 생성**
   - https://vercel.com 에서 GitHub 계정으로 가입

2. **Vercel CLI 설치** (선택사항)
   ```bash
   npm install -g vercel
   ```

## 배포 방법

### 방법 1: Vercel 웹사이트에서 배포 (추천)

1. **GitHub에 코드 푸시**
   ```bash
   cd /Users/a./Desktop/vscode/seoulier_parttimer
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Vercel에서 프로젝트 import**
   - https://vercel.com/new 접속
   - GitHub 저장소 선택
   - "Import" 클릭

3. **프로젝트 설정**
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (루트)
   - **Build Command**: `cd client && npm install && npm run build`
   - **Output Directory**: `client/dist`

4. **환경 변수 설정**
   - Settings > Environment Variables로 이동
   - 다음 변수 추가:
     ```
     VITE_API_URL=/api
     ```

5. **Deploy 클릭**

### 방법 2: Vercel CLI로 배포

1. **Vercel 로그인**
   ```bash
   vercel login
   ```

2. **프로젝트 배포**
   ```bash
   cd /Users/a./Desktop/vscode/seoulier_parttimer
   vercel
   ```

3. **질문에 답변**
   - Set up and deploy? **Y**
   - Which scope? (계정 선택)
   - Link to existing project? **N**
   - Project name? **seoulier-parttimer**
   - In which directory is your code located? **./client**

4. **프로덕션 배포**
   ```bash
   vercel --prod
   ```

## 배포 후 확인사항

1. **URL 확인**
   - Vercel이 제공하는 URL로 접속 (예: https://seoulier-parttimer.vercel.app)

2. **기능 테스트**
   - 로그인 테스트
   - 출퇴근 기능 테스트
   - 관리자 기능 테스트

3. **데이터베이스 주의사항**
   - Vercel의 Serverless Functions는 stateless이므로 `/tmp` 디렉토리의 데이터는 영구적이지 않습니다
   - 프로덕션 환경에서는 외부 데이터베이스 사용을 권장합니다 (Supabase, PlanetScale 등)

## 커스텀 도메인 설정 (선택사항)

1. Vercel 프로젝트 > Settings > Domains
2. 도메인 추가
3. DNS 설정 업데이트

## 문제 해결

### API 호출 실패
- Vercel 대시보드 > Functions 탭에서 로그 확인
- CORS 설정 확인

### 빌드 실패
- Vercel 대시보드 > Deployments에서 빌드 로그 확인
- package.json 의존성 확인

### 데이터베이스 초기화 문제
- Serverless Functions는 매 요청마다 새로 시작될 수 있음
- 영구 데이터베이스 솔루션으로 마이그레이션 필요

## 다음 단계

프로덕션 환경을 위한 개선사항:

1. **외부 데이터베이스 사용**
   - Supabase PostgreSQL
   - PlanetScale MySQL
   - MongoDB Atlas

2. **환경 변수 보안**
   - 비밀번호 해싱 (bcrypt)
   - JWT 토큰 인증

3. **모니터링**
   - Vercel Analytics 활성화
   - 에러 로깅 (Sentry)

## 참고 링크

- [Vercel 문서](https://vercel.com/docs)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
