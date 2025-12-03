import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 변수들을 먼저 선언합니다
let auth: Auth
let db: Firestore
let storage: FirebaseStorage
let functions: Functions

// 🚨 CI 환경이거나 테스트 중인지 확인
// (any 에러 방지를 위해 unknown으로 2중 캐스팅을 사용합니다)
if (import.meta.env.CI || process.env.NODE_ENV === 'test') {
  console.log('🧪 CI/Test 환경 감지됨: Firebase 연결을 차단하고 Mock 객체를 사용합니다.')

  // 빈 객체({})를 unknown으로 먼저 변환 후, 원하는 타입으로 강제 변환하면 에러가 나지 않습니다.
  auth = {} as unknown as Auth
  db = {} as unknown as Firestore
  storage = {} as unknown as FirebaseStorage
  functions = {} as unknown as Functions
} else {
  // 🚀 실제 환경(개발/배포)일 때만 초기화 수행
  const app = initializeApp(firebaseConfig)

  auth = getAuth(app)
  db = getFirestore(app)
  storage = getStorage(app)
  functions = getFunctions(app)

  // 로컬 에뮬레이터 연결 (localhost일 때만)
  if (location.hostname === 'localhost') {
    console.log('🔧 Localhost detected. Connecting to Emulators...')
    try {
      connectFirestoreEmulator(db, 'localhost', 8080)
      connectAuthEmulator(auth, 'http://localhost:9099')
      connectStorageEmulator(storage, 'localhost', 9199)
      connectFunctionsEmulator(functions, 'localhost', 5001)
    } catch (e) {
      console.warn('에뮬레이터 연결 중 경고(이미 연결됨 등):', e)
    }
  }
}

export { auth, db, storage, functions }
