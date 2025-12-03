# Narabi (나라비) - 순번 대기 관리 시스템

일본 시장을 타겟으로 한 매장 순번 대기 관리 서비스입니다.
LINE 메신저와 연동하여 손님이 QR 코드로 간편하게 대기 등록을 하고, 호출 알림을 받을 수 있습니다.
현재 1인 개발로 진행되고 있는 프로젝트입니다.

## 🛠 기술 스택 (Tech Stack)

- **Frontend**: Vue 3, TypeScript, Vite
- **Backend / Infrastructure**: Firebase (Authentication, Firestore, Cloud Functions, Hosting, Storage)
- **Integration**: LINE Login API, LINE Messaging API

## ✨ 주요 기능

### 매장용 (Store)

- **매장 관리**: 매장 정보 등록, 수정 및 승인 요청
- **대기열 관리**: 실시간 대기자 확인, 호출, 입장 완료 및 취소 처리
- **QR 코드**: 대기 등록용 QR 코드 생성 및 다운로드
- **스태프 관리**: 스태프 초대, 권한 관리, 표시명 변경
- **이력 조회**: 방문 완료 및 취소된 고객 이력 조회

### 손님용 (Customer)

- **간편 대기 등록**: 매장 QR 코드를 스캔하여 LINE 로그인으로 간편하게 대기 등록
- **실시간 확인**: 내 앞의 대기 팀 수와 예상 대기 시간 확인
- **알림 수신**: 순번 도래 시 LINE 메시지로 호출 알림 수신

## 🚀 시작하기 (Getting Started)

### 1. 사전 요구사항

- Node.js (v18 이상 권장)
- Firebase CLI (`npm install -g firebase-tools`)

### 2. 설치 (Installation)

```bash
# 레포지토리 클론
git clone [repository-url]
cd narabi

# 프론트엔드 의존성 설치
npm install

# Cloud Functions 의존성 설치
cd functions
npm install
cd ..
```

### 3. 환경 변수 설정 (Environment Variables)

프로젝트 루트에 `.env` 파일을 생성하고 Firebase 설정 정보를 입력하세요.

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. 로컬 실행 (Running Locally)

**프론트엔드 개발 서버 실행:**

```bash
npm run dev
```

**Firebase 에뮬레이터 실행 (Functions, Firestore 등 로컬 테스트):**

```bash
firebase emulators:start
```

> **Note**: 로컬 에뮬레이터 사용 시 `src/firebase.ts` 및 `functions/src/index.ts`의 에뮬레이터 연결 코드가 활성화됩니다.

## 📦 배포 (Deployment)

`package.json`에 정의된 스크립트를 사용하여 배포할 수 있습니다.

- **전체 배포 (빌드 포함)**:

  ```bash
  npm run deploy:all
  ```

- **Hosting만 배포**:

  ```bash
  npm run deploy
  ```

- **Functions만 배포**:

  ```bash
  npm run deploy:functions
  ```

## 🔐 보안 및 시크릿 (Secrets)

Cloud Functions에서 LINE API 연동을 위해 Firebase Secrets를 사용합니다.
배포 전 다음 시크릿 키들이 설정되어 있어야 합니다.

- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `MESSAGING_API_CHANNEL_ACCESS_TOKEN`

**시크릿 설정 방법:**

```bash
firebase functions:secrets:set LINE_LOGIN_CHANNEL_ID
# 프롬프트에 따라 값 입력
```

## 📂 프로젝트 구조

```
narabi/
├── src/                # Vue.js 프론트엔드 소스
│   ├── components/     # 재사용 가능한 컴포넌트
│   ├── views/          # 페이지 뷰
│   ├── stores/         # Pinia 상태 관리
│   ├── firebase.ts     # Firebase 초기화 및 설정
│   └── ...
├── functions/          # Firebase Cloud Functions (백엔드 로직)
│   ├── src/index.ts    # 메인 함수 진입점
│   └── ...
├── firestore.rules     # Firestore 보안 규칙
├── storage.rules       # Storage 보안 규칙
└── firebase.json       # Firebase 호스팅 및 에뮬레이터 설정
```
